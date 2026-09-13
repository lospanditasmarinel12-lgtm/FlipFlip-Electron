import { webFrame } from 'electron';

interface MemSnapshot {
  timestamp: number;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  gpuImageCount: number;
  gpuImageSizeMB: number;
  gpuImageLiveMB: number;
  gpuImageDecodedMB: number;
  otherCacheMB: number;
  liveImgs: number;
  liveVideos: number;
  liveCanvases: number;
  iframes: number;
  imgViewTimeouts: number;
  imgPlayers: number;
  playerHistory: number;
  playerReady: number;
  vramUsedMB: number;
  vramTotalMB: number;
  arcItems: number;
  arcBytesEstMB: number;
  tag: string;
}

let _autoPollInterval: ReturnType<typeof setInterval> | null = null;
let _snapshots: MemSnapshot[] = [];
let _gcBefore: MemSnapshot | null = null;
const MAX_SNAPSHOTS = 5000;
let _minTimestamp: number = 0;

function countLiveElements() {
  let imgs = 0, videos = 0, canvases = 0, iframes = 0;
  try {
    imgs = document.images?.length || 0;
    videos = document.querySelectorAll('video').length;
    canvases = document.querySelectorAll('canvas').length;
    iframes = document.querySelectorAll('iframe').length;
  } catch (e) {}
  return { imgs, videos, canvases, iframes };
}

function countImageViewTimeouts(): number {
  let total = 0;
  try {
    for (let el of document.querySelectorAll('div[id="image"], [class*="copy-"][style*="position"]')) {
      const k = Object.keys(el).find((key) => key.startsWith('__reactFiber$'));
      if (!k) continue;
      let fiber = (el as any)[k];
      let depth = 0;
      while (fiber && depth < 20) {
        const inst = fiber.stateNode;
        if (inst && typeof inst.clearTimeouts === 'function' && Array.isArray(inst._timeouts)) {
          total += inst._timeouts.length;
          break;
        }
        fiber = fiber.return;
        depth++;
      }
    }
  } catch (e) {}
  return total;
}

function countImagePlayers() {
  let players = 0, history = 0, ready = 0;
  try {
    for (let el of document.querySelectorAll('div')) {
      const k = Object.keys(el).find((key) => key.startsWith('__reactFiber$'));
      if (!k) continue;
      let fiber = (el as any)[k];
      let depth = 0;
      while (fiber && depth < 30) {
        const inst = fiber.stateNode;
        if (inst && inst.constructor && inst.constructor.name === 'ImagePlayer' &&
            Array.isArray(inst.state?.historyPaths) && Array.isArray(inst.state?.readyToDisplay)) {
          players++;
          history += inst.state.historyPaths.length;
          ready += inst.state.readyToDisplay.length;
          break;
        }
        fiber = fiber.return;
        depth++;
      }
    }
  } catch (e) {}
  return { players, history, ready };
}

