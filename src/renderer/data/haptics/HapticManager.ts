import { ButtplugClient, noopLogger } from '@zendrex/buttplug.js';
const filteredLogger = { ...noopLogger, error: console.error, warn: console.warn };

let WasmTransport: any = null;
function loadWasmTransport() {
  if (!WasmTransport) {
    try {
      WasmTransport = require('@zendrex/buttplug.js/wasm').WasmTransport;
    } catch (e) {
      console.warn('[Haptics] WASM transport not available:', e);
    }
  }
  return WasmTransport;
}

import { detectPlatform, HapticDevice } from './types';

const DEFAULT_WS_ENDPOINT = 'ws://127.0.0.1:12345';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class HapticManager {
  private client: ButtplugClient | null = null;
  private devices: HapticDevice[] = [];
  private connected = false;
  private lastError: string | null = null;
  private onDevicesChanged: ((devices: HapticDevice[]) => void) | null = null;
  private _scanning = false;
  private _restartCount = 0;
  private _maxRestarts = 5;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _awaitingConnection = false;
  private _bleRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  private _lastVibration: Map<number, number> = new Map();
  // private _onScanCycleStart: (() => void) | null = null; // deferred callback — disabled

  async connect(onDevicesChanged: (devices: HapticDevice[]) => void, transportMode: string = 'auto', wsEndpoint: string = DEFAULT_WS_ENDPOINT): Promise<void> {
    this._clearRestartTimer();
    this.onDevicesChanged = onDevicesChanged;
    const platform = detectPlatform();
    console.log('[BLE] Connecting, platform:', platform, 'transportMode:', transportMode);

    let transport: any;
    const useWasm = (transportMode === 'wasm') ||
      (transportMode === 'auto' && (platform === 'electron' || platform === 'capacitor-android' || platform === 'web-chrome'));

    console.log('[BLE] useWasm:', useWasm);

    if (useWasm) {
      let bluetoothAvailable = false;
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
          bluetoothAvailable = await Promise.race([
            (navigator as any).bluetooth.getAvailability(),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
          ]);
        }
      } catch { bluetoothAvailable = false; }
      console.log('[BLE] navigator.bluetooth available:', bluetoothAvailable);
      if (!bluetoothAvailable) {
        console.warn('[BLE] Web Bluetooth not available on this system, falling back to WebSocket');
        if (transportMode === 'wasm') {
          this.lastError = 'Web Bluetooth not available on this system. Use Intiface Central (WebSocket) transport instead.';
          return;
        }
        transport = wsEndpoint;
      } else {
        const WT = loadWasmTransport();
        if (WT) {
          try {
            transport = new WT();
          } catch (e) {
            console.warn('[Haptics] WASM transport creation failed, falling back to WebSocket:', e);
            transport = wsEndpoint;
          }
        } else {
          console.warn('[Haptics] WASM transport not available, using WebSocket');
          transport = wsEndpoint;
        }
      }
    } else {
      transport = wsEndpoint;
    }

    this.client = new ButtplugClient(transport, {
      clientName: 'FlipFlip Haptics',
      autoReconnect: true,
      reconnectDelay: 2000,
      maxReconnectDelay: 15000,
      maxReconnectAttempts: 5,
      logger: filteredLogger,
    });

    this.client.on('device.added', () => {
      console.log('[BLE] device.added event fired');
      this._scanning = false;
      this._awaitingConnection = false;
      this._restartCount = 0;
      this._clearRestartTimer();
      try { this.refreshDevices(); } catch (e) { console.error('[BLE] refreshDevices error in device.added:', e); }
      if (this._lastVibration.size > 0) {
        setTimeout(() => {
          for (const [idx, val] of this._lastVibration) {
            const dev = this.client?.devices.find(d => d.index === idx);
            if (dev && dev.canOutput('Vibrate')) {
              console.log('[BLE] Re-applying last vibration to device', idx, ':', val.toFixed(3));
              dev.vibrate(clamp01(val)).catch(() => {});
            }
          }
        }, 500);
      }
    });
    this.client.on('device.removed', () => {
      try { this.refreshDevices(); } catch (e) { console.error('[BLE] refreshDevices error in device.removed:', e); }
    });
    this.client.on('device.error', (data: any) => {
      console.error('[BLE] device.error:', data?.error?.message || data);
    });
    this.client.on('connection.error', (data: any) => {
      const msg = data?.error?.message || 'Connection error occurred';
      console.error('[BLE] connection.error:', msg);
      this.connected = false;
      this.devices = [];
      this.lastError = msg;
      this.onDevicesChanged?.([]);
      if (this._restartCount < this._maxRestarts) {
        this._restartCount++;
        this._awaitingConnection = false;
        console.log('[BLE] Scheduling reconnect after connection error (attempt', this._restartCount + '/' + this._maxRestarts + ')');
        this._restartTimer = setTimeout(async () => {
          try { await this.client?.stopScanning(); } catch {}
          (globalThis as any).gc?.();
          this.startScanning().catch((e) => console.warn('[BLE] Retry scan after connection error failed:', e?.message || e));
        }, 3000);
      } else {
        console.log('[BLE] Max restarts reached after connection error, stopping');
        this._scanning = false;
        this._awaitingConnection = false;
        this._clearRestartTimer();
      }
    });
    this.client.on('scan.finished', () => {
      console.log('[BLE] scan.finished, devices:', this.devices.length, 'scanning:', this._scanning, 'awaitingConnection:', this._awaitingConnection);
      if (this._awaitingConnection) {
        if (this.devices.length === 0 && this._restartCount < this._maxRestarts) {
          console.log('[BLE] Awaiting connection but no devices, retrying scan');
          this._awaitingConnection = false;
          this._restartCount++;
          this._restartTimer = setTimeout(async () => {
            try { await this.client?.stopScanning(); } catch {}
            (globalThis as any).gc?.();
            this.startScanning().catch((e) => console.warn('[BLE] Retry scan failed:', e?.message || e));
          }, 2000);
        } else if (this._restartCount >= this._maxRestarts) {
          console.log('[BLE] Max restarts reached while awaiting connection, stopping');
          this._scanning = false;
          this._awaitingConnection = false;
          this._clearRestartTimer();
        } else {
          console.log('[BLE] Awaiting connection, devices found — waiting');
        }
        return;
      }
      if (this._scanning && this.devices.length === 0 && this._restartCount < this._maxRestarts) {
        this._restartCount++;
        console.log('[BLE] Scheduling restart in 2s (attempt', this._restartCount + '/' + this._maxRestarts + ')');
        this._restartTimer = setTimeout(async () => {
          try { await this.client?.stopScanning(); } catch {}
          (globalThis as any).gc?.();
          this.startScanning().catch((e) => console.warn('[BLE] Retry scan failed:', e?.message || e));
        }, 2000);
      } else if (this._restartCount >= this._maxRestarts) {
        console.log('[BLE] Max restarts reached, stopping');
        this._scanning = false;
        this._clearRestartTimer();
      }
    });
    this.client.on('connection.disconnected', () => {
      console.log('[BLE] connection.disconnected');
      this.connected = false;
      this.devices = [];
      this.onDevicesChanged?.([]);
      if (this._restartCount < this._maxRestarts) {
        this._restartCount++;
        this._awaitingConnection = false;
        console.log('[BLE] Scheduling reconnect after disconnect (attempt', this._restartCount + '/' + this._maxRestarts + ')');
        this._restartTimer = setTimeout(async () => {
          try { await this.client?.stopScanning(); } catch {}
          (globalThis as any).gc?.();
          this.startScanning().catch((e) => console.warn('[BLE] Retry scan after disconnect failed:', e?.message || e));
        }, 3000);
      } else {
        console.log('[BLE] Max restarts reached after disconnect, stopping');
        this._scanning = false;
        this._awaitingConnection = false;
        this._clearRestartTimer();
      }
    });
    this.client.on('connection.reconnected', () => {
      console.log('[BLE] connection.reconnected');
      this.connected = true;
    });

    this._bleRejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason?.name === 'AggregateError' || reason?.message?.includes('listeners threw an error')) {
        console.warn('[BLE] WASM transport AggregateError caught:', reason.message || reason);
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', this._bleRejectionHandler);

    try {
      console.log('[BLE] Connecting to Buttplug server...');
      await this.client.connect();
      console.log('[BLE] Connected to Buttplug server');
      this.connected = true;
      this.lastError = null;
      await this.refreshDevices();
    } catch (err) {
      const isWebSocket = typeof transport === 'string';
      const msg = isWebSocket
        ? `Cannot reach Intiface Central at ${transport}. Ensure Intiface Central is installed and running.`
        : `Failed to connect Buttplug server: ${err instanceof Error ? err.message : err}`;
      console.warn('[BLE] ' + msg);
      this.lastError = msg;
      this.connected = false;
      await this.disconnect();
    }
  }

  private async refreshDevices(): Promise<void> {
    if (!this.client) return;
    this.devices = this.client.devices.map(d => {
      const motors: Array<{index: number; type: string; description: string; minValue: number; maxValue: number}> = [];
      if (d.features?.outputs) {
        for (const o of d.features.outputs) {
          const desc = (o as any).description || '';
          const range = (o as any).range;
          const min = range?.[0] ?? 0;
          const max = range?.[1] ?? 100;
          motors.push({
            index: o.index,
            type: o.type,
            description: desc,
            minValue: min,
            maxValue: max,
          });
        }
      }
      // Some drivers / the mobile Web Bluetooth polyfill report a device that
      // can vibrate but carry no output-feature metadata. Expose a single
      // motor so the Motor slider is shown AND honored, instead of silently
      // driving the toy at full mode intensity (which used to happen in the
      // zero-motor fallback path).
      if (motors.length === 0 && typeof (d as any).canOutput === 'function' && (d as any).canOutput('Vibrate')) {
        motors.push({ index: 0, type: 'Vibrate', description: 'Vibrator', minValue: 0, maxValue: 1 });
      }
      return {
        index: d.index,
        name: d.name,
        displayName: d.displayName,
        outputs: d.features?.outputs?.map(o => o.type) ?? ['Vibrate'],
        motors,
      };
    });
    console.log('[BLE] refreshDevices: found', this.devices.length, 'devices:', this.devices.map(d => d.name));
    this.onDevicesChanged?.(this.devices);
  }

  async vibrate(deviceIndex: number, intensity: number, motorIndex?: number): Promise<void> {
    if (!this.client || !this.connected) return;
    const device = this.client.devices.find(d => d.index === deviceIndex);
    if (!device) return;
    if (!device.canOutput('Vibrate')) return;
    if (motorIndex !== undefined) {
      const val = clamp01(intensity);
      this._lastVibration.set(deviceIndex, val);
      await device.vibrate([{ index: motorIndex, value: val }]);
    } else {
      const val = clamp01(intensity);
      this._lastVibration.set(deviceIndex, val);
      await device.vibrate(val);
    }
  }

  async vibrateMulti(deviceIndex: number, motorValues: Array<{ index: number; value: number }>): Promise<void> {
    if (!this.client || !this.connected) return;
    const device = this.client.devices.find(d => d.index === deviceIndex);
    if (!device) {
      console.log('[Haptic] vibrateMulti: no device at index', deviceIndex, 'available indices:', this.client.devices.map(d => d.index));
      return;
    }
    if (!device.canOutput('Vibrate')) return;
    const clamped = motorValues.map(m => ({ index: m.index, value: clamp01(m.value) }));
    const avg = clamped.reduce((s, m) => s + m.value, 0) / Math.max(1, clamped.length);
    this._lastVibration.set(deviceIndex, avg);
    await device.vibrate(motorValues);
  }

  async stopAll(): Promise<void> {
    if (this.client) {
      await this.client.stopAll();
    }
  }

  getDevices(): HapticDevice[] {
    return [...this.devices];
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this._scanning = false;
    this._clearRestartTimer();
    if (this._bleRejectionHandler) {
      window.removeEventListener('unhandledrejection', this._bleRejectionHandler);
      this._bleRejectionHandler = null;
    }
    if (this.client) {
      try { await this.client.stopAll(); } catch {}
      try { await this.client.disconnect(); } catch {}
      try { this.client.dispose(); } catch {}
      this.client = null;
    }
    this.connected = false;
    this.devices = [];
  }

  // Deferred callback: disabled in favor of auto-select in main.ts
  // setScanCycleStartCallback(cb: (() => void) | null): void {
  //   this._onScanCycleStart = cb;
  // }

  setAwaitingConnection(v: boolean): void {
    this._awaitingConnection = v;
  }

  async startScanning(): Promise<boolean> {
    if (!this.client) {
      console.log('[BLE] startScanning: no client');
      this.lastError = 'No client initialized. Connect first.';
      return false;
    }
    if (!this.connected) {
      console.log('[BLE] startScanning: not connected');
      this.lastError = 'Not connected to Buttplug server.';
      return false;
    }
    try {
      console.log('[BLE] startScanning: starting scan, restart:', this._restartCount);
      await this.client.startScanning();
      console.log('[BLE] startScanning: scan started');
      this._scanning = true;
      this.lastError = null;
      return true;
    } catch (err) {
      const msg = `Scan failed: ${err instanceof Error ? err.message : err}`;
      console.warn('[BLE] ' + msg);
      this.lastError = msg;
      return false;
    }
  }

  async stopScanning(): Promise<void> {
    this._scanning = false;
    this._clearRestartTimer();
    if (this.client) {
      try {
        await this.client.stopScanning();
      } catch (err) {
        console.warn('[Haptics] Failed to stop scanning:', err);
      }
    }
  }

  private _clearRestartTimer(): void {
    if (this._restartTimer !== null) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }
}
