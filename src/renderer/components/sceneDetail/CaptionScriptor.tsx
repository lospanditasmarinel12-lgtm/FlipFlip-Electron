import * as React from "react";
import * as remote from "@electron/remote";
import wretch from "wretch";
import fs from "fs";
import fontList from "font-list";
import SystemFonts from "system-font-families";

require('codemirror/lib/codemirror.css');
require('codemirror/theme/material.css');

import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Select,
  Slider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled, Theme } from "@mui/material/styles";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FolderIcon from '@mui/icons-material/Folder';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import GetAppIcon from '@mui/icons-material/GetApp';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SaveIcon from '@mui/icons-material/Save';

import {CST, MO, RP} from "../../data/const";
import captionProgramDefaults, {CancelablePromise, deepClone} from "../../data/utils";
import Scene from "../../data/Scene";
import Tag from "../../data/Tag";
import Player from "../player/Player";
import Config from "../../data/Config";
import SceneSelect from "../configGroups/SceneSelect";
import CaptionProgram from "../player/CaptionProgram";
import ChildCallbackHack from "../player/ChildCallbackHack";
import AudioCard from "../configGroups/AudioCard";
import FontOptions from "../library/FontOptions";
import CaptionScript, {FontSettingsI} from "../../data/CaptionScript";
import CodeMirror, {
  booleanSetters,
  colorSetters,
  singleSetters,
  stringSetters,
  timestampRegex,
  tupleSetters
} from "./CodeMirror";
import SceneGrid from "../../data/SceneGrid";

class CaptionScriptor extends React.Component {
  readonly props: {
    config: Config,
    openScript: CaptionScript,
    scenes: Array<Scene>,
    sceneGrids: Array<SceneGrid>,
    theme: Theme,
    tutorial: string,
    onAddFromLibrary(): void,
    getTags(source: string): Array<Tag>,
    goBack(): void,
    onUpdateScene(scene: Scene, fn: (scene: Scene) => void): void,
    onUpdateLibrary(fn: (library: Array<CaptionScript>) => void): void,
  };

  readonly state = {
    captionScript: new CaptionScript({script: ""}),
    sceneScripts: null as Array<CaptionScript>,
    selectScript: "",
    scene: null as Scene,
    error: null as string,
    fullscreen: false,
    sceneChanged: false,
    scriptChanged: false,
    loadFromSceneError: false,
    openMenu: null as string,
    menuAnchorEl: null as any,
    captionProgramJumpToHack: new ChildCallbackHack(),
    codeMirrorAddHack: new ChildCallbackHack(),
    codeMirrorOverwriteHack: new ChildCallbackHack(),
    systemFonts: Array<string>(),
  };

