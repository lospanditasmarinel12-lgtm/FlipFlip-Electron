import * as React from "react";
import clsx from "clsx";

import {
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import {EA, SDT, STF, TF} from "../../data/const";
import {SceneSettings} from "../../data/Config";
import en from "../../data/en";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

const FullWidthCollapse = styled(Collapse)({
  width: '100%',
});

class SlideCard extends React.Component {
  readonly props: {
    scene: Scene | SceneSettings,
    easingControls: boolean,
    sidebar?: boolean,
    tutorial?: string,
    onUpdateScene(scene: Scene | SceneSettings, fn: (scene: Scene | SceneSettings) => void): void,
  };

  readonly sinInputRef: React.RefObject<HTMLInputElement> = React.createRef();

  render() {
    const slideSinRate = typeof this.props.scene.slideSinRate === 'number' ? this.props.scene.slideSinRate : 0;
    const slideBPMMulti = typeof this.props.scene.slideBPMMulti === 'number' ? this.props.scene.slideBPMMulti : 0;
    const slideDistance = typeof this.props.scene.slideDistance === 'number' ? this.props.scene.slideDistance : 0;
    const slideDuration = typeof this.props.scene.slideDuration === 'number' ? this.props.scene.slideDuration : 0;
    const slideDurationMin = typeof this.props.scene.slideDurationMin === 'number' ? this.props.scene.slideDurationMin : 0;
    const slideDurationMax = typeof this.props.scene.slideDurationMax === 'number' ? this.props.scene.slideDurationMax : 0;

    const playlists = (this.props.scene.audioPlaylists as {audios: Audio[], shuffle: boolean, repeat: string}[]);
    const hasBPM = !!playlists && playlists.length && playlists[0].audios.length && playlists[0].audios[0].bpm;
    return (
      <Grid container spacing={this.props.scene.slide ? 2 : 0} alignItems="center" sx={this.props.tutorial != null ? { pointerEvents: 'none' } : undefined}>
        <Grid item xs={12}>
          <FormControlLabel
            sx={this.props.tutorial == SDT.fade1 ? { borderWidth: 2, borderColor: 'secondary.main', borderStyle: 'solid' } : undefined}
            control={
              <Switch checked={this.props.scene.slide}
                      onChange={this.onBoolInput.bind(this, 'slide')}/>
            }
            label="Slide"/>
        </Grid>
        <Grid item xs={12}>
          <FullWidthCollapse in={this.props.scene.slide}>
            <Divider />
          </FullWidthCollapse>
        </Grid>
        <Grid item xs={12}>
          <FullWidthCollapse in={this.props.scene.slide}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 4} style={{paddingTop: 10}}>
                <FormControl variant="standard" sx={{ width: '100%' }}>
                  <InputLabel>Direction</InputLabel>
                  <Select
                    variant="standard"
                    value={this.props.scene.slideType}
                    onChange={this.onInput.bind(this, 'slideType')}>
                    {Object.values(STF).map((tf) =>
                      <MenuItem key={tf} value={tf}>{en.get(tf)}</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 8}>
                <Typography variant="caption" component="div" color="textSecondary">
                  Distance: {slideDistance}%
                </Typography>
                <Slider
                  min={1}
                  defaultValue={slideDistance}
                  onChangeCommitted={this.onSliderChange.bind(this, 'slideDistance')}
                  valueLabelDisplay={'auto'}
                  valueLabelFormat={(v) => v + '%'}
                  aria-labelledby="slide-distance-slider"/>
              </Grid>
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 4}>
                <FormControl variant="standard" sx={{ width: '100%' }}>
                  <InputLabel>Timing</InputLabel>
                  <Select
                    variant="standard"
                    value={this.props.scene.slideTF}
                    onChange={this.onInput.bind(this, 'slideTF')}>
                    {Object.values(TF).map((tf) => {
                      if (tf == TF.bpm) {
                        return <MenuItem key={tf} value={tf}>
                          {en.get(tf)} {!hasBPM && <Tooltip disableInteractive title={"Missing audio with BPM"}><ErrorOutlineIcon color={'error'} /></Tooltip>}
                        </MenuItem>
                      } else {
                        return <MenuItem key={tf} value={tf}>{en.get(tf)}</MenuItem>
                      }
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 8}>
                <FullWidthCollapse in={this.props.scene.slideTF == TF.sin}>
                  <Typography variant="caption" component="div" color="textSecondary">
                    Wave Rate
                  </Typography>
                  <Grid container alignItems="center">
                    <Grid item xs>
                      <Slider
                        ref={this.sinInputRef}
                        min={1}
                        defaultValue={slideSinRate}
                        onChangeCommitted={this.onSliderChange.bind(this, 'slideSinRate')}
                        valueLabelDisplay={'auto'}
                        aria-labelledby="slide-sin-rate-slider"/>
                    </Grid>
                    <Grid item xs={3} sx={{ minWidth: (theme) => theme.spacing(11) }}>
                      <TextField
                        variant="standard"
                        value={slideSinRate}
                        onChange={this.onIntInput.bind(this, 'slideSinRate')}
                        onBlur={this.blurIntKey.bind(this, 'slideSinRate')}
                        inputProps={{
                          sx: { pl: 1, pt: 0 },
                          step: 5,
                          min: 0,
                          max: 100,
                          type: 'number',
                          'aria-labelledby': 'slide-sin-rate-slider',
                        }} />
                    </Grid>
                  </Grid>
                </FullWidthCollapse>
                <FullWidthCollapse in={this.props.scene.slideTF == TF.bpm}>
                  <Typography variant="caption" component="div" color="textSecondary">
                    BPM Multiplier {this.props.scene.slideBPMMulti / 10}x
                  </Typography>
                  <Slider
                    min={1}
                    max={100}
                    defaultValue={slideBPMMulti}
                    onChangeCommitted={this.onSliderChange.bind(this, 'slideBPMMulti')}
                    valueLabelDisplay={'auto'}
                    valueLabelFormat={(v) => (v / 10) + "x"}
                    aria-labelledby="slide-bpm-multi-slider"/>
                </FullWidthCollapse>
                <FullWidthCollapse in={this.props.scene.slideTF == TF.constant}>
                  <TextField
                    variant="outlined"
                    label="For"
                    margin="dense"
                    value={slideDuration}
                    onChange={this.onIntInput.bind(this, 'slideDuration')}
                    onBlur={this.blurIntKey.bind(this, 'slideDuration')}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                    }}
                    inputProps={{
                      step: 100,
                      min: 0,
                      type: 'number',
                    }}/>
                </FullWidthCollapse>
              </Grid>
            </Grid>
          </FullWidthCollapse>
        </Grid>
        <Grid item xs={12}>
          <FullWidthCollapse in={this.props.scene.slide && (this.props.scene.slideTF == TF.random || this.props.scene.slideTF == TF.sin)}>
            <Grid container alignItems="center">
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                <TextField
                  variant="outlined"
                  label="Between"
                  margin="dense"
                  value={slideDurationMin}
                  onChange={this.onIntInput.bind(this, 'slideDurationMin')}
                  onBlur={this.blurIntKey.bind(this, 'slideDurationMin')}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                  }}
                  inputProps={{
                    step: 100,
                    min: 0,
                    type: 'number',
                  }}/>
              </Grid>
              <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                <TextField
                  variant="outlined"
                  label="and"
                  margin="dense"
                  value={slideDurationMax}
                  onChange={this.onIntInput.bind(this, 'slideDurationMax')}
                  onBlur={this.blurIntKey.bind(this, 'slideDurationMax')}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                  }}
                  inputProps={{
                    step: 100,
                    min: 0,
                    type: 'number',
                  }}/>
              </Grid>
            </Grid>
          </FullWidthCollapse>
        </Grid>
        {this.props.easingControls && (
          <React.Fragment>
            <Grid item xs={12}>
              <FullWidthCollapse in={this.props.scene.slide}>
                <Divider />
              </FullWidthCollapse>
            </Grid>
            <Grid item xs={12}>
              <FullWidthCollapse in={this.props.scene.slide}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                    <FormControl variant="standard" sx={{ width: '100%' }}>
                      <InputLabel>Easing</InputLabel>
                      <Select
                        variant="standard"
                        value={this.props.scene.slideEase}
                        onChange={this.onInput.bind(this, 'slideEase')}>
                        {Object.values(EA).map((rf) =>
                          <MenuItem key={rf} value={rf}>{en.get(rf)}</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                    <FullWidthCollapse in={this.props.scene.slideEase == EA.polyIn || this.props.scene.slideEase == EA.polyOut || this.props.scene.slideEase == EA.polyInOut}>
                      <Typography variant="caption" component="div" color="textSecondary">
                        Exponent: {this.props.scene.slideExp / 2}
                      </Typography>
                      <Slider
                        min={1}
                        max={10}
                        defaultValue={this.props.scene.slideExp}
                        onChangeCommitted={this.onSliderChange.bind(this, 'slideExp')}
                        valueLabelDisplay={'auto'}
                        valueLabelFormat={(v) => v/2}
                        aria-labelledby="exp-slider"/>
                    </FullWidthCollapse>
                    <FullWidthCollapse in={this.props.scene.slideEase == EA.backIn || this.props.scene.slideEase == EA.backOut || this.props.scene.slideEase == EA.backInOut}>
                      <Typography variant="caption" component="div" color="textSecondary">
                        Overshoot: {this.props.scene.slideOv / 2}
                      </Typography>
                      <Slider
                        min={1}
                        max={10}
                        defaultValue={this.props.scene.slideOv}
                        onChangeCommitted={this.onSliderChange.bind(this, 'slideOv')}
                        valueLabelDisplay={'auto'}
                        valueLabelFormat={(v) => v/2}
                        aria-labelledby="ov-slider"/>
                    </FullWidthCollapse>
                  </Grid>
                  <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                    <FullWidthCollapse in={this.props.scene.slideEase == EA.elasticIn || this.props.scene.slideEase == EA.elasticOut || this.props.scene.slideEase == EA.elasticInOut}>
                      <Typography variant="caption" component="div" color="textSecondary">
                        Amplitude: {this.props.scene.slideAmp / 20}
                      </Typography>
                      <Slider
                        min={1}
                        max={40}
                        defaultValue={this.props.scene.slideAmp}
                        onChangeCommitted={this.onSliderChange.bind(this, 'slideAmp')}
                        valueLabelDisplay={'auto'}
                        valueLabelFormat={(v) => v/20}
                        aria-labelledby="amp-slider"/>
                    </FullWidthCollapse>
                  </Grid>
                  <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                    <FullWidthCollapse in={this.props.scene.slideEase == EA.elasticIn || this.props.scene.slideEase == EA.elasticOut || this.props.scene.slideEase == EA.elasticInOut}>
                      <Typography variant="caption" component="div" color="textSecondary">
                        Period: {this.props.scene.slidePer / 20}
                      </Typography>
                      <Slider
                        min={1}
                        max={20}
                        defaultValue={this.props.scene.slidePer}
                        onChangeCommitted={this.onSliderChange.bind(this, 'slidePer')}
                        valueLabelDisplay={'auto'}
                        valueLabelFormat={(v) => v/20}
                        aria-labelledby="per-slider"/>
                    </FullWidthCollapse>
                  </Grid>
                </Grid>
              </FullWidthCollapse>
            </Grid>
          </React.Fragment>
        )}
      </Grid>
    );
  }

  blurIntKey(key: string, e: MouseEvent) {
    const min = (e.currentTarget as any).min ? (e.currentTarget as any).min : null;
    const max = (e.currentTarget as any).max ? (e.currentTarget as any).max : null;
    let value = (e.currentTarget as any).value;
    if (min && (this.props.scene as any)[key] < min) {
      value = min;
      this.changeIntKey(key, min);
    } else if (max && (this.props.scene as any)[key] > max) {
      value = max;
      this.changeIntKey(key, max);
    }

    if (key == 'slideSinRate') {
      (this.sinInputRef.current.children.item(1) as any).style.width = value + '%';
      (this.sinInputRef.current.children.item(3) as any).style.left = value + '%';
      this.sinInputRef.current.children.item(3).children.item(0).children.item(0).children.item(0).innerHTML = value;
    }
  }

  onSliderChange(key: string, e: MouseEvent, value: number) {
    this.changeKey(key, value);
  }

  onBoolInput(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    const checked = input.checked;
    this.changeKey(key, checked);
  }

  onIntInput(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.changeKey(key, input.value === '' ? '' : Number(input.value));
  }

  onInput(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.changeKey(key, input.value);
  }

  update(fn: (scene: any) => void) {
    this.props.onUpdateScene(this.props.scene, fn);
  }

  changeIntKey(key:string, intString: string) {
    this.changeKey(key, intString === '' ? '' : Number(intString));
  }

  changeKey(key: string, value: any) {
    this.update((s) => s[key] = value);
  }
}

(SlideCard as any).displayName="SlideCard";
export default SlideCard;