function takeSnapshot(tag: string = '', includeDOMScan = true): MemSnapshot {
  let heapUsedMB = 0, heapTotalMB = 0, externalMB = 0, arrayBuffersMB = 0;
  let rssMB = 0;
  let gpuCount = 0, gpuSizeMB = 0, gpuLiveMB = 0, gpuDecodedMB = 0;
  let otherCacheMB = 0;
  let vramUsed = 0, vramTotal = 0;
  let arcItems = 0, arcBytes = 0;

  try {
    const usage = process.memoryUsage();
    rssMB = Math.round(usage.rss / (1024 * 1024));
    heapUsedMB = Math.round(usage.heapUsed / (1024 * 1024));
    heapTotalMB = Math.round(usage.heapTotal / (1024 * 1024));
    externalMB = Math.round((usage as any).external / (1024 * 1024));
    arrayBuffersMB = Math.round(((usage as any).arrayBuffers || 0) / (1024 * 1024));
  } catch (e) {}

  try {
    const ru = webFrame.getResourceUsage();
    if (ru && ru.images) {
      gpuCount = ru.images.count || 0;
      gpuSizeMB = Math.round((ru.images.size || 0) / (1024 * 1024));
      gpuLiveMB = Math.round(((ru.images as any).liveSize || 0) / (1024 * 1024));
      gpuDecodedMB = Math.round(((ru.images as any).decodedSize || 0) / (1024 * 1024));
    }
    if (ru && (ru as any).other) {
      otherCacheMB = Math.round(((ru as any).other.size || 0) / (1024 * 1024));
    }
  } catch (e) {}

  try {
    const imgPlayer = (window as any).__ff_imgPlayer;
    if (imgPlayer) {
      arcItems = (imgPlayer._t1?.size || 0) + (imgPlayer._t2?.size || 0);
      arcBytes = Math.round(((imgPlayer._t1Bytes || 0) + (imgPlayer._t2Bytes || 0)) / (1024 * 1024));
    }
  } catch (e) {}

  // Heavy DOM/fiber scans are expensive on the main thread (they iterate every
  // div / React fiber). Only run them for explicit snapshots / leakCheck, and
  // skip them on the auto-poll so playback doesn't stall every 5s.
  const elems = includeDOMScan ? countLiveElements() : { imgs: 0, videos: 0, canvases: 0, iframes: 0 };
  const imgViewTimeouts = includeDOMScan ? countImageViewTimeouts() : 0;
  const ipStats = includeDOMScan ? countImagePlayers() : { players: 0, history: 0, ready: 0 };

  const s: MemSnapshot = {
    timestamp: Date.now(),
    rssMB, heapUsedMB, heapTotalMB, externalMB, arrayBuffersMB,
    gpuImageCount: gpuCount, gpuImageSizeMB: gpuSizeMB,
    gpuImageLiveMB: gpuLiveMB, gpuImageDecodedMB: gpuDecodedMB,
    otherCacheMB,
    liveImgs: elems.imgs, liveVideos: elems.videos, liveCanvases: elems.canvases, iframes: elems.iframes,
    imgViewTimeouts,
    imgPlayers: ipStats.players, playerHistory: ipStats.history, playerReady: ipStats.ready,
    vramUsedMB: vramUsed, vramTotalMB: vramTotal,
    arcItems, arcBytesEstMB: arcBytes,
    tag,
  };
  _snapshots.push(s);
  // Bound the snapshot ring so a long poll session can't grow RAM unboundedly.
  if (_snapshots.length > MAX_SNAPSHOTS) {
    const overflow = _snapshots.length - MAX_SNAPSHOTS;
    _snapshots.splice(0, overflow);
    _minTimestamp = _snapshots[0]?.timestamp || 0;
  }
  return s;
}

function logSnapshot(s: MemSnapshot, label: string = '') {
  const elapsed = _snapshots.length > 1
    ? `+${((s.timestamp - _snapshots[_snapshots.length - 2].timestamp) / 1000).toFixed(1)}s`
    : '0.0s';
  console.log(
    `[FFDEBUG${label ? ` ${label}` : ''}] ${elapsed}` +
    `  RSS:${s.rssMB}MB` +
    `  heap:${s.heapUsedMB}/${s.heapTotalMB}MB` +
    `  ext:${s.externalMB}MB` +
    `  ab:${s.arrayBuffersMB}MB` +
    `  imgs:${s.gpuImageCount}(${s.gpuImageSizeMB}MB live:${s.gpuImageLiveMB} dec:${s.gpuImageDecodedMB}) other:${s.otherCacheMB}MB` +
    `  dom:img${s.liveImgs} v${s.liveVideos} c${s.liveCanvases} i${s.iframes}` +
    `  ivTimeouts:${s.imgViewTimeouts}` +
    `  players:${s.imgPlayers}(h:${s.playerHistory} r:${s.playerReady})` +
    `  arc:${s.arcItems}(${s.arcBytesEstMB}MB)` +
    (s.tag ? `  "${s.tag}"` : '')
  );
}

