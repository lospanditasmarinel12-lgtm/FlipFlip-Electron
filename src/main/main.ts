import { app, BrowserWindow, Menu, protocol as electronProtocol, net, session, ipcMain, desktopCapturer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { initializeIpcEvents, getBluetoothCallback, releaseIpcEvents, setBluetoothCallback } from './IPCEvents';
import { createMainMenu, createMenuTemplate } from './MainMenu';
import {createNewWindow, startScene} from "./WindowManager";
import {IPC} from "../renderer/data/const";

require('@electron/remote/main').initialize();

electronProtocol.registerSchemesAsPrivileged([
  { scheme: 'flipflip', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  electronProtocol.handle('flipflip', async (request) => {
    const raw = decodeURI(request.url.replace('flipflip://./', ''));
    let filePath: string;
    if (raw.startsWith('/')) {
      filePath = 'file://' + raw;
    } else {
      const absTry = '/' + raw;
      if (raw.length > 0 && !raw.startsWith(__dirname) && fs.existsSync(absTry)) {
        filePath = 'file://' + absTry;
      } else {
        filePath = 'file://' + path.join(__dirname, raw);
      }
    }

    const res = await net.fetch(filePath);

    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
      '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
      '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
    };
    const ext = raw.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
    const mime = mimeMap[ext];

    if (mime) {
      const headers: Record<string, string> = {};
      res.headers.forEach((value: string, key: string) => {
        headers[key] = value;
      });
      headers['Content-Type'] = mime;
      if (!headers['Accept-Ranges']) {
        headers['Accept-Ranges'] = 'bytes';
      }
      if (!headers['Content-Length']) {
        const realPath = filePath.replace('file://', '');
        headers['Content-Length'] = String(fs.statSync(realPath).size);
      }
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    }
    return res;
  });

  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
      }
    })
  });

  // The app already relies on permissive defaults (e.g. getUserMedia works
  // with no permission handler). Be explicit: keep everything allowed and
  // additionally grant 'select-audio-output' so the system-audio monitor can
  // route BlackHole playback to the physical speakers via setSinkId().
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return true;
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if ((permission as string) === 'select-audio-output') {
      console.log('[Permission] granted audio output selection');
    }
    callback(true);
  });

  // Renderer getDisplayMedia() (Windows system-audio haptics capture) only
  // works when the main process resolves the request here. 'audio: loopback'
  // attaches the default output device via WASAPI with no picker dialog.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: { id: sources[0].id, name: sources[0].name }, audio: 'loopback' });
      } else {
        callback({});
      }
    }).catch((e) => {
      console.warn('[SystemAudio] display media request failed:', e);
      callback({});
    });
  });

  createNewWindow();
  createMainMenu(Menu, createMenuTemplate(app));
  initializeIpcEvents();

  // Ensure the image cache root exists up-front so first-run audio-cover /
  // thumbnail writes don't hit a missing `…/flipflip/ImageCache` directory.
  try {
    fs.mkdirSync(path.join(app.getPath('appData'), 'flipflip', 'ImageCache'), { recursive: true });
  } catch (e) {
    console.warn('[flipflip] could not pre-create ImageCache dir:', e);
  }

  // This could be improved, but there are only two command line options currently
  const sceneName = process.argv.find((el, i, arr) => el != '--no-dev-tools' && !el.endsWith('electron.exe') && !el.endsWith('electron') && !el.endsWith('bundle.js'));
  if (sceneName) {
    setTimeout(startScene.bind(null, sceneName), 1500);
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  releaseIpcEvents();
  app.quit();
});

app.commandLine.appendSwitch('js-flags', '--expose_gc --max-old-space-size=1024')
app.commandLine.appendSwitch('--autoplay-policy','no-user-gesture-required')
// app.commandLine.appendSwitch('--disable-vulkan')  // re-enable if Vulkan causes rendering issues
app.commandLine.appendSwitch('enable-features', 'WebBluetooth')

let mainWindow: BrowserWindow | null = null;

export function wireBluetoothEvents(win: BrowserWindow) {
  mainWindow = win;

  let _bleTimeout: ReturnType<typeof setTimeout> | null = null;

  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    console.log('[BLE] select-bluetooth-device fired, devices:', deviceList.length, deviceList.map((d: any) => d.deviceName || d.deviceId));

    // Auto-select if only one device found
    if (deviceList.length === 1) {
      const device = deviceList[0];
      console.log('[BLE] Auto-selecting single device:', device.deviceName, device.deviceId);
      // Clear any stale pending callback and timeout from a prior event
      // so the 30s timeout doesn't fire later and abort the connection
      setBluetoothCallback(null);
      if (_bleTimeout) { clearTimeout(_bleTimeout); _bleTimeout = null; }
      callback(device.deviceId);
      return;
    }

    if (getBluetoothCallback()) {
      console.log('[BLE] Cancelling previous pending callback');
      getBluetoothCallback()?.('');
    }
    setBluetoothCallback(callback);

    win.webContents.send(IPC.bleDevices, deviceList);

    if (_bleTimeout) { clearTimeout(_bleTimeout); _bleTimeout = null; }
    _bleTimeout = setTimeout(() => {
      if (getBluetoothCallback() === callback) {
        console.log('[BLE] 30s timeout - auto-cancelling callback');
        setBluetoothCallback(null);
        _bleTimeout = null;
        callback('');
        win.webContents.send(IPC.bleSelectionTimeout);
      }
    }, 30000);
  });

  // Deferred callback: disabled in favor of auto-select above
  // ipcMain.on(IPC.bleDeferredSelect, (_ev, deviceId: string) => {
  //   console.log('[BLE] Deferred device select, storing ID:', deviceId);
  //   deferredDeviceId = deviceId;
  // });
}