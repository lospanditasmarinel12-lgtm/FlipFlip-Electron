import * as React from "react";

import {Grid, InputAdornment, TextField, Tooltip, Typography, Switch, FormControlLabel, Chip, Slider, Box} from "@mui/material";

import {DisplaySettings} from "../../data/Config";
import LibrarySearch from "../library/LibrarySearch";
import LibrarySource from "../../data/LibrarySource";
import Tag from "../../data/Tag";

class PlayerNumCard extends React.Component {
  readonly props: {
    library: Array<LibrarySource>,
    tags: Array<Tag>,
    settings: DisplaySettings,
    onUpdateSettings(fn: (settings: DisplaySettings) => void): void,
  };

  render() {
    return (
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={this.props.settings.autoConfigEnabled}
                onChange={this.onToggleAuto.bind(this)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Auto-Configure
                <Chip label="Recommended" size="small" color="primary" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>
            Automatically adjust memory limits based on your system capabilities
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive title="Images under this size (width or height) will be skipped">
            <TextField
              variant="standard"
              label="Min Image Size"
              margin="dense"
              value={this.props.settings.minImageSize}
              onChange={this.onIntInput.bind(this, 'minImageSize')}
              onBlur={this.blurIntKey.bind(this, 'minImageSize')}
              InputProps={{
                endAdornment: <InputAdornment position="end">px</InputAdornment>,
              }}
              inputProps={{
                min: 0,
                type: 'number',
              }} />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive title="Videos under this size (width or height) will be skipped">
            <TextField
              variant="standard"
              label="Min Video Size"
              margin="dense"
              value={this.props.settings.minVideoSize}
              onChange={this.onIntInput.bind(this, 'minVideoSize')}
              onBlur={this.blurIntKey.bind(this, 'minVideoSize')}
              InputProps={{
                endAdornment: <InputAdornment position="end">px</InputAdornment>,
              }}
              inputProps={{
                min: 0,
                type: 'number',
              }} />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive title={this.props.settings.autoConfigEnabled ? "Auto-configured based on your system capabilities" : "The maximum number of images/videos to keep in player history. Reduce this number to reduce memory usage and improve performance."}>
            <TextField
              variant="standard"
              label="Max in History"
              margin="dense"
              value={this.props.settings.maxInHistory}
              onChange={this.onIntInput.bind(this, 'maxInHistory')}
              onBlur={this.blurIntKey.bind(this, 'maxInHistory')}
              disabled={this.props.settings.autoConfigEnabled}
              InputProps={this.props.settings.autoConfigEnabled ? {
                endAdornment: <InputAdornment position="end"><Chip label="AUTO" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }}/></InputAdornment>,
              } : undefined}
              inputProps={{
                min: 0,
                type: 'number',
              }} />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive title={this.props.settings.autoConfigEnabled ? "Auto-configured based on your system capabilities" : "The maximum number of images/videos to queue up for rendering. Reduce this number to reduce memory usage and improve performance."}>
            <TextField
              variant="standard"
              label="Max in Memory"
              margin="dense"
              value={this.props.settings.maxInMemory}
              onChange={this.onIntInput.bind(this, 'maxInMemory')}
              onBlur={this.blurIntKey.bind(this, 'maxInMemory')}
              disabled={this.props.settings.autoConfigEnabled}
              InputProps={this.props.settings.autoConfigEnabled ? {
                endAdornment: <InputAdornment position="end"><Chip label="AUTO" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }}/></InputAdornment>,
              } : undefined}
              inputProps={{
                min: 0,
                type: 'number',
              }} />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive title={this.props.settings.autoConfigEnabled ? "Auto-configured based on your system capabilities" : "The maximum number of simultaneous images/videos loading. Increase this number to load sources faster. Reduce this number to improve display performance."}>
            <TextField
              variant="standard"
              label="Max Loading at Once"
              margin="dense"
              value={this.props.settings.maxLoadingAtOnce}
              onChange={this.onIntInput.bind(this, 'maxLoadingAtOnce')}
              onBlur={this.blurIntKey.bind(this, 'maxLoadingAtOnce')}
              disabled={this.props.settings.autoConfigEnabled}
              InputProps={this.props.settings.autoConfigEnabled ? {
                endAdornment: <InputAdornment position="end"><Chip label="AUTO" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }}/></InputAdornment>,
              } : undefined}
              inputProps={{
                min: 0,
                type: 'number',
              }} />
           </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Box sx={{ mt: 1.5 }}>
          <Tooltip disableInteractive title={this.props.settings.autoConfigEnabled ? "Auto-configured based on your system capabilities" : "The maximum number of decoded images/videos kept in memory simultaneously. Lower values reduce RAM usage aggressively; higher values reduce reloads but use more memory."}>
            <Typography variant="body2" color="text.secondary">
              Max Decoded Images
              {this.props.settings.autoConfigEnabled && <Chip label="AUTO" size="small" color="primary" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />}
            </Typography>
          </Tooltip>
          <Slider
            value={this.props.settings.maxDecodedImages}
            onChange={this.onIntInput.bind(this, 'maxDecodedImages')}
            onChangeCommitted={this.blurIntKey.bind(this, 'maxDecodedImages')}
            min={1}
            max={50}
            step={1}
            disabled={this.props.settings.autoConfigEnabled}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            marks={[
              { value: 1, label: '1' },
              { value: 12, label: '12 (default)' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
            ]}
            sx={{ mt: 0.5 }}
          />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Tooltip disableInteractive placement={"top"} title="The following tags/types will be ignored when using a Scene Generator. This setting overrides any generator rules.">
            <div>
              <LibrarySearch
                displaySources={this.props.library}
                filters={this.props.settings.ignoredTags}
                tags={this.props.tags}
                placeholder=""
                isClearable
                onlyTagsAndTypes
                showCheckboxes
                withBrackets
                hideSelectedOptions={false}
                onUpdateFilters={this.onSelectTags.bind(this)}/>
            </div>
          </Tooltip>
        </Grid>
      </Grid>
    );
  }

  onToggleAuto(e: React.ChangeEvent, checked: boolean) {
    this.changeKey('autoConfigEnabled', checked);
  }

  onSelectTags(selectedTags: Array<string>) {
    this.changeKey('ignoredTags', selectedTags);
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

  changeKey(key: string, value: any) {
    this.update((s) => s[key] = value);
  }

  update(fn: (settings: any) => void) {
    this.props.onUpdateSettings(fn);
  }
}

(PlayerNumCard as any).displayName="PlayerNumCard";
export default PlayerNumCard;
