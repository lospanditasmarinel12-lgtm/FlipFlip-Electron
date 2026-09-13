/**
 * Namespaced, gated logging for FlipFlip.
 *
 * All console output in the app is routed through a console-level hook so that
 * the (very chatty) debug logs can be turned off — and turned back on — from the
 * Settings panel without touching every call site.
 *
 * Each log message is classified into a namespace by inspecting the first
 * argument's bracketed tag / known prefix. Every namespace can be enabled or
 * disabled at runtime; the set is persisted in `Config.logSettings`.
 *
 * `console.error` is always passed through.
 *
 * Dev helpers on the window:
 *   window.__fflogs.list()                      – namespaces + enabled state
 *   window.__fflogs.enable(ns) / disable(ns)    – toggle one namespace
 *   window.__fflogs.enableAll() / disableAll()  – toggle everything
 */

export type LogNamespace =
  | 'imagePlayer'
  | 'memory'
  | 'audio'
  | 'haptics'
  | 'ble'
  | 'meta'
  | 'storage'
  | 'liveshow'
  | 'other';

export const LOG_NAMESPACES: ReadonlyArray<LogNamespace> = [
  'imagePlayer',
  'memory',
  'audio',
  'haptics',
  'ble',
  'meta',
  'storage',
  'liveshow',
  'other',
];

export const LOG_NAMESPACE_LABELS: Record<LogNamespace, string> = {
  imagePlayer: 'Image Player (advance/queue/video timing)',
  memory: 'Memory (governor, FFDEBUG, heap)',
  audio: 'Audio (soundmanager, audio control)',
  haptics: 'Haptics',
  ble: 'Bluetooth devices',
  meta: 'Startup / auto-config',
  storage: 'Save / backup / portable mode',
  liveshow: 'LiveShow player (advance/schedule/build)',
  other: 'Everything else (warnings, violations)',
};

interface NamespaceMap {
  [ns: string]: boolean;
}

let enabled: NamespaceMap = {};

// Everything off by default: the console hook is a no-op fast path until a
// namespace is enabled (from Settings or __fflogs). `applyLogSettings` syncs
// from persisted config right after load.
for (const ns of LOG_NAMESPACES) {
  enabled[ns] = false;
}

const origConsole = {
  log: console.log.bind(console),
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/**
 * Classify a set of console arguments into a namespace.
 */
function classifyNamespace(args: any[]): LogNamespace {
  const first = typeof args[0] === 'string' ? args[0] : "";
  if (!first) return 'other';
  if (/\bImagePlayer\b|\bAdvanceSchedule\b|\bReadyQueue\b|\bAdvanceTrace\b|\bVideoTiming\b|\bElementCount\b|\bFetchThrottle\b|\bVideoTransition\b|skipped due to minimum width\/height/.test(first)) {
    return 'imagePlayer';
  }
  if (/\bFFDEBUG\b|\bMemoryGovernor\b|\bHeap\b|\bRAFMONITOR\b/.test(first)) {
    return 'memory';
  }
  if (/\bsoundmanager\b|\bSoundManager\b|\bAudioControl\b/.test(first)) {
    return 'audio';
  }
  if (/\bHaptic/.test(first)) {
    return 'haptics';
  }
  if (/\bBLE\b/.test(first)) {
    return 'ble';
  }
  if (/\[LiveShow\]/.test(first)) {
    return 'liveshow';
  }
  if (/\bFlipFlip\b/.test(first)) {
    return 'meta';
  }
  if (/\bPortable\b|\bSaving to\b|\bPerformed Auto\b|\bFOUND OLD SAVE\b/.test(first)) {
    return 'storage';
  }
  return 'other';
}

function isEnabled(ns: LogNamespace): boolean {
  return enabled[ns] === true;
}

/** Public check used to skip setting up intervals/processing when a namespace is off. */
export function isLogEnabled(ns: LogNamespace): boolean {
  return enabled[ns] === true;
}

// When nothing is enabled we can skip the per-call classifyNamespace() work,
// keeping the console hook essentially free while logging is fully off.
let _allDisabled = true;
function refreshFastPath(): void {
  _allDisabled = LOG_NAMESPACES.every((ns) => enabled[ns] !== true);
}

function makeHook(method: 'log' | 'debug' | 'info' | 'warn') {
  const original = origConsole[method];
  return function (...args: any[]) {
    if (_allDisabled) return;
    if (console[method] !== gatedConsole[method]) {
      // Avoid recursion if our own hook is being invoked through a stale ref.
      return original.apply(console, args as any);
    }
    const ns = classifyNamespace(args);
    if (!isEnabled(ns)) return;
    original.apply(console, args as any);
  };
}

const gatedConsole = {
  log: makeHook('log'),
  debug: makeHook('debug'),
  info: makeHook('info'),
  warn: makeHook('warn'),
  error: function (...args: any[]) {
    return origConsole.error.apply(console, args as any);
  },
};

function install() {
  configureConsole();
}

export function configureConsole(): void {
  (console as any).log = gatedConsole.log;
  (console as any).debug = gatedConsole.debug;
  (console as any).info = gatedConsole.info;
  (console as any).warn = gatedConsole.warn;
  (console as any).error = gatedConsole.error;
}

/**
 * Sync the enabled-namespace map from persisted Config.logSettings.
 */
export function applyLogSettings(logSettings: any): void {
  if (!logSettings) return;
  for (const ns of LOG_NAMESPACES) {
    enabled[ns] = logSettings[ns] === true;
  }
  refreshFastPath();
}

export function setLogEnabled(ns: LogNamespace, value: boolean): void {
  enabled[ns] = value;
  refreshFastPath();
}

export function getLogState(): NamespaceMap {
  return { ...enabled };
}

export function enableAllLogs(): void {
  for (const ns of LOG_NAMESPACES) {
    enabled[ns] = true;
  }
  refreshFastPath();
}

export function disableAllLogs(): void {
  for (const ns of LOG_NAMESPACES) {
    enabled[ns] = false;
  }
  refreshFastPath();
}

export function exposeLoggingAPI(): void {
  if (typeof window === 'undefined') return;
  (window as any).__fflogs = {
    list: getLogState,
    enable: setLogEnabled,
    disable: (ns: LogNamespace) => setLogEnabled(ns, false),
    enableAll: enableAllLogs,
    disableAll: disableAllLogs,
  };
}

let installed = false;
export function initLogging(): void {
  if (installed) return;
  installed = true;
  install();
  exposeLoggingAPI();
}
