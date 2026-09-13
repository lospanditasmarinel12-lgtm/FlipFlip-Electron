import * as React from "react";
import Sortable from "react-sortablejs";
import {existsSync} from "fs";
import * as remote from "@electron/remote";

import {
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import ShuffleIcon from '@mui/icons-material/Shuffle';

import {arrayMove} from "../../data/utils";
import {RP} from "../../data/const";
import Scene from "../../data/Scene";
import SourceIcon from "../library/SourceIcon";
import CaptionScript from "../../data/CaptionScript";

const ScriptUl = styled('ul')({
  paddingLeft: 0,
});

const PlaylistAction = styled('div')({
  textAlign: 'center',
});

const LeftDiv = styled('div')(({theme}) => ({
  float: 'left',
  paddingLeft: theme.spacing(2),
}));

const RightDiv = styled('div')(({theme}) => ({
  float: 'right',
  paddingRight: theme.spacing(2),
}));

const ScriptThumb = styled('div')({
  height: 40,
  width: 40,
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  cursor: 'pointer',
  userSelect: 'none',
});

const StyledListItemAvatar = styled(ListItemAvatar)({
  width: 56,
});

const StyledFab = styled(Fab)(({theme}) => ({
  backgroundColor: theme.palette.primary.main,
  boxShadow: 'none',
}));

const StyledSourceIcon = styled(SourceIcon)<{ url?: string }>(({theme}) => ({
  color: theme.palette.primary.contrastText,
}));

class ScriptPlaylist extends React.Component {
  readonly props: {
    playlistIndex: number,
    playlist: { scripts: Array<CaptionScript>, shuffle: boolean, repeat: string },
    scene: Scene,
    onAddScript(playlistIndex: number): void,
    onPlay(source: CaptionScript, sceneID: number, displaySources: Array<CaptionScript>): void,
    onSourceOptions(script: CaptionScript): void,
    onUpdateScene(scene: Scene, fn: (scene: Scene) => void): void,
    systemMessage(message: string): void,
  };

  render() {
    return (
      <List disablePadding>
        <Sortable
          tag="ul"
          className={undefined}
          options={{
            animation: 150,
            easing: "cubic-bezier(1, 0, 0, 1)",
          }}
          onChange={(order: any, sortable: any, evt: any) => {
            let newScripts = Array.from(this.props.playlist.scripts);
            arrayMove(newScripts, evt.oldIndex, evt.newIndex);
            this.props.onUpdateScene(this.props.scene, (s) => {
              s.scriptPlaylists[this.props.playlistIndex].scripts = newScripts;
            });
          }}>
          <ScriptUl>
            {this.props.playlist.scripts.map((s, i) =>
              <ListItem key={i}>
                <StyledListItemAvatar>
                    <Tooltip disableInteractive placement={'bottom'}
                             title={
                                 <div>
                                   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Click: Library Tagging
                                   <br/>
                                   Shift+Click: Open Source
                                   <br/>
                                   &nbsp;&nbsp;Ctrl+Click: Reveal File
                                 </div>
                             }>
                      <div onClick={this.onSourceIconClick.bind(this, s)}>
                        <ScriptThumb>
                          <StyledFab
                            size="small">
                            <StyledSourceIcon url={s.url}/>
                          </StyledFab>
                        </ScriptThumb>
                      </div>
                    </Tooltip>
                </StyledListItemAvatar>
                <ListItemText primary={s.url} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={this.props.onSourceOptions.bind(this, this.props.playlistIndex, s)}
                    size="large">
                    <BuildIcon/>
                  </IconButton>
                  <IconButton edge="end" onClick={this.removeScript.bind(this, i)} size="large">
                    <DeleteIcon color={"error"}/>
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )}
          </ScriptUl>
        </Sortable>
        <PlaylistAction>
          <LeftDiv>
            <Tooltip disableInteractive title={"Shuffle " + (this.props.playlist.shuffle ? "(On)" : "(Off)")}>
              <IconButton onClick={this.toggleShuffle.bind(this)} size="large">
                <ShuffleIcon color={this.props.playlist.shuffle ? "primary" : undefined}/>
              </IconButton>
            </Tooltip>
            <Tooltip disableInteractive title={"Repeat " + (this.props.playlist.repeat == RP.none ? "(Off)" : this.props.playlist.repeat == RP.all ? "(All)" : "(One)")}>
              <IconButton onClick={this.changeRepeat.bind(this)} size="large">
                {this.props.playlist.repeat == RP.none && (
                  <RepeatIcon />
                )}
                {this.props.playlist.repeat == RP.all && (
                  <RepeatIcon color={"primary"}/>
                )}
                {this.props.playlist.repeat == RP.one && (
                  <RepeatOneIcon color={"primary"} />
                )}
              </IconButton>
            </Tooltip>
          </LeftDiv>
          <Tooltip disableInteractive title="Add Tracks">
            <IconButton
              onClick={this.props.onAddScript.bind(this, this.props.playlistIndex)}
              size="large">
              <AddIcon/>
            </IconButton>
          </Tooltip>
          <RightDiv>
            <Tooltip disableInteractive title="Remove Playlist">
              <IconButton onClick={this.removePlaylist.bind(this)} size="large">
                <ClearIcon color={"error"}/>
              </IconButton>
            </Tooltip>
          </RightDiv>
        </PlaylistAction>
      </List>
    );
  }

  onSourceIconClick(script: CaptionScript, e: MouseEvent) {
    const sourceURL = script.url;
    if (e.shiftKey && !e.ctrlKey) {
      this.openExternalURL(sourceURL);
    } else if (!e.shiftKey && e.ctrlKey) {
      if (existsSync(sourceURL)) {
        remote.shell.showItemInFolder(sourceURL);
      }
    } else if (!e.shiftKey && !e.ctrlKey && this.props.systemMessage) {
      try {
        this.props.onPlay(script, this.props.scene.id, this.props.playlist.scripts);
      } catch (e) {
        this.props.systemMessage("The source " + sourceURL + " isn't in your Library");
      }
    }
  }

  openExternalURL(url: string) {
    remote.shell.openExternal(url);
  }

  toggleShuffle() {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.scriptPlaylists[this.props.playlistIndex];
      playlist.shuffle = !playlist.shuffle;
    });
  }

  changeRepeat() {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.scriptPlaylists[this.props.playlistIndex];
      const repeat = playlist.repeat;
      switch (repeat) {
        case RP.none:
          playlist.repeat = RP.all;
          break;
        case RP.all:
          playlist.repeat = RP.one;
          break;
        case RP.one:
          playlist.repeat = RP.none;
          break;
      }
    });
  }

  removePlaylist() {
    this.props.onUpdateScene(this.props.scene, (s) => {
      s.scriptPlaylists.splice(this.props.playlistIndex, 1);
    });
  }

  removeScript(scriptIndex: number) {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.scriptPlaylists[this.props.playlistIndex];
      playlist.scripts.splice(scriptIndex, 1);
    });
  }
}

(ScriptPlaylist as any).displayName="ScriptPlaylist";
export default ScriptPlaylist;
