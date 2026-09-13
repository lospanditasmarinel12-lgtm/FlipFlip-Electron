import { execSync } from 'child_process';
import { cpus, totalmem } from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface SystemCapabilities {
  platform: 'linux' | 'win32' | 'darwin';
  displayServer: 'X11' | 'wayland' | 'unknown';
  gpuVendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
  gpuModel: string;
  vramMB: number;
  systemRAM_MB: number;
  cpuCores: number;
  isRemoteSession: boolean;
  isDedicatedGPU: boolean;
}

interface ParsedGPU {
  vendor: SystemCapabilities['gpuVendor'];
  model: string;
  vramMB: number;
  dedicated: boolean;
}

function detectRemoteSession(): boolean {
  const env = process.env;
  return !!(
    env.X2GO_SESSION ||
    env.RUSTDESK_CURRENT_SESSION ||
    env.RUSTDESK_NAME ||
    env.SSH_CONNECTION ||
    env.SSH_CLIENT ||
    env.SSH_TTY ||
    (env.XDG_SESSION_TYPE === 'x11' && env.REMOTE_HOST) ||
    (env.XDG_SESSION_TYPE && env.XDG_SESSION_TYPE.startsWith('mir'))
  );
}

function detectDisplayServer(): 'X11' | 'wayland' | 'unknown' {
  const xdgType = process.env.XDG_SESSION_TYPE;
  if (xdgType === 'wayland') return 'wayland';
  if (xdgType === 'x11') return 'X11';
  if (process.env.WAYLAND_DISPLAY) return 'wayland';
  if (process.env.DISPLAY) return 'X11';
  return 'unknown';
}

function detectGPULinux(): ParsedGPU[] {
  const gpus: ParsedGPU[] = [];
  const drmDir = '/sys/class/drm';

  if (!fs.existsSync(drmDir)) {
    return null;
  }

  const entries = fs.readdirSync(drmDir);

  for (const entry of entries) {
    const entryPath = path.join(drmDir, entry);
    const devicePath = path.join(entryPath, 'device');
    if (!fs.existsSync(devicePath)) continue;

    try {
      const vendorPath = path.join(devicePath, 'vendor');
      const deviceIdPath = path.join(devicePath, 'device');
      const vramPath = path.join(devicePath, 'mem_info_vram_total');
      const vramUsedPath = path.join(devicePath, 'mem_info_vram_used');
      const subsystemVendorPath = path.join(devicePath, 'subsystem_vendor');

      let vendorId = '';
      let deviceId = '';
      try { vendorId = fs.readFileSync(vendorPath, 'utf8').trim().replace('0x', ''); } catch (e) {}
      try { deviceId = fs.readFileSync(deviceIdPath, 'utf8').trim().replace('0x', ''); } catch (e) {}

      let vendor: SystemCapabilities['gpuVendor'] = 'unknown';
      const vLower = vendorId.toLowerCase();
      if (vLower === '10de') vendor = 'nvidia';
      else if (vLower === '1002') vendor = 'amd';
      else if (vLower === '8086') vendor = 'intel';

      let vramB = 0;
      try {
        const vramStr = fs.readFileSync(vramPath, 'utf8').trim();
        vramB = parseInt(vramStr, 10);
      } catch (e) {
        try {
          const vramUsedRaw = fs.readFileSync(vramUsedPath, 'utf8').trim();
          const vramUsed = parseInt(vramUsedRaw, 10);
          vramB = vramUsed > 0 ? vramUsed * 4 : 0;
        } catch (e2) {}
      }

      const vramMB = Math.round(vramB / (1024 * 1024));

      if (vramB === 0 && vendor === 'nvidia') {
        try {
          const nvpath = path.join(devicePath, 'mem_info');
          if (fs.existsSync(nvpath)) {
            const nvraw = fs.readFileSync(nvpath, 'utf8');
            const match = nvraw.match(/vram_total_bytes=(\d+)/);
            if (match) {
              vramB = parseInt(match[1], 10);
            }
          }
        } catch (e) {}
      }

      const finalVramMB = Math.round(vramB / (1024 * 1024));
      gpus.push({
        vendor,
        model: `${vendorId}:${deviceId}`,
        vramMB: finalVramMB > 0 ? finalVramMB : 0,
        dedicated: vendor !== 'intel',
      });
    } catch (e) {}
  }

  return gpus.length > 0 ? gpus : null;
}

function detectGPUWindows(): ParsedGPU[] {
  try {
    const output = execSync(
      'wmic path Win32_VideoController get AdapterRAM,Name,VideoProcessor /format:csv',
      { timeout: 5000, windowsHide: true }
    ).toString();

    const gpus: ParsedGPU[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.includes('Node,AdapterRAM,Name,VideoProcessor') || line.trim() === '') continue;

      const cols = line.split(',');
      const name = (cols[2] || '').trim();
      const ramBytes = parseInt((cols[1] || '0').trim(), 10);
      const vramMB = Math.round(ramBytes / (1024 * 1024));

      let vendor: SystemCapabilities['gpuVendor'] = 'unknown';
      const nLower = name.toLowerCase();
      if (nLower.includes('nvidia') || nLower.includes('nv')) vendor = 'nvidia';
      else if (nLower.includes('amd') || nLower.includes('radeon')) vendor = 'amd';
      else if (nLower.includes('intel') || nLower.includes('uhd') || nLower.includes('iris')) vendor = 'intel';

      gpus.push({
        vendor,
        model: name || 'Unknown GPU',
        vramMB: vramMB > 0 ? vramMB : 0,
        dedicated: vendor !== 'intel',
      });
    }

    return gpus.length > 0 ? gpus : null;
  } catch (e) {
    return null;
  }
}