function printSummary() {
  if (_snapshots.length < 2) {
    console.log('[FFDEBUG] Need at least 2 snapshots for summary');
    return;
  }
  const first = _snapshots[0];
  const last = _snapshots[_snapshots.length - 1];
  const duration = ((last.timestamp - first.timestamp) / 1000).toFixed(1);
  console.log('--- FFDEBUG SUMMARY ---');
  console.log(`  Duration: ${duration}s`);
  console.log(`  RSS:     ${first.rssMB}MB → ${last.rssMB}MB  (Δ${last.rssMB - first.rssMB}MB)`);
  console.log(`  heap:    ${first.heapUsedMB}MB → ${last.heapUsedMB}MB  (Δ${last.heapUsedMB - first.heapUsedMB}MB)`);
  console.log(`  imgs(blink cache): ${first.gpuImageCount}(${first.gpuImageSizeMB}MB dec:${first.gpuImageDecodedMB} live:${first.gpuImageLiveMB}) → ${last.gpuImageCount}(${last.gpuImageSizeMB}MB dec:${last.gpuImageDecodedMB} live:${last.gpuImageLiveMB})`);
  console.log(`  domMedia: img ${first.liveImgs}→${last.liveImgs}  video ${first.liveVideos}→${last.liveVideos}  canvas ${first.liveCanvases}→${last.liveCanvases}`);
  console.log(`  ivTimeouts: ${first.imgViewTimeouts} → ${last.imgViewTimeouts}`);
  console.log(`  players: ${first.imgPlayers} (h:${first.playerHistory} r:${first.playerReady}) → ${last.imgPlayers} (h:${last.playerHistory} r:${last.playerReady})`);
  console.log(`  arc:     ${first.arcItems}(${first.arcBytesEstMB}MB) → ${last.arcItems}(${last.arcBytesEstMB}MB)`);
  if (first.externalMB || last.externalMB) {
    console.log(`  external:${first.externalMB}MB → ${last.externalMB}MB  (Δ${last.externalMB - first.externalMB}MB)`);
  }

  // Show biggest jumps
  const jumps = [];
  for (let i = 1; i < _snapshots.length; i++) {
    const prev = _snapshots[i-1];
    const curr = _snapshots[i];
    const rssDelta = curr.rssMB - prev.rssMB;
    if (Math.abs(rssDelta) >= 20) {
      jumps.push({ at: ((curr.timestamp - first.timestamp) / 1000).toFixed(1) + 's', delta: rssDelta, tag: curr.tag });
    }
  }
  if (jumps.length > 0) {
    console.log('  RSS jumps (≥20MB):');
    for (const j of jumps) {
      console.log(`    ${j.at}  ${j.delta > 0 ? '+' : ''}${j.delta}MB  ${j.tag || ''}`);
    }
  }
}

