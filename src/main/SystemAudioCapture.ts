import { spawn, execSync } from 'child_process';

const LOOPBACK_NAME = 'flipflip_audio_capture';

export function createLoopbackSource(): Promise<{ moduleId: string; sourceDesc: string }> {
  return new Promise((resolve, reject) => {
    let defaultSink: string;
    try {
      defaultSink = execSync('pactl get-default-sink', { encoding: 'utf8' }).trim();
    } catch {
      reject(new Error('Failed to get default sink. Is PulseAudio/PipeWire running?'));
      return;
    }

    // Remove any existing flipflip loopbacks first
    try {
      const existing = execSync('pactl list short modules', { encoding: 'utf8' });
      const ids = existing.split('\n')
        .filter(line => line.includes(LOOPBACK_NAME))
        .map(line => line.split('\t')[0]);
      for (const id of ids) {
        console.log('[SystemAudio] Removing existing loopback module:', id);
        execSync('pactl unload-module ' + id);
      }
    } catch { /* ignore */ }

    const master = `${defaultSink}.monitor`;

    const proc = spawn('pactl', ['load-module', 'module-remap-source',
      `source_name=${LOOPBACK_NAME}`,
      `master=${master}`,
      `source_properties=device.description=FlipFlip Audio Capture`,
      'channels=2',
      'channel_map=front-left,front-right',
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const moduleId = stdout.trim();
        console.log('[SystemAudio] Loopback created:', { moduleId, master, name: LOOPBACK_NAME });
        resolve({ moduleId, sourceDesc: 'FlipFlip Audio Capture' });
      } else {
        const fallback = spawn('pactl', ['load-module', 'module-remap-source',
          `source_name=${LOOPBACK_NAME}`,
          `master=${master}`,
          `source_properties=device.description=FlipFlip Audio Capture`,
          'channels=2',
          'channel_map=front-left,front-right',
          'rate=48000',
        ]);
        let fbStdout = '';
        fallback.stdout?.on('data', (d: Buffer) => { fbStdout += d.toString(); });
        fallback.on('close', () => {
          console.log('[SystemAudio] Loopback created (fallback):', { moduleId: fbStdout.trim(), master });
          resolve({ moduleId: fbStdout.trim(), sourceDesc: 'FlipFlip Audio Capture' });
        });
        fallback.on('error', () => reject(new Error(`pactl failed: ${stderr}`)));
      }
    });
  });
}

export function removeLoopbackSource(moduleId?: string): void {
  if (moduleId) {
    console.log('[SystemAudio] Removing loopback module:', moduleId);
    spawn('pactl', ['unload-module', moduleId]);
  }
}

export function cleanupAllLoopbacks(): void {
  console.log('[SystemAudio] Cleaning up all flipflip loopbacks');
  try {
    const existing = execSync('pactl list short modules', { encoding: 'utf8' });
    const ids = existing.split('\n')
      .filter(line => line.includes(LOOPBACK_NAME))
      .map(line => line.split('\t')[0]);
    for (const id of ids) {
      spawn('pactl', ['unload-module', id]);
    }
  } catch {
    spawn('pactl', ['unload-module', LOOPBACK_NAME]);
  }
}
