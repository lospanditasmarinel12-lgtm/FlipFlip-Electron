import * as React from "react";
import * as remote from "@electron/remote";
import {readFileSync} from "fs";
import {parseFile} from "music-metadata";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import { styled } from "@mui/material/styles";

import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import DeleteIcon from "@mui/icons-material/Delete";

import {extractMusicMetadata, generateThumbnailFile} from "../../data/utils";
import {isImage} from "../player/Scrapers";
import Audio from "../../data/Audio";

const Input = styled(TextField)(({ theme }) => ({
  width: '100%',
  maxWidth: 365,
  marginRight: theme.spacing(4),
}));

const InputShort = styled(TextField)({
  width: 75,
});

const InputFull = styled(TextField)({
  width: '100%',
  maxWidth: 530,
});

const TrackThumb = styled('div', {
  shouldForwardProp: (prop) => prop !== '$pointer',
})<{ $pointer?: boolean }>(({ $pointer }) => ({
  height: 140,
  width: 140,
  overflow: 'hidden',
  display: 'inline-flex',
  justifyContent: 'center',
  position: 'absolute',
  cursor: $pointer ? 'pointer' : undefined,
}));

const ThumbImage = styled('img')({
  height: '100%',
});

const DeleteThumbButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.error.main,
  position: 'absolute',
  bottom: '3%',
  right: '6%',
}));

const StyledDeleteIcon = styled(DeleteIcon)(({ theme }) => ({
  color: theme.palette.error.contrastText,
}));

const AudioIcon = styled(AudiotrackIcon)({
  height: '100%',
  width: '100%',
});

const Actions = styled(DialogActions)(({ theme }) => ({
  marginRight: theme.spacing(3),
}));

class AudioEdit extends React.Component {
  readonly props: {
    audio: Audio,
    cachePath: string,
    title: string,
    allowSuggestion?: boolean,
    onCancel(): void,
    onFinishEdit(common: Audio): void,
  };

  readonly state = {
    audio: this.props.audio,
  }

  render() {
    return (
      <Dialog
        open={true}
        onClose={this.props.onCancel.bind(this)}
        aria-describedby="edit-description">
        <DialogContent>
          <Typography variant="h6">{this.props.title}</Typography>
          <Input
            variant="standard"
            value={this.state.audio.name == null ? "" : this.state.audio.name}
            margin="normal"
            label="Name"
            onChange={this.onEdit.bind(this, 'name')} />
          <TrackThumb $pointer={this.state.audio.thumb == null} onClick={this.state.audio.thumb == null ? this.loadThumb.bind(this) : this.nop}>
            {this.state.audio.thumb != null && (
              <React.Fragment>
                <DeleteThumbButton
                  onClick={this.onRemoveThumb.bind(this)}
                  edge="end"
                  size="small"
                  aria-label="delete">
                  <StyledDeleteIcon color="inherit"/>
                </DeleteThumbButton>
                <ThumbImage src={this.state.audio.thumb}/>
              </React.Fragment>
            )}
            {this.state.audio.thumb == null && (
              <AudioIcon />
            )}
          </TrackThumb>
          <Input
            variant="standard"
            value={this.state.audio.artist == null ? "" : this.state.audio.artist}
            margin="normal"
            label="Artist"
            onChange={this.onEdit.bind(this, 'artist')} />
          <Input
            variant="standard"
            value={this.state.audio.album == null ? "" : this.state.audio.album}
            margin="normal"
            label="Album"
            onChange={this.onEdit.bind(this, 'album')} />
          <InputShort
            variant="standard"
            value={this.state.audio.trackNum == null ? "" : this.state.audio.trackNum}
            margin="normal"
            label="Track #"
            inputProps={{
              min: 0,
              type: 'number',
            }}
            onChange={this.onEditInt.bind(this, 'trackNum')} />
          <InputFull
            variant="standard"
            value={this.state.audio.comment == null ? "" : this.state.audio.comment}
            margin="normal"
            label="Comment"
            multiline
            onChange={this.onEdit.bind(this, 'comment')} />
        </DialogContent>
        <Actions>
          {this.props.allowSuggestion && (
            <Button onClick={this.loadSuggestions.bind(this)}>
              Use Suggestions
            </Button>
          )}
          <Button onClick={this.props.onCancel.bind(this)} color="secondary">
            Cancel
          </Button>
          <Button onClick={this.props.onFinishEdit.bind(this, this.state.audio)} color="primary">
            Save
          </Button>
        </Actions>
      </Dialog>
    );
  }

  nop() {}

  onEditInt(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    const newAudio = new Audio(this.state.audio);
    (newAudio as any)[key] = parseInt(input.value);
    this.setState({audio: newAudio});
  }

  onEdit(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    const newAudio = new Audio(this.state.audio);
    (newAudio as any)[key] = input.value;
    this.setState({audio: newAudio});
  }

  onRemoveThumb(e: MouseEvent) {
    e.preventDefault();
    const newAudio = new Audio(this.state.audio);
    newAudio.thumb = null;
    this.setState({audio: newAudio});
  }

  loadThumb() {
    remote.dialog.showOpenDialog(remote.getCurrentWindow(),
      {filters: [{name:'All Files (*.*)', extensions: ['*']}, {name: 'Image files', extensions: ["gif", "png", "jpeg", "jpg", "webp", "tiff", "svg"]}], properties: ['openFile']}).then(iResult => {
      if (iResult.canceled || !iResult.filePaths.length) return;
      const filtered = iResult.filePaths.filter((i) => isImage(i, true));
      if (filtered.length > 0) {
        const newAudio = this.state.audio;
        newAudio.thumb = generateThumbnailFile(this.props.cachePath, readFileSync(filtered[0]));
        this.setState({audio: newAudio});
      }
    });
  }

  loadSuggestions() {
    const url = this.state.audio.url;
    parseFile(url)
      .then((metadata: any) => {
        if (metadata) {
          const newAudio = new Audio(this.state.audio);
          extractMusicMetadata(newAudio, metadata, this.props.cachePath);
          this.setState({audio: newAudio});
        }
      })
      .catch((err: any) => {
        console.error("Error reading metadata:", err.message);
      });
  }
}

(AudioEdit as any).displayName="AudioEdit";
export default AudioEdit;
