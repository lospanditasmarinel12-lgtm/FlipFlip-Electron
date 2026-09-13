import * as React from "react";
import path from "path";
import clsx from "clsx";

import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Slide,
  Snackbar,
  SnackbarContent,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorIcon from '@mui/icons-material/Error';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';

import {convertFromEpoch, getBackups, saveDir} from "../../data/utils";
import {MO, SS} from "../../data/const";
import {GeneralSettings} from "../../data/Config";

const ButtonGrid = styled(Grid)({
  textAlign: 'center',
});

const ChipGrid = styled(Grid)(({theme}) => ({
  paddingTop: theme.spacing(1),
}));

const HideXS = styled('span')(({theme}) => ({
  [theme.breakpoints.down('sm')]: {
    display: 'none'
  },
}));

const ShowXS = styled('span')(({theme}) => ({
  [theme.breakpoints.up('sm')]: {
    display: 'none'
  },
}));

const BackupDaysTextField = styled(TextField)(({theme}) => ({
  width: theme.spacing(16),
}));

function TransitionUp(props: any) {
  return <Slide {...props} direction="up" />;
}

class BackupCard extends React.Component {
  readonly props: {
    settings: GeneralSettings,
    onBackup(): void,
    onClean(): void,
    onRestore(backupFile: string): void,
    onUpdateSettings(fn: (settings: GeneralSettings) => void): void,
  };

  readonly state = {
    backups: Array<{url: string, size: number}>(),
    backup: (null as {url: string, size: number}),
    openMenu: null as string,
    snackbarOpen: false,
    snackbar: null as string,
    snackbarSeverity: null as string,
  };

