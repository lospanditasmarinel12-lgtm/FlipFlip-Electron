import { AudioContext } from 'standardized-audio-context';
import { AudioAnalysisFrame } from './types';

export const FFT_SIZE = 2048;
const SMOOTHING_TIME_CONSTANT = 0.8;
const POLL_INTERVAL_MS = 32;
const WARMUP_FRAMES = 5;
const READINESS_POLL_MS = 100;
const READINESS_TIMEOUT_MS = 5000;
const RESUME_POLL_MS = 250;
const RESUME_POLL_MAX_TICKS = 40;

export class AudioAnalyzer {
  private _ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: any = null;
  private _tapStream: MediaStream | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _readinessTimer: ReturnType<typeof setInterval> | null = null;
  private smoothedRms = 0;
  private onFrame: ((frame: AudioAnalysisFrame) => void) | null = null;
  private _frameCount = 0;
  alpha = 0.3;

  setSmoothing(alpha: number): void {
    this.alpha = Math.max(0.05, Math.min(0.95, alpha));
  }

  private ensureContext(): AudioContext {
    if (this._ctx && this._ctx.state !== 'closed') {
      return this._ctx;
    }
    this._ctx = new AudioContext() as unknown as AudioContext;
    return this._ctx;
  }

  private _gestureResume: (() => void) | null = null;
  private _resumePollTimer: ReturnType<typeof setInterval> | null = null;
  private _resumePollTicks = 0;

  // Chromium suspends a fresh AudioContext until a user gesture; haptics often
  // start outside one (analysis begins during playback). Resume lazily and on
  // the next gesture so the analyser actually receives frames.
  private resumeContext(): void {
    const a = this._ctx as any;
    if (a && a.state === 'suspended') {
      a.resume().catch(() => {});
    }
    this.startResumePoll();
  }

  // A suspended context feeds the analyser all-zero frames forever (reads as
  // "No audio detected"). resume() can silently fail outside a user gesture,
  // so keep retrying until the context is actually running.
  private startResumePoll(): void {
    if (this._resumePollTimer) return;
    this._resumePollTicks = 0;
    this._resumePollTimer = setInterval(() => {
      const c = this._ctx as any;
      this._resumePollTicks++;
      if (!c || c.state === 'closed' || c.state === 'running' || this._resumePollTicks > RESUME_POLL_MAX_TICKS) {
        if (c && c.state === 'suspended') {
          console.warn('[Haptics] AudioContext still suspended after ' + this._resumePollTicks + ' resume attempts — analysis will read silence');
        }
        this.clearResumePoll();
        return;
      }
      c.resume().catch(() => {});
    }, RESUME_POLL_MS);
  }

  private clearResumePoll(): void {
    if (this._resumePollTimer) {
      clearInterval(this._resumePollTimer);
      this._resumePollTimer = null;
    }
  }

  // Create/resume the context synchronously. Call this from a user-gesture
  // handler (e.g. the "System Audio" toggle click) — Chromium only honors
  // resume() during a gesture, and capture starts async after the gesture ends.
  warmUp(): void {
    const ctx = this.ensureContext();
    this.resumeContext();
    this.attachGestureResume();
    console.log('[Haptics] warmUp: ctx.state=' + (ctx as any).state);
  }

  getContextState(): string {
    return (this._ctx as any)?.state ?? 'none';
  }

  private attachGestureResume(): void {
    if (this._gestureResume) return;
    this._gestureResume = () => this.resumeContext();
    window.addEventListener('pointerdown', this._gestureResume, true);
    window.addEventListener('keydown', this._gestureResume, true);
  }

  private detachGestureResume(): void {
    if (this._gestureResume) {
      window.removeEventListener('pointerdown', this._gestureResume, true);
      window.removeEventListener('keydown', this._gestureResume, true);
      this._gestureResume = null;
    }
  }

  start(audioElement: HTMLAudioElement, onFrame: (frame: AudioAnalysisFrame) => void): void {
    this.stop();
    this.onFrame = onFrame;

    if (audioElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      this.startImmediate(audioElement);
    } else {
      console.log('[Haptics] Audio element not ready (readyState=' + audioElement.readyState + '), polling...');
      this._readinessTimer = setInterval(() => {
        if (audioElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          this.clearReadinessTimer();
          this.startImmediate(audioElement);
        }
      }, READINESS_POLL_MS);
      setTimeout(() => {
        if (this._readinessTimer) {
          console.warn('[Haptics] Audio readiness timeout, attempting start anyway');
          this.clearReadinessTimer();
          this.startImmediate(audioElement);
        }
      }, READINESS_TIMEOUT_MS);
    }
  }

