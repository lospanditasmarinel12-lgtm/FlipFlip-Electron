import * as React from "react";

import { Collapse, Divider, Fab, FormControlLabel, Grid, Switch, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";

import Scene from "../../data/Scene";
import AddIcon from "@mui/icons-material/Add";
import {RP} from "../../data/const";
import ScriptPlaylist from "./ScriptPlaylist";
import ScriptOptions from "../library/ScriptOptions";
import CaptionScript from "../../data/CaptionScript";

const StyledFab = styled(Fab)({
  boxShadow: 'none',
});

class TextCard extends React.Component {
  readonly props: {
    scene: Scene,
    sidebar?: boolean
    onAddScript(playlistIndex: number): void,
    onPlay(source: CaptionScript, sceneID: number, displayed: Array<CaptionScript>): void,
    onUpdateScene(scene: Scene, fn: (scene: Scene) => void): void,
    systemMessage(message: string): void,
  };

  readonly state = {
    sourceOptionsPlaylist: -1,
    sourceOptions: null as CaptionScript,
  }

  render() {
    if (this.props.sidebar) {
      return (
        <Grid container alignItems="center">
          <Grid item xs={12}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs>
                <FormControlLabel
                  control={
                    <Switch checked={this.props.scene.textEnabled}
                            onChange={this.onBoolInput.bind(this, 'textEnabled')}/>
                  }
                  label="Text Overlay"/>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )
    }

    return(
      <Grid container alignItems="center">
        <Grid item xs={12}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <FormControlLabel
                control={
                  <Switch checked={this.props.scene.textEnabled}
                          onChange={this.onBoolInput.bind(this, 'textEnabled')}/>
                }
                label="Text Overlay"/>
            </Grid>
            <Grid item>
              <Collapse in={this.props.scene.textEnabled}>
                <Tooltip disableInteractive title={"Add Playlist"}>
                  <StyledFab
                    onClick={this.onAddPlaylist.bind(this)}
                    size="small">
                    <AddIcon />
                  </StyledFab>
                </Tooltip>
              </Collapse>
            </Grid>
          </Grid>
        </Grid>
        {this.props.scene.scriptPlaylists.map((playlist, i) =>
          <React.Fragment key={i}>
            <Grid item xs={12}>
              <Collapse in={this.props.scene.textEnabled}>
                <ScriptPlaylist
                  playlistIndex={i}
                  playlist={playlist}
                  scene={this.props.scene}
                  onAddScript={this.props.onAddScript}
                  onPlay={this.props.onPlay}
                  onSourceOptions={this.onSourceOptions.bind(this)}
                  onUpdateScene={this.props.onUpdateScene.bind(this)}
                  systemMessage={this.props.systemMessage}/>
              </Collapse>
            </Grid>
            {i != this.props.scene.scriptPlaylists.length-1 && (
              <Grid item xs={12}>
                <Collapse in={this.props.scene.textEnabled}>
                  <Divider/>
                </Collapse>
              </Grid>
            )}
          </React.Fragment>
        )}
        {this.state.sourceOptions != null && (
          <ScriptOptions
            script={this.state.sourceOptions}
            onCancel={this.onCloseSourceOptions.bind(this)}
            onFinishEdit={this.onFinishSourceOptions.bind(this)}
          />
        )}
      </Grid>
    );
  }

  onFinishSourceOptions(newScript: CaptionScript) {
    this.props.onUpdateScene(this.props.scene, (s) => {
      const playlist = s.scriptPlaylists[this.state.sourceOptionsPlaylist];
      let editSource = playlist.scripts.find((s) => s.id == this.state.sourceOptions.id);
      Object.assign(editSource, newScript);
    })
    this.onCloseSourceOptions();
  }

  onCloseSourceOptions() {
    this.setState({sourceOptions: null, sourceOptionsPlaylist: -1});
  }

  onSourceOptions(playlistIndex: number, script: CaptionScript) {
    this.setState({sourceOptions: script, sourceOptionsPlaylist: playlistIndex});
  }

  onAddPlaylist() {
    this.changeKey('scriptPlaylists', this.props.scene.scriptPlaylists.concat([{scripts: [], shuffle: false, repeat: RP.all}]));
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
    this.props.onUpdateScene(this.props.scene, fn);
  }
}

(TextCard as any).displayName="TextCard";
export default TextCard;