  render() {
    let menuName, menuThen;
    switch(this.state.openMenu) {
      case MO.error:
        menuName="Back";
        menuThen=this.props.goBack;
        break;
      case MO.new:
        menuName="New";
        menuThen=this.onConfirmNew.bind(this);
        break;
      case MO.openLocal:
        menuName="Open";
        menuThen=this.onConfirmOpen.bind(this);
        break;
      case MO.openLibrary:
        menuName="Open";
        menuThen=this.onConfirmOpenFromLibrary.bind(this);
        break;
      case MO.load:
        menuName = "Load From Scene";
        menuThen = this.onOpenScriptSelect.bind(this)
        break;
    }

    let getTimestamp = undefined;
    if (this.state.scene && this.state.scene.audioEnabled) {
      getTimestamp = this.getTimestamp.bind(this);
    }

    return (
      <div style={{ display: 'flex' }}>
        <AppBar position="absolute" sx={theme => ({
          zIndex: theme.zIndex.drawer + 1,
        })}>
          <Toolbar sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexWrap: 'nowrap', minHeight: 64, height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
            <div style={{ flexBasis: '3%' }}>
              <Tooltip disableInteractive title="Back" placement="right-end">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  sx={{ float: 'left' }}
                  onClick={this.goBack.bind(this)}
                  size="large">
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </div>

            <Typography component="h1" variant="h4" color="inherit" noWrap
                        sx={{ textAlign: 'center', flexGrow: 1 }}>
              {this.state.captionScript.url ? this.state.captionScript.url : "Caption Scriptor"}
            </Typography>

            <Tooltip disableInteractive title={this.state.fullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              <span style={this.state.scene == null ? { pointerEvents: "none" } : {}}>
                <IconButton
                  disabled={this.state.scene == null}
                  edge="start"
                  color="inherit"
                  aria-label={this.state.fullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  onClick={this.onFullscreen.bind(this)}
                  size="large">
                  {this.state.fullscreen ? <FullscreenExitIcon fontSize="large"/> : <FullscreenIcon fontSize="large"/>}
                </IconButton>
              </span>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', height: '100vh', backgroundColor: 'background.default' }}>
          <Box sx={theme => ({
            backgroundColor: theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 8px',
            minHeight: 64,
          })} />

          <div style={{ display: 'flex', flexGrow: 1 }}>
            <Container maxWidth={false} sx={{
              padding: 0,
              display: 'grid',
              gridTemplateColumns: '40% 20% 40%',
              gridTemplateRows: '50% 50%',
            }}>
              <Box sx={theme => ({
                gridRowStart: 1,
                gridRowEnd: 3,
                display: 'flex',
                flexDirection: 'column',
                ...(this.state.fullscreen && { opacity: 0 }),
              })}
                   id={'script-field'}>
                {this.state.error != null && (
                  <Box sx={{ display: 'flex', ml: 1 }}>
                    <ErrorOutlineIcon sx={{ marginTop: '3px', marginRight: 1 }} color="error" />
                    <Typography component="div" variant="h5" color="error">
                      {this.state.error}
                    </Typography>
                   </Box>
                  )}
         </Box>

        <Dialog
          open={this.state.openMenu == MO.select}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="load-title"
          aria-describedby="load-description">
          <DialogTitle id="load-title">Load From Scene</DialogTitle>
          <DialogContent>
            <DialogContentText id="load-description">
              Choose a script to load:
            </DialogContentText>
            <Select
              variant="standard"
              fullWidth
              value={this.state.selectScript}
              onChange={this.onChangeSelectScript.bind(this)}>
              {this.state.sceneScripts && this.state.sceneScripts.map((s, i) => 
                <MenuItem key={i} value={s.url}>{s.url}</MenuItem>
              )}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button disabled={!this.state.selectScript.length} onClick={this.onConfirmLoadFromScene.bind(this)} color="primary">
              Load Script
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!menuName && !!menuThen}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="back-title"
          aria-describedby="back-description">
          <DialogTitle id="back-title">Save Changes?</DialogTitle>
          <DialogContent>
            <DialogContentText id="back-description">
              You have unsaved changes. Would you like to save?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={menuThen} color="inherit">
              {menuName} - Don't Save
            </Button>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onSaveThen.bind(this, menuThen)} color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
        </Container>
      </div>
    </Box>
  </div>
    );
  }

  _currentTimestamp: number = null;
  onPlaying(position: number, duration: number) {
    this._currentTimestamp = position;
  }
  getTimestamp() {
    return this._currentTimestamp;
  }

  onCloseDialog() {
    this.setState({openMenu: null, menuAnchorEl: null, drawerOpen: false, selectScript: ""});
  }

  _promise: CancelablePromise = null;
  componentDidMount() {
    this._currentTimestamp = 0;
    window.addEventListener('keydown', this.onKeyDown, false);
    if (process.platform == "darwin") {
      this._promise = new CancelablePromise((resolve, reject) => {
        new SystemFonts().getFonts().then((res: Array<string>) => {
            if (!this._promise.hasCanceled) {
              this.setState({systemFonts: res});
            }
          },
          (err: string) => {
            console.error(err);
          }
        );
      });
    } else {
      this._promise = new CancelablePromise((resolve, reject) => {
        fontList.getFonts().then((res: Array<string>) => {
            res = res.map((r) => {
              if (r.startsWith("\"") && r.endsWith("\"")) {
                return r.substring(1, r.length - 1);
              } else {
                return r;
              }
            })
            if (!this._promise.hasCanceled) {
              this.setState({systemFonts: res});
            }
          },
          (err: string) => {
            console.error(err);
          }
        );
      });
    }
    if (this.props.openScript) {
      if (this.props.openScript.script) {
        this.state.codeMirrorOverwriteHack.args = [this.props.openScript.script];
        this.state.codeMirrorOverwriteHack.fire();
        this.setState({captionScript: this.props.openScript, scriptChanged: false});
      } else {
        wretch(this.props.openScript.url)
          .get()
          .text(data => {
            this.state.codeMirrorOverwriteHack.args = [data];
            this.state.codeMirrorOverwriteHack.fire();
            this.setState({captionScript: this.props.openScript, scriptChanged: false});
          });
      }
    }
  }

