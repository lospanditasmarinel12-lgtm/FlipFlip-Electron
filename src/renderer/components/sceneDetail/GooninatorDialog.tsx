import * as React from "react";
import * as remote from "@electron/remote";

import {
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";

import { styled, Theme } from "@mui/material/styles";

import {GT} from "../../data/const";

class GooninatorDialog extends React.Component {
  readonly props: {
    open: boolean,
    onClose(): void,
    onImportURL(type: string, e: MouseEvent, ...args: any[]): void,
  };

  readonly state = {
    importType: GT.tumblr,
    importURL: "",
    rootDir: "",
  };

  render() {
    return (
      <Dialog
        open={this.props.open}
        onClose={this.props.onClose.bind(this)}
        aria-labelledby="url-import-title"
        aria-describedby="url-import-description">
        <DialogTitle id="url-import-title">Import URL</DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-all-description">
            Paste a gooninator URL and choose how to import the sources:
          </DialogContentText>
          <TextField
            variant="standard"
            label="Gooninator URL"
            fullWidth
            placeholder="Paste URL Here"
            margin="dense"
            value={this.state.importURL}
            onChange={this.onURLChange.bind(this)} />
          <div style={{ display: 'flex' }}>
            <FormControl variant="standard">
              <InputLabel>Import as</InputLabel>
              <Select
                variant="standard"
                value={this.state.importType}
                onChange={this.onTypeChange.bind(this)}>
                <MenuItem value={GT.tumblr}>Tumblr Blogs</MenuItem>
                <MenuItem value={GT.local}>Local Directories</MenuItem>
              </Select>
            </FormControl>
            <Collapse sx={{ ml: 2, flexGrow: 1 }} in={this.state.importType == GT.local}>
              <TextField
                variant="standard"
                fullWidth
                label="Parent Directory"
                value={this.state.rootDir}
                InputProps={{readOnly: true}}
                onClick={this.onRootChange.bind(this)} />
            </Collapse>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose.bind(this)} color="secondary">
            Cancel
          </Button>
          <Button
            disabled={!this.state.importURL.match("^https?://") || (this.state.importType == GT.local && this.state.rootDir.length == 0)}
            onClick={this.onImportURL.bind(this)}
            color="primary">
            Import
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  onTypeChange(e: MouseEvent) {
    const type = (e.target as HTMLInputElement).value;
    this.setState({importType: type});
  }

  onURLChange(e: MouseEvent) {
    const type = (e.target as HTMLInputElement).value;
    this.setState({importURL: type});
  }

  onRootChange() {
    remote.dialog.showOpenDialog(remote.getCurrentWindow(), {properties: ['openDirectory']}).then(result => {
      if (result.canceled || !result.filePaths.length) return;
      this.setState({rootDir: result.filePaths[0]});
    });
  }

  onImportURL() {
    this.props.onImportURL(this.state.importType, null, this.state.importURL, this.state.rootDir);
    this.props.onClose();
  }
}

(GooninatorDialog as any).displayName="GooninatorDialog";
export default GooninatorDialog;
