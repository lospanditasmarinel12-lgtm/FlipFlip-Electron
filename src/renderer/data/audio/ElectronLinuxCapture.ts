import { ipcRenderer } from 'electron';
import { ISystemAudioCapture, CaptureDevice, CaptureResult } from './ISystemAudioCapture';
import { IPC } from '../const';

export class ElectronLinuxCapture implements ISystemAudioCapture {
  private currentStream: MediaStream | null = null;
  private currentDevice: CaptureDevice | null = null;
  private cachedDevices: CaptureDevice[] = [];
  private loopbackCreated = false;

  isAvailable(): boolean {
    return true;
  }

  async enumerateDevices(): Promise<CaptureDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map(d => {
          const isMonitor = /monitor|loopback|remap|source\b|audio.?output|xtoy|flipflip|sink.*input/i.test(d.label);
          return {
            id: d.deviceId,
            label: d.label || `Unknown (${d.deviceId.slice(0, 8)}...)`,
            groupId: d.groupId,
            isMonitor,
            isRunning: true,
          };
        });

      audioInputs.sort((a, b) => {
        if (a.isMonitor && !b.isMonitor) return -1;
        if (!a.isMonitor && b.isMonitor) return 1;
        return a.label.localeCompare(b.label);
      });

      this.cachedDevices = audioInputs;
      console.log('[SystemAudio] Found devices:', audioInputs.map(d => `${d.label}${d.isMonitor ? ' (monitor)' : ''}`));
      return audioInputs;
    } catch (err) {
      console.warn('[SystemAudio] Failed to enumerate devices:', err);
      return this.cachedDevices;
    }
  }

  getCachedDevices(): CaptureDevice[] {
    return this.cachedDevices;
  }

  async createLoopback(): Promise<boolean> {
    try {
      console.log('[SystemAudio] Creating our own loopback source...');
      const result = await ipcRenderer.invoke(IPC.systemAudioCreateLoopback);
      if (result.success) {
        this.loopbackCreated = true;
        await new Promise(resolve => setTimeout(resolve, 800));
        await this.enumerateDevices();
        const ours = this.cachedDevices.find(d => d.label.toLowerCase().includes('flipflip'));
        if (ours) {
          console.log('[SystemAudio] Our loopback source ready:', ours.label);
        }
        return true;
      }
      console.warn('[SystemAudio] Loopback creation failed:', result.error);
      return false;
    } catch (err) {
      console.error('[SystemAudio] Loopback creation error:', err);
      return false;
    }
  }

  async startCapture(deviceId?: string): Promise<CaptureResult> {
    this.stopCapture();

    if (!deviceId) {
      // Always create our own loopback — never use external monitors
      const ours = this.cachedDevices.find(d => d.label.toLowerCase().includes('flipflip'));
      if (!ours) {
        const created = await this.createLoopback();
        if (!created) {
          throw new Error('Failed to create audio loopback source.');
        }
      }
      const ownDevice = this.cachedDevices.find(d => d.label.toLowerCase().includes('flipflip'));
      if (!ownDevice) {
        throw new Error('Loopback source not found after creation.');
      }
      deviceId = ownDevice.id;
    }

    const selected = this.cachedDevices.find(d => d.id === deviceId);
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.currentStream = stream;
    this.currentDevice = selected || null;
    console.log('[SystemAudio] Capturing from:', selected?.label || deviceId);

    return { stream, device: selected! };
  }

  stopCapture(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(t => t.stop());
      this.currentStream = null;
    }
  }

  getStatus(): string {
    if (this.currentDevice) {
      return `PipeWire: ${this.currentDevice.label}`;
    }
    if (this.cachedDevices.length > 0) {
      const monitors = this.cachedDevices.filter(d => d.isMonitor);
      if (monitors.length > 0) return `PipeWire (${monitors.length} monitor(s))`;
      return `PipeWire (${this.cachedDevices.length} input(s))`;
    }
    return 'PipeWire (ready)';
  }

  dispose(): void {
    this.stopCapture();
    this.currentDevice = null;
    this.cachedDevices = [];
    if (this.loopbackCreated) {
      ipcRenderer.send(IPC.systemAudioCleanupLoopback);
      this.loopbackCreated = false;
    }
  }
}
