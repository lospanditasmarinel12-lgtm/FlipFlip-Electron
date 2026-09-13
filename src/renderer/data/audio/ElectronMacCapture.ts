import * as fs from 'fs';
import { ipcRenderer } from 'electron';
import { IPC } from '../const';
import { ISystemAudioCapture, CaptureDevice, CaptureResult, RoutingCheck } from './ISystemAudioCapture';

const AGGREGATE_UID = 'com.flipflip.app.multi-output';
const AGGREGATE_NAME = 'FlipFlip Multi-Output';
const FALLBACK_LOOPBACK_UIDS = ['BlackHole2ch_UID', 'BlackHole16ch_UID', 'BlackHole64ch_UID'];

export interface MonitorSink {
  id: string;
  label: string;
}

export class ElectronMacCapture implements ISystemAudioCapture {
  private currentStream: MediaStream | null = null;
  private currentDevice: CaptureDevice | null = null;
  private cachedDevices: CaptureDevice[] = [];
  private savedOutputUid: string | null = null;
  private loopbackUid: string | null = null;
  private loopbackUidPromise: Promise<string | null> | null = null;

  isAvailable(): boolean { return true; }

  async enumerateDevices(): Promise<CaptureDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map(d => {
          const isMonitor = /blackhole|soundflower|loopback|vb.?cable|aggregate|multi.?output|background.?music/i.test(d.label);
          return {
            id: d.deviceId, label: d.label || 'Unknown', groupId: d.groupId,
            isMonitor: isMonitor || /blackhole/i.test(d.label),
            isRunning: true,
          };
        });
      // BlackHole first (the recording side of a loopback), then other virtual monitors.
      audioInputs.sort((a, b) => {
        if (/blackhole/i.test(a.label) && !/blackhole/i.test(b.label)) return -1;
        if (!/blackhole/i.test(a.label) && /blackhole/i.test(b.label)) return 1;
        if (a.isMonitor && !b.isMonitor) return -1;
        if (!a.isMonitor && b.isMonitor) return 1;
        return a.label.localeCompare(b.label);
      });
      this.cachedDevices = audioInputs;
      console.log('[SystemAudio] macOS devices:', audioInputs.map(d => `${d.label}${d.isMonitor ? ' (loopback)' : ''}`));
      return audioInputs;
    } catch (err) {
      console.warn('[SystemAudio] macOS enumerate failed:', err);
      return this.cachedDevices;
    }
  }

  getCachedDevices(): CaptureDevice[] { return this.cachedDevices; }

  /**
   * Ensure the "FlipFlip Multi-Output" aggregate (speakers + BlackHole) exists
   * via the bundled CoreAudio helper, so system audio is both audible and
   * captured. Best-effort; capturing BlackHole works once output is there.
   */
  async createLoopback(): Promise<boolean> {
    try {
      const res = await this.invokeHelper('create');
      if (res && (res.ok || res.created)) {
        await this.enumerateDevices();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async invokeHelper(action: string, arg?: string): Promise<any> {
    try {
      return await ipcRenderer.invoke(IPC.systemAudioMacMultiOutput, action, arg);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Find the loopback device's CoreAudio UID for routing (BlackHole, then
  // Soundflower, then any virtual), so System Audio works on any Mac rather
  // than assuming "BlackHole2ch_UID".
  private async detectLoopbackUid(): Promise<string | null> {
    if (this.loopbackUid) return this.loopbackUid;
    if (!this.loopbackUidPromise) {
      this.loopbackUidPromise = (async () => {
        const list = await this.invokeHelper('list');
        if (Array.isArray(list) && list.length > 0) {
          const entries: Array<{ uid: string; name: string }> = list;
          const blackhole = entries.find(n => /blackhole/i.test(n.name));
          const soundflower = entries.find(n => /soundflower/i.test(n.name));
          const virtual = entries.find(n => /loopback|virtual|vb.?cable/i.test(n.name));
          const pick = blackhole || soundflower || virtual;
          if (pick?.uid) {
            this.loopbackUid = pick.uid;
            console.log('[SystemAudio] Detected loopback device:', pick.name, pick.uid);
            return this.loopbackUid;
          }
        }
        for (const uid of FALLBACK_LOOPBACK_UIDS) {
          if (Array.isArray(list) && list.some((n: { uid: string }) => n.uid === uid)) {
            this.loopbackUid = uid;
            return uid;
          }
        }
        console.warn('[SystemAudio] No loopback device found on this Mac.');
        return null;
      })();
    }
    return await this.loopbackUidPromise;
  }

  async verifyRouting(): Promise<RoutingCheck> {
    const loopUid = await this.detectLoopbackUid();
    if (!loopUid) {
      return { ok: false, detail: 'No loopback device (BlackHole/Soundflower) found. Install BlackHole (brew install blackhole-2ch) and retry.' };
    }
    const def = await this.invokeHelper('default');
    if (!def || def.ok === false) {
      return { ok: false, detail: 'Could not query the default output device.' };
    }
    if (def.uid === loopUid) {
      return { ok: true, detail: 'System output is routed to the loopback \u2014 capture will receive every app\u2019s audio.' };
    }
    return {
      ok: false,
      detail: `System output is "${def.name || 'unknown'}". Set it to the loopback so all apps' audio reaches the capture.`,
    };
  }

  async repairRouting(): Promise<RoutingCheck> {
    const loopUid = await this.detectLoopbackUid();
    if (!loopUid) {
      return { ok: false, detail: 'No loopback device found. Install BlackHole (brew install blackhole-2ch) and retry.' };
    }
    const setDef = await this.invokeHelper('set-default', loopUid);
    await this.enumerateDevices();
    if (setDef && setDef.ok) {
      return { ok: true, detail: 'System output set to the loopback. Start playback and the capture will react.' };
    }
    return { ok: false, detail: 'Could not set the loopback as the system output automatically.' };
  }

  private blackholeDriverInstalled(): boolean {
    try {
      const dir = '/Library/Audio/Plug-Ins/HAL';
      if (!fs.existsSync(dir)) return false;
      return fs.readdirSync(dir).some(f => /^BlackHole.*\.driver$/.test(f));
    } catch {
      return false;
    }
  }

  async startCapture(deviceId?: string): Promise<CaptureResult> {
    this.stopCapture();

    if (!deviceId) {
      if (this.cachedDevices.length === 0) await this.enumerateDevices();
      const blackhole = this.cachedDevices.find(d => /blackhole/i.test(d.label));
      const monitor = blackhole ?? this.cachedDevices.find(d => d.isMonitor);
      if (!monitor) {
        if (this.blackholeDriverInstalled()) {
          throw new Error('BlackHole is installed but not yet loaded. Reboot your Mac (or run "sudo killall coreaudiod") and try again.');
        }
        throw new Error('No loopback device found. Install BlackHole (brew install blackhole-2ch), then run the FlipFlip Audio Setup tool to create the Multi-Output Device.');
      }
      deviceId = monitor.id;
    }

    // On macOS the multi-output aggregate only feeds its master leg (observed
    // on macOS 15.7), so we route the system's default output directly to the
    // loopback device instead. That captures every app's audio (proven path);
    // the renderer plays the captured stream back to the speakers as a monitor.
    const loopUid = await this.detectLoopbackUid();
    const cur = await this.invokeHelper('default');
    if (loopUid && cur && cur.ok && cur.uid !== loopUid) {
      this.savedOutputUid = cur.uid;
      await this.invokeHelper('set-default', loopUid);
    }

    const selected = this.cachedDevices.find(d => d.id === deviceId);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      this.restoreOutput();
      throw err;
    }
    this.currentStream = stream;
    this.currentDevice = selected || null;
    const monitorSinkId = deviceId && /blackhole/i.test(selected?.label ?? '')
      ? await this.getMonitorSinkId()
      : undefined;
    return { stream, device: selected!, monitorSinkId };
  }

  private async restoreOutput(): Promise<void> {
    if (this.savedOutputUid) {
      await this.invokeHelper('set-default', this.savedOutputUid);
      this.savedOutputUid = null;
    }
  }

  // Physical output devices for the "Monitor to" picker. Excludes loopbacks
  // and virtual mixers.
  async listMonitorSinks(): Promise<MonitorSink[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .filter(d => !/blackhole|soundflower|loopback|vb.?cable|aggregate|multi.?output/i.test(d.label))
        .map(d => ({ id: d.deviceId, label: d.label || 'Unknown output' }));
    } catch {
      return [];
    }
  }

  // Resolve the Chromium device id the monitor should play to. Honors a
  // user preference (e.g. AirPods) when it is still connected; otherwise
  // falls back to the physical speakers.
  async getMonitorSinkId(preferred?: string): Promise<string | null> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outs = devices.filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      const physical = outs.filter(d => !/blackhole|soundflower|loopback|vb.?cable|aggregate|multi.?output/i.test(d.label));
      if (preferred) {
        const match = outs.find(d => d.deviceId === preferred);
        if (match && !/blackhole|soundflower|loopback|vb.?cable|aggregate|multi.?output/i.test(match.label)) {
          return match.deviceId;
        }
      }
      const speakers = physical.find(d => /speaker|built-?in output|headphone|airpods|output device/i.test(d.label))
        ?? physical[0];
      return speakers?.deviceId ?? null;
    } catch {
      return null;
    }
  }

  stopCapture(): void {
    if (this.currentStream) { this.currentStream.getTracks().forEach(t => t.stop()); this.currentStream = null; }
    this.currentDevice = null;
    this.restoreOutput();
  }

  getStatus(): string {
    if (this.currentDevice) return `macOS: ${this.currentDevice.label}`;
    if (this.cachedDevices.length > 0) {
      const bh = this.cachedDevices.find(d => /blackhole/i.test(d.label));
      if (bh) return `macOS: ${bh.label} (ready)`;
      const monitor = this.cachedDevices.find(d => d.isMonitor);
      if (monitor) return `macOS: ${monitor.label} (ready)`;
      return `macOS (${this.cachedDevices.length} input(s))`;
    }
    if (this.blackholeDriverInstalled()) return 'macOS: BlackHole installed — reboot required';
    return 'macOS (no loopback — requires BlackHole)';
  }

  dispose(): void { this.stopCapture(); }
}
