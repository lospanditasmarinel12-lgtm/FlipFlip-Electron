import * as React from "react";
import {green, red} from "@mui/material/colors";

import {
  AppBar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Collapse,
  Container,
  Drawer,
  Fab,
  Grid,
  IconButton,
  Slider,
  SvgIcon,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { styled, Theme } from "@mui/material/styles";

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SaveIcon from '@mui/icons-material/Save';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

import {getTimestamp, getTimestampValue} from "../../data/utils";
import {BT, VCT} from "../../data/const";
import LibrarySource from "../../data/LibrarySource";
import Tag from "../../data/Tag";
import Clip from "../../data/Clip";
import Scene from "../../data/Scene";
import ImageView from "../player/ImageView";
import VideoControl from "../player/VideoControl";

class VideoClipper extends React.Component {
  readonly props: {
    allTags: Array<Tag>,
    isLibrary: boolean,
    source: LibrarySource,
    tutorial: string,
    videoVolume: number,
    cache(video: HTMLVideoElement): void,
    goBack(): void,
    navigateClipping(offset: number): void,
    onTutorial(tutorial: string): void,
    onStartVCTutorial(): void,
    onSetDisabledClips(disabledClips: Array<number>): void,
    onUpdateClips(url: string, clips: Array<Clip>): void,
  };

  readonly state = {
    scene: new Scene(),
    video: null as HTMLVideoElement,
    empty: false,
    isEditing: null as Clip,
    isEditingValue: [0,0],
    isEditingStartText: "",
    isEditingEndText: "",
    isTagging: false,
  };

  render() {
    let tagNames: Array<string> = [];
    if (!!this.state.isEditing && this.state.isEditing.tags) {
      tagNames = this.state.isEditing.tags.map((t) => t.name);
    }

    return (
      <Box className="VideoClipper" sx={{ display: 'flex' }}>
        <AppBar sx={{ height: (theme) => theme.spacing(8) }}>
          <Toolbar sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexWrap: 'nowrap', minHeight: 64, height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
            <Box sx={{ flexBasis: '3%' }}>
              <Tooltip disableInteractive title="Back" placement="right-end">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  onClick={this.props.goBack.bind(this)}
                  size="large">
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography component="h1" variant="h4" color="inherit" noWrap sx={{ textAlign: 'center', flexGrow: 1 }}>
              {this.props.source.url}
            </Typography>

            <Box sx={{ flexBasis: '3%' }}/>
          </Toolbar>
        </AppBar>

        {!this.state.video && !this.state.empty && (
          <Box component="main" sx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', height: '100vh', backgroundColor: (theme) => theme.palette.background.default }}>
            <Box sx={{ height: (theme) => theme.spacing(8) }}/>
            <Container maxWidth={false} sx={[{ flexGrow: 1, padding: 0, position: 'relative' }, { alignItems: 'center', justifyContent: 'center', display: 'flex' }]}>
              <CircularProgress size={200} />
            </Container>
          </Box>
        )}

        {!this.state.video && this.state.empty && (
          <Box component="main" sx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', height: '100vh', backgroundColor: (theme) => theme.palette.background.default }}>
            <Box sx={{ height: (theme) => theme.spacing(8) }}/>
            <Container maxWidth={false} sx={{ flexGrow: 1, padding: 0, position: 'relative' }}>
              <Typography component="h1" variant="h3" color="inherit" noWrap sx={{ textAlign: 'center', marginTop: '25%' }}>
                (ಥ﹏ಥ)
              </Typography>
              <Typography component="h1" variant="h4" color="inherit" noWrap sx={{ textAlign: 'center' }}>
                I couldn't find anything
              </Typography>
            </Container>
          </Box>
        )}

        {this.state.video && (
          <React.Fragment>
            <Box component="main" sx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', height: '100vh', backgroundColor: 'black' }}>
              <Box sx={{ height: (theme) => theme.spacing(8) }}/>
              <Container maxWidth={false} sx={{ flexGrow: 1, padding: 0, position: 'relative' }}>
                {this.state.isTagging && (
                  <ImageView
                    image={this.state.video}
                    scene={this.state.scene}
                    fitParent
                    hasStarted/>
                )}
                {!this.state.isTagging && (
                  <ImageView
                    image={this.state.video}
                    scene={this.state.scene}
                    fitParent
                    hasStarted/>
                )}
              </Container>
              {!this.state.isTagging && (
                <Box sx={{ height: (theme) => theme.spacing(21) }}/>
              )}
              {this.state.isTagging && (
                <Grid container alignItems="center" sx={{ backgroundColor: (theme) => theme.palette.background.default, padding: (theme) => theme.spacing(1), justifyContent: 'flex-end' }}>
                  <Grid item xs>
                    <Box sx={{ padding: (theme) => theme.spacing(1), display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {this.props.allTags.map((tag) =>
                        <Card sx={[{ marginRight: (theme) => theme.spacing(1), marginBottom: (theme) => theme.spacing(1) }, tagNames && tagNames.includes(tag.name) && { backgroundColor: (theme) => theme.palette.primary.light, color: (theme) => theme.palette.primary.contrastText }]} key={tag.id}>
                          <CardActionArea onClick={this.toggleTag.bind(this, tag)}>
                            <CardContent sx={{ padding: (theme) => theme.spacing(1) }}>
                              <Typography component="h6" variant="body2">
                                {tag.name}
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      )}
                    </Box>
                  </Grid>
                  <Grid item sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Tooltip disableInteractive title="Inherit Source Tags">
                      <Fab
                        color="primary"
                        size="small"
                        onClick={this.onInherit.bind(this)}>
                        <SystemUpdateAltIcon/>
                      </Fab>
                    </Tooltip>
                    <Tooltip disableInteractive title="End Tagging" placement="top">
                      <IconButton onClick={this.onTag.bind(this)} size="large">
                        <KeyboardReturnIcon/>
                      </IconButton>
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} sx={[this.props.tutorial == VCT.controls && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}>
                    <VideoControl
                      video={this.state.video}
                      volume={this.state.scene.videoVolume}
                      clip={!this.state.isEditing ? null : this.state.isEditing}
                      clipValue={!this.state.isEditing ? null : this.state.isEditingValue}
                      useHotkeys
                      onChangeVolume={this.onChangeVolume.bind(this)}/>
                  </Grid>
                </Grid>
              )}
            </Box>

            {!this.state.isTagging && (
              <Drawer
                variant="permanent"
                anchor="bottom"
                sx={[(this.props.tutorial == VCT.controls || this.props.tutorial == VCT.clips || this.props.tutorial == VCT.clip) && { zIndex: (theme) => theme.zIndex.modal + 1 }]}
                slotProps={{ paper: { sx: { backgroundColor: (theme) => theme.palette.background.default, height: (theme) => theme.spacing(21), padding: (theme) => theme.spacing(1), justifyContent: 'flex-end' } } }}
                open>
                <Grid container alignItems="center">
                  <Grid item xs={12}>
                    <Collapse in={!this.state.isEditing}>
                      <Grid container spacing={1} alignItems="center" sx={[this.props.tutorial == VCT.controls && { pointerEvents: 'none' }, this.props.tutorial == VCT.clips && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}>
                        <Grid key={-1} item>
                          <Tooltip disableInteractive title="New Clip" placement="top">
                            <Fab
                              color="primary"
                              size="small"
                              sx={[{ boxShadow: 'none' }, { marginLeft: (theme) => theme.spacing(1) }, this.props.tutorial == VCT.clips && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}
                              onClick={this.onAdd.bind(this)}>
                              <AddIcon/>
                            </Fab>
                          </Tooltip>
                        </Grid>
                        {this.props.source.clips.map((c, index) =>
                          <Grid key={c.id} item>
                            <Button
                              variant="contained"
                              color="secondary"
                              size="large"
                              sx={[this.props.tutorial == VCT.clips && { pointerEvents: 'none' }]}
                              onClick={this.onEdit.bind(this, c)}>
                              {index + 1}
                            </Button>
                          </Grid>
                        )}
                      </Grid>
                    </Collapse>
                    <Collapse in={!!this.state.isEditing}>
                      <Grid container spacing={1} alignItems="center" sx={[this.props.tutorial == VCT.clip && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}>
                        {!this.props.isLibrary && this.state.isEditing && this.props.source.clips.find((c) => c.id == this.state.isEditing.id) && (
                          <Grid item>
                            <Tooltip disableInteractive title={this.props.source.disabledClips && this.props.source.disabledClips.includes(this.state.isEditing.id) ? "Disabled" : "Enabled"} placement="top">
                              <Fab
                                size="small"
                                sx={[{ boxShadow: 'none' }, this.props.source.disabledClips && !this.props.source.disabledClips.includes(this.state.isEditing.id) && { backgroundColor: green[500], '&:hover': { backgroundColor: green[700] } }, this.props.source.disabledClips && this.props.source.disabledClips.includes(this.state.isEditing.id) && { backgroundColor: red[500], '&:hover': { backgroundColor: red[700] } }]}
                                onClick={this.onToggleClip.bind(this)}>
                                {this.props.source.disabledClips && this.props.source.disabledClips.includes(this.state.isEditing.id) ? <CloseIcon/> : <CheckIcon/>}
                              </Fab>
                            </Tooltip>
                          </Grid>
                        )}
                        <Grid item xs sx={{ marginLeft: (theme) => theme.spacing(2), marginRight: (theme) => theme.spacing(3), marginTop: (theme) => theme.spacing(2) }}>
                          <Slider
                            min={0}
                            max={this.state.video.duration}
                            value={this.state.isEditingValue}
                            slotProps={{
                              valueLabel: { style: { backgroundColor: 'transparent', top: 2 } },
                              thumb: { sx: { transition: 'unset' } },
                              track: { sx: { transition: 'unset' } },
                            } as any}
                            valueLabelDisplay="on"
                            valueLabelFormat={(value) => getTimestamp(value)}
                            marks={[{value: 0, label: getTimestamp(0)}, {value: this.state.video.duration, label: getTimestamp(this.state.video.duration)}]}
                            onChange={this.onChangePosition.bind(this)}/>
                        </Grid>
                        <Grid item>
                          <TextField
                            variant="standard"
                            id="start"
                            sx={{ maxWidth: (theme) => theme.spacing(8) }}
                            label="Start"
                            value={this.state.isEditingStartText}
                            onDoubleClick={this.onClickStartText.bind(this)}
                            onChange={this.onChangeStartText.bind(this)} />
                        </Grid>
                        <Grid item>
                          <TextField
                            variant="standard"
                            id="end"
                            sx={{ maxWidth: (theme) => theme.spacing(8) }}
                            label="End"
                            value={this.state.isEditingEndText}
                            onDoubleClick={this.onClickEndText.bind(this)}
                            onChange={this.onChangeEndText.bind(this)} />
                        </Grid>
                        <Grid item>
                          <Tooltip disableInteractive title="Save" placement="top">
                            <Fab
                              color="primary"
                              size="small"
                              sx={[{ boxShadow: 'none' }, this.props.tutorial == VCT.clip && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}
                              onClick={this.onSave.bind(this)}>
                              <SaveIcon/>
                            </Fab>
                          </Tooltip>
                        </Grid>
                        <Grid item>
                          <Tooltip disableInteractive title="Tag Clip" placement="top">
                            <Fab
                              color="secondary"
                              size="small"
                              sx={[{ boxShadow: 'none' }, this.props.tutorial == VCT.clip && { pointerEvents: 'none' }]}
                              onClick={this.onTag.bind(this)}>
                              <LocalOfferIcon/>
                            </Fab>
                          </Tooltip>
                        </Grid>
                        <Grid item>
                          <Tooltip disableInteractive title="Set Volume" placement="top">
                            <Fab
                              color="secondary"
                              size="small"
                              sx={[{ boxShadow: 'none' }, this.props.tutorial == VCT.clip && { pointerEvents: 'none' }]}
                              onClick={this.onSetVolume.bind(this)}
                              onContextMenu={this.onClearVolume.bind(this)}>
                              <SvgIcon viewBox="0 0 24 24">
                                <path d="M3 9V15H7L12 20V4L7 9H3M16 15H14V9H16V15M20 19H18V5H20V19Z" />
                              </SvgIcon>
                            </Fab>
                          </Tooltip>
                        </Grid>
                        {this.state.isEditing && this.props.source.clips.find((c) => c.id == this.state.isEditing.id) && (
                          <Grid item>
                            <Tooltip disableInteractive title="Delete Clip" placement="top">
                              <Fab
                                size="small"
                                sx={[{ boxShadow: 'none' }, { backgroundColor: (theme) => theme.palette.error.main, color: (theme) => theme.palette.error.contrastText }, this.props.tutorial == VCT.clip && { pointerEvents: 'none' }]}
                                onClick={this.onRemove.bind(this)}>
                                <DeleteIcon color="inherit" />
                              </Fab>
                            </Tooltip>
                          </Grid>
                        )}
                        <Grid item>
                          <Tooltip disableInteractive title="Cancel" placement="top">
                            <IconButton
                              sx={[this.props.tutorial == VCT.clip && { pointerEvents: 'none' }]}
                              onClick={this.onCancel.bind(this)}
                              size="large">
                              <KeyboardReturnIcon/>
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Grid>
                  <Grid item xs={12} sx={[this.props.tutorial == VCT.controls && { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' }]}>
                    <VideoControl
                      video={this.state.video}
                      volume={this.state.scene.videoVolume}
                      clip={!this.state.isEditing ? null : this.state.isEditing}
                      clipValue={!this.state.isEditing ? null : this.state.isEditingValue}
                      clips={this.props.source.clips}
                      useHotkeys
                      onChangeVolume={this.onChangeVolume.bind(this)}/>
                  </Grid>
                </Grid>
              </Drawer>
            )}
          </React.Fragment>
        )}
      </Box>
    );
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('wheel', this.onScroll, false);

    const scene = this.state.scene;
    scene.backgroundType = BT.color;
    scene.backgroundColor = "#010101";
    scene.videoVolume = this.props.videoVolume;
    this.setState({scene: scene});
    this.initVideo();
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('wheel', this.onScroll);
  }

  componentDidUpdate(props: any) {
    if (this.props.source.url !== props.source.url) {
      this.setState({
        video: null as HTMLVideoElement,
        empty: false,
        isEditing: null,
        isEditingValue: [0,0],
        isEditingStartText: "",
        isEditingEndText: "",
      });
      this.initVideo();
    }
  }

  initVideo() {
    let video = document.createElement('video');

    video.onerror = () => {
      console.error("Error loading " + this.props.source.url);
      this.setState({empty: true});
    };

    video.onloadeddata = () => {
      this.props.cache(video);
      this.setState({video: video});
      this.props.onStartVCTutorial();
    };

    video.src = this.props.source.url;
    video.preload = "auto";
    video.loop = true;
    if (this.props.source.subtitleFile != null && this.props.source.subtitleFile.length > 0) {
      video.setAttribute("subtitles", this.props.source.subtitleFile);
    }
    video.load();
  }

  onAdd() {
    if (this.props.tutorial == VCT.clips) {
      this.props.onTutorial(VCT.clips);
    }
    const source = this.props.source;
    const newClip = new Clip();
    let id = source.clips.length + 1;
    source.clips.forEach((c) => {
      id = Math.max(c.id + 1, id);
    });
    newClip.id = id;
    newClip.start = this.state.isEditingValue[0];
    newClip.end = this.state.isEditingValue[1];
    newClip.tags = source.tags.concat();
    this.setState({
      isEditing: newClip,
      isEditingValue: [0, this.state.video.duration],
      isEditingStartText: getTimestamp(0),
      isEditingEndText: getTimestamp(this.state.video.duration),
    });
  }

  onEdit(clip: Clip) {
    if (clip.volume != null) {
      this.onChangeVolume(clip.volume);
    }
    this.setState({
      isEditing: clip,
      isEditingValue: [clip.start, clip.end],
      isEditingStartText: getTimestamp(clip.start),
      isEditingEndText: getTimestamp(clip.end),
    });
  }

  onCancel() {
    this.closeEdit();
  }

  onSave(close: boolean = true) {
    if (this.props.tutorial == VCT.clip) {
      this.props.onTutorial(VCT.clip);
    }
    const source = this.props.source;
    let clip = source.clips.find((c) => c.id == this.state.isEditing.id);
    if (clip) {
      clip.start = this.state.isEditingValue[0];
      clip.end = this.state.isEditingValue[1];
    } else {
      this.state.isEditing.start = this.state.isEditingValue[0];
      this.state.isEditing.end = this.state.isEditingValue[1];
      source.clips = source.clips.concat([this.state.isEditing]);
    }
    this.props.onUpdateClips(source.url, source.clips);
    if (close) {
      this.closeEdit();
    }
  }

  onToggleClip() {
    this.props.onSetDisabledClips(this.props.source.disabledClips ? this.props.source.disabledClips.concat(this.state.isEditing.id) : [this.state.isEditing.id]);
  }

  onTag() {
    this.setState({isTagging: !this.state.isTagging});
  }

  onClearVolume() {
    const source = this.props.source;
    let fn = (c: Clip): Clip => {c.volume = null; return c;};
    this.setState({isEditing: fn(this.state.isEditing)});
    let clip = source.clips.find((c) => c.id === this.state.isEditing.id);
    if (clip) {
      clip.volume = null;
      this.props.onUpdateClips(source.url, source.clips);
    }
  }

  onSetVolume() {
    const source = this.props.source;
    let fn = (c: Clip): Clip => {c.volume = parseInt(this.state.scene.videoVolume as any); return c;};
    this.setState({isEditing: fn(this.state.isEditing)});
    let clip = source.clips.find((c) => c.id === this.state.isEditing.id);
    if (clip) {
      clip.volume = this.state.scene.videoVolume;
      this.props.onUpdateClips(source.url, source.clips);
    }
  }

  onInherit() {
    const source = this.props.source;
    let fn = (c: Clip): Clip => {c.tags = source.tags; return c;};
    this.setState({isEditing: fn(this.state.isEditing)});
    let clip = source.clips.find((c) => c.id === this.state.isEditing.id);
    if (clip) {
      clip.tags = source.tags.concat();
      this.props.onUpdateClips(source.url, source.clips);
    }
  }

  toggleTag(tag: Tag) {
    const source = this.props.source;
    let clip = source.clips.find((c) => c.id === this.state.isEditing.id);
    if (clip) {
      if (clip.tags.find((t) => t.name === tag.name)) {
        clip.tags = clip.tags.filter((t) => t.name !== tag.name);
      } else {
        clip.tags = clip.tags.concat([tag]);
      }
      this.props.onUpdateClips(source.url, source.clips);
    } else {
      const isEditing = this.state.isEditing;
      if (isEditing.tags.find((t) => t.name === tag.name)) {
        isEditing.tags = isEditing.tags.filter((t) => t.name !== tag.name);
      } else {
        isEditing.tags = isEditing.tags.concat([tag]);
      }
      this.setState({isEditing: isEditing});
    }
  }

  onRemove() {
    const source =  this.props.source;
    const clip = source.clips.find((c) => c.id === this.state.isEditing.id);
    if (clip) {
      source.clips = source.clips.filter((c) => c.id !== this.state.isEditing.id);
      this.props.onUpdateClips(source.url, source.clips);
      this.props.onSetDisabledClips(this.props.source.disabledClips ? this.props.source.disabledClips.filter((n) => n != this.state.isEditing.id) : []);
    }
    this.closeEdit();
  }

  closeEdit() {
    this.setState({
      isEditing: null,
      isEditingValue: [0, 0],
      isEditingStartText: "",
      isEditingEndText: "",
    });
  }

  onChangeVolume(volume: number) {
    const scene = this.state.scene;
    scene.videoVolume = volume;
    this.setState({scene: scene});
    if (this.state.video) {
      this.state.video.volume = volume / 100;
    }
  }

  onChangePosition(e: MouseEvent, values: Array<number>, forceStart = false, forceEnd = false) {
    let min = values[0];
    let max = values[1];
    if (min < 0) min = 0;
    if (max < 0) max = 0;
    if (min > this.state.video.duration) min = this.state.video.duration;
    if (max > this.state.video.duration) max = this.state.video.duration;

    if (this.state.video.paused) {
      if (forceStart || values[0] != this.state.isEditingValue[0]) {
        this.state.video.currentTime = min;
      } else if (forceEnd || values[1] != this.state.isEditingValue[1]) {
        this.state.video.currentTime = max;
      }
    } else {
      if (this.state.video.currentTime < min) {
        this.state.video.currentTime = min;
      } else if (this.state.video.currentTime > max) {
        this.state.video.currentTime = max;
      }
    }

    this.setState({
      isEditingValue: [min, max],
      isEditingStartText: getTimestamp(min),
      isEditingEndText: getTimestamp(max),
    });
  }

  onChangeStartText(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({isEditingStartText: input.value});
    let timestampValue = getTimestampValue(input.value);
    this.onChangeStartTextValue(timestampValue);
  }

  onChangeStartTextValue(timestampValue: number, force = false) {
    if (timestampValue != null) {
      this.onChangePosition(null, [timestampValue, this.state.isEditingValue[1]], force, false);
    }
  }

  onClickStartText() {
    this.setState({isEditingStartText: getTimestamp(this.state.video.currentTime)});
    this.onChangePosition(null, [this.state.video.currentTime, this.state.isEditingValue[1]]);
  }

  onChangeEndText(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({isEditingEndText: input.value});
    let timestampValue = getTimestampValue(input.value);
    this.onChangeStartTextValue(timestampValue);
  }

  onChangeEndTextValue(timestampValue: number, force = false) {
    if (timestampValue != null) {
      this.onChangePosition(null, [this.state.isEditingValue[0], timestampValue], false, force);
    }
  }

  onClickEndText() {
    this.setState({isEditingEndText: getTimestamp(this.state.video.currentTime)});
    this.onChangePosition(null, [this.state.isEditingValue[0], this.state.video.currentTime]);
  }

  onScroll = (e: WheelEvent) => {
    const volumeChange = (e.deltaY / 100) * -5;
    let newVolume = this.state.scene.videoVolume + volumeChange;
    if (newVolume < 0) {
      newVolume = 0;
    } else if (newVolume > 100) {
      newVolume = 100;
    }
    this.onChangeVolume(newVolume);
  }

  onKeyDown = (e: KeyboardEvent) => {
    const focus = document.activeElement.tagName.toLocaleLowerCase();
    const start = document.activeElement.id == "start";
    const end = document.activeElement.id == "end";
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (this.state.isTagging) {
          this.onTag();
        } else if (!!this.state.isEditing) {
          const clip = this.props.source.clips.find((c) => c.id == this.state.isEditing.id);
          if (clip) {
            this.onSave();
          } else {
            this.closeEdit();
          }
        } else {
          this.props.goBack();
        }
        break;
      case '[':
        e.preventDefault();
        if (this.state.isEditing) {
          this.prevClip();
        } else {
          this.prevSource();
        }
        break;
      case ']':
        e.preventDefault();
        if (this.state.isEditing) {
          this.nextClip();
        } else {
          this.nextSource();
        }
        break;
      case 'ArrowDown':
        if (focus == "input") {
          e.preventDefault();
          if (start) {
            const timestampValue = getTimestampValue(this.state.isEditingStartText);
            const startValue = timestampValue-1 >= 0 ? timestampValue-1 : 0;
            this.onChangeStartTextValue(startValue, true);
          } else if (end) {
            const timestampValue = getTimestampValue(this.state.isEditingEndText);
            const endValue = timestampValue-1 >= 0 ? timestampValue-1 : 0;
            this.onChangeEndTextValue(endValue, true);
          }
        }
        break;
      case 'ArrowUp':
        if (focus == "input") {
          e.preventDefault();
          if (start) {
            const timestampValue = getTimestampValue(this.state.isEditingStartText);
            const startValue = timestampValue+1 <= this.state.video.duration ? timestampValue+1 : Math.floor(this.state.video.duration);
            this.onChangeStartTextValue(startValue, true);
          } else if (end) {
            const timestampValue = getTimestampValue(this.state.isEditingEndText);
            const endValue = timestampValue+1 <= this.state.video.duration ? timestampValue+1 : Math.floor(this.state.video.duration);
            this.onChangeEndTextValue(endValue, true);
          }
        }
        break;
    }
  };

  prevClip() {
    this.onSave(false);
    let indexOf = this.props.source.clips.indexOf(this.state.isEditing);
    indexOf -= 1;
    if (indexOf < 0) {
      indexOf = this.props.source.clips.length - 1;
    }
    this.onEdit(this.props.source.clips[indexOf]);
  }

  nextClip() {
    this.onSave(false);
    let indexOf = this.props.source.clips.indexOf(this.state.isEditing);
    indexOf += 1;
    if (indexOf >= this.props.source.clips.length) {
      indexOf = 0
    }
    this.onEdit(this.props.source.clips[indexOf]);
  }

  prevSource() {
    this.props.navigateClipping(-1);
  }

  nextSource() {
    this.props.navigateClipping(1);
  }
}

(VideoClipper as any).displayName="VideoClipper";
export default VideoClipper;
