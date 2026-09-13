import { ISystemAudioCapture } from './ISystemAudioCapture';
import { NoOpCapture } from './NoOpCapture';
import { ElectronLinuxCapture } from './ElectronLinuxCapture';
import { ElectronWinCapture } from './ElectronWinCapture';
import { ElectronMacCapture } from './ElectronMacCapture';
import { PlatformType } from '../haptics/types';

export function createSystemAudioCapture(platform: PlatformType): ISystemAudioCapture {
  const os = process.platform;

  if (platform === 'electron') {
    switch (os) {
      case 'linux':   return new ElectronLinuxCapture();
      case 'win32':   return new ElectronWinCapture();
      case 'darwin':  return new ElectronMacCapture();
      default:        return new NoOpCapture();
    }
  }

  if (platform === 'capacitor-android') {
    return new NoOpCapture();
  }

  return new NoOpCapture();
}