  componentWillUnmount() {
    this._currentTimestamp = null;
    window.removeEventListener('keydown', this.onKeyDown);
    if (this._promise != null) {
      this._promise.cancel();
    }
  }

  onKeyDown = (e: KeyboardEvent) => {
    if (e.key == 'Escape' && this.state.fullscreen) {
      this.onFullscreen();
    }
  };

  onNew() {
    if (this.state.scriptChanged) {
      this.setState({openMenu: MO.new});
    } else {
      this.onConfirmNew();
    }
  }

  onConfirmNew() {
    this.onCloseDialog();
    this.setState({captionScript: new CaptionScript({script: ""}), error: null, scriptChanged: false});
    this.state.codeMirrorOverwriteHack.args = [""];
    this.state.codeMirrorOverwriteHack.fire();
  }

  onOpenMenu(e: MouseEvent) {
    this.setState({menuAnchorEl: e.currentTarget, openMenu: MO.open});
  }

  onOpen() {
    this.onCloseDialog();
    if (this.state.scriptChanged) {
      this.setState({openMenu: MO.openLocal});
    } else {
      this.onConfirmOpen();
    }
  }

  onConfirmOpen() {
    this.onCloseDialog();
    remote.dialog.showOpenDialog(remote.getCurrentWindow(),
      {
        filters: [{name: 'All Files (*.*)', extensions: ['*']}, {name: 'Text Document', extensions: ['txt']}],
        properties: ['openFile']
      }).then(result => {
      if (result.canceled || !result.filePaths.length) return;
      const url = result.filePaths[0];
      wretch(url)
        .get()
        .text(data => {
          this.state.codeMirrorOverwriteHack.args = [data];
          this.state.codeMirrorOverwriteHack.fire();
          this.setState({captionScript: new CaptionScript({url: url}), scriptChanged: false});
        });
    });
  }

  onOpenFromLibrary() {
    this.onCloseDialog();
    if (this.state.scriptChanged) {
      this.setState({openMenu: MO.openLibrary});
    } else {
      this.onConfirmOpenFromLibrary();
    }
  }

  onConfirmOpenFromLibrary() {
    this.onCloseDialog();
    this.props.onAddFromLibrary();
  }

  onSaveThen(then: () => void) {
    if (this.onSave()) {
      then();
    }
  }

  onSaveMenu(e: MouseEvent) {
    this.setState({menuAnchorEl: e.currentTarget, openMenu: MO.save});
  }

  onSave() {
    this.onCloseDialog();
    if (!this.state.captionScript.url) {
      return this.onSaveAs();
    } else {
      if (!this.state.captionScript.url.startsWith("http")) {
        fs.writeFileSync(this.state.captionScript.url, this.state.captionScript.script);
        this.setState({scriptChanged: false});
        return true;
      } else {
        return false;
      }
    }
  }

  onSaveAs() {
    this.onCloseDialog();
    remote.dialog.showSaveDialog(remote.getCurrentWindow(),
      {filters: [{name: 'Text Document', extensions: ['txt']}], defaultPath: this.state.captionScript.url}).then(result => {
        if (result.canceled || !result.filePath) return;
        const filePath = result.filePath;
        fs.writeFileSync(filePath, this.state.captionScript.script);
        const setURL = (script: CaptionScript) => {
          script.url = filePath;
          return script;
        }
        this.setState({captionScript: setURL(this.state.captionScript), scriptChanged: false});
      });
  }

    onSaveToLibrary() {
    this.onCloseDialog();
    this.onSave();
    this.props.onUpdateLibrary((library) => {
      const script = library.find((s) => s.url == this.state.captionScript.url);
      if (script) {
        script.blink = this.state.captionScript.blink;
        script.caption = this.state.captionScript.caption;
        script.captionBig = this.state.captionScript.captionBig;
        script.count = this.state.captionScript.count;
      } else {
        let id = library.length + 1;
        library.forEach((s) => {
          id = Math.max(s.id + 1, id);
        });
        const newScript = deepClone(this.state.captionScript);
        newScript.id = id;
        newScript.script = null;
        library.push(newScript);
      }
    })
  }

  onLoadFromScene() {
    if (!this.state.sceneScripts.length || this.state.loadFromSceneError)  return;
    if (this.state.scriptChanged) {
      this.setState({openMenu: MO.load});
    } else {
      this.onOpenScriptSelect();
    }
  }

