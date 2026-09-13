import * as React from 'react';
import VibrationIcon from '@mui/icons-material/Vibration';
import { Tooltip } from '@mui/material';

interface HapticIndicatorProps {
  active: boolean;
  connected: boolean;
  deviceName?: string;
}

export default function HapticIndicator({ active, connected, deviceName }: HapticIndicatorProps) {
  if (!connected) return null;

  const color = active ? '#4caf50' : '#9e9e9e';
  const title = deviceName ? `Haptics: ${deviceName}` : active ? 'Haptic activity' : 'Haptics idle';

  return (
    <Tooltip title={title}>
      <VibrationIcon
        style={{
          color,
          fontSize: 20,
          animation: active ? 'hapticPulse 0.3s ease-in-out' : 'none',
          transition: 'color 0.2s ease',
        }}
      />
    </Tooltip>
  );
}

(HapticIndicator as any).displayName = 'HapticIndicator';
