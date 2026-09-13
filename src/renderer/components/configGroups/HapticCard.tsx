import * as React from 'react';
import {
  Box, Button, Card, CardHeader, Collapse, FormControlLabel, Grid,
  IconButton, InputLabel, MenuItem, Radio, RadioGroup, Select, Slider, Switch, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VibrationIcon from '@mui/icons-material/Vibration';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';
import { produce } from 'immer';
import { useStore } from '../../stores/flipflipStore';
import { HapticService } from '../../data/haptics/HapticService';
import { HapticPattern } from '../../data/haptics/types';

interface HapticCardProps {
  sidebar?: boolean;
  hapticsEnabled: boolean;
  hapticIntensity: number;
  hapticPattern: HapticPattern;
  connectedDevices: Array<{ index: number; name: string }>;
  activeDeviceIndex: number;
  onHapticsEnabledChange: (enabled: boolean) => void;
  onChange: (changes: any) => void;
}

export default class HapticCard extends React.Component<HapticCardProps, { expanded: boolean; scanning: boolean; testing: boolean; error: string; scanResult: string; motorIntensities: Record<number, number>; systemDeviceId: string; captureDevices: Array<{id: string; label: string; isMonitor: boolean}>; sourceStatus: string; fixingRouting: boolean; routingMsg: string; monitorSinks: Array<{id: string; label: string}>; loadingSinks: boolean; pattern: HapticPattern }> {
  readonly state: { expanded: boolean; scanning: boolean; testing: boolean; error: string; scanResult: string; motorIntensities: Record<number, number>; systemDeviceId: string; captureDevices: Array<{id: string; label: string; isMonitor: boolean}>; sourceStatus: string; fixingRouting: boolean; routingMsg: string; monitorSinks: Array<{id: string; label: string}>; loadingSinks: boolean; pattern: HapticPattern } = { expanded: true, scanning: false, testing: false, error: '', scanResult: '', motorIntensities: {}, systemDeviceId: '', captureDevices: [], sourceStatus: 'stopped', fixingRouting: false, routingMsg: '', monitorSinks: [], loadingSinks: false, pattern: this.props.hapticPattern };

  componentDidMount() {
    const motors = HapticService.getInstance().getActiveDeviceMotors();
    const intensities: Record<number, number> = {};
    for (const m of motors) {
      intensities[m.index] = HapticService.getInstance().getMotorIntensity(m.index);
    }
    if (Object.keys(intensities).length > 0) {
      this.setState({ motorIntensities: intensities });
    }
    HapticService.getInstance().setSourceStatusCallback((status) => {
      this.setState({ sourceStatus: status });
    });
    const st: any = useStore.getState();
    const savedSink = st?.config?.generalSettings?.hapticMonitorSinkId ?? '';
    HapticService.getInstance().setMonitorSink(savedSink);
    if (HapticService.getInstance().isSystemAudioAvailable()) {
      this.loadMonitorSinks();
    }
  }

  componentDidUpdate(prevProps: HapticCardProps) {
    if (this.state.scanning && prevProps.connectedDevices.length === 0 && this.props.connectedDevices.length > 0) {
      this.setState({ scanning: false, error: '', scanResult: '' });
    }
    if (prevProps.hapticPattern !== this.props.hapticPattern) {
      this.setState({ pattern: this.props.hapticPattern });
    }
    if (prevProps.activeDeviceIndex !== this.props.activeDeviceIndex) {
      const motors = HapticService.getInstance().getActiveDeviceMotors();
      const intensities: Record<number, number> = {};
      for (const m of motors) {
        intensities[m.index] = HapticService.getInstance().getMotorIntensity(m.index);
      }
      this.setState({ motorIntensities: intensities });
    }
    const wasInitialized = HapticService.getInstance().isInitialized();
    if (wasInitialized && this.state.captureDevices.length === 0) {
      if (HapticService.getInstance().isSystemAudioAvailable()) {
        HapticService.getInstance().refreshCaptureDevices().then(devices => {
          this.setState({ captureDevices: devices });
        });
      }
    }
  }

  onScan = async () => {
    const service = HapticService.getInstance();
    if (!service.isConnected()) {
      if (service.isInitialized() && this.props.hapticsEnabled) {
        this.setState({ scanning: true, error: '', scanResult: '' });
        try {
          await service.ensureConnected();
          if (!service.isConnected()) {
            const err = service.getLastError() || 'Connection failed.';
            this.setState({ scanning: false, error: err });
            return;
          }
        } catch (e) {
          console.warn('[Haptics] Reconnect error:', e);
          this.setState({ scanning: false, error: 'Connection failed.' });
          return;
        }
      } else {
        this.setState({ error: 'Haptic service is not initialized. Enable Haptic Feedback first.' });
        return;
      }
    }

    this.setState({ scanning: true, error: '', scanResult: '' });
    try {
      const started = await service.startScanning();
      if (!started) {
        const err = service.getLastError() || 'Scan could not be started.';
        this.setState({ scanning: false, error: err });
        return;
      }
    } catch (e) {
      console.warn('[Haptics] Scan error:', e);
      this.setState({ scanning: false, error: 'Unexpected error during scan.' });
    }
  };

  onTest = async () => {
    this.setState({ testing: true, error: '' });
    try {
      await HapticService.getInstance().testVibrate(this.props.activeDeviceIndex);
    } catch (e) {
      console.warn('[Haptics] Test error:', e);
      this.setState({ error: 'Test vibration failed: ' + (e instanceof Error ? e.message : String(e)) });
    }
    setTimeout(() => this.setState({ testing: false }), 1200);
  };

  onDisconnect = () => {
    const service = HapticService.getInstance();
    service.reconnect();
    this.setState({ error: '' });
  };

  persistSystemAudio = (deviceId?: string) => {
    const enabled = HapticService.getInstance().isSystemAudioEnabled();
    const dev = deviceId ?? HapticService.getInstance().getSystemCaptureDeviceId();
    useStore.setState((s: any) => ({
      config: {
        ...s.config,
        generalSettings: { ...s.config?.generalSettings, hapticSystemAudio: enabled, hapticSystemDeviceId: dev },
      },
    }));
  };

  onFixRouting = async () => {
    this.setState({ fixingRouting: true, routingMsg: '' });
    try {
      const service = HapticService.getInstance();
      const check = await service.verifySystemRouting();
      if (check.ok) {
        await service.startSystemAnalysis();
        this.setState({ fixingRouting: false, routingMsg: 'Routing is correct — capture restarted. Play audio and give it a moment.' });
      } else {
        const res = await service.repairSystemRouting();
        this.setState({ fixingRouting: false, routingMsg: res.detail });
      }
    } catch (e) {
      this.setState({ fixingRouting: false, routingMsg: 'Routing repair failed: ' + (e instanceof Error ? e.message : String(e)) });
    }
  };

  loadMonitorSinks = async () => {
    if (this.state.loadingSinks) return;
    this.setState({ loadingSinks: true });
    const sinks = await HapticService.getInstance().listMonitorSinks();
    this.setState({ loadingSinks: false, monitorSinks: sinks });
  };

  onMonitorSinkChange = async (id: string) => {
    await HapticService.getInstance().setMonitorSink(id);
    const st: any = useStore.getState();
    const next = produce(st, (draft: any) => {
      draft.config.generalSettings.hapticMonitorSinkId = id;
    });
    useStore.setState(next);
    this.forceUpdate();
  };

  render() {
    const hasDevices = this.props.connectedDevices.length > 0;
    const connected = HapticService.getInstance().isConnected();
    const initialized = HapticService.getInstance().isInitialized();
    const st: any = useStore.getState();
    const monitorSinkId = st?.config?.generalSettings?.hapticMonitorSinkId ?? '';

    let statusText = 'Not initialized — enable Haptic Feedback';
    if (connected && hasDevices) {
      statusText = `Connected: ${this.props.connectedDevices.length} device(s)`;
    } else if (connected) {
      statusText = 'Click Scan for Devices below';
    } else if (this.state.scanning) {
      statusText = 'Scanning...';
    } else if (initialized) {
      statusText = 'Ready — click Scan for Devices';
    }

    return (
      <Card variant={this.props.sidebar ? "elevation" : "outlined"} sx={{ overflow: 'visible' }}>
        <CardHeader
          avatar={<VibrationIcon color={hasDevices ? 'success' : 'disabled'} />}
          title="Haptic Feedback"
          subheader={statusText}
          action={
            <IconButton onClick={() => this.setState({ expanded: !this.state.expanded })} size="large">
              <ExpandMoreIcon style={{ transform: this.state.expanded ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          }
        />
        <Collapse in={this.state.expanded}>
          <Box sx={{ px: 1.5, pb: 2 }}>
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={this.props.hapticsEnabled}
                      onChange={(_, checked) => {
                        this.props.onChange({ hapticsEnabled: checked });
                        this.props.onHapticsEnabledChange(checked);
                      }}
                    />
                  }
                  label="Enable Haptic Feedback"
                />
              </Grid>
              {HapticService.getInstance().isSystemAudioAvailable() && (
                <React.Fragment>
                <Grid item xs={12}>
                  <InputLabel>Audio Source</InputLabel>
                  <RadioGroup
                    value={HapticService.getInstance().isSystemAudioEnabled() ? 'system' : 'scene'}
                    onChange={async (e) => {
                      const useSystem = e.target.value === 'system';
                      if (useSystem) {
                        // Synchronous, inside the click gesture: Chromium only
                        // lets an AudioContext start/resume here. Capture itself
                        // starts async below, after the gesture is gone.
                        HapticService.getInstance().warmUpAudioContext();
                        const st: any = useStore.getState();
                        await HapticService.getInstance().setMonitorSink(st?.config?.generalSettings?.hapticMonitorSinkId ?? '');
                        this.loadMonitorSinks();
                        const devices = await HapticService.getInstance().refreshCaptureDevices();
                        this.setState({ captureDevices: devices });
                        const success = await HapticService.getInstance().setSystemAudioEnabled(true);
                        if (!success) {
                          const err = HapticService.getInstance().getLastSystemAudioError() || 'Failed to start system audio capture.';
                          this.setState({ error: err });
                        }
                      } else {
                        HapticService.getInstance().setSystemAudioEnabled(false);
                      }
                      this.persistSystemAudio();
                      this.forceUpdate();
                    }}
                  >
                    <FormControlLabel value="scene" control={<Radio />} label="Scene Audio" />
                    <FormControlLabel value="system" control={<Radio />} label="System Audio" />
                  </RadioGroup>
                  <Typography variant="caption" color="textSecondary">
                    {HapticService.getInstance().getSystemAudioStatus()}
                    {this.state.sourceStatus === 'active' && ' ● LIVE'}
                    {this.state.sourceStatus === 'silent' && ' — No audio detected'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                    System Audio mode captures whatever your computer is playing and drives haptics from it.
                    On Windows it captures the output loopback directly; on macOS it routes output to BlackHole
                    and plays it back to your speakers. Output returns to normal when System Audio is turned off.
                  </Typography>
                  {this.state.sourceStatus === 'silent' && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="warning.main" display="block">
                        The capture stream is open but silent. Make sure audio is playing, then fix the routing
                        (sets BlackHole as the system output).
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={this.onFixRouting}
                        disabled={this.state.fixingRouting}
                        sx={{ mt: 0.5 }}
                      >
                        {this.state.fixingRouting ? 'Fixing…' : 'Fix Audio Routing'}
                      </Button>
                    </Box>
                  )}
                  {this.state.routingMsg && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {this.state.routingMsg}
                    </Typography>
                  )}
                </Grid>
                {HapticService.getInstance().isSystemAudioEnabled() && this.state.captureDevices.length > 0 && (
                <Grid item xs={12}>
                  <Select
                    value={this.state.systemDeviceId}
                    onChange={(e) => {
                      const deviceId = e.target.value as string;
                      this.setState({ systemDeviceId: deviceId });
                      HapticService.getInstance().startSystemAnalysis(deviceId);
                      this.persistSystemAudio(deviceId);
                      this.forceUpdate();
                    }}
                    fullWidth
                    size="small"
                  >
                    {this.state.captureDevices.map(d => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.label}{d.isMonitor ? ' (monitor)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                )}
                {this.state.monitorSinks.length > 0 && (
                <Grid item xs={12}>
                  <InputLabel>Hear playthrough on</InputLabel>
                  <Select
                    value={monitorSinkId}
                    onChange={(e) => this.onMonitorSinkChange(e.target.value as string)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">Auto (built-in speakers)</MenuItem>
                    {this.state.monitorSinks.map(d => (
                      <MenuItem key={d.id} value={d.id}>{d.label}</MenuItem>
                    ))}
                  </Select>
                </Grid>
                )}
                </React.Fragment>
              )}
              <Grid item xs={12}>
                <InputLabel>Pattern</InputLabel>
                <Select
                  value={this.state.pattern}
                  onChange={(e) => {
                    const p = e.target.value as HapticPattern;
                    this.setState({ pattern: p });
                    this.props.onChange({ hapticPattern: p });
                    HapticService.getInstance().setConfig({ pattern: p });
                    this.forceUpdate();
                  }}
                  fullWidth
                  disabled={!this.props.hapticsEnabled}
                >
                  <MenuItem value={HapticPattern.direct}>Direct (Loudness)</MenuItem>
                  <MenuItem value={HapticPattern.bass}>Bass-Driven</MenuItem>
                  <MenuItem value={HapticPattern.beat}>Beat-Synced</MenuItem>
                  <MenuItem value={HapticPattern.melody}>Melody (High Frequencies)</MenuItem>
                  <MenuItem value={HapticPattern.voice}>Voice (Speech Band)</MenuItem>
                </Select>
              </Grid>
              {this.props.hapticPattern === HapticPattern.direct && (
                <>
                <Grid item xs={12}>
                  <Typography gutterBottom>Sensitivity</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Gain multiplier for direct loudness response. Higher values make quiet sounds more intense.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().directGain * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ directGain: (val as number) / 100 }); this.forceUpdate(); }}
                      min={50} max={300} step={10}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${(v / 100).toFixed(1)}x`}
                      marks={[{ value: 50, label: '0.5x' }, { value: 100, label: '1x' }, { value: 200, label: '2x' }, { value: 300, label: '3x' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography gutterBottom>Attack (Smoothing)</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Lower values = smoother response. Higher values = more punchy, less smooth.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().directSmoothing * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ directSmoothing: (val as number) / 100 }); this.forceUpdate(); }}
                      min={5} max={95} step={5}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v}%`}
                      marks={[{ value: 5, label: '5%' }, { value: 50, label: '50%' }, { value: 95, label: '95%' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
                </>
              )}
              {this.props.hapticPattern === HapticPattern.bass && (
                <Grid item xs={12}>
                  <Typography gutterBottom>Bass Sensitivity</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Gain multiplier for bass frequency response.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().bassGain * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ bassGain: (val as number) / 100 }); this.forceUpdate(); }}
                      min={50} max={500} step={10}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${(v / 100).toFixed(1)}x`}
                      marks={[{ value: 50, label: '0.5x' }, { value: 100, label: '1x' }, { value: 250, label: '2.5x' }, { value: 500, label: '5x' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
              )}
              {this.props.hapticPattern === HapticPattern.melody && (
                <Grid item xs={12}>
                  <Typography gutterBottom>Melody Sensitivity</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Gain multiplier for high frequency response.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().melodyGain * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ melodyGain: (val as number) / 100 }); this.forceUpdate(); }}
                      min={50} max={500} step={10}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${(v / 100).toFixed(1)}x`}
                      marks={[{ value: 50, label: '0.5x' }, { value: 100, label: '1x' }, { value: 250, label: '2.5x' }, { value: 500, label: '5x' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
              )}
              {this.props.hapticPattern === HapticPattern.voice && (
                <Grid item xs={12}>
                  <Typography gutterBottom>Voice Sensitivity</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Gain multiplier for the speech band (voice rhythm, not speech recognition).
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().voiceGain * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ voiceGain: (val as number) / 100 }); this.forceUpdate(); }}
                      min={50} max={500} step={10}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${(v / 100).toFixed(1)}x`}
                      marks={[{ value: 50, label: '0.5x' }, { value: 100, label: '1x' }, { value: 250, label: '2.5x' }, { value: 500, label: '5x' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
              )}
              {this.props.hapticPattern === HapticPattern.beat && (
                <>
                <Grid item xs={12}>
                  <Typography gutterBottom>Beat Threshold</Typography>
                  <Typography variant="caption" color="textSecondary">
                    How much a sound must spike above average to trigger a beat. Lower = more sensitive.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().beatThreshold * 100}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ beatThreshold: (val as number) / 100 }); this.forceUpdate(); }}
                      min={110} max={300} step={5}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${(v / 100).toFixed(2)}x`}
                      marks={[{ value: 110, label: '1.1x' }, { value: 200, label: '2x' }, { value: 300, label: '3x' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography gutterBottom>Beat Cooldown</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Minimum ms between beats. Lower = faster response, higher = less jitter.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Slider
                      value={HapticService.getInstance().getConfig().beatCooldownMs}
                      onChange={(_, val) => { HapticService.getInstance().setConfig({ beatCooldownMs: val as number }); this.forceUpdate(); }}
                      min={50} max={400} step={10}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v}ms`}
                      marks={[{ value: 50, label: '50ms' }, { value: 200, label: '200ms' }, { value: 400, label: '400ms' }]}
                      disabled={!this.props.hapticsEnabled}
                    />
                  </Box>
                </Grid>
                </>
              )}
              {hasDevices && (
                <Grid item xs={12}>
                  <InputLabel>Target Device</InputLabel>
                  <Select
                    value={this.props.activeDeviceIndex}
                    onChange={(e) => {
                      this.props.onChange({ hapticActiveDevice: e.target.value });
                      HapticService.getInstance().setActiveDevice(e.target.value as number);
                    }}
                    fullWidth
                    disabled={!this.props.hapticsEnabled}
                  >
                    {this.props.connectedDevices.map(d => (
                      <MenuItem key={d.index} value={d.index}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </Grid>
              )}
              {hasDevices && (() => {
                const motors = HapticService.getInstance().getActiveDeviceMotors();
                if (motors.length === 0) return null;
                return motors.map(m => (
                  <Grid item xs={12} key={m.index}>
                    <Typography gutterBottom>
                      Motor {m.index + 1}{m.description ? ` (${m.description})` : ''}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Slider
                        value={this.state.motorIntensities[m.index] ?? 100}
                        onChange={(_, val) => {
                          const v = val as number;
                          HapticService.getInstance().setMotorIntensityFor(this.props.activeDeviceIndex, m.index, v);
                          this.setState(prev => ({
                            motorIntensities: { ...prev.motorIntensities, [m.index]: v }
                          }));
                        }}
                        min={0} max={100} step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${v}%`}
                        marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]}
                        disabled={!this.props.hapticsEnabled}
                      />
                    </Box>
                  </Grid>
                ));
              })()}
              <Grid item xs={12}>
                <Grid container spacing={1}>
                  <Grid item>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<BluetoothSearchingIcon />}
                      onClick={this.onScan}
                      disabled={this.state.scanning}
                    >
                      {this.state.scanning ? 'Scanning...' : 'Scan for Devices'}
                    </Button>
                  </Grid>
                  {hasDevices && (
                    <Grid item>
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        onClick={this.onTest}
                        disabled={this.state.testing}
                      >
                        {this.state.testing ? 'Testing...' : 'Test Buzz'}
                      </Button>
                    </Grid>
                  )}
                  {connected && (
                    <Grid item>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={this.onDisconnect}
                      >
                        Disconnect
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Grid>
              {this.state.error && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 500 }}>
                    {this.state.error}
                  </Typography>
                </Grid>
              )}
              {this.state.scanResult && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                    {this.state.scanResult}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  {hasDevices
                    ? `Ready. Start audio playback to experience haptic feedback.`
                    : connected
                      ? `Server connected. Click 'Scan for Devices' to search for nearby Bluetooth toys. Make sure your device is powered on and in pairing mode.`
                      : initialized
                        ? `Click 'Scan for Devices' to connect. If using Web Bluetooth, ensure your computer has Bluetooth enabled. If using Intiface Central, make sure it is running.`
                        : `Enable Haptic Feedback above to get started.`}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Card>
    );
  }
}

(HapticCard as any).displayName="HapticCard";