  render() {
    const hasBackup = this.state.backups.length > 0;
    return (
      <React.Fragment>
        <ChipGrid container spacing={2} alignItems="center" justifyContent="center">
          <ButtonGrid item xs={"auto"}>
            <FormControlLabel
              control={
                <Switch checked={this.props.settings.autoBackup}
                        onChange={this.onBoolInput.bind(this, 'autoBackup')}/>
              }
              label="Auto Backup"/>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <BackupDaysTextField
              disabled={!this.props.settings.autoBackup}
              variant="outlined"
              label="Every"
              margin="dense"
              value={this.props.settings.autoBackupDays}
              onChange={this.onIntInput.bind(this, 'autoBackupDays')}
              onBlur={this.blurIntKey.bind(this, 'autoBackupDays')}
              InputProps={{
                endAdornment: <InputAdornment position="end">Days</InputAdornment>,
              }}
              inputProps={{
                min: 1,
                type: 'number',
              }}/>
          </ButtonGrid>
        </ChipGrid>
        <ChipGrid container spacing={2} alignItems="center" justifyContent="center">
          <Tooltip disableInteractive title="If enabled, backups will be automatically cleaned up. This algorithm will keep 1 backup for
           each of the configured periods.">
            <ButtonGrid item xs={"auto"}>
              <FormControlLabel
                control={
                  <Switch checked={this.props.settings.autoCleanBackup}
                          onChange={this.onBoolInput.bind(this, 'autoCleanBackup')}/>
                }
                label="Auto Clean"/>
            </ButtonGrid>
          </Tooltip>
          <ButtonGrid item xs={"auto"}>
            <BackupDaysTextField
              disabled={!this.props.settings.autoCleanBackup}
              variant="outlined"
              label="Keep Last"
              margin="dense"
              value={this.props.settings.autoCleanBackupDays}
              onChange={this.onIntInput.bind(this, 'autoCleanBackupDays')}
              onBlur={this.blurIntKey.bind(this, 'autoCleanBackupDays')}
              InputProps={{
                endAdornment: <InputAdornment position="end">Days</InputAdornment>,
              }}
              inputProps={{
                min: 1,
                type: 'number',
              }}/>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <BackupDaysTextField
              disabled={!this.props.settings.autoCleanBackup}
              variant="outlined"
              label="Keep Last"
              margin="dense"
              value={this.props.settings.autoCleanBackupWeeks}
              onChange={this.onIntInput.bind(this, 'autoCleanBackupWeeks')}
              onBlur={this.blurIntKey.bind(this, 'autoCleanBackupWeeks')}
              InputProps={{
                endAdornment: <InputAdornment position="end">Weeks</InputAdornment>,
              }}
              inputProps={{
                min: 1,
                type: 'number',
              }}/>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <BackupDaysTextField
              disabled={!this.props.settings.autoCleanBackup}
              variant="outlined"
              label="Keep Last"
              margin="dense"
              value={this.props.settings.autoCleanBackupMonths}
              onChange={this.onIntInput.bind(this, 'autoCleanBackupMonths')}
              onBlur={this.blurIntKey.bind(this, 'autoCleanBackupMonths')}
              InputProps={{
                endAdornment: <InputAdornment position="end">Months</InputAdornment>,
              }}
              inputProps={{
                min: 1,
                type: 'number',
              }}/>
          </ButtonGrid>
        </ChipGrid>
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          <ButtonGrid item xs={"auto"}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={this.onBackup.bind(this)}
              startIcon={<SaveIcon />}
            >
              Backup Data
            </Button>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              disabled={!hasBackup}
              onClick={this.onRestore.bind(this)}
              startIcon={<RestoreIcon />}
            >
              Restore Backup
            </Button>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <Button
              variant="contained"
              color="inherit"
              size="large"
              disabled={this.state.backups.length <= 1}
              onClick={this.onClean.bind(this)}
              startIcon={<DeleteIcon />}
            >
              Clean Backups
            </Button>
          </ButtonGrid>
        </Grid>
        <ChipGrid container spacing={2} alignItems="center" justifyContent="center">
          <ButtonGrid item xs={"auto"}>
            <Chip
              label={`Backups: ${hasBackup ? this.state.backups.length : "--"}`}
              color="primary"
              variant="outlined"/>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <HideXS>
              <Chip
                label={`Latest: ${hasBackup ? convertFromEpoch(this.state.backups[0].url) + " (" + Math.round(this.state.backups[0].size / 1000) + " KB)" : "--"}`}
                color="secondary"
                variant="outlined"/>
            </HideXS>
          </ButtonGrid>
          <ButtonGrid item xs={"auto"}>
            <ShowXS>
              <Chip
                label={`Latest: ${hasBackup ? convertFromEpoch(this.state.backups[0].url) : "--"}`}
                color="secondary"
                variant="outlined"/>
            </ShowXS>
          </ButtonGrid>
        </ChipGrid>
        <Dialog
          open={this.state.openMenu == MO.deleteAlert}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="remove-all-title"
          aria-describedby="remove-all-description">
          <DialogTitle id="remove-all-title">Clean backups</DialogTitle>
          <DialogContent>
            {this.props.settings.autoCleanBackup && (
              <DialogContentText id="remove-all-description">
                You are about to clean your backups. Backups will be retained according to your Auto Clean
                configuration. A record will be kept for each of the
                last: {this.props.settings.autoCleanBackupDays} Days, {this.props.settings.autoCleanBackupWeeks} Weeks, {this.props.settings.autoCleanBackupMonths} Months.
              </DialogContentText>
            )}
            {!this.props.settings.autoCleanBackup && (
              <React.Fragment>
                <DialogContentText id="remove-all-description">
                  You are about to clean your backups. How many of the most recent backups would you like to retain?
                </DialogContentText>
                {this.props.settings.cleanRetain != null && (
                  <TextField
                    variant="outlined"
                    label="Keep Last"
                    margin="dense"
                    value={this.props.settings.cleanRetain}
                    onChange={this.onIntInput.bind(this, 'cleanRetain')}
                    onBlur={this.blurIntKey.bind(this, 'cleanRetain')}
                    inputProps={{
                      min: 1,
                      type: 'number',
                    }}/>
                )}
              </React.Fragment>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onFinishClean.bind(this)} color="primary">
              Continue
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={this.state.openMenu == MO.restore}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="restore-title"
          aria-describedby="restore-description">
          <DialogTitle id="restore-title">Restore Backup</DialogTitle>
          <DialogContent>
            <DialogContentText id="restore-description">
              Choose a backup to restore from:
            </DialogContentText>
            {this.state.backup && (
              <FormControl variant="standard">
                <InputLabel>Backups</InputLabel>
                <Select
                  variant="standard"
                  value={this.state.backup.url}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                  onChange={this.onChangeBackup.bind(this)}>
                  {this.state.backups.map((b) =>
                    <MenuItem value={b.url} key={b.url}>{convertFromEpoch(b.url)} ({Math.round(b.size / 1000)} KB)</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onFinishRestore.bind(this)} color="primary">
              Restore
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={this.state.snackbarOpen}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          autoHideDuration={5000}
          onClose={this.onCloseDialog.bind(this)}
          TransitionComponent={TransitionUp}>
          <Alert onClose={this.onCloseDialog.bind(this)} severity={this.state.snackbarSeverity as any}>
            {this.state.snackbar}
          </Alert>
        </Snackbar>
      </React.Fragment>
    );
  }

  componentDidMount() {
    this.refreshBackups();
  }

  refreshBackups() {
    this.setState({backups: getBackups()});
  }

  onChangeBackup(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({backup: this.state.backups.find((b) => b.url == input.value)});
  }

  onBackup() {
    try {
      this.props.onBackup();
      this.setState({snackbarOpen: true, snackbar: "Backup success!", snackbarSeverity: SS.success});
    } catch (e) {
      console.error(e);
      this.setState({snackbarOpen: true, snackbar: "Error: " + e, snackbarSeverity: SS.error});
    }
    this.refreshBackups();
  }

  onClean() {
    this.setState({backup: this.state.backups[0], openMenu: MO.deleteAlert});
  }

  onFinishClean() {
    this.onCloseDialog();
    try {
      this.props.onClean();
      this.setState({snackbarOpen: true, snackbar: "Clean success!", snackbarSeverity: SS.success});
    } catch (e) {
      console.error(e);
      this.setState({snackbarOpen: true, snackbar: "Error: " + e, snackbarSeverity: SS.error});
    }
    this.refreshBackups();
  }

  onRestore() {
    this.setState({backup: this.state.backups[0], openMenu: MO.restore});
  }

  onFinishRestore() {
    this.onCloseDialog();
    try {
      this.props.onRestore(saveDir + path.sep + this.state.backup.url);
      this.setState({snackbarOpen: true, snackbar: "Restore success!", snackbarSeverity: SS.success});
    } catch (e) {
      console.error(e);
      this.setState({snackbarOpen: true, snackbar: "Error: " + e, snackbarSeverity: SS.error});
    }
  }

  onCloseDialog() {
    this.setState({openMenu: null, snackbarOpen: false});
  }

  blurIntKey(key: string, e: MouseEvent) {
    const min = (e.currentTarget as any).min ? (e.currentTarget as any).min : null;
    const max = (e.currentTarget as any).max ? (e.currentTarget as any).max : null;
    if (min && (this.props.settings as any)[key] < min) {
      this.changeIntKey(key, min);
    } else if (max && (this.props.settings as any)[key] > max) {
      this.changeIntKey(key, max);
    }
  }

  onIntInput(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.changeKey(key, input.value === '' ? '' : Number(input.value));
  }

  changeIntKey(key:string, intString: string) {
    this.changeKey(key, intString === '' ? '' : Number(intString));
  }

  onBoolInput(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    const checked = input.checked;
    this.changeKey(key, checked);
  }

  changeKey(key: string, value: any) {
    this.update((s) => s[key] = value);
  }

  update(fn: (scene: any) => void) {
    this.props.onUpdateSettings(fn);
  }
}

(BackupCard as any).displayName="BackupCard";
export default BackupCard;
