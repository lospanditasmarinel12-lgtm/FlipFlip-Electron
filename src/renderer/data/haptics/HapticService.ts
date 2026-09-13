import { AudioAnalyzer, FFT_SIZE } from './AudioAnalyzer';
import { HapticManager } from './HapticManager';
import { HapticConfig, HapticPattern, AudioAnalysisFrame } from './types';
import { ISystemAudioCapture, CaptureDevice, RoutingCheck, createSystemAudioCapture } from '../audio/index';
import { ipcRenderer } from 'electron';
import { IPC } from '../const';
import { detectPlatform } from './types';
import { useStore } from '../../stores/flipflipStore';

// A Buttplug command whose promise never settles (lost BLE write, server
// hiccup) must not wedge feedback permanently — hence the timeout + watchdog.
const VIBRATE_TIMEOUT_MS = 3000;
const VIBRATE_WATCHDOG_MS = 5000;
// Don't flood the device: resend only when intensity moved meaningfully or
// after a short heartbeat so sustained tones keep refreshing.
const VIBRATE_DELTA = 0.02;
const VIBRATE_MIN_INTERVAL_MS = 100;

export class HapticService {
  private static instance: HapticService | null = null;
  private analyzer = new AudioAnalyzer();
  private manager = new HapticManager();
  private config: HapticConfig = { enabled: false, intensity: 80, pattern: HapticPattern.direct, directGain: 1.0, directSmoothing: 0.3, bassGain: 1.0, melodyGain: 1.0, voiceGain: 1.0, beatThreshold: 1.25, beatCooldownMs: 150 };
  private activeDeviceIndex = 0;
  private motorIntensities: Map<string, number> = new Map();
  private connected = false;
  private useSystemAudio = false;
  private systemCapture: ISystemAudioCapture | null = null;
  private systemStream: MediaStream | null = null;
  private monitorEl: HTMLAudioElement | null = null;
  private monitorSinkOverride: string | null = null;
  private lastSystemAudioError: string | null = null;
  private _silenceCounter = 0;
  private _analysisWaiting = false;
  private _lastAudioElement: HTMLAudioElement | null = null;
  private _lastCaptureDeviceId: string | null = null;
  private _vibrating = false;
  private _vibrateStartedAt = 0;
  private _lastSentValue = -1;
  private _lastSentTime = 0;
  private _warmupFramesRemaining = 0;
  // private _pendingDeviceId: string | null = null; // deferred callback — disabled
  private _onSourceStatus: ((status: 'active' | 'silent' | 'stopped') => void) | null = null;
  private onDevicesChanged: ((devices: any[]) => void) | null = null;
  private onActivityChanged: ((active: boolean) => void) | null = null;
  private _initTransportMode = 'auto';
  private _initWSEndpoint = 'ws://127.0.0.1:12345';
  private _initialized = false;
  private _systemRetryTimer: ReturnType<typeof setInterval> | null = null;
  private _systemRetryCount = 0;

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  async init(onDevicesChanged: (devices: any[]) => void, onActivityChanged: (active: boolean) => void, transportMode: string = 'auto', wsEndpoint: string = 'ws://127.0.0.1:12345', systemAudioEnabled: boolean = false, systemDeviceId: string = ''): Promise<void> {
    const transportChanged = transportMode !== this._initTransportMode || wsEndpoint !== this._initWSEndpoint;
    this.onDevicesChanged = onDevicesChanged;
    this.onActivityChanged = onActivityChanged;
    this._initTransportMode = transportMode;
    this._initWSEndpoint = wsEndpoint;
    this._initialized = true;
    this.restoreMotorIntensities();
    if (systemAudioEnabled && !this.useSystemAudio) {
      // Restore the user's persisted audio-source choice so a remount/reload
      // doesn't silently revert haptics back to Scene Audio.
      this.useSystemAudio = true;
      if (systemDeviceId) this._lastCaptureDeviceId = systemDeviceId;
    }
    if (this.connected && !transportChanged) {
      // Same transport already connected: don't tear down the live session —
      // that would drop an active system-audio capture and its mode.
      if (this.useSystemAudio && this.config.enabled) {
        await this.ensureCaptureRunning();
      }
      return;
    }
    await this.ensureConnected();
    if (this.useSystemAudio && this.config.enabled && this.connected) {
      await this.startSystemAnalysis(this._lastCaptureDeviceId ?? undefined);
    }
  }