  private startImmediate(audioElement: HTMLAudioElement): void {
    try {
      const ctx = this.ensureContext();
      this.resumeContext();
      this.attachGestureResume();
      this.analyser = ctx.createAnalyser() as any;
      (this.analyser as any).fftSize = FFT_SIZE;
      (this.analyser as any).smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

      // Prefer a silent captureStream tap: the element keeps playing through the
      // browser's native media path at full quality while the analyser listens to
      // a duplicate. Routing the audible element into the WebAudio graph
      // (createMediaElementSource) resamples it and audibly degrades the audio.
      if (typeof (audioElement as any).captureStream === 'function') {
        try {
          const stream = (audioElement as any).captureStream() as MediaStream;
          if (stream && stream.getAudioTracks().length > 0) {
            this._tapStream = stream;
            this.source = (ctx as any).createMediaStreamSource(stream);
            this.source.connect(this.analyser as any);
            console.log('[Haptics] Using captureStream tap for scene audio analysis (element plays natively)');
          } else {
            this.stopTapStream();
          }
        } catch (tapErr) {
          console.warn('[Haptics] captureStream tap failed, falling back to createMediaElementSource:', tapErr);
          this.stopTapStream();
          this.source = null;
        }
      }

      // Fallback (WebViews without captureStream, or an element that cannot be
      // tapped): route it through the graph. If the element is already bound to
      // another context this throws and analysis is skipped.
      if (!this.source) {
        try {
          this.source = (ctx as any).createMediaElementSource(audioElement);
        } catch (boundErr) {
          console.warn('[Haptics] createMediaElementSource failed — element already bound to another context');
          this.disconnectNodes();
          return;
        }
        if (!this.source) {
          console.error('[Haptics] Failed to create media element source');
          this.disconnectNodes();
          return;
        }
        this.source.connect(this.analyser as any);
        // Pass through so routing the element through the graph never mutes it.
        (this.analyser as any).connect((ctx as any).destination);
      }
    } catch (err) {
      console.error('[Haptics] Failed to create audio context:', err);
      this.disconnectNodes();
      return;
    }

    this._frameCount = 0;
    this._silentTicks = 0;
    this.smoothedRms = 0;
    this.intervalId = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  startFromStream(mediaStream: MediaStream, onFrame: (frame: AudioAnalysisFrame) => void): void {
    this.stop();
    this.onFrame = onFrame;

    try {
      const ctx = this.ensureContext();
      this.resumeContext();
      this.attachGestureResume();
      this.analyser = ctx.createAnalyser() as any;
      (this.analyser as any).fftSize = FFT_SIZE;
      (this.analyser as any).smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

      this.source = (ctx as any).createMediaStreamSource(mediaStream);
      this.source.connect(this.analyser as any);

      const tracks = mediaStream.getAudioTracks().map(t => {
        const s: any = typeof t.getSettings === 'function' ? t.getSettings() : {};
        return { label: t.label, rate: s.sampleRate, ch: s.channelCount, muted: t.muted, readyState: t.readyState };
      });
      console.log('[Haptics] startFromStream:', { ctxState: (ctx as any).state, ctxRate: (ctx as any).sampleRate, tracks });
    } catch (err) {
      console.warn('[Haptics] Failed to create stream audio context:', err);
      this.disconnectNodes();
      return;
    }

    this._frameCount = 0;
    this._silentTicks = 0;
    this.smoothedRms = 0;
    this.intervalId = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  stop(): void {
    this.clearReadinessTimer();
    this.clearResumePoll();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.disconnectNodes();
    this.onFrame = null;
  }

  private stopTapStream(): void {
    if (this._tapStream) {
      this._tapStream.getTracks().forEach(t => t.stop());
      this._tapStream = null;
    }
  }

  private disconnectNodes(): void {
    this.stopTapStream();
    if (this.source) {
      try { (this.source as any).disconnect(); } catch (_) {}
      this.source = null;
    }
    if (this.analyser) {
      try { (this.analyser as any).disconnect(); } catch (_) {}
      this.analyser = null;
    }
  }

  dispose(): void {
    this.stop();
    this.detachGestureResume();
    if (this._ctx) {
      (this._ctx as any).close().catch(() => {});
      this._ctx = null;
    }
  }

  private clearReadinessTimer(): void {
    if (this._readinessTimer) {
      clearInterval(this._readinessTimer);
      this._readinessTimer = null;
    }
  }

  private _silentTicks = 0;

  private tick(): void {
    if (!this.analyser || !this._ctx) return;

    this._frameCount++;
    if (this._frameCount <= WARMUP_FRAMES) return;

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const waveData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    this.analyser.getByteTimeDomainData(waveData);

    let sum = 0;
    for (let i = 0; i < waveData.length; i++) {
      const normalized = (waveData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rmsRaw = Math.sqrt(sum / waveData.length);

    if (rmsRaw <= 0.0001) {
      this._silentTicks++;
      if (this._silentTicks === 90) {
        console.warn('[Haptics] Analyser input is silent (~3s). ctx.state=' + (this._ctx as any).state +
          ' — if "suspended", click anywhere in the app; if "running", the captured device carries no audio.');
      }
    } else {
      this._silentTicks = 0;
    }

    const alpha = this.alpha;
    this.smoothedRms = alpha * rmsRaw + (1 - alpha) * this.smoothedRms;

    this.onFrame?.({
      timestamp: this._ctx.currentTime,
      rms: Math.min(1, this.smoothedRms),
      rmsRaw,
      frequencyData: freqData,
      waveformData: waveData,
      sampleRate: this._ctx.sampleRate,
    });
  }
}
