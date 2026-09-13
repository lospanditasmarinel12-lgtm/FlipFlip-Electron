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
import { styled } from "@mui/material/styles";

import {AF} from "../../data/const";

class URLDialog extends React.Component {
  readonly props: {
    open: boolean,
    onClose(): void,
    onImportURL(type: string, e: MouseEvent, ...args: any[]): void,
  };

  readonly state = {
    importURLs: "",
  };

  render() {
    return (
      <Dialog
        open={this.props.open}
        onClose={this.props.onClose.bind(this)}
        aria-labelledby="url-import-title"
        aria-describedby="url-import-description">
        <DialogTitle id="url-import-title">Add Multiple URL Sources</DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-all-description">
            Paste URLs to add as sources, one per line:
          </DialogContentText>
          <TextField
            variant="standard"
            label="Source URLs"
            fullWidth
            multiline
            margin="dense"
            value={this.state.importURLs}
            sx={{
              '& .MuiInputBase-input': {
                minWidth: 550,
                minHeight: 300,
                whiteSpace: 'nowrap',
                overflowX: 'hidden',
                overflowY: 'auto !important',
              },
            }}
            onChange={this.onURLChange.bind(this)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose.bind(this)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={this.onImportURL.bind(this)}
            color="primary">
            Add Sources
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  onURLChange(e: MouseEvent) {
    const type = (e.target as HTMLInputElement).value;
    this.setState({importURLs: type});
  }

  onImportURL() {
    this.props.onImportURL(AF.list, null, this.state.importURLs);
    this.setState({importURLs: ""});
    this.props.onClose();
  }
}

(URLDialog as any).displayName="URLDialog";
export default URLDialog;