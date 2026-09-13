import * as React from "react";
import Sortable from "react-sortablejs";
import {existsSync} from "fs";
import * as remote from "@electron/remote";

import {
  Avatar,
  Badge,
  Chip,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
} from "@mui/material";

import { styled } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import BuildIcon from "@mui/icons-material/Build";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import ShuffleIcon from '@mui/icons-material/Shuffle';

import {arrayMove, getTimestamp, randomizeList} from "../../data/utils";
import {RP} from "../../data/const";
import AudioControl from "./AudioControl";
import Audio from "../../data/Audio";
import Scene from "../../data/Scene";
import Tag from "../../data/Tag";
import SourceIcon from "../library/SourceIcon";

const AudioList = styled('div')({
  paddingLeft: 0,
});

const MediaIcon = styled(AudiotrackIcon)({
  width: '100%',
  height: 'auto',
});

const ThumbAvatar = styled(Avatar)(({ theme }) => ({
  width: theme.spacing(6),
  height: theme.spacing(6),
}));

const PlaylistAction = styled('div')({
  textAlign: 'center',
});

const LeftFloat = styled('div')(({ theme }) => ({
  float: 'left',
  paddingLeft: theme.spacing(2),
}));

const RightFloat = styled('div')(({ theme }) => ({
  float: 'right',
  paddingRight: theme.spacing(2),
}));

const TrackThumb = styled('div')({
  height: 40,
  width: 40,
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  cursor: 'pointer',
  userSelect: 'none',
});

const ThumbImage = styled('img')({
  height: '100%',
});

const ListAvatar = styled(ListItemAvatar)({
  width: 56,
});

const BigTooltip = styled(Tooltip)({
  '& .MuiTooltip-tooltip': {
    fontSize: "medium",
    maxWidth: 500,
  },
});

const TagChips = styled('div')({
  textAlign: 'center',
});

const AvatarFab = styled(Fab)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  boxShadow: 'none',
}));

const SourceIconStyled = styled(SourceIcon)<{ url?: string }>(({ theme }) => ({
  color: theme.palette.primary.contrastText,
}));

class AudioPlaylist extends React.Component {
  readonly props: {
    playlistIndex: number,
    playlist: { audios: Array<Audio>, shuffle: boolean, repeat: string },
    scene: Scene,
    sidebar: boolean,
    startPlaying: boolean,
    onAddTracks(playlistIndex: number): void,
    onSourceOptions(audio: Audio): void,
    onUpdateScene(scene: Scene, fn: (scene: Scene) => void): void,
    persist?: boolean,
    shorterSeek?: boolean,
    showMsTimestamp?: boolean,
    scenePaths?: Array<any>,
    goBack?(): void,
    orderAudioTags?(audio: Audio): void,
    onPlay?(source: Audio, displaySources: Array<Audio>): void,
    onPlaying?(position: number, duration: number): void,
    playTrack?(url: string): void,
    playNextScene?(): void,
    setCurrentAudio?(audio: Audio): void,
    systemMessage?(message: string): void,
  };

  readonly state = {
    currentIndex: this.props.playlistIndex == 0 ? this.props.scene.audioStartIndex : 0,
    playingAudios: Array<Audio>(),
  }

