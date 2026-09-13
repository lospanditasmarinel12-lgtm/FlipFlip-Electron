export interface FileMediaInfo {
  width: number;
  height: number;
  fileSize: number;
  bitrate?: number;
  duration?: number;
  format: string;
  lastModified: number;
}

export type MediaInfoMap = Map<string, FileMediaInfo>;

export function estimatedGPU_MemCost(width: number, height: number): number {
  return width * height * 4;
}

export function estimatedTotalMemoryCost(width: number, height: number, fileSize: number): number {
  return estimatedGPU_MemCost(width, height) + fileSize;
}

export function isHeavyMedia(info: FileMediaInfo): boolean {
  return (
    info.fileSize > 5 * 1024 * 1024 ||
    info.width * info.height > 3840 * 2160 ||
    (info.duration != null && info.duration > 60)
  );
}

export function formatMediaType(ext: string): string {
  const m = ext.toLowerCase();
  const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'avif', 'heic', 'heif'];
  const videoFormats = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'ogv', 'm4v', 'flv', 'wmv'];

  if (imageFormats.some(f => m.endsWith(f))) return m.split('.').pop() || 'unknown';
  if (videoFormats.some(f => m.endsWith(f))) return m.split('.').pop() || 'unknown';
  return 'unknown';
}
