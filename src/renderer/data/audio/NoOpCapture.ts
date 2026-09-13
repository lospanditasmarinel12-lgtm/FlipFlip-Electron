import { ISystemAudioCapture, CaptureDevice, CaptureResult } from './ISystemAudioCapture';

export class NoOpCapture implements ISystemAudioCapture {
  isAvailable(): boolean { return false; }
  async enumerateDevices(): Promise<CaptureDevice[]> { return []; }
  getCachedDevices(): CaptureDevice[] { return []; }
  async createLoopback(): Promise<boolean> { return false; }
  async startCapture(_deviceId?: string): Promise<CaptureResult> {
    throw new Error('System audio capture not available on this platform');
  }
  stopCapture(): void {}
  getStatus(): string { return 'Not available'; }
  dispose(): void {}
}