  onOpenScriptSelect() {
    const defScript = this.state.sceneScripts != null && this.state.sceneScripts.length ? this.state.sceneScripts[0].url : "";
    this.setState({openMenu: MO.select, selectScript: defScript});
  }

  onChangeSelectScript(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({selectScript: input.value});
  }

  onConfirmLoadFromScene() {
    const error = (error: any) => {
      console.error(error);
      this.setState({loadFromSceneError: true});
      setTimeout(() => {this.setState({loadFromSceneError: false});}, 3000);
    }

    const script = deepClone(this.state.sceneScripts.find((s) => s.url == this.state.selectScript));
    this.onCloseDialog();
    wretch(script.url)
      .get()
      .badRequest(error)
      .unauthorized(error)
      .forbidden(error)
      .notFound(error)
      .timeout(error)
      .internalError(error)
      .fetchError(error)
      .error(503, error)
      .text(data => {
        this.state.codeMirrorOverwriteHack.args = [data];
        this.state.codeMirrorOverwriteHack.fire();
        this.setState({captionScript: script, scriptChanged: false});
      });
  }

  onFullscreen() {
    if (this.state.scene != null) {
      this.setState({fullscreen: !this.state.fullscreen});
    } else {
      this.setState({fullscreen: false});
    }
  }

  onError(e: string) {
    this.setState({error: e});
  }

  onUpdateScript(script: string, changed = false) {
    const newScript = deepClone(this.state.captionScript);
    newScript.blink = this.state.captionScript.blink;
    newScript.caption = this.state.captionScript.caption;
    newScript.captionBig = this.state.captionScript.captionBig;
    newScript.count = this.state.captionScript.count;
    newScript.script = script;
    if (this.state.scene) {
      const newScene = deepClone(this.state.scene);
      newScene.scriptPlaylists = [{scripts: [newScript], shuffle: false, repeat: RP.one}];
      this.setState({scene: newScene, captionScript: newScript, error: null, scriptChanged: changed ? true : this.state.scriptChanged});
    } else {
      this.setState({captionScript: newScript, error: null, scriptChanged: changed ? true : this.state.scriptChanged});
    }
  }

  onGutterClick(editor: any, clickedLine: number) {
    let lineNum = clickedLine - 1;
    const lines = this.state.captionScript.script.split('\n');
    for (let l = 0; l < clickedLine; l++) {
      const line = lines[l];
      if (line.trim().length == 0 || line[0] == '#' || line.toLowerCase().startsWith("storephrase ") ||
        line.toLowerCase().startsWith("storeaudio ") ||
        timestampRegex.exec(line.split(" ")[0]) != null) lineNum--;
    }
    lineNum = Math.max(lineNum, 0);
    this.state.captionProgramJumpToHack.args = [lineNum];
    this.state.captionProgramJumpToHack.fire();
  }

  onChangeScene(sceneID: number) {
    if (sceneID == 0) {
      this.setState({scene: null, sceneScripts: null, sceneChanged: false});
      return;
    }
    const scene = deepClone(this.props.scenes.find((s) => s.id == sceneID));
    const originalPlaylists = scene.scriptPlaylists;
    scene.audioEnabled = false;
    scene.videoVolume = 0;
    scene.textEnabled = true;
    scene.scriptPlaylists = [{scripts: [this.state.captionScript], shuffle: false, repeat: RP.one}];
    const originalScripts = new Array<CaptionScript>();
    for (let playlist of originalPlaylists) {
      for (let script of playlist.scripts) {
        originalScripts.push(script);
      }
    }
    this.setState({scene: scene, sceneScripts: originalScripts, sceneChanged: false});
  }

  getSceneName(id: string): string {
    if (id === "0") return "None";
    return this.props.scenes.find((s) => s.id.toString() === id).name;
  }

  onUpdateScene(scene: Scene, fn: (scene: Scene) => void) {
    const newScene = deepClone(scene)
    fn(newScene);
    this.setState({scene: newScene, sceneChanged: true});
  }

  goBack() {
    if (this.state.fullscreen) {
      this.onFullscreen();
    } else if (this.state.scriptChanged) {
      this.setState({openMenu: MO.error});
    } else {
      this.props.goBack();
    }
  }

  onAddBlink() {
    this.onAddString("blink <TEXT> / <TEXT> / <TEXT>", true);
  }

  onAddCap() {
    this.onAddString("cap <TEXT>", true);
  }

  onAddBigCap() {
    this.onAddString("bigcap <TEXT>", true);
  }