  render() {
    if (this.props.startPlaying) {
      let audio = this.state.playingAudios[this.state.currentIndex];
      if (!audio) audio = this.props.playlist.audios[this.state.currentIndex];
      if (!audio) return <div/>;
      return (
        <React.Fragment>
          <ListItem disableGutters>
            <ListItemIcon>
              <ThumbAvatar alt={audio.name} src={audio.thumb}>
                {audio.thumb == null && (
                  <MediaIcon/>
                )}
              </ThumbAvatar>
            </ListItemIcon>
            <ListItemText primary={audio.name} />
          </ListItem>
          <AudioControl
            audio={audio}
            audioEnabled={this.props.scene.audioEnabled || this.props.persist}
            singleTrack={this.state.playingAudios.length == 1}
            lastTrack={this.state.currentIndex == this.state.playingAudios.length - 1}
            repeat={this.props.playlist.repeat}
            scenePaths={this.props.scenePaths}
            shorterSeek={this.props.shorterSeek}
            showMsTimestamp={this.props.showMsTimestamp}
            startPlaying={this.props.startPlaying}
            playTrack={this.props.playTrack}
            nextTrack={this.nextTrack.bind(this)}
            prevTrack={this.prevTrack.bind(this)}
            onPlaying={this.props.onPlaying}
            onAudioSliderChange={this.onAudioSliderChange.bind(this)}
            goBack={this.props.goBack}
            playNextScene={this.props.playNextScene}/>
          <PlaylistAction>
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
          </PlaylistAction>
        </React.Fragment>
      );
    } else {
      return (
        <List disablePadding>
          <Sortable
            className="audioList"
            options={{
              animation: 150,
              easing: "cubic-bezier(1, 0, 0, 1)",
            }}
            onChange={(order: any, sortable: any, evt: any) => {
              let newAudios = Array.from(this.props.playlist.audios);
              arrayMove(newAudios, evt.oldIndex, evt.newIndex);
              this.props.onUpdateScene(this.props.scene, (s) => {
                s.audioPlaylists[this.props.playlistIndex].audios = newAudios;
              });
            }}>
            {this.props.playlist && this.props.playlist.audios && this.props.playlist.audios.map((a, i) =>
              <ListItem key={i}>
                <ListAvatar>
                  <Badge
                    invisible={!a.trackNum}
                    max={999}
                    overlap="rectangular"
                    color="primary"
                    badgeContent={a.trackNum}>
                    {a.comment ? (
                      <BigTooltip disableInteractive placement={a.comment ? 'right' : 'bottom'}
                                  arrow={!!a.comment || (a.tags && a.tags.length > 0)}
                                  title={
                                    <div>
                                      {a.comment}
                                      {a.comment && a.tags && a.tags.length > 0 && (<br/>)}
                                      <TagChips>
                                        {a.tags && a.tags.map((tag: Tag) =>
                                          <React.Fragment key={tag.id}>
                                            <Chip
                                              label={tag.name}
                                              color="primary"
                                              size="small"/>
                                          </React.Fragment>
                                        )}
                                      </TagChips>
                                    </div>
                                  }>
                        <TrackThumb onClick={this.onSourceIconClick.bind(this, a)}>
                          {a.thumb != null && (
                            <ThumbImage src={a.thumb}/>
                          )}
                          {a.thumb == null && (
                            <AvatarFab
                              size="small">
                              <SourceIconStyled url={a.url}/>
                            </AvatarFab>
                          )}
                        </TrackThumb>
                      </BigTooltip>
                    ) : (
                      <Tooltip disableInteractive placement={'bottom'}
                               arrow={!!a.comment || (a.tags && a.tags.length > 0)}
                               title={
                                 <div>
                                   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Click: Library Tagging
                                   <br/>
                                   Shift+Click: Open Source
                                   <br/>
                                   &nbsp;&nbsp;Ctrl+Click: Reveal File
                                 </div>
                               }>
                        <TrackThumb onClick={this.onSourceIconClick.bind(this, a)}>
                          {a.thumb != null && (
                            <ThumbImage src={a.thumb}/>
                          )}
                          {a.thumb == null && (
                            <AvatarFab
                              size="small">
                              <SourceIconStyled url={a.url}/>
                            </AvatarFab>
                          )}
                        </TrackThumb>
                      </Tooltip>
                    )}
                  </Badge>
                </ListAvatar>
                <ListItemText primary={a.name} />
                <ListItemSecondaryAction>
                  <Chip
                    label={getTimestamp(a.duration)}
                    color='default'
                    size='small'
                    variant='outlined'/>
                  <IconButton
                    edge="end"
                    onClick={this.props.onSourceOptions.bind(this, this.props.playlistIndex, a)}
                    size="large">
                    <BuildIcon/>
                  </IconButton>
                  <IconButton edge="end" onClick={this.removeTrack.bind(this, i)} size="large">
                    <DeleteIcon color={"error"}/>
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )}
          </Sortable>
          <PlaylistAction>
            <LeftFloat>
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
            </LeftFloat>
            <Tooltip disableInteractive title="Add Tracks">
              <IconButton
                onClick={this.props.onAddTracks.bind(this, this.props.playlistIndex)}
                size="large">
                <AddIcon/>
              </IconButton>
            </Tooltip>
            <RightFloat>
              <Chip
                label={getTimestamp(this.props.playlist.audios.reduce((total, a) => total + a.duration, 0))}
                color='default'
                size='small'
                variant='outlined'/>
              <Tooltip disableInteractive title="Remove Playlist">
                <IconButton onClick={this.removePlaylist.bind(this)} size="large">
                  <ClearIcon color={"error"}/>
                </IconButton>
              </Tooltip>
            </RightFloat>
          </PlaylistAction>
        </List>
      );
    }
  }

