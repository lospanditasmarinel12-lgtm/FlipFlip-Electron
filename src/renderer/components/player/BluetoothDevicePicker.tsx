import { ipcRenderer } from 'electron';
import * as React from 'react';
import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, List, ListItemButton, ListItemText
} from '@mui/material';
import { IPC } from '../../data/const';
import { HapticService } from '../../data/haptics/HapticService';

interface BluetoothDevice {
  deviceId: string;
  deviceName: string;
}

export default function BluetoothDevicePicker() {
  const [open, setOpen] = React.useState(false);
  const [devices, setDevices] = React.useState<BluetoothDevice[]>([]);
  const [secondsElapsed, setSecondsElapsed] = React.useState(0);
  const [hasSelected, setHasSelected] = React.useState(false);
  // const [waitingForScan, setWaitingForScan] = React.useState(false); // deferred callback — disabled

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      const svcDevices = HapticService.getInstance().getDevices();
      if (svcDevices.length > 0) {
        console.log('[BLE] Device connected, closing picker');
        HapticService.getInstance().stopScanning();
        setOpen(false);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [open]);

  // Deferred callback: disabled in favor of auto-select in main.ts
  // React.useEffect(() => {
  //   if (!open || !waitingForScan) return;
  //   const interval = setInterval(() => {
  //     if (!HapticService.getInstance().hasPendingSelection()) {
  //       console.log('[BLE] Deferred device resolved, closing picker');
  //       setOpen(false);
  //     }
  //   }, 300);
  //   return () => clearInterval(interval);
  // }, [open, waitingForScan]);

  React.useEffect(() => {
    const handler = (_event: any, deviceList: BluetoothDevice[]) => {
      console.log('[BLE] Picker received device list:', deviceList.length, 'devices:', deviceList.map(d => d.deviceName || d.deviceId));
      setDevices(prev => {
        const existing = new Set(prev.map(d => d.deviceId));
        const merged = [...prev];
        for (const d of deviceList) {
          if (!existing.has(d.deviceId)) {
            merged.push(d);
          }
        }
        return merged;
      });
      setSecondsElapsed(0);
      setHasSelected(false);
      setOpen(true);
    };
    ipcRenderer.on(IPC.bleDevices, handler);
    return () => { ipcRenderer.removeListener(IPC.bleDevices, handler); };
  }, []);

  React.useEffect(() => {
    const handler = () => {
      console.log('[BLE] Selection timeout, closing picker');
      HapticService.getInstance().stopScanning();
      setOpen(false);
    };
    ipcRenderer.on(IPC.bleSelectionTimeout, handler);
    return () => { ipcRenderer.removeListener(IPC.bleSelectionTimeout, handler); };
  }, []);

  const onSelect = (deviceId: string) => {
    console.log('[BLE] User selected device:', deviceId);
    setHasSelected(true);
    ipcRenderer.send(IPC.bleDeviceSelected, deviceId);
  };

  const onCancel = () => {
    console.log('[BLE] User cancelled device selection');
    HapticService.getInstance().stopScanning();
    ipcRenderer.send(IPC.bleDeviceSelected, '');
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        Select Bluetooth Device ({devices.length} found)
        {devices.length === 0 && ` — scanning ${secondsElapsed}s`}
      </DialogTitle>
      <DialogContent>
        {devices.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <CircularProgress size={24} />
            <ListItemText secondary="Scanning for devices... Make sure Bluetooth is enabled and your device is in pairing mode." />
          </div>
        ) : (
          <List>
            {devices.map(d => (
              <ListItemButton key={d.deviceId} onClick={() => onSelect(d.deviceId)} disabled={hasSelected}>
                <ListItemText primary={d.deviceName || 'Unknown Device'} secondary={d.deviceId} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

(BluetoothDevicePicker as any).displayName = 'BluetoothDevicePicker';
