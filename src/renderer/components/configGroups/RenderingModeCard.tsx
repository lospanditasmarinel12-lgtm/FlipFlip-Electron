import * as React from "react";

import { Grid, Typography, ToggleButton, ToggleButtonGroup, Alert } from "@mui/material";

import { DisplaySettings } from "../../data/Config";

const MODES = [
  { value: 'auto', label: 'Auto', desc: 'Best for your system (recommended)' },
  { value: 'software', label: 'CPU', desc: 'Software rendering — stable, slower' },
  { value: 'hardware', label: 'GPU', desc: 'Hardware accelerated — fast, may be unstable' },
];

class RenderingModeCard extends React.Component {
  readonly props: {
    settings: DisplaySettings,
    onUpdateSettings(fn: (settings: DisplaySettings) => void): void,
  };

  render() {
    const current = this.props.settings.renderingMode || 'auto';
    return (
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Controls whether FlipFlip uses your graphics card (GPU) or processor (CPU) for rendering.
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <ToggleButtonGroup
            value={current}
            exclusive
            onChange={this.onChange}
            size="small"
            fullWidth
          >
            {MODES.map(m => (
              <ToggleButton key={m.value} value={m.value} sx={{ flexDirection: 'column', py: 1 }}>
                <Typography variant="button">{m.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {m.desc}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Grid>
        <Grid item xs={12}>
          <Alert severity="info" sx={{ py: 0 }}>
            Changing rendering mode requires restarting FlipFlip to take full effect.
          </Alert>
        </Grid>
      </Grid>
    );
  }

  onChange = (_e: React.MouseEvent, value: string | null) => {
    if (!value) return;
    this.props.onUpdateSettings((s) => s.renderingMode = value);
  };
}

(RenderingModeCard as any).displayName = "RenderingModeCard";
export default RenderingModeCard;