  componentDidUpdate(props: any, state: any) {
    if (!this.props.persist && this.props.scene !== props.scene) {
      this.restart();
    }
  }

  componentDidMount() {
    if (this.props.playlistIndex == 0 && this.props.scene.audioScene) {
      window.addEventListener('keydown', this.onKeyDown, false);
    }
    this.restart();
  }

  restart() {
    let audios = this.props.playlist.audios;
    if (this.props.startPlaying && this.state.playingAudios.length == 0) {
      if (this.props.playlist.shuffle) {
        audios = randomizeList(Array.from(audios));
      }
      this.setState({playingAudios: audios});
    }
    if (this.props.setCurrentAudio) {
      let audio = audios[this.state.currentIndex];
      if (!audio) audio = this.props.playlist.audios[this.state.currentIndex];
      this.props.setCurrentAudio(audio);
    }
  }

  componentWillUnmount() {
    if (this.props.playlistIndex == 0 && this.props.scene.audioScene) {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case '[':
        e.preventDefault();
        this.props.orderAudioTags(this.props.playlist.audios[this.state.currentIndex]);
        this.prevTrack();
        break;
      case ']':
        e.preventDefault();
        this.props.orderAudioTags(this.props.playlist.audios[this.state.currentIndex]);
        this.nextTrack();
        break;
    }
  }

  onSourceIconClick(audio: Audio, e: MouseEvent) {
    const sourceURL = audio.url;
    if (e.shiftKey && !e.ctrlKey) {
      this.openExternalURL(sourceURL);
    } else if (!e.shiftKey && e.ctrlKey) {
      if (existsSync(sourceURL)) {
        remote.shell.showItemInFolder(sourceURL);
      }
    } else if (!e.shiftKey && !e.ctrlKey && this.props.onPlay && this.props.systemMessage) {
      try {
        this.props.onPlay(audio, this.props.playlist.audios);
      } catch (e) {
        this.props.systemMessage("The source " + sourceURL + " isn't in your Library");
      }
    }
  }

  openExternalURL(url: string) {
    remote.shell.openExternal(url);
  }

  prevTrack() {
    let prevTrack = this.state.currentIndex - 1;
    if (prevTrack < 0) {
      prevTrack = this.state.playingAudios.length - 1;
    }
    if (this.props.setCurrentAudio) {
      this.props.setCurrentAudio(this.state.playingAudios[prevTrack]);
    }
    this.setState({currentIndex: prevTrack});
  }

  nextTrack() {
    let nextTrack = this.state.currentIndex + 1;
    if (nextTrack >= this.state.playingAudios.length) {
      nextTrack = 0;
    }
    if (this.props.setCurrentAudio) {
      this.props.setCurrentAudio(this.state.playingAudios[nextTrack]);
    }
    this.setState({currentIndex: nextTrack});
  }

  toggleShuffle() {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.audioPlaylists[this.props.playlistIndex];
      playlist.shuffle = !playlist.shuffle;
    });
  }

  changeRepeat() {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.audioPlaylists[this.props.playlistIndex];
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
      s.audioPlaylists.splice(this.props.playlistIndex, 1);
    });
  }

  removeTrack(trackIndex: number) {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.audioPlaylists[this.props.playlistIndex];
      playlist.audios.splice(trackIndex, 1);
    });
  }

  onAudioSliderChange(e: MouseEvent, value: number) {
  }
}

(AudioPlaylist as any).displayName="AudioPlaylist";
export default AudioPlaylist;