  startAnalysis(audioElement: HTMLAudioElement): void {
    this._lastAudioElement = audioElement;
    if (!this.config.enabled) {
      console.log('[Haptic] startAnalysis: config not enabled yet, deferring');
      return;
    }
    if (this.useSystemAudio) {
      console.log('[Haptic] startAnalysis: system audio mode, delegating to startSystemAnalysis');
      this.startSystemAnalysis(this._lastCaptureDeviceId);
      return;
    }
    if (!this.connected) {
      console.log('[Haptic] startAnalysis: not connected, waiting (analysisWaiting=true)');
      this._analysisWaiting = true;
      return;
    }
    if (this.manager.getDevices().length === 0) {
      console.log('[Haptic] startAnalysis: connected but no device paired, waiting (analysisWaiting=true)');
      this._analysisWaiting = true;
      return;
    }
    console.log('[Haptic] startAnalysis: connected with device, starting scene audio analysis');
    this._analysisWaiting = false;
    this.startAnalysisInternal(audioElement);
  }

  private startAnalysisInternal(audioElement: HTMLAudioElement): void {
    this._frameCount = 0;
    this._firstFrameLogged = false;
    this._warmupFramesRemaining = 10;
    this._vibrating = false;
    this.beatHistory = [];
    this.lastBeatTime = 0;
    this._lastSentValue = -1;
    this._lastSentTime = 0;
    this._melodyRef = 0;
    this._voiceRef = 0;
    this._voiceFastEma = 0;
    this._voiceSlowEma = 0;
    this.analyzer.setSmoothing(this.config.directSmoothing);
    this.analyzer.start(audioElement, (frame) => this.onAnalysisFrame(frame));
    console.log('[Haptic] startAnalysisInternal: analyzer started on audio element src=', audioElement.src?.slice(-40));
  }

  tryStartPendingAnalysis(): void {
    if (!this.config.enabled) {
      console.log('[Haptic] tryStartPendingAnalysis: config.enabled is false');
      return;
    }
    if (!this.connected) {
      console.log('[Haptic] tryStartPendingAnalysis: not connected yet');
      return;
    }
    if (this.manager.getDevices().length === 0) {
      console.log('[Haptic] tryStartPendingAnalysis: no device paired yet');
      return;
    }
    if (!this._lastAudioElement) {
      console.log('[Haptic] tryStartPendingAnalysis: no stored audio element');
      return;
    }
    console.log('[Haptic] tryStartPendingAnalysis: starting analysis on stored audio element');
    this._analysisWaiting = false;
    this.startAnalysisInternal(this._lastAudioElement);
  }