const debugAPI = {
  snapshot: (tag: string = 'manual') => {
    const s = takeSnapshot(tag);
    logSnapshot(s, 'SNAPSHOT');
    return s;
  },

  mark: (tag: string) => {
    const s = takeSnapshot(tag);
    logSnapshot(s, 'MARK');
  },

  gc: () => {
    console.log('[FFDEBUG] Running global.gc()...');
    const before = takeSnapshot('gc-before');
    logSnapshot(before, 'GC-BEFORE');
    try { (global as any).gc?.(); } catch (e) {}
    const after = takeSnapshot('gc-after');
    logSnapshot(after, 'GC-AFTER');
    console.log(`[FFDEBUG] GC effect: RSS ${before.rssMB}MB → ${after.rssMB}MB (Δ${after.rssMB - before.rssMB}MB)`);
    return after;
  },

  clearCache: () => {
    console.log('[FFDEBUG] Running webFrame.clearCache()...');
    const before = takeSnapshot('cc-before');
    logSnapshot(before, 'CC-BEFORE');
    try { webFrame.clearCache(); } catch (e) {}
    const after = takeSnapshot('cc-after');
    logSnapshot(after, 'CC-AFTER');
    console.log(`[FFDEBUG] clearCache effect: RSS ${before.rssMB}MB → ${after.rssMB}MB (Δ${after.rssMB - before.rssMB}MB)`);
    return after;
  },

  gcAndClear: () => {
    console.log('[FFDEBUG] Running GC + clearCache...');
    const before = takeSnapshot('gc+cc-before');
    logSnapshot(before, 'GC+CC-BEFORE');
    try { (global as any).gc?.(); } catch (e) {}
    try { webFrame.clearCache(); } catch (e) {}
    setTimeout(() => {
      const after = takeSnapshot('gc+cc-after');
      logSnapshot(after, 'GC+CC-AFTER');
      console.log(`[FFDEBUG] GC+CC effect: RSS ${before.rssMB}MB → ${after.rssMB}MB (Δ${after.rssMB - before.rssMB}MB)`);
    }, 100);
  },

  gcSequence: () => {
    console.log('[FFDEBUG] ===== GC SEQUENCE TEST =====');
    console.log('[FFDEBUG] Phase 1: ARC eviction only (no GC, no clearCache)');
    const s1 = takeSnapshot('phase1-before');
    logSnapshot(s1, 'P1-BEFORE');
    setTimeout(() => {
      const s2 = takeSnapshot('phase1-after-1s');
      logSnapshot(s2, 'P1-+1S');
    }, 1000);
    setTimeout(() => {
      const s3 = takeSnapshot('phase1-after-5s');
      logSnapshot(s3, 'P1-+5S');
    }, 5000);
    setTimeout(() => {
      const s4 = takeSnapshot('phase1-after-30s');
      logSnapshot(s4, 'P1-+30S');
    }, 30000);
  },

  summary: () => printSummary(),

  snapshots: () => [..._snapshots],

  clearSnapshots: () => { _snapshots = []; console.log('[FFDEBUG] Snapshots cleared'); },

  startPoll: (intervalMs: number = 5000) => {
    if (_autoPollInterval) clearInterval(_autoPollInterval);
    // Auto-poll stays cheap: no DOM/fiber scans (they'd stall playback every
    // few seconds). Explicit __ffdebug.snapshot()/mark()/leakCheck() include them.
    takeSnapshot('poll-start', false);
    _autoPollInterval = setInterval(() => {
      const s = takeSnapshot('poll', false);
      logSnapshot(s);
    }, intervalMs);
    console.log(`[FFDEBUG] Auto-poll started every ${intervalMs}ms`);
  },

  stopPoll: () => {
    if (_autoPollInterval) {
      clearInterval(_autoPollInterval);
      _autoPollInterval = null;
      console.log('[FFDEBUG] Auto-poll stopped');
    }
  },

  linkPlayer: () => {
    var getFiberKey = function(el: any): string | null {
      return Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); }) || null;
    };
    var walkToPlayer = function(fiber: any): any {
      while (fiber) {
        if (fiber.stateNode && typeof fiber.stateNode.advance === 'function' && fiber.stateNode._t1) {
          (window as any).__ff_imgPlayer = fiber.stateNode;
          console.log('[FFDEBUG] Found ImagePlayer');
          return fiber.stateNode;
        }
        fiber = fiber.return;
      }
      return null;
    };

    // Strategy 1: find #image element (ImageView's contentRef div)
    var el = document.getElementById('image');
    var key = el ? getFiberKey(el) : null;
    if (key && walkToPlayer((el as any)[key])) return;

    // Strategy 2: find a media element created by ImagePlayer, use its parent's fiber
    var media = document.querySelector('img[source], video[source]');
    if (media && media.parentElement) {
      key = getFiberKey(media.parentElement);
      if (key && walkToPlayer((media.parentElement as any)[key])) return;
    }

    // Strategy 3: scan DOM for any element with a React fiber, walk up from each
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      key = getFiberKey(all[i]);
      if (key && walkToPlayer((all[i] as any)[key])) return;
    }

    console.log('[FFDEBUG] Could not find ImagePlayer instance');
  },

  getARC: () => {
    const ip = (window as any).__ff_imgPlayer;
    if (!ip) return { error: 'no ImagePlayer linked' };
    return {
      t1: ip._t1?.size || 0,
      t2: ip._t2?.size || 0,
      b1: ip._b1?.size || 0,
      b2: ip._b2?.size || 0,
      p: ip._p || 0,
      t1Bytes: Math.round((ip._t1Bytes || 0) / (1024*1024)),
      t2Bytes: Math.round((ip._t2Bytes || 0) / (1024*1024)),
      arcMaxBytes: Math.round((ip._arcMaxBytes || 0) / (1024*1024)),
      metadataSize: ip._itemMetadata?.size || 0,
      historyPaths: ip.state?.historyPaths?.length || 0,
      readyToDisplay: ip.state?.readyToDisplay?.length || 0,
    };
  },

  dumpVideos: () => {
    const ip = (window as any).__ff_imgPlayer;
    if (!ip) { console.log('[FFDEBUG] No ImagePlayer linked — run __ffdebug.linkPlayer() first'); return; }
    const videos: any[] = [];
    const seen = new Set();
    ip.state.historyPaths.forEach(function(p: any, i: number) {
      if (!p || !(p instanceof HTMLVideoElement)) return;
      const key = (p as any)._ffKey || (p as any).key || p.src || '?';
      if (seen.has(key)) return; seen.add(key);
      const meta = ip._itemMetadata.get(key);
      const frozen = meta ? (meta as any).frozen : false;
      const inARC = ip._t1.has(key) || ip._t2.has(key);
      const arcList = ip._t1.has(key) ? 'T1' : ip._t2.has(key) ? 'T2' : 'none';
      videos.push({
        idx: i,
        src: (p.src || '').split('/').pop(),
        readyState: p.readyState,
        networkState: p.networkState,
        w: p.videoWidth, h: p.videoHeight,
        paused: p.paused, ended: p.ended,
        decoded: (p as any).webkitDecodedFrameCount || 0,
        dropped: (p as any).webkitDroppedFrameCount || 0,
        ffKey: key, frozen, arcList, inARC, mb: meta ? (meta.estimatedMB || 0) : 0,
      });
    });
    ip.state.readyToDisplay.forEach(function(p: any, i: number) {
      if (!p || !(p instanceof HTMLVideoElement)) return;
      const key = (p as any)._ffKey || (p as any).key || p.src || '?';
      if (seen.has(key)) return; seen.add(key);
      videos.push({
        idx: 'ready-' + i, ffKey: key, src: (p.src || '').split('/').pop(),
        readyState: p.readyState, w: p.videoWidth, h: p.videoHeight,
        paused: p.paused, decoded: (p as any).webkitDecodedFrameCount || 0,
        frozen: false, arcList: 'none', inARC: false, mb: 0,
      });
    });
    const current = ip.state.historyPaths[ip.state.historyPaths.length - 1];
    var _ec = typeof ip._countElements === 'function' ? ip._countElements() : null;
    console.log('=== Video State Dump ===');
    console.log('warmItemCount:', ip._maxWarmItems);
    console.log('arc items:', ip._t1.size + ip._t2.size);
    if (_ec) {
      console.log('counters:',
        'videos=' + _ec.liveVideoElements,
        'withSrc=' + _ec.videoWithSrc,
        'connected=' + _ec.videoConnected,
        'images=' + _ec.liveImageElements,
        'ready=' + _ec.readyQueue,
        'history=' + _ec.history);
    }
    console.log('total videos:', videos.length);
    videos.forEach(function(v: any) {
      var marker = (current && v.idx === ip.state.historyPaths.length - 1) ? ' ▶' :
                     typeof v.idx === 'string' ? ' ⏳' : '';
      console.log(
        (v.idx + '').padStart(4) + marker +
        '  src=' + (v.src || '?').substring(0,22).padEnd(23) +
        '  rs=' + v.readyState +
        '  ' + (v.w||'?')+'x'+(v.h||'?') +
        '  dec=' + v.decoded + '  drp=' + v.dropped +
        (v.frozen ? ' FROZEN' : '') +
        (v.paused ? ' PAUSED' : '') + (v.ended ? ' ENDED' : '')
      );
    });
    console.log('=== End dumpVideos ===');
  },

  stopGovernor: () => {
    try {
      const { getMemoryGovernor } = require('../data/MemoryMonitor');
      getMemoryGovernor().stop();
      console.log('[FFDEBUG] MemoryGovernor stopped');
    } catch (e) {
      console.error('[FFDEBUG] Failed to stop governor:', e);
    }
  },

  startGovernor: () => {
    try {
      const { getMemoryGovernor } = require('../data/MemoryMonitor');
      getMemoryGovernor(Math.round(require('os').totalmem() / (1024 * 1024))).start();
      console.log('[FFDEBUG] MemoryGovernor started');
    } catch (e) {
      console.error('[FFDEBUG] Failed to start governor:', e);
    }
  },

  leakCheck: () => {
    const ru = webFrame.getResourceUsage();
    const elems = countLiveElements();
    const ivTimeouts = countImageViewTimeouts();
    const ipStats = countImagePlayers();
    console.log('=== LEAK CHECK ===');
    console.log('resourceUsage.images:', ru?.images ? {
      count: ru.images.count,
      size: Math.round((ru.images.size || 0) / 1048576),
      liveSize: Math.round(((ru.images as any).liveSize || 0) / 1048576),
      decodedSize: Math.round(((ru.images as any).decodedSize || 0) / 1048576),
    } : 'n/a');
    console.log('DOM media:', `img=${elems.imgs} video=${elems.videos} canvas=${elems.canvases} iframe=${elems.iframes}`);
    console.log('ImageView _timeouts (total):', ivTimeouts);
    console.log('ImagePlayers:', ipStats.players, '| history sum:', ipStats.history, '| ready sum:', ipStats.ready);
    // List each ImagePlayer's queues + ARC sets via fiber scan.
    try {
      let idx = 0;
      for (let el of document.querySelectorAll('div')) {
        const k = Object.keys(el).find((key) => key.startsWith('__reactFiber$'));
        if (!k) continue;
        let fiber = (el as any)[k];
        let depth = 0;
        while (fiber && depth < 30) {
          const inst = fiber.stateNode;
          if (inst && inst.constructor && inst.constructor.name === 'ImagePlayer' &&
              Array.isArray(inst.state?.historyPaths) && Array.isArray(inst.state?.readyToDisplay)) {
            console.log(`  player#${idx}: history=${inst.state.historyPaths.length} ready=${inst.state.readyToDisplay.length} ` +
              `t1=${inst._t1?.size||0} t2=${inst._t2?.size||0} loadedURLs=${inst._loadedURLs?.length||0} played=${inst._playedURLs?.length||0}`);
            idx++;
            break;
          }
          fiber = fiber.return;
          depth++;
        }
      }
    } catch (e) {}
    console.log('=== END LEAK CHECK ===');
  },

  reproMatrix: (secondsPerCase: number = 60) => {
    const cases = ['stills', 'videos', 'blur+stills+crossfade', 'blur+videos+crossfade'];
    console.log(`[FFDEBUG] Repro matrix: run each case for ${secondsPerCase}s. `);
    console.log('  Tip: apply the case in the UI (scene options), then run __ffdebug.mark(caseName).');
    console.log('  Compare __ffdebug.summary() RSS jumps / images.decodedSize per case.');
  },

  budget: () => {
    try {
      const { MediaBudget } = require('../data/MediaBudget');
      return {
        budget: MediaBudget.getBudget(),
        live: MediaBudget.totalLive(),
        ready: MediaBudget.totalReady(),
        players: MediaBudget.playerCount(),
        perPlayerCap: MediaBudget.perPlayerCap(),
        exhausted: MediaBudget.isExhausted(),
        playersDetail: MediaBudget.dump(),
      };
    } catch (e) {
      return { error: e.message };
    }
  },

  monitorRAF: (durationMs: number = 30000) => {
    var last = performance.now();
    var count = 0;
    var maxGap = 0;
    var longFrames: { at: string; gap: number }[] = [];
    var start = last;
    var rafId: number;
    function tick() {
      var now = performance.now();
      var gap = now - last;
      last = now;
      count++;
      if (gap > maxGap) maxGap = gap;
      if (gap > 50) longFrames.push({ at: ((now - start) / 1000).toFixed(1), gap: Math.round(gap) });
      if ((now - start) < durationMs) {
        rafId = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafId);
        var pct = longFrames.length > 0 ? Math.round(longFrames.length / count * 100) : 0;
        console.log(`[RAFMONITOR] duration=${(durationMs/1000).toFixed(0)}s  frames=${count}  avg=${(durationMs/count).toFixed(1)}ms  maxGap=${Math.round(maxGap)}ms  longFrames=${longFrames.length}(${pct}%)`);
        if (longFrames.length > 0) {
          console.log('  long frames (>{51}ms):');
          longFrames.slice(0, 20).forEach(function(f) { console.log('    t=' + f.at + 's  gap=' + f.gap + 'ms'); });
          if (longFrames.length > 20) console.log('    ... and ' + (longFrames.length - 20) + ' more');
        }
      }
    }
    requestAnimationFrame(tick);
  },
};

