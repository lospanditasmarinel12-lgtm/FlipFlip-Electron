import { webFrame } from 'electron';
import * as fs from 'fs';
import { execSync, exec } from 'child_process';

export type MemoryZone = 'green' | 'yellow' | 'orange' | 'red';

export interface GovernorState {
  zone: MemoryZone;
  warmWindowMultiplier: number;
  warmBudgetMB: number;
  warmItemCount: number;
  preloadMode: 'auto' | 'metadata' | 'none';
  cacheEnabled: boolean;
  purgeEnabled: boolean;
  purgeFraction: number;
  gcInterval: number;
  maxLoadingAtOnce: number;
  systemBudgetMB: number;
  systemUsedMB: number;
  heapRatio: number;
  gpuVramUsedPercent: number;
  gpuImageCount: number;
  gpuImageSizeMB: number;
  vramTotalMB: number;
  vramUsedMB: number;
  vramSource: 'sysfs' | 'nvidia-smi' | 'none';
  rssMB: number;
  rssRatio: number;
}

interface GPUVRAM {
  usedMB: number;
  totalMB: number;
  usedPercent: number;
  source: GovernorState['vramSource'];
}

type GovernorCallback = (state: GovernorState) => void;

interface ZoneConfig {
  warmWindowMultiplier: number;
  warmItemCount: number;
  preloadMode: 'auto' | 'metadata' | 'none';
  cacheEnabled: boolean;
  purgeEnabled: boolean;
  purgeFraction: number;
  gcInterval: number;
  maxLoadingAtOnce: number;
}

interface CachedBudget {
  total: number;
  free: number;
  used: number;
  ratio: number;
}

const ZONE_CONFIGS: Record<MemoryZone, ZoneConfig> = {
  green: {
    warmWindowMultiplier: 0.6,
    warmItemCount: 3,
    preloadMode: 'auto',
    cacheEnabled: true,
    purgeEnabled: false,
    purgeFraction: 0,
    gcInterval: 60000,
    maxLoadingAtOnce: -1,
  },
  yellow: {
    warmWindowMultiplier: 0.4,
    warmItemCount: 2,
    preloadMode: 'auto',
    cacheEnabled: true,
    purgeEnabled: false,
    purgeFraction: 0,
    gcInterval: 30000,
    maxLoadingAtOnce: -1,
  },
  orange: {
    warmWindowMultiplier: 0.25,
    warmItemCount: 1,
    preloadMode: 'auto',
    cacheEnabled: false,
    purgeEnabled: true,
    purgeFraction: 0.25,
    gcInterval: 15000,
    maxLoadingAtOnce: 2,
  },
  red: {
    warmWindowMultiplier: 0.10,
    warmItemCount: 1,
    preloadMode: 'none',
    cacheEnabled: false,
    purgeEnabled: true,
    purgeFraction: 1.0,
    gcInterval: 3000,
    maxLoadingAtOnce: 1,
  },
};

const RED_MIN_COUNT = 4;
const GREEN_MIN_COUNT = 6;
const SAMPLING_INTERVAL = 3000;
const BACKGROUND_REFRESH_INTERVAL = 10000;
const VRAM_POLL_INTERVAL = 30000;
const VRAM_RED_THRESHOLD = 0.90;
const VRAM_ORANGE_THRESHOLD = 0.75;
const VRAM_YELLOW_THRESHOLD = 0.58;

class MemoryGovernor {
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _bgRefreshId: ReturnType<typeof setTimeout> | null = null;
  private _gcIntervalId: ReturnType<typeof setInterval> | null = null;
  private _zone: MemoryZone = 'green';
  private _redCount = 0;
  private _greenCount = 0;
  private _callbacks: GovernorCallback[] = [];
  private _systemTotalRAM_MB: number;
  private _lastBudgetMB: number = 0;
  private _tick = 0;
  private _lastVRAMPoll = 0;
  private _cachedVRAM: GPUVRAM | null = null;
  private _startupTime: number;

  private _cachedBudget: CachedBudget | null = null;
  private _cachedGPUResources: { count: number; sizeMB: number } = { count: 0, sizeMB: 0 };
  private _bgRefreshPending = false;
  private _cachedMemAvailable = 0;

  private _timingLog: string[] = [];
  private _timingCount = 0;

