import { ISystemAudioCapture, CaptureDevice, CaptureResult } from './ISystemAudioCapture';

const VIRTUAL_DEVICE: CaptureDevice = {
  id: 'system-loopback',
  label: 'System Audio (Loopback)',
  groupId: 'system-loopback',
  isMonitor: true,
  isRunning: true,
};

export class ElectronWinCapture implements ISystemAudioCapture {
  private currentStream: MediaStream | null = null;
  private loopback: MediaStream | null = null;
  private cachedDevices: CaptureDevice[] = [];

  isAvailable(): boolean { return true; }

  async enumerateDevices(): Promise<CaptureDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map(d => ({
          id: d.deviceId, label: d.label || 'Unknown', groupId: d.groupId,
          isMonitor: /stereo.?mix|wave.?out|loopback|what.?u.?hear/i.test(d.label),
          isRunning: true,
        }));
      audioInputs.sort((a, b) => {
        if (a.isMonitor && !b.isMonitor) return -1;
        if (!a.isMonitor && b.isMonitor) return 1;
        return a.label.localeCompare(b.label);
      });
      this.cachedDevices = audioInputs;
      return audioInputs;
    } catch { return this.cachedDevices; }
  }

  getCachedDevices(): CaptureDevice[] { return this.cachedDevices; }

  /**
   * Capture system audio directly via WASAPI loopback: Chromium on Windows
   * exposes the default playback device as the audio track of a desktop share,
   * so no Stereo Mix / virtual driver is required.
   */
  async createLoopback(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5, max: 8 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
        },
      });
      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('System audio was not included in the share. Enable "Also share system audio" and try again.');
      }
      // Keep the video track (stopping it can drop the audio track on some
      // Chromium builds); it is simply never rendered.
      this.loopback = stream;
      return true;
    } catch (err) {
      console.warn('[SystemAudio] Loopback via display share failed:', (err as Error)?.message || err);
      return false;
    }
  }

  async startCapture(deviceId?: string): Promise<CaptureResult> {
    this.stopCapture();

    if (deviceId && deviceId !== VIRTUAL_DEVICE.id) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.currentStream = stream;
      return { stream, device: this.cachedDevices.find(d => d.id === deviceId)! };
    }

    // Either a monitor input (Stereo Mix / What U Hear) already exists, or use
    // the WASAPI system-loopback share.
    const monitor = deviceId === VIRTUAL_DEVICE.id ? VIRTUAL_DEVICE : this.cachedDevices.find(d => d.isMonitor);
    if (monitor) {
      if (monitor.id === VIRTUAL_DEVICE.id || this.loopback) {
        if (!this.loopback) await this.createLoopback();
        if (this.loopback) {
          this.currentStream = this.loopback;
          return { stream: this.loopback, device: VIRTUAL_DEVICE };
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: monitor.id }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.currentStream = stream;
      return { stream, device: monitor };
    }

    if (await this.createLoopback() && this.loopback) {
      this.currentStream = this.loopback;
      return { stream: this.loopback, device: VIRTUAL_DEVICE };
    }

    throw new Error('No system audio available. Enable Stereo Mix in Windows Sound settings, or allow the system-audio share prompt.');
  }

  stopCapture(): void {
    if (this.currentStream) { this.currentStream.getTracks().forEach(t => t.stop()); this.currentStream = null; }
    if (this.loopback) { this.loopback.getTracks().forEach(t => t.stop()); this.loopback = null; }
  }

  getStatus(): string {
    if (this.loopback) return 'Windows (system loopback)';
    const monitor = this.cachedDevices.find(d => d.isMonitor);
    if (monitor) return `Windows: ${monitor.label}`;
    return 'Windows (ready)';
  }

  dispose(): void { this.stopCapture(); }
}