export function initMemoryDebug() {
  (window as any).__ffdebug = debugAPI;
  console.log(
    '%c[FFDEBUG] Memory debugger active. Use %c__ffdebug%c in console.\n' +
    '  %cCommands:%c\n' +
    '  __ffdebug.snapshot("label")     — take a memory snapshot\n' +
    '  __ffdebug.mark("label")          — snapshot + log\n' +
    '  __ffdebug.gc()                   — run global.gc()\n' +
    '  __ffdebug.clearCache()           — run webFrame.clearCache()\n' +
    '  __ffdebug.gcAndClear()           — run both\n' +
    '  __ffdebug.gcSequence()           — phased test (eviction → wait → GC)\n' +
    '  __ffdebug.startPoll(ms)          — auto-poll memory every N ms\n' +
    '  __ffdebug.stopPoll()             — stop auto-poll\n' +
    '  __ffdebug.summary()              — print summary of all snapshots\n' +
    '  __ffdebug.snapshots()            — list all snapshots\n' +
    '  __ffdebug.clearSnapshots()       — clear recorded snapshots\n' +
    '  __ffdebug.linkPlayer()           — find and link ImagePlayer for ARC info\n' +
    '  __ffdebug.getARC()               — show ARC cache state\n' +
    '  __ffdebug.dumpVideos()           — dump all video elements with state\n' +
    '  __ffdebug.leakCheck()             — dump live DOM media, ImageView timeouts, per-ImagePlayer queues\n' +
    '  __ffdebug.reproMatrix(secs)        — repro test plan (stills/videos/blur/crossfade cases)\n' +
    '  __ffdebug.monitorRAF(ms)         — measure rAF intervals for N ms\n' +
    '  __ffdebug.stopGovernor()          — stop MemoryGovernor polling\n' +
    '  __ffdebug.startGovernor()         — restart MemoryGovernor polling\n',
    'font-weight:bold;color:#4caf50',
    'font-weight:bold;color:#ff9800',
    '',
    'font-weight:bold;color:#2196f3',
    'font-weight:normal;color:inherit'
  );

  // Debugger is available on window.__ffdebug but does NOT auto-poll: the 5s
  // timer and its snapshot array would add ongoing CPU + RAM overhead. Call
  // __ffdebug.startPoll(ms) yourself when actively debugging.
}

export default initMemoryDebug;
