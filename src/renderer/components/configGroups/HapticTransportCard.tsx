import * as React from 'react';
import {
  FormControlLabel, Grid, InputLabel, MenuItem, Select, Switch, TextField, Typography
} from '@mui/material';

interface HapticTransportCardProps {
  hapticTransport: string;
  hapticWSEndpoint: string;
  onUpdateSettings: (fn: (settings: any) => void) => void;
}

const HAPTIC_TRANSPORT_CARD_STYLE: React.CSSProperties = {
  overflow: 'visible',
};

export default class HapticTransportCard extends React.Component<HapticTransportCardProps> {
  render() {
    return (
      <div style={HAPTIC_TRANSPORT_CARD_STYLE}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6">Haptic Settings</Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Configure how FlipFlip connects to haptic devices.
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <InputLabel>Device Transport</InputLabel>
            <Select
              value={this.props.hapticTransport}
              onChange={(e) => this.props.onUpdateSettings((s) => { s.hapticTransport = e.target.value; })}
              fullWidth
            >
              <MenuItem value="auto">Auto (Web Bluetooth, fallback to Intiface)</MenuItem>
              <MenuItem value="wasm">Web Bluetooth (built-in, no extra app)</MenuItem>
              <MenuItem value="websocket">Intiface Central (separate app, more reliable)</MenuItem>
            </Select>
          </Grid>

          {this.props.hapticTransport !== 'wasm' && (
            <Grid item xs={12}>
              <TextField
                label="Intiface Central WebSocket URL"
                value={this.props.hapticWSEndpoint}
                onChange={(e) => this.props.onUpdateSettings((s) => { s.hapticWSEndpoint = e.target.value; })}
                fullWidth
                size="small"
                helperText="Default: ws://127.0.0.1:12345 — only change if Intiface Central uses a custom port or runs on another machine"
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">
              <strong>Auto</strong>: Tries Web Bluetooth first. Falls back to Intiface Central if unavailable (Windows/Linux recommended).<br/>
              <strong>Web Bluetooth</strong>: Uses Bluetooth directly from the browser. Works on Windows, Linux, ChromeOS. No extra software.<br/>
              <strong>Intiface Central</strong>: Connects to Intiface Central app running locally. Required for macOS. Most reliable. <a href="https://intiface.com/central/" target="_blank" rel="noreferrer">Download Intiface Central</a>
            </Typography>
          </Grid>
        </Grid>
      </div>
    );
  }
}

(HapticTransportCard as any).displayName="HapticTransportCard";
