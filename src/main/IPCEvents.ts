import { app, ipcMain, IpcMainEvent } from 'electron'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { createNewWindow } from './WindowManager'
import { createLoopbackSource, cleanupAllLoopbacks } from './SystemAudioCapture'
import { getSystemCapabilities } from './SystemCapabilities'
import {IPC} from "../renderer/data/const";

let _pendingBluetoothCallback: ((deviceId: string) => void) | null = null;

// Locate the CoreAudio helper. Packaged builds bundle it in
// Contents/Resources; dev builds (npm start) run from the repo, where
// process.resourcesPath points at Electron's own resources instead.
function resolveAudioHelper(): string {
  if (process.env.FLIPFLIP_AUDIO_HELPER) return process.env.FLIPFLIP_AUDIO_HELPER;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const candidates = [
    path.join(process.resourcesPath, 'flipflip_audio_helper'),
    path.join(app.getAppPath(), 'audio_helper', 'build', `flipflip_audio_helper_${arch}`),
    path.join(app.getAppPath(), 'build', 'audio-setup', `flipflip_audio_helper_${arch}`),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* keep looking */ }
  }
  return candidates[0];
}

// Define functions
function onRequestCreateNewWindow(ev: IpcMainEvent) {
  createNewWindow();
}

function onBleDeviceSelected(ev: IpcMainEvent, deviceId: string) {
  console.log('[BLE] onBleDeviceSelected, deviceId:', deviceId || '(cancelled)');
  if (_pendingBluetoothCallback) {
    console.log('[BLE] Calling pending callback with:', deviceId);
    _pendingBluetoothCallback(deviceId);
    _pendingBluetoothCallback = null;
  } else {
    console.log('[BLE] No pending callback!');
  }
}

export function setBluetoothCallback(cb: ((deviceId: string) => void) | null) {
  _pendingBluetoothCallback = cb;
}

export function getBluetoothCallback(): ((deviceId: string) => void) | null {
  return _pendingBluetoothCallback;
}


// Initialize and release listeners
let initialized = false;
export function initializeIpcEvents() {
  if (initialized) {
    return;
  }

  initialized = true;
  ipcMain.on(IPC.newWindow, onRequestCreateNewWindow);
  ipcMain.on(IPC.bleDeviceSelected, onBleDeviceSelected);

  ipcMain.handle(IPC.systemAudioCreateLoopback, async () => {
    try {
      const result = await createLoopbackSource();
      return { success: true, ...result };
    } catch (err) {
      console.error('[SystemAudio] Failed to create loopback:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.on(IPC.systemAudioCleanupLoopback, () => {
    cleanupAllLoopbacks();
  });

  ipcMain.handle(IPC.systemAudioMacMultiOutput, async (_ev, action: string = 'create', arg?: string) => {
    try {
      const helper = resolveAudioHelper();
      const args = arg ? [action, arg] : [action];
      // 'level' captures ~1s of audio; give it headroom beyond the default.
      const timeout = action === 'level' ? 30000 : 15000;
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(helper, args, { timeout }, (err, so, se) => {
          if (err) return reject(new Error(err.message + (se ? ' ' + se : '')));
          resolve(so);
        });
      });
      return JSON.parse(stdout);
    } catch (err) {
      console.error('[SystemAudio] macOS multi-output helper failed:', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC.systemCapabilities, async () => {
    try {
      return getSystemCapabilities();
    } catch (err) {
      console.error('[SystemCapabilities] Failed:', err);
      return null;
    }
  });
}

export function releaseIpcEvents() {
  if (initialized) {
    cleanupAllLoopbacks();
    ipcMain.removeAllListeners(IPC.newWindow);
    ipcMain.removeAllListeners(IPC.bleDeviceSelected);
    ipcMain.removeHandler(IPC.systemAudioCreateLoopback);
    ipcMain.removeAllListeners(IPC.systemAudioCleanupLoopback);
    ipcMain.removeHandler(IPC.systemAudioMacMultiOutput);
    ipcMain.removeHandler(IPC.systemCapabilities);
  }

  initialized = false;
}