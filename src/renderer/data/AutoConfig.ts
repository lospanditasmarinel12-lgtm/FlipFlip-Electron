export interface DisplayAutoConfig {
  maxInMemory: number;
  maxInHistory: number;
  maxLoadingAtOnce: number;
  cacheMaxSizeMB: number;
  maxDecodedImages: number;
}

export function computeDisplayAutoConfig(
  _systemRAM_MB: number,
  _vramMB: number,
  _isDedicatedGPU: boolean,
  _hasRiskyGPU: boolean,
  _isRemoteSession: boolean,
): DisplayAutoConfig {
  return {
    maxInMemory: 8,
    maxInHistory: 5,
    maxLoadingAtOnce: 2,
    cacheMaxSizeMB: 250,
    maxDecodedImages: 4,
  };
}
