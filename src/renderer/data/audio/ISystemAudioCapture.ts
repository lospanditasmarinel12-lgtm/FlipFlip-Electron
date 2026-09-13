export interface CaptureDevice {
  id: string;
  label: string;
  groupId: string;
  isMonitor: boolean;
  isRunning: boolean;
}

export interface CaptureResult {
  stream: MediaStream;
  device: CaptureDevice;
  monitorSinkId?: string;
}

export interface RoutingCheck {
  ok: boolean;
  detail: string;
}

export interface ISystemAudioCapture {
  isAvailable(): boolean;
  enumerateDevices(): Promise<CaptureDevice[]>;
  getCachedDevices(): CaptureDevice[];
  createLoopback(): Promise<boolean>;
  startCapture(deviceId?: string): Promise<CaptureResult>;
  stopCapture(): void;
  getStatus(): string;
  dispose(): void;
  verifyRouting?(): Promise<RoutingCheck>;
  repairRouting?(): Promise<RoutingCheck>;
  listMonitorSinks?(): Promise<Array<{ id: string; label: string }>>;
  getMonitorSinkId?(preferred?: string): Promise<string | null>;
}
