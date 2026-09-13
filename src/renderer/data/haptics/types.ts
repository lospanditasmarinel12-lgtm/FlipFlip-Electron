export interface HapticMotor {
  index: number;
  type: string;
  description: string;
  minValue: number;
  maxValue: number;
}

export interface HapticDevice {
  index: number;
  name: string;
  displayName?: string;
  outputs: string[];
  motors: HapticMotor[];
}

export interface AudioAnalysisFrame {
  timestamp: number;
  rms: number;
  rmsRaw: number;
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  sampleRate: number;
}

export interface HapticConfig {
  enabled: boolean;
  intensity: number;
  pattern: HapticPattern;
  directGain: number;
  directSmoothing: number;
  bassGain: number;
  melodyGain: number;
  voiceGain: number;
  beatThreshold: number;
  beatCooldownMs: number;
}

export enum HapticPattern {
  direct = 'direct',
  bass = 'bass',
  beat = 'beat',
  melody = 'melody',
  voice = 'voice',
}

export type PlatformType = 'electron' | 'capacitor-android' | 'capacitor-ios' | 'web-chrome' | 'web-unsupported';

export function detectPlatform(): PlatformType {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('electron')) return 'electron';
  if ((window as any).Capacitor) {
    if (ua.includes('android')) return 'capacitor-android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'capacitor-ios';
  }
  if (ua.includes('chrome') || ua.includes('edg')) return 'web-chrome';
  return 'web-unsupported';
}

export function hasWebBluetooth(): boolean {
  return !!(navigator as any).bluetooth;
}