function detectGPUMac(): ParsedGPU[] {
  try {
    const output = execSync(
      'system_profiler SPDisplaysDataType -json',
      { timeout: 10000 }
    ).toString();

    const data = JSON.parse(output);
    const displays = data?.SPDisplaysDataType || [];
    const gpus: ParsedGPU[] = [];

    for (const d of displays) {
      const name = d.sppci_model || '';
      const vramStr = d.spdisplays_vram || d.sppci_vram || '0';
      const vramMB = parseInt(vramStr.replace(/\D/g, ''), 10) || 0;

      let vendor: SystemCapabilities['gpuVendor'] = 'apple';
      const nLower = name.toLowerCase();
      if (nLower.includes('amd') || nLower.includes('radeon')) vendor = 'amd';
      else if (nLower.includes('nvidia')) vendor = 'nvidia';
      else if (nLower.includes('intel')) vendor = 'intel';
      else if (nLower.includes('apple') || nLower.includes('m1') || nLower.includes('m2') || nLower.includes('m3') || nLower.includes('m4')) vendor = 'apple';

      gpus.push({
        vendor,
        model: name || 'Apple GPU',
        vramMB: vramMB > 0 ? vramMB : 0,
        dedicated: false, // Apple Silicon is unified memory
      });
    }

    return gpus.length > 0 ? gpus : null;
  } catch (e) {
    return null;
  }
}

function parseGPUs(): ParsedGPU[] {
  switch (process.platform) {
    case 'linux': return detectGPULinux();
    case 'win32': return detectGPUWindows();
    case 'darwin': return detectGPUMac();
    default: return null;
  }
}

function pickPrimaryGPU(gpus: ParsedGPU[]): ParsedGPU | null {
  if (!gpus || gpus.length === 0) return null;

  const dedicated = gpus.filter(g => g.dedicated && g.vramMB > 0);
  if (dedicated.length > 0) {
    return dedicated.reduce((a, b) => (a.vramMB >= b.vramMB ? a : b));
  }

  return gpus.reduce((a, b) => (a.vramMB >= b.vramMB ? a : b));
}

export function detectSystemCapabilities(): SystemCapabilities {
  const platform = process.platform as SystemCapabilities['platform'];
  const displayServer = detectDisplayServer();
  const isRemoteSession = detectRemoteSession();
  const gpus = parseGPUs();
  const primaryGPU = pickPrimaryGPU(gpus || []);

  let gpuVendor: SystemCapabilities['gpuVendor'];
  let gpuModel: string;
  let vramMB: number;
  let isDedicatedGPU: boolean;

  if (primaryGPU) {
    gpuVendor = primaryGPU.vendor;
    gpuModel = primaryGPU.model;
    vramMB = primaryGPU.vramMB;
    isDedicatedGPU = primaryGPU.dedicated;
  } else {
    gpuVendor = platform === 'darwin' ? 'apple' : 'unknown';
    gpuModel = 'Unknown GPU';
    vramMB = detectFallbackVRAM(platform);
    isDedicatedGPU = false;
  }

  if (vramMB === 0) {
    vramMB = detectFallbackVRAM(platform);
  }

  return {
    platform,
    displayServer,
    gpuVendor,
    gpuModel,
    vramMB,
    systemRAM_MB: Math.round(totalmem() / (1024 * 1024)),
    cpuCores: cpus().length,
    isRemoteSession,
    isDedicatedGPU,
  };
}

function detectFallbackVRAM(platform: string): number {
  if (platform === 'darwin') {
    const ram = Math.round(totalmem() / (1024 * 1024));
    return ram > 12000 ? 8192 : (ram > 6000 ? 4096 : 2048);
  }

  try {
    if (fs.existsSync('/sys/class/drm')) {
      const cards = fs.readdirSync('/sys/class/drm').filter(e => e.startsWith('card'));
      for (const card of cards) {
        try {
          const devPath = path.join('/sys/class/drm', card, 'device');
          const vendorFile = path.join(devPath, 'vendor');
          if (fs.existsSync(vendorFile)) {
            const vendor = fs.readFileSync(vendorFile, 'utf8').trim().replace('0x', '');
            if (vendor === '10de') return 8192; // NVidia — guess 8GB
            if (vendor === '1002') return 4096; // AMD — guess 4GB
            if (vendor === '8086') return 1024; // Intel — guess 1GB
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return platform === 'win32' ? 4096 : 2048;
}

export function hasRiskyGPUConfig(caps: SystemCapabilities): boolean {
  return (
    caps.gpuVendor === 'nvidia' &&
    caps.platform === 'linux' &&
    caps.displayServer === 'X11'
  );
}

let _cachedCapabilities: SystemCapabilities | null = null;

export function getSystemCapabilities(): SystemCapabilities {
  if (!_cachedCapabilities) {
    _cachedCapabilities = detectSystemCapabilities();
  }
  return _cachedCapabilities;
}