  stopAnalysis(): void {
    this.analyzer.stop();
    this._silenceCounter = 0;
    this._vibrating = false;
    this._lastSentValue = -1;
    this._lastSentTime = 0;
    this._melodyRef = 0;
    this._voiceRef = 0;
    this._voiceFastEma = 0;
    this._voiceSlowEma = 0;
    this.stopMonitor();
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(t => t.stop());
      this.systemStream = null;
    }
    if (this._onSourceStatus) this._onSourceStatus('stopped');
  }

  // Plays the captured BlackHole stream back to the physical speakers so the
  // user still hears system audio while its output is routed to BlackHole.
  private async monitorStream(stream: MediaStream, sinkId?: string): Promise<void> {
    this.stopMonitor();
    if (!sinkId) {
      console.warn('[Haptic] No speakers sink available for monitoring — system audio will not be audible through speakers.');
      return;
    }
    const probe = document.createElement('audio');
    if (typeof (probe as any).setSinkId !== 'function') {
      console.warn('[Haptic] setSinkId unsupported — system audio will not be audible through speakers.');
      return;
    }
    try {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.srcObject = stream;
      el.volume = 1.0;
      document.body.appendChild(el);
      this.monitorEl = el;
      await (el as any).setSinkId(sinkId);
      el.play().catch((e) => console.warn('[Haptic] Monitor play failed:', e));
      console.log('[Haptic] Monitor running to speakers sink', sinkId);
    } catch (e) {
      console.warn('[Haptic] setSinkId failed, monitor removed:', e);
      this.stopMonitor();
    }
  }

  private stopMonitor(): void {
    if (this.monitorEl) {
      try { this.monitorEl.pause(); this.monitorEl.srcObject = null; } catch (_) {}
      try { this.monitorEl.remove(); } catch (_) {}
      this.monitorEl = null;
    }
  }

  async startSystemAnalysis(deviceId?: string): Promise<boolean> {
    if (!this.config.enabled) return false;
    this.initSystemCapture();
    if (!this.systemCapture || !this.systemCapture.isAvailable()) {
      this.lastSystemAudioError = 'System audio capture not available on this platform.';
      return false;
    }

    this._lastCaptureDeviceId = deviceId || null;

    if (!this.connected) {
      console.log('[Haptic] System analysis requested but not connected. Waiting...');
      this._analysisWaiting = true;
      return true;
    }

    this.stopAnalysis();

    // Pre-flight: monitoring to the speakers requires setSinkId, and routing
    // the system output to BlackHole would mute everything if we could not
    // monitor it back. Bail out before any routing happens.
    if (typeof document !== 'undefined' && typeof (document.createElement('audio') as any).setSinkId !== 'function') {
      this.lastSystemAudioError = 'This macOS build lacks audio-output selection (setSinkId) — system audio mode is not available. Update Electron/Chromium.';
      return false;
    }

    try {
      const result = await this.systemCapture.startCapture(deviceId);
      this.systemStream = result.stream;
      this.analyzer.startFromStream(result.stream, (frame) => this.onAnalysisFrame(frame));
      this.analyzer.setSmoothing(this.config.directSmoothing);
      this.lastSystemAudioError = null;
      this._analysisWaiting = false;
      console.log('[SystemAudio] Capturing from:', this.systemCapture.getStatus());
      const sink = await this.resolveMonitorSink();
      if (sink) {
        this.monitorStream(result.stream, sink);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[SystemAudio] Failed to start capture:', msg);
      this.lastSystemAudioError = msg;
      // Keep the user's chosen mode: a transient failure must not silently
      // flip haptics back to Scene Audio. Schedule a bounded retry.
      this._scheduleSystemRetry();
      return false;
    }
  }

  getLastSystemAudioError(): string | null {
    return this.lastSystemAudioError;
  }

  setSourceStatusCallback(cb: ((status: 'active' | 'silent' | 'stopped') => void) | null): void {
    this._onSourceStatus = cb;
  }

  getSourceStatus(): 'active' | 'silent' | 'stopped' {
    if (!this.systemStream) return 'stopped';
    if (this._silenceCounter >= 90) return 'silent';
    return 'active';
  }

  getAvailableCaptureDevices(): CaptureDevice[] {
    return this.systemCapture?.getCachedDevices() ?? [];
  }

  initSystemCapture(): void {
    if (this.systemCapture) return;
    const platform = detectPlatform();
    this.systemCapture = createSystemAudioCapture(platform);
    console.log('[SystemAudio] Platform:', platform, 'Available:', this.systemCapture.isAvailable());
  }

  isSystemAudioAvailable(): boolean {
    this.initSystemCapture();
    return this.systemCapture?.isAvailable() ?? false;
  }

  async refreshCaptureDevices(): Promise<CaptureDevice[]> {
    this.initSystemCapture();
    if (!this.systemCapture) return [];
    return await this.systemCapture.enumerateDevices();
  }

  getSystemAudioStatus(): string {
    if (!this.systemCapture) return 'Not available';
    return this.systemCapture.getStatus() ?? 'Not available';
  }

  // Must be called synchronously from a user-gesture handler so Chromium
  // allows the AudioContext to start/resume (capture itself starts async).
  warmUpAudioContext(): void {
    this.analyzer.warmUp();
  }

  async verifySystemRouting(): Promise<RoutingCheck> {
    this.initSystemCapture();
    if (!this.systemCapture?.verifyRouting) {
      return { ok: true, detail: '' };
    }
    return await this.systemCapture.verifyRouting();
  }

  async repairSystemRouting(): Promise<RoutingCheck> {
    this.initSystemCapture();
    if (!this.systemCapture?.repairRouting) {
      return { ok: false, detail: 'Routing repair is not supported on this platform.' };
    }
    const res = await this.systemCapture.repairRouting();
    if (res.ok && this.useSystemAudio) {
      await this.startSystemAnalysis(this._lastCaptureDeviceId ?? undefined);
    }
    return res;
  }

  // Physical outputs the user can hear the monitor through (e.g. AirPods).
  async listMonitorSinks(): Promise<Array<{ id: string; label: string }>> {
    this.initSystemCapture();
    if (typeof this.systemCapture?.listMonitorSinks === 'function') {
      return await this.systemCapture.listMonitorSinks();
    }
    return [];
  }

  // Change the monitor output live (and for the next capture start). id === ''
  // means "auto (built-in speakers)".
  async setMonitorSink(id: string): Promise<void> {
    this.monitorSinkOverride = id || null;
    const el = this.monitorEl;
    if (!el || typeof (el as any).setSinkId !== 'function') return;
    const sink = await this.resolveMonitorSink();
    if (!sink) {
      console.warn('[Haptic] No monitor output available — stopping monitor');
      this.stopMonitor();
      return;
    }
    try {
      await (el as any).setSinkId(sink);
      console.log('[Haptic] Monitor switched to sink', sink);
    } catch (e) {
      console.warn('[Haptic] setSinkId failed, monitor removed:', e);
      this.stopMonitor();
    }
  }

  getMonitorSinkOverride(): string {
    return this.monitorSinkOverride ?? '';
  }

  private async resolveMonitorSink(): Promise<string | null> {
    if (typeof this.systemCapture?.getMonitorSinkId === 'function') {
      return await this.systemCapture.getMonitorSinkId(this.monitorSinkOverride ?? undefined);
    }
    return null;
  }

  /** Brings the capture back up if mode is on but no capture is running. */
  private async ensureCaptureRunning(): Promise<void> {
    if (!this.useSystemAudio || !this.config.enabled) return;
    if (this.systemCapture && this.systemCapture.getStatus().startsWith('Capturing')) return;
    await this.startSystemAnalysis(this._lastCaptureDeviceId ?? undefined);
  }

  /**
   * Bounded auto-retry for a system-audio capture that failed to (re)start.
   * Polls every 5s while the user's chosen mode is still on and no capture is
   * running, so a transient stall self-heals instead of killing haptics.
   * Stops after a few attempts; the mode is kept (status shows "waiting")
   * rather than reverting to Scene Audio.
   */
  private _scheduleSystemRetry(): void {
    this._stopSystemRetry();
    if (!this.useSystemAudio || !this.config.enabled) return;
    this._systemRetryCount = 0;
    this._systemRetryTimer = setInterval(() => {
      if (!this.useSystemAudio || !this.config.enabled || !this.connected) {
        this._stopSystemRetry();
        return;
      }
      if (this.systemCapture && this.systemCapture.getStatus().startsWith('Capturing')) {
        this._stopSystemRetry();
        return;
      }
      if (this._systemRetryCount >= 3) {
        this._stopSystemRetry();
        return;
      }
      this._systemRetryCount++;
      console.log('[SystemAudio] Retrying capture start (' + this._systemRetryCount + '/3)');
      void this.startSystemAnalysis(this._lastCaptureDeviceId ?? undefined).then((ok) => {
        if (ok) this._stopSystemRetry();
      });
    }, 5000);
  }

  private _stopSystemRetry(): void {
    if (this._systemRetryTimer) {
      clearInterval(this._systemRetryTimer);
      this._systemRetryTimer = null;
    }
  }

  async setSystemAudioEnabled(enabled: boolean): Promise<boolean> {
    this.useSystemAudio = enabled;
    if (enabled) {
      const success = await this.startSystemAnalysis();
      return success;
    } else {
      this._stopSystemRetry();
      this.stopAnalysis();
      this.systemCapture?.stopCapture();
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(t => t.stop());
        this.systemStream = null;
      }
      console.log('[Haptic] setSystemAudioEnabled(false): system audio stopped, calling stopAll and checking scene restart');
      await this.manager.stopAll();
      this.tryStartPendingAnalysis();
      return true;
    }
  }

  isSystemAudioEnabled(): boolean {
    return this.useSystemAudio;
  }

  /** The capture device id selected for system audio ('' = default). */
  getSystemCaptureDeviceId(): string {
    return this._lastCaptureDeviceId ?? '';
  }

  private _frameCount = 0;
  private _firstFrameLogged = false;

  private onAnalysisFrame(frame: AudioAnalysisFrame): void {
    if (!this.config.enabled || !this.connected) return;
    if (this.manager.getDevices().length === 0) {
      this._analysisWaiting = true;
      return;
    }

    if (this._warmupFramesRemaining > 0) {
      this._warmupFramesRemaining--;
      return;
    }

    const baseIntensity = this.computeIntensity(frame);
    const scaled = Math.min(1, Math.max(0, baseIntensity * (this.config.intensity / 100)));

    this._frameCount++;
    if (!this._firstFrameLogged && this._frameCount >= 5) {
      this._firstFrameLogged = true;
      console.log('[Haptic] First analysis frames:', {
        rms: frame.rms.toFixed(4), rmsRaw: frame.rmsRaw.toFixed(4),
        base: baseIntensity.toFixed(4), scaled: scaled.toFixed(4),
        pattern: this.config.pattern, intensity: this.config.intensity,
        deviceCount: this.manager.getDevices().length,
        activeDevice: this.activeDeviceIndex,
      });
    }
    if (this._frameCount % 90 === 0) {
      const motors: Record<string, number> = {};
      for (const [k, v] of this.motorIntensities) motors[String(k)] = v;
      console.log('[Haptic] ~3s:', {
        rms: frame.rms.toFixed(3), rmsRaw: frame.rmsRaw.toFixed(3),
        base: baseIntensity.toFixed(3), scaled: scaled.toFixed(3),
        pattern: this.config.pattern, intensity: this.config.intensity,
        deviceCount: this.manager.getDevices().length,
        motors,
      });
    }

    // Source status tracks the raw capture signal, not the pattern output —
    // sparse patterns (beats / melody gaps) must not read as "No audio
    // detected" while music is actually playing.
    if (frame.rmsRaw > 0.0005) {
      this._silenceCounter = 0;
      if (this._onSourceStatus) this._onSourceStatus('active');
    } else {
      this._silenceCounter++;
      if (this._silenceCounter >= 90 && this._onSourceStatus) {
        this._onSourceStatus('silent');
      }
    }

    if (scaled > 0.0001) {
      if (this._vibrating) {
        if (performance.now() - this._vibrateStartedAt > VIBRATE_WATCHDOG_MS) {
          console.warn('[Haptic] Vibrate watchdog: force-clearing stuck busy latch');
          this._vibrating = false;
        } else {
          this.onActivityChanged?.(true);
          return;
        }
      }
      const now = performance.now();
      const changedEnough = Math.abs(scaled - this._lastSentValue) >= VIBRATE_DELTA;
      if (!changedEnough && (now - this._lastSentTime) < VIBRATE_MIN_INTERVAL_MS) {
        this.onActivityChanged?.(true);
        return;
      }

      const devices = this.manager.getDevices();
      const device = devices.find(d => d.index === this.activeDeviceIndex);
      if (!device) {
        if (this._frameCount % 30 === 0) {
          console.log('[Haptic] No device found for index', this.activeDeviceIndex, 'available:', devices.map(d => d.index));
        }
        this.onActivityChanged?.(true);
        return;
      }
      this._vibrating = true;
      this._vibrateStartedAt = now;
      this._lastSentValue = scaled;
      this._lastSentTime = now;
      const idx = this.activeDeviceIndex;
      const sendVibrate = async () => {
        try {
          let send: Promise<void>;
          if (device.motors.length > 0) {
            const motorValues = device.motors.map(m => {
              const motorScale = this.getMotorIntensityFor(idx, m.index);
              return { index: m.index, value: Math.min(1, Math.max(0, scaled * (motorScale / 100))) };
            });
            send = this.manager.vibrateMulti(idx, motorValues);
          } else {
            // No per-motor metadata: still honor the index-0 Motor slider.
            const motorScale = this.getMotorIntensityFor(idx, 0);
            send = this.manager.vibrate(idx, Math.min(1, Math.max(0, scaled * (motorScale / 100))));
          }
          await Promise.race([
            send,
            new Promise((_, reject) => setTimeout(() => reject(new Error('vibrate command timed out')), VIBRATE_TIMEOUT_MS)),
          ]);
        } catch (e) {
          console.warn('[Haptic] Vibrate failed:', e);
        } finally {
          this._vibrating = false;
        }
      };
      sendVibrate();
      this.onActivityChanged?.(true);
    } else {
      this.onActivityChanged?.(false);
      // BLE toys hold their last commanded intensity until told otherwise.
      // Sparse patterns (beat/melody) and pauses must explicitly release the
      // motor once when output drops to zero, or the toy stays stuck at the
      // previous pattern's level.
      if (
        this._lastSentValue > 0.0001 &&
        !this._vibrating &&
        this.connected &&
        this.manager.getDevices().length > 0
      ) {
        const device = this.manager.getDevices().find(d => d.index === this.activeDeviceIndex);
        if (device) {
          this._lastSentValue = 0;
          this._lastSentTime = performance.now();
          void this.manager.stopAll().catch(() => {});
        }
      }
    }
  }

  private computeIntensity(frame: AudioAnalysisFrame): number {
    switch (this.config.pattern) {
      case HapticPattern.direct:
        return Math.min(1, frame.rms * this.config.directGain);
      case HapticPattern.bass:
        return Math.min(1, this.computeBassIntensity(frame) * this.config.bassGain);
      case HapticPattern.melody:
        return Math.min(1, this.computeMelodyIntensity(frame) * this.config.melodyGain);
      case HapticPattern.voice:
        return Math.min(1, this.computeVoiceIntensity(frame) * this.config.voiceGain);
      case HapticPattern.beat:
        return this.computeBeatIntensity(frame);
      default:
        return frame.rms;
    }
  }

  private computeBassIntensity(frame: AudioAnalysisFrame): number {
    const bins = frame.frequencyData.length >> 3;
    let sum = 0;
    for (let i = 0; i < bins; i++) sum += frame.frequencyData[i];
    return (sum / bins) / 255;
  }

  // Presence/harmonic region — meaningful on every sample rate (Windows
  // loopback commonly runs 48 kHz, mac/linux 44.1 kHz; a fixed "top half of
  // the FFT" band lands above 11–12 kHz where compressed music is empty).
  private computeMelodyIntensity(frame: AudioAnalysisFrame): number {
    const hzPerBin = frame.sampleRate / FFT_SIZE;
    const start = Math.max(1, Math.floor(2000 / hzPerBin));
    const end = Math.min(frame.frequencyData.length, Math.ceil(10000 / hzPerBin));
    const count = end - start;
    if (count <= 0) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) sum += frame.frequencyData[i];
    const avg = (sum / count) / 255;

    // Adaptive normalization: track the band's recent peak (instant attack,
    // slow ~4s release) and scale against it. Quiet output volume (e.g. 20%)
    // therefore reads with the same dynamics as full volume.
    this._melodyRef = Math.max(avg, this._melodyRef * 0.999);
    // Noise gate: pure digital silence/dither must not normalize up to signal.
    if (avg < 0.01 || this._melodyRef < 0.01) return 0;
    return Math.min(1, avg / this._melodyRef);
  }

  private beatHistory: number[] = [];
  private lastBeatTime = 0;
  // Rolling peak of the melody band used as auto-gain reference (fast attack,
  // slow release) so low system/output volume doesn't flatten the response.
  private _melodyRef = 0;

  // Voice-pattern state: speech-band auto-gain reference plus fast/slow
  // envelope EMAs used to weight the drive by syllable-rate modulation.
  private _voiceRef = 0;
  private _voiceFastEma = 0;
  private _voiceSlowEma = 0;

  /**
   * Voice heuristic (no speech recognition): voice lives around 250–2500 Hz,
   * above music/VFX bass and below high-shelved whooshes, and — the real
   * discriminator — it modulates at a syllable rate (constant loud/soft
   * swings) whereas sustained background chords/VFX are steady. Drive =
   * speech-band level, auto-gained, weighted by how much the band is
   * fluctuating (fast EMA vs slow EMA), with low-band de-emphasis.
   */
  private computeVoiceIntensity(frame: AudioAnalysisFrame): number {
    const hzPerBin = frame.sampleRate / FFT_SIZE;
    const start = Math.max(1, Math.floor(250 / hzPerBin));
    const end = Math.min(frame.frequencyData.length, Math.ceil(2500 / hzPerBin));
    const lowEnd = Math.min(frame.frequencyData.length, Math.max(1, Math.ceil(240 / hzPerBin)));
    const count = end - start;
    if (count <= 0) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) sum += frame.frequencyData[i];
    const bandAvg = (sum / count) / 255;

    let lowSum = 0;
    for (let i = 1; i < lowEnd; i++) lowSum += frame.frequencyData[i];
    const lowAvg = lowEnd > 1 ? (lowSum / (lowEnd - 1)) / 255 : 0;

    // Adaptive normalization so quiet voice still registers.
    this._voiceRef = Math.max(bandAvg, this._voiceRef * 0.999);
    if (bandAvg < 0.01 || this._voiceRef < 0.01) {
      this._voiceFastEma = 0;
      this._voiceSlowEma = 0;
      return 0;
    }
    const normalized = Math.min(1, bandAvg / this._voiceRef);

    // Syllable-rate weighting: fast (~120ms) vs slow (~800ms) envelope of the
    // speech band. Speech swings fast relative to its own slow average, so
    // fast/slow > 1 pulses the drive; steady music/VFX sits near 1 (floor).
    const alphaFast = 0.25;
    const alphaSlow = 0.04;
    this._voiceFastEma = alphaFast * bandAvg + (1 - alphaFast) * this._voiceFastEma;
    this._voiceSlowEma = alphaSlow * bandAvg + (1 - alphaSlow) * this._voiceSlowEma;
    const speechiness = Math.max(0, Math.min(1, this._voiceFastEma / Math.max(0.0001, this._voiceSlowEma) - 1));

    // Bass-heavy frames are likely music/effects rather than speech.
    const lowPenalty = lowAvg > bandAvg ? Math.max(0, 1 - (lowAvg - bandAvg)) : 1;

    return Math.min(1, normalized * (0.35 + 0.65 * speechiness) * lowPenalty);
  }

  private computeBeatIntensity(frame: AudioAnalysisFrame): number {
    this.beatHistory.push(frame.rmsRaw);
    if (this.beatHistory.length > 30) this.beatHistory.shift();

    if (this.beatHistory.length < 5) return 0;

    const avg = this.beatHistory.reduce((a, b) => a + b, 0) / this.beatHistory.length;
    const now = performance.now();

    if (frame.rmsRaw > avg * this.config.beatThreshold && (now - this.lastBeatTime) > this.config.beatCooldownMs) {
      this.lastBeatTime = now;
      return 1.0;
    }
    return 0;
  }

  setConfig(config: Partial<HapticConfig>): void {
    const patternChanged = config.pattern !== undefined && config.pattern !== this.config.pattern;
    this.config = { ...this.config, ...config };
    // Any config change the user makes must apply immediately: clear the busy
    // latch so a pending/overlapping BLE command can't swallow the new value,
    // and push the next frame through without wait for the old throttle window.
    this._vibrating = false;
    this._vibrateStartedAt = 0;
    this._lastSentTime = 0;
    this._lastSentValue = -1;
    if (patternChanged) {
      // Switching patterns must never inherit stale drive state: a hung
      // command from the old pattern or leftover beat history would otherwise
      // silence the new one.
      this._vibrating = false;
      this.beatHistory = [];
      this.lastBeatTime = 0;
      this._lastSentValue = -1;
      this._lastSentTime = 0;
      this._melodyRef = 0;
      this._voiceRef = 0;
      this._voiceFastEma = 0;
      this._voiceSlowEma = 0;
      // Start the new pattern from silence instead of inheriting the previous
      // pattern's last commanded intensity.
      void this.manager.stopAll().catch(() => {});
    }
    console.log('[Haptic] Config updated:', { pattern: this.config.pattern, intensity: this.config.intensity, enabled: this.config.enabled });
  }

  getConfig(): HapticConfig {
    return { ...this.config };
  }

  setActiveDevice(index: number): void {
    this.activeDeviceIndex = index;
  }

  private motorKey(deviceIndex: number, motorIndex: number): string {
    return deviceIndex + ':' + motorIndex;
  }

  getMotorIntensity(motorIndex: number): number {
    return this.getMotorIntensityFor(this.activeDeviceIndex, motorIndex);
  }

  getMotorIntensityFor(deviceIndex: number, motorIndex: number): number {
    return this.motorIntensities.get(this.motorKey(deviceIndex, motorIndex)) ?? 100;
  }

  setMotorIntensity(motorIndex: number, value: number): void {
    this.setMotorIntensityFor(this.activeDeviceIndex, motorIndex, value);
  }

  setMotorIntensityFor(deviceIndex: number, motorIndex: number, value: number): void {
    this.motorIntensities.set(this.motorKey(deviceIndex, motorIndex), Math.max(0, Math.min(100, value)));
    this.persistMotorIntensities();
  }

  private persistMotorIntensities(): void {
    const gs: any = useStore.getState()?.config?.generalSettings ?? {};
    const next = { ...gs, hapticMotorIntensities: { ...this.motorIntensities } };
    useStore.setState((s: any) => ({
      config: { ...s.config, generalSettings: next },
    }));
  }

  private restoreMotorIntensities(): void {
    if (this.motorIntensities.size > 0) return;
    const saved: Record<string, number> | undefined = useStore.getState()?.config?.generalSettings?.hapticMotorIntensities;
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(saved)) {
        const v = saved[k];
        if (typeof v === 'number') this.motorIntensities.set(k, v);
      }
    }
  }

  getActiveDeviceMotors(): Array<{index: number; type: string; description: string; maxValue: number}> {
    const devices = this.manager.getDevices();
    const device = devices.find(d => d.index === this.activeDeviceIndex);
    return device?.motors ?? [];
  }

  async startScanning(): Promise<boolean> {
    if (this.connected) {
      this.manager.setAwaitingConnection(true);
    }
    return await this.manager.startScanning();
  }

  // Deferred callback: disabled in favor of auto-select in main.ts
  // selectDevice(deviceId: string): void {
  //   console.log('[BLE] Storing deferred device selection:', deviceId);
  //   this._pendingDeviceId = deviceId;
  // }
  //
  // hasPendingSelection(): boolean {
  //   return this._pendingDeviceId !== null;
  // }

  getLastError(): string | null {
    return this.manager.getLastError();
  }

  async stopScanning(): Promise<void> {
    await this.manager.stopScanning();
  }

  async testVibrate(deviceIndex: number): Promise<void> {
    if (!this.connected) return;
    const intensity = (this.config.intensity / 100) * 0.5;
    const devices = this.manager.getDevices();
    const device = devices.find(d => d.index === deviceIndex);
    if (device && device.motors.length > 0) {
      const motorValues = device.motors.map(m => {
        const motorScale = this.getMotorIntensityFor(deviceIndex, m.index);
        return { index: m.index, value: Math.min(1, Math.max(0, intensity * (motorScale / 100))) };
      });
      await this.manager.vibrateMulti(deviceIndex, motorValues);
    } else {
      const motorScale = this.getMotorIntensityFor(deviceIndex, 0);
      await this.manager.vibrate(deviceIndex, Math.min(1, Math.max(0, intensity * (motorScale / 100))));
    }
    setTimeout(() => this.manager.stopAll(), 1000);
  }

  isConnected(): boolean {
    return this.connected;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async ensureConnected(): Promise<boolean> {
    if (this.connected) return true;
    if (!this._initialized) return false;
    console.log('[Haptic] ensureConnected: trying reconnect via', this._initTransportMode, this._initWSEndpoint);
    await this.reconnect();
    console.log('[Haptic] ensureConnected: result =', this.connected);
    return this.connected;
  }

  async reconnect(): Promise<void> {
    console.log('[Haptic] reconnect: shutting down existing connection...');
    await this.shutdown();
    console.log('[Haptic] reconnect: connecting via', this._initTransportMode);
    try {
      await this.manager.connect((devices) => {
        this.connected = this.manager.isConnected();
        this.onDevicesChanged?.(devices);
        if (devices.length > 0) {
          if (this._analysisWaiting && !this.useSystemAudio && this._lastAudioElement) {
            console.log('[Haptic] Device connected, starting pending analysis');
            this._analysisWaiting = false;
            this.startAnalysisInternal(this._lastAudioElement);
          } else if (this._analysisWaiting && this.useSystemAudio) {
            console.log('[Haptic] Device connected, starting pending system analysis');
            this._analysisWaiting = false;
            this.startSystemAnalysis(this._lastCaptureDeviceId);
          }
        } else {
          if (this._lastAudioElement) {
            console.log('[Haptic] All devices disconnected, pausing analysis');
            this.stopAnalysis();
            this._analysisWaiting = true;
          }
        }
      }, this._initTransportMode, this._initWSEndpoint);
      this.connected = this.manager.isConnected();
      console.log('[Haptic] reconnect: connected =', this.connected);
      // Re-arm a persisted system-audio mode now that the link is back.
      if (this.useSystemAudio && this.config.enabled && this.connected) {
        void this.startSystemAnalysis(this._lastCaptureDeviceId ?? undefined).catch(() => {});
      }
    } catch (err) {
      console.warn('[Haptic] Reconnect failed:', err);
      this.connected = false;
    }
  }

  getDevices(): any[] {
    return this.manager.getDevices();
  }

  hasDevices(): boolean {
    try {
      return this.manager.getDevices().length > 0;
    } catch (e) {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this._stopSystemRetry();
    this.stopAnalysis();
    this.analyzer.dispose();
    if (this.systemCapture) {
      this.systemCapture.dispose();
      this.systemCapture = null;
    }
    await this.manager.stopAll();
    await this.manager.disconnect();
  }
}