  onAddCount() {
    this.onAddString("count <START> <END>", true);
  }

  onAddWait() {
    this.onAddString("wait <MILLISECONDS>", true);
  }

  onAddAdvance() {
    this.onAddString("advance", true);
  }

  onAddPlayAudio() {
    this.onAddString("playAudio <ALIAS> <VOLUME>", true);
  }

  onAddStorePhrase() {
    this.onAddString("storePhrase <TEXT>", true);
  }

  onAddStoreAudio() {
    this.onAddString("storeAudio <PATH> <ALIAS>", true);
  }

  addAllSetters() {
    let addString = "";
    for (let setter of tupleSetters) {
      let property = setter.replace("set", "");
      property = property.charAt(0).toLowerCase() + property.slice(1);
      const defaultVal = (captionProgramDefaults as any)[property];
      addString += setter + " " + defaultVal[0] + " " + defaultVal[1] + "\n";
    }
    addString += "\n";
    for (let setter of stringSetters) {
      addString += setter + " constant\n";
    }
    addString += "\n";
    for (let setter of singleSetters) {
      let property = setter.replace("set", "");
      property = property.charAt(0).toLowerCase() + property.slice(1);
      const defaultVal = (captionProgramDefaults as any)[property];
      addString += setter + " " + defaultVal + "\n";
    }
    addString += "\n";
    for (let setter of booleanSetters) {
      addString += setter + " false\n";
    }
    for (let setter of colorSetters) {
      addString += setter + " 0 #FFFFFF\n";
    }
    this.onAddString(addString, true);
  }

  onAddSetter(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    if (input.value == "all") {
      this.addAllSetters();
    } else {
      const setter = input.value;
      if (tupleSetters.includes(setter)) {
        this.onAddTupleSetter(setter);
      } else if (singleSetters.includes(setter)) {
        this.onAddSingleSetter(setter);
      } else if (stringSetters.includes(setter)) {
        this.onAddStringSetter(setter);
      } else if (booleanSetters.includes(setter)) {
        this.onAddBooleanSetter(setter);
      } else if (colorSetters.includes(setter)) {
        this.onAddColorSetter(setter);
      }
    }
  }

  onAddSingleSetter(setter: string) {
    let property = setter.replace("set", "");
    property = property.charAt(0).toLowerCase() + property.slice(1);
    const defaultVal = (captionProgramDefaults as any)[property];
    this.onAddString(setter + " " + defaultVal, true);
  }

  onAddTupleSetter(setter: string) {
    let property = setter.replace("set", "");
    property = property.charAt(0).toLowerCase() + property.slice(1);
    const defaultVal = (captionProgramDefaults as any)[property];
    this.onAddString(setter + " " + defaultVal[0] + " " + defaultVal[1], true);
  }

  onAddStringSetter(setter: string) {
    this.onAddString(setter + " constant", true);
  }

  onAddBooleanSetter(setter: string) {
    this.onAddString(setter + " false", true);
  }

  onAddColorSetter(setter: string) {
    this.onAddString(setter + " 0 #FFFFFF", true);
  }

  onAddString(string: string, newLine = false) {
    this.state.codeMirrorAddHack.args = [string, newLine];
    this.state.codeMirrorAddHack.fire();
  }

  onUpdateOptions(property: string, fn: (options: FontSettingsI) => void) {
    const script = deepClone(this.state.captionScript);
    const newOptions = deepClone((script as any)[property]);
    fn(newOptions);
    (script as any)[property] = newOptions;
    if (this.state.scene) {
      const newScene = deepClone(this.state.scene);
      newScene.scriptPlaylists = [{scripts: [script], shuffle: false, repeat: RP.one}];
      this.setState({scene: newScene, captionScript: script, error: null, scriptChanged: true});
    } else {
      this.setState({captionScript: script, error: null, scriptChanged: true});
    }
  }

  onSliderChange(key: string, e: MouseEvent, value: number) {
    const script = deepClone(this.state.captionScript);
    (script as any)[key] = value;
    if (this.state.scene) {
      const newScene = deepClone(this.state.scene);
      newScene.scriptPlaylists = [{scripts: [script], shuffle: false, repeat: RP.one}];
      this.setState({scene: newScene, captionScript: script, error: null, scriptChanged: true});
    } else {
      this.setState({captionScript: script});
    }
  }

  openLink(url: string) {
    remote.shell.openExternal(url);
  }
}

(CaptionScriptor as any).displayName="CaptionScriptor";
export default CaptionScriptor;
