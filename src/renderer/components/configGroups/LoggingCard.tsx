import * as React from "react";

import {Button, ButtonGroup, FormControlLabel, Grid, Switch, Tooltip, Typography} from "@mui/material";

import {LogSettings} from "../../data/Config";
import {LOG_NAMESPACES, LOG_NAMESPACE_LABELS, setLogEnabled} from "../../data/logging";

export default class LoggingCard extends React.Component {
  readonly props: {
    logSettings: LogSettings,
    onUpdateConfig(fn: (config: any) => void): void,
  };

  render() {
    return (
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            FlipFlip prints diagnostic logging to the developer console. All
            logging is off by default to keep performance and RAM usage down.
            Turn a category on here to debug it; changes apply immediately and
            are saved with your settings.
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <ButtonGroup size="small" variant="outlined" fullWidth>
            <Button onClick={this.enableAll.bind(this)}>Enable All</Button>
            <Button onClick={this.disableAll.bind(this)}>Disable All</Button>
          </ButtonGroup>
        </Grid>
        {LOG_NAMESPACES.map((ns) => (
          <Grid item xs={12} key={ns}>
            <Tooltip disableInteractive title={LOG_NAMESPACE_LABELS[ns]}>
              <FormControlLabel
                control={
                  <Switch
                    checked={this.props.logSettings[ns] === true}
                    onChange={this.onToggle.bind(this, ns)}
                    size="small"/>
                }
                label={ns}/>
            </Tooltip>
          </Grid>
        ))}
      </Grid>
    );
  }

  onToggle(key: string, e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    const checked = input.checked;
    // Apply to the runtime console hook immediately (fast-path refresh), then
    // persist via the config store.
    setLogEnabled(key as any, checked);
    this.update((c: any) => c.logSettings[key] = checked);
  }

  enableAll() {
    this.updateAll(true);
  }

  disableAll() {
    this.updateAll(false);
  }

  update(fn: (config: any) => void) {
    this.props.onUpdateConfig(fn);
  }

  updateAll(value: boolean) {
    for (const ns of LOG_NAMESPACES) {
      setLogEnabled(ns, value);
    }
    this.props.onUpdateConfig((c: any) => {
      for (const ns of LOG_NAMESPACES) {
        c.logSettings[ns] = value;
      }
    });
  }
}

(LoggingCard as any).displayName = "LoggingCard";