  constructor(totalRAM_MB: number) {
    this._systemTotalRAM_MB = totalRAM_MB;
  }

  start() {
    if (this._intervalId) return;
    this._startupTime = Date.now();
    this._tick = 0;
    this._refreshCacheSync();
    this._doPoll();
    this._intervalId = setInterval(() => this._doPoll(), SAMPLING_INTERVAL);
    this._scheduleBackgroundRefresh();
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._bgRefreshId) {
      clearTimeout(this._bgRefreshId);
      this._bgRefreshId = null;
    }
    this._clearGC();
  }

  onGovernorState(cb: GovernorCallback): () => void {
    this._callbacks.push(cb);
    return () => {
      this._callbacks = this._callbacks.filter(c => c !== cb);
    };
  }

  getCurrentState(): GovernorState {
    return this._buildState(this._zone, this._cachedBudget || this._getBudgetFallback(), this._getHeapRatio(), this._getRSSRatio(), this._cachedGPUResources, this._cachedVRAM || this._getVRAMFallback());
  }

  private _scheduleBackgroundRefresh() {
    if (this._bgRefreshPending) return;
    this._bgRefreshPending = true;
    this._bgRefreshId = setTimeout(() => {
      this._bgRefreshPending = false;
      this._refreshCacheAsync();
      this._scheduleBackgroundRefresh();
    }, BACKGROUND_REFRESH_INTERVAL);
  }

  private _refreshCacheSync() {
    this._cachedBudget = this._getBudgetSync();
    this._cachedVRAM = this._getVRAMSync();
    this._cachedGPUResources = this._pollWebFrameGPU();
  }

  private _refreshCacheAsync() {
    this._updateBudgetAsync();
    this._updateVRAMAsync();
    this._updateGPUResourcesAsync();
  }

  private _updateBudgetAsync() {
    if (process.platform === 'linux') {
      fs.promises.readFile('/proc/meminfo', 'utf8').then(raw => {
        const match = raw.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (match) {
          this._cachedMemAvailable = parseInt(match[1], 10) * 1024;
        }
      }).catch(() => {});
    }

    try {
      const info = process.getSystemMemoryInfo();
      if (info && info.total > 0) {
        const total = Math.round((info.total * 1024) / (1024 * 1024));
        let freeBytes = info.free * 1024;
        if (process.platform === 'linux' && this._cachedMemAvailable > 0) {
          freeBytes = this._cachedMemAvailable;
        }
        const free = Math.round(freeBytes / (1024 * 1024));
        const safeFree = free > total ? total : free;
        const used = total - safeFree;
        const safeBudget = Math.round(safeFree * 0.7);
        this._lastBudgetMB = safeBudget;
        this._cachedBudget = { total, free, used, ratio: total > 0 ? used / total : 1 };
      }
    } catch (e) {
      this._cachedBudget = this._budgetFromHeapFallback();
    }
  }

  private _budgetFromHeapFallback(): CachedBudget | null {
    try {
      const memUsage = process.memoryUsage();
      const heapMB = Math.round(memUsage.heapUsed / (1024 * 1024));
      const ratio = this._lastBudgetMB > 0 ? heapMB / this._lastBudgetMB : 0;
      return { total: this._systemTotalRAM_MB, free: this._systemTotalRAM_MB - heapMB, used: heapMB, ratio };
    } catch (e) {}
    return null;
  }

  private _updateVRAMAsync() {
    const now = Date.now();
    if (this._cachedVRAM && (now - this._lastVRAMPoll) < VRAM_POLL_INTERVAL) return;
    this._lastVRAMPoll = now;

    this._readVRAMLinuxSysfsAsync();
  }

  private _readVRAMLinuxSysfsAsync() {
    const drmDir = '/sys/class/drm';
    fs.promises.readdir(drmDir).then(entries => {
      let checked = 0;
      for (const entry of entries) {
        if (!entry.startsWith('card')) continue;
        checked++;
        const devPath = `${drmDir}/${entry}/device`;
        const totalPath = `${devPath}/mem_info_vram_total`;
        const usedPath = `${devPath}/mem_info_vram_used`;

        Promise.all<string | null>([
          fs.promises.readFile(totalPath, 'utf8').catch((): null => null),
          fs.promises.readFile(usedPath, 'utf8').catch((): null => null),
        ]).then(([totalRaw, usedRaw]) => {
          if (!totalRaw) return;
          const totalB = parseInt(totalRaw.trim(), 10);
          if (!totalB) return;
          const usedB = usedRaw ? parseInt(usedRaw.trim(), 10) : 0;
          const totalMB = Math.round(totalB / (1024 * 1024));
          const usedMB = Math.round(usedB / (1024 * 1024));
          this._cachedVRAM = {
            usedMB, totalMB,
            usedPercent: totalMB > 0 ? usedMB / totalMB : 0,
            source: 'sysfs',
          };
        }).catch(() => {});
      }
      if (checked === 0) {
        this._readVRAMNvidiaSMIAsync();
      }
    }).catch(() => {
      this._readVRAMNvidiaSMIAsync();
    });
  }

  private _readVRAMNvidiaSMIAsync() {
    exec(
      'nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits',
      { timeout: 5000 },
      (error, stdout) => {
        if (error) return;
        const lines = stdout.trim().split('\n');
        if (lines.length === 0) return;
        const parts = lines[0].split(',').map(p => p.trim());
        if (parts.length < 2) return;
        const usedMB = parseInt(parts[0], 10);
        const totalMB = parseInt(parts[1], 10);
        if (isNaN(usedMB) || isNaN(totalMB) || totalMB === 0) return;
        this._cachedVRAM = {
          usedMB, totalMB,
          usedPercent: usedMB / totalMB,
          source: 'nvidia-smi',
        };
      }
    );
  }

  private _updateGPUResourcesAsync() {
    this._cachedGPUResources = this._pollWebFrameGPU();
  }

  private _getBudgetSync(): CachedBudget {
    try {
      const info = process.getSystemMemoryInfo();
      if (info && info.total > 0) {
        const total = Math.round((info.total * 1024) / (1024 * 1024));
        let freeBytes = info.free * 1024;
        if (process.platform === 'linux') {
          const avail = this._readMemAvailableSync();
          if (avail > 0) freeBytes = avail;
        }
        const free = Math.round(freeBytes / (1024 * 1024));
        const safeFree = free > total ? total : free;
        const used = total - safeFree;
        const safeBudget = Math.round(safeFree * 0.7);
        this._lastBudgetMB = safeBudget;
        return { total, free, used, ratio: total > 0 ? used / total : 1 };
      }
    } catch (e) {}

    try {
      const memUsage = process.memoryUsage();
      const heapMB = Math.round(memUsage.heapUsed / (1024 * 1024));
      const ratio = this._lastBudgetMB > 0 ? heapMB / this._lastBudgetMB : 0;
      return { total: this._systemTotalRAM_MB, free: this._systemTotalRAM_MB - heapMB, used: heapMB, ratio };
    } catch (e) {}

    return { total: this._systemTotalRAM_MB, free: 0, used: 0, ratio: 0 };
  }

  private _readMemAvailableSync(): number {
    try {
      const raw = fs.readFileSync('/proc/meminfo', 'utf8');
      const match = raw.match(/MemAvailable:\s+(\d+)\s+kB/);
      if (match) {
        this._cachedMemAvailable = parseInt(match[1], 10) * 1024;
        return this._cachedMemAvailable;
      }
    } catch (e) {}
    return 0;
  }

  private _getVRAMSync(): GPUVRAM {
    const now = Date.now();
    if (this._cachedVRAM && (now - this._lastVRAMPoll) < VRAM_POLL_INTERVAL) {
      return this._cachedVRAM;
    }
    this._lastVRAMPoll = now;

    let vram = this._readVRAMLinuxSysfsSync();
    if (vram) {
      this._cachedVRAM = vram;
      return vram;
    }

    vram = this._readVRAMNvidiaSMISync();
    if (vram) {
      this._cachedVRAM = vram;
      return vram;
    }

    vram = { usedMB: 0, totalMB: 0, usedPercent: 0, source: 'none' as const };
    this._cachedVRAM = vram;
    return vram;
  }

  private _readVRAMLinuxSysfsSync(): GPUVRAM | null {
    try {
      const drmDir = '/sys/class/drm';
      if (!fs.existsSync(drmDir)) return null;

      const entries = fs.readdirSync(drmDir);
      for (const entry of entries) {
        if (!entry.startsWith('card')) continue;
        const devPath = `${drmDir}/${entry}/device`;

        let totalB = 0;
        let usedB = 0;

        try {
          const totalPath = `${devPath}/mem_info_vram_total`;
          if (fs.existsSync(totalPath)) {
            totalB = parseInt(fs.readFileSync(totalPath, 'utf8').trim(), 10);
          } else {
            const memInfoPath = `${devPath}/mem_info`;
            if (fs.existsSync(memInfoPath)) {
              const raw = fs.readFileSync(memInfoPath, 'utf8');
              const match = raw.match(/vram_total_bytes=(\d+)/);
              if (match) totalB = parseInt(match[1], 10);
            }
          }
        } catch (e) {}

        try {
          const usedPath = `${devPath}/mem_info_vram_used`;
          if (fs.existsSync(usedPath)) {
            usedB = parseInt(fs.readFileSync(usedPath, 'utf8').trim(), 10);
          }
        } catch (e) {}

        if (totalB > 0) {
          const totalMB = Math.round(totalB / (1024 * 1024));
          const usedMB = Math.round(usedB / (1024 * 1024));
          return {
            usedMB, totalMB,
            usedPercent: totalMB > 0 ? usedMB / totalMB : 0,
            source: 'sysfs',
          };
        }
      }
    } catch (e) {}
    return null;
  }

  private _readVRAMNvidiaSMISync(): GPUVRAM | null {
    try {
      const output = execSync(
        'nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits',
        { timeout: 5000 }
      ).toString().trim();

      const lines = output.split('\n');
      if (lines.length === 0) return null;

      const parts = lines[0].split(',').map(p => p.trim());
      if (parts.length < 2) return null;

      const usedMB = parseInt(parts[0], 10);
      const totalMB = parseInt(parts[1], 10);

      if (isNaN(usedMB) || isNaN(totalMB) || totalMB === 0) return null;

      return {
        usedMB, totalMB,
        usedPercent: usedMB / totalMB,
        source: 'nvidia-smi',
      };
    } catch (e) {}
    return null;
  }

  private _getVRAMFallback(): GPUVRAM {
    return { usedMB: 0, totalMB: 0, usedPercent: 0, source: 'none' as const };
  }

  private _getBudgetFallback(): CachedBudget {
    return { total: this._systemTotalRAM_MB, free: 0, used: 0, ratio: 0 };
  }

  private _doPoll() {
    const tStart = performance.now();

    this._tick++;

    const t0 = performance.now();
    const budget = this._cachedBudget || this._getBudgetFallback();
    const heapRatio = this._getHeapRatio();
    const rssInfo = this._getRSSRatio();
    const gpuResources = this._cachedGPUResources;
    const vram = this._cachedVRAM || this._getVRAMFallback();
    const t1 = performance.now();

    const newZone = this._classifyZone(heapRatio, rssInfo, budget, vram, gpuResources);
    const effectiveZone = this._debounceZone(newZone, heapRatio, rssInfo.rssRatio, vram.usedPercent);
    const t2 = performance.now();

    if (effectiveZone !== this._zone || this._tick % 5 === 0) {
      this._zone = effectiveZone;
      this._applyZone(effectiveZone, budget, heapRatio, rssInfo, gpuResources, vram);
    }
    const t3 = performance.now();

    this._recordTiming(tStart, t1, t2, t3);
  }

  private _recordTiming(tStart: number, tData: number, tClassify: number, tApply: number) {
    this._timingCount++;
    if (this._timingCount % 5 !== 0) return;

    const dataMs = (tData - tStart).toFixed(1);
    const classifyMs = (tClassify - tData).toFixed(1);
    const applyMs = (tApply - tClassify).toFixed(1);
    const totalMs = (tApply - tStart).toFixed(1);

    this._timingLog.push(`poll#${this._timingCount}: data=${dataMs}ms classify=${classifyMs}ms apply=${applyMs}ms total=${totalMs}ms`);
    if (this._timingLog.length > 10) this._timingLog.shift();

    console.log(
      `[MemoryGovernor timing] total=${totalMs}ms (data=${dataMs}ms + classify=${classifyMs}ms + apply=${applyMs}ms)  ` +
      `budget=${JSON.stringify(budgetRatio(this._cachedBudget))} vram=${this._cachedVRAM?.source || 'none'} gpuImgs=${this._cachedGPUResources.count}`
    );
  }

  private _getRSSRatio(): { rssMB: number; rssRatio: number } {
    try {
      const usage = process.memoryUsage();
      const rssMB = Math.round(usage.rss / (1024 * 1024));
      const ratio = this._systemTotalRAM_MB > 0 ? rssMB / this._systemTotalRAM_MB : 0;
      return { rssMB, rssRatio: ratio };
    } catch (e) {}
    return { rssMB: 0, rssRatio: 0 };
  }

  private _getHeapRatio(): number {
    try {
      const perf = (performance as any).memory;
      if (perf && perf.usedJSHeapSize && perf.jsHeapSizeLimit && perf.jsHeapSizeLimit > 0) {
        return perf.usedJSHeapSize / perf.jsHeapSizeLimit;
      }
    } catch (e) {}

    try {
      const usage = process.memoryUsage();
      if (usage && usage.heapTotal > 0) {
        return usage.heapUsed / usage.heapTotal;
      }
    } catch (e) {}

    return 0;
  }

  private _pollWebFrameGPU(): { count: number; sizeMB: number } {
    try {
      const usage = webFrame.getResourceUsage();
      if (usage && usage.images) {
        return {
          count: usage.images.count || 0,
          sizeMB: Math.round((usage.images.size || 0) / (1024 * 1024)),
        };
      }
    } catch (e) {}
    return { count: 0, sizeMB: 0 };
  }

  private _classifyZone(
    heapRatio: number,
    rssInfo: { rssMB: number; rssRatio: number },
    budget: { total: number; free: number; used: number; ratio: number },
    vram: GPUVRAM,
    gpuResources: { count: number; sizeMB: number },
  ): MemoryZone {
    const rssRatio = rssInfo.rssRatio;
    const budgetRatio = budget.total > 0 ? (budget.total - budget.free) / budget.total : 0;
    const inStartupGrace = (Date.now() - this._startupTime) < 30000;
    const heapRed = inStartupGrace ? 0.92 : 0.85;
    const heapOrange = inStartupGrace ? 0.85 : 0.75;
    const heapYellow = inStartupGrace ? 0.75 : 0.65;

    if (heapRatio >= heapRed || budgetRatio >= 0.92 || rssRatio >= 0.80 ||
        vram.usedPercent >= VRAM_RED_THRESHOLD) {
      return 'red';
    }
    if (heapRatio >= heapOrange || budgetRatio >= 0.78 || rssRatio >= 0.55 ||
        vram.usedPercent >= VRAM_ORANGE_THRESHOLD ||
        gpuResources.count > 800 || gpuResources.sizeMB > 3000) {
      return 'orange';
    }
    if (heapRatio >= heapYellow || budgetRatio >= 0.58 || rssRatio >= 0.40 ||
        vram.usedPercent >= VRAM_YELLOW_THRESHOLD ||
        gpuResources.count > 300 || gpuResources.sizeMB > 1200) {
      return 'yellow';
    }
    return 'green';
  }

  private _debounceZone(newZone: MemoryZone, heapRatio?: number, rssRatio?: number, vramPercent?: number): MemoryZone {
    if (newZone !== 'green') {
      this._greenCount = 0;
    }

    if (newZone === 'red') {
      this._redCount++;
    } else {
      this._redCount = 0;
    }

    if (newZone === 'red' && ((heapRatio != null && heapRatio > 0.85) || (rssRatio != null && rssRatio > 0.75) || (vramPercent != null && vramPercent > 0.80))) {
      this._redCount = RED_MIN_COUNT;
      return 'red';
    }

    if (this._zone === 'green' && newZone === 'red' && this._redCount < RED_MIN_COUNT) {
      return 'yellow';
    }
    if (this._zone === 'green' && newZone === 'orange' && this._redCount < 2) {
      return 'yellow';
    }

    if (this._zone !== 'green') {
      if (newZone === 'green') {
        this._greenCount++;
        if (this._greenCount < GREEN_MIN_COUNT) {
          return this._zone;
        }
      }
    }

    return newZone;
  }

  private _buildState(
    zone: MemoryZone,
    budget: { total: number; free: number; used: number; ratio: number },
    heapRatio: number,
    rssInfo: { rssMB: number; rssRatio: number },
    gpuResources: { count: number; sizeMB: number },
    vram: GPUVRAM,
  ): GovernorState {
    const cfg = ZONE_CONFIGS[zone];
    const vramTotalMB = vram.totalMB || 0;
    const safeBudgetMB = this._lastBudgetMB > 0 ? this._lastBudgetMB : budget.free || 0;
    const rssBudgetMB = Math.max(64, Math.round(rssInfo.rssMB * 0.5));
    const warmBudgetMB = Math.round(Math.min(rssBudgetMB, vramTotalMB * 0.3) * cfg.warmWindowMultiplier);
    return {
      zone,
      warmWindowMultiplier: cfg.warmWindowMultiplier,
      warmBudgetMB: Math.max(warmBudgetMB, 64),
      warmItemCount: cfg.warmItemCount,
      preloadMode: cfg.preloadMode,
      cacheEnabled: cfg.cacheEnabled,
      purgeEnabled: cfg.purgeEnabled,
      purgeFraction: cfg.purgeFraction,
      gcInterval: cfg.gcInterval,
      maxLoadingAtOnce: cfg.maxLoadingAtOnce,
      systemBudgetMB: this._lastBudgetMB,
      systemUsedMB: budget.used,
      heapRatio,
      gpuVramUsedPercent: vram.usedPercent,
      gpuImageCount: gpuResources.count,
      gpuImageSizeMB: gpuResources.sizeMB,
      vramTotalMB,
      vramUsedMB: vram.usedMB,
      vramSource: vram.source,
      rssMB: rssInfo.rssMB,
      rssRatio: rssInfo.rssRatio,
    };
  }

  private _applyZone(
    zone: MemoryZone,
    budget: { total: number; free: number; used: number; ratio: number },
    heapRatio: number,
    rssInfo: { rssMB: number; rssRatio: number },
    gpuResources: { count: number; sizeMB: number },
    vram: GPUVRAM,
  ) {
    const state = this._buildState(zone, budget, heapRatio, rssInfo, gpuResources, vram);
    this._clearGC();
    // Only schedule hard GC while actually memory-starved. In green/yellow
    // nothing runs; in orange/red the interval fires but the actual work is
    // deferred off the main thread so it can't freeze input.
    if (zone === 'orange' || zone === 'red') {
      this._gcIntervalId = setInterval(() => this._forceGC(), state.gcInterval);
    }

    if (zone !== 'green') {
      console.warn(
        `[MemoryGovernor] ${zone.toUpperCase()} —` +
        ` RAM:${state.systemUsedMB}/${state.systemBudgetMB}MB` +
        ` heap:${(state.heapRatio * 100).toFixed(0)}%` +
        ` rss:${state.rssMB}MB(${(state.rssRatio * 100).toFixed(0)}%)` +
        (vram.source !== 'none' ? ` VRAM:${vram.usedMB}/${vram.totalMB}MB(${(vram.usedPercent * 100).toFixed(0)}%)` : '') +
        ` gpuImgs:${gpuResources.count}(${gpuResources.sizeMB}MB)`
      );
    }

    for (const cb of this._callbacks) {
      try { cb(state); } catch (e) {}
    }
  }

  private _forceGC() {
    // Deferred + non-blocking: a synchronous full GC freezes the renderer.
    // webFrame.clearCache() is intentionally NOT called — per Chromium source
    // it wipes ALL cache mappings (scripts/fonts/css/code) and still doesn't
    // free in-use decoded pixels; decoded images are freed by Oilpan GC once
    // our eviction drops element clients (src=''/remove).
    try {
      setTimeout(() => { (global as any).gc?.(); }, 0);
    } catch (e) {}
  }

  private _clearGC() {
    if (this._gcIntervalId) {
      clearInterval(this._gcIntervalId);
      this._gcIntervalId = null;
    }
  }
}

function budgetRatio(budget: CachedBudget | null): string {
  if (!budget || budget.total === 0) return '?';
  return (budget.used / budget.total * 100).toFixed(0) + '%';
}

let _instance: MemoryGovernor | null = null;

export function getMemoryGovernor(totalRAM_MB?: number): MemoryGovernor {
  if (!_instance) {
    _instance = new MemoryGovernor(totalRAM_MB || Math.round(require('os').totalmem() / (1024 * 1024)));
  }
  return _instance;
}
