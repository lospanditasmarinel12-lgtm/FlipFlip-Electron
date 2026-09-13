import * as React from "react";
import { SketchPicker } from 'react-color';

import { Fab, Grid, IconButton, Menu, Tooltip } from "@mui/material";

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from "@mui/icons-material/Delete";

class ColorSetPicker extends React.Component {
  readonly props: {
    currentColors: Array<string>,
    sidebar?: boolean,
    onChangeColors(e: any): void,
  };

  readonly state = {
    pickerIndex: null as number,
    pickerColor: null as string,
    pickerAnchorEl: null as any,
  };

  render() {
    return (
      <Grid container>
        <Grid item sx={{ width: 64 }}>
          <Tooltip disableInteractive title="Add Color">
            <Fab
              id="add-color"
              sx={(theme) => ({
                backgroundColor: theme.palette.common.white,
                mt: 0, ml: 1, mr: 1, mb: 1,
                boxShadow: 'none',
              })}
              style={this.state.pickerIndex != null ? {backgroundColor: this.state.pickerColor} : {}}
              onClick={this.onOpenColorPicker.bind(this)}
              size="medium">
              {this.state.pickerIndex == null && (<AddIcon />)}
              {this.state.pickerIndex != null && (<div />)}
            </Fab>
          </Tooltip>
          <Menu
            id="color-picker"
            elevation={1}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            anchorEl={this.state.pickerAnchorEl}
            keepMounted
            open={!!this.state.pickerColor}
            onClose={this.onCloseColorPicker.bind(this)}>
            <SketchPicker
              color={this.state.pickerColor ? this.state.pickerColor : "#000000"}
              disableAlpha={false}
              presetColors={[]}
              onChange={this.onChangeColor.bind(this)}/>
          </Menu>
        </Grid>
        <Grid item xs>
          <Grid container alignItems="center">
            {this.props.currentColors.map((c, index) =>
              <Grid key={c + index} item>
                <Fab
                  id={"color-" + index}
                  sx={(theme) => ({
                    backgroundColor: theme.palette.common.white,
                    mr: 0.25,
                    width: theme.spacing(2),
                    height: theme.spacing(2),
                    minHeight: theme.spacing(2),
                    boxShadow: 'none',
                    ...(index == this.state.pickerIndex && { border: 'black solid 3px' }),
                  })}
                  style={{backgroundColor: c}}
                  value={c}
                  onClick={this.onOpenColorPicker.bind(this)}
                  size="small">
                  <div/>
                </Fab>
              </Grid>
            )}
          </Grid>
        </Grid>
        <Grid item>
          <Tooltip disableInteractive title="Clear Colors">
            <IconButton onClick={this.onClearColors.bind(this)} size="large">
              <DeleteIcon color="error"/>
            </IconButton>
          </Tooltip>
        </Grid>
      </Grid>
    );
  }

  onOpenColorPicker(e: MouseEvent) {
    const target  = e.currentTarget as HTMLElement;
    let color, index;
    if (target.id == "add-color") {
      index = this.props.currentColors.length;
      color = "#000000";
      this.props.onChangeColors({target: {value: this.props.currentColors.concat(color)}});
    } else {
      index = parseInt(target.id.replace("color-", ""));
      color = this.props.currentColors[index];
    }
    this.setState({pickerIndex: index, pickerColor: color, pickerAnchorEl: document.getElementById("add-color")});
  }

  onCloseColorPicker() {
    const newColors = this.props.currentColors;
    newColors[this.state.pickerIndex] = this.state.pickerColor;
    this.props.onChangeColors({target: {value: newColors}});
    this.setState({pickerIndex: null, pickerColor: null, pickerAnchorEl: null});
  }

  onChangeColor(color: any) {
    this.setState({pickerColor: color.hex});
  }

  onClearColors() {
    this.setState({pickerIndex: null, pickerColor: null, pickerAnchorEl: null});
    this.props.onChangeColors({target: {value: []}});

  }
}

(ColorSetPicker as any).displayName="ColorSetPicker";
export default ColorSetPicker;