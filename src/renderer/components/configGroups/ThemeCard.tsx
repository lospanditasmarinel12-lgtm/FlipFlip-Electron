import * as React from "react";

import { FormControlLabel, Switch, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";

import ThemeColorPicker from "../config/ThemeColorPicker";

const ThemePickerDiv = styled('div')(({theme}) => ({
  [theme.breakpoints.up('sm')]: {
    maxWidth: theme.spacing(47),
  }
}));

class ThemeCard extends React.Component {
  readonly props: {
    theme: Theme,
    onChangeThemeColor(colorTheme: any, primary: boolean): void,
    onToggleDarkMode(): void,
  };

  render() {
    return(
      <React.Fragment>
        <div>
          <FormControlLabel
            control={
              <Switch checked={this.props.theme.palette.mode === "dark"}
                      onChange={this.props.onToggleDarkMode.bind(this)}/>
            }
            label="Dark Mode"/>
        </div>
        <ThemePickerDiv sx={{ mb: 2 }}>
          <Typography>Primary Color</Typography>
          <ThemeColorPicker
            currentColor={this.props.theme.palette.primary.main}
            onChangeColor={this.onPrimaryInput.bind(this)}/>
        </ThemePickerDiv>
        <ThemePickerDiv>
          <Typography>Secondary Color</Typography>
          <ThemeColorPicker
            currentColor={this.props.theme.palette.secondary.main}
            onChangeColor={this.onSecondaryInput.bind(this)}/>
        </ThemePickerDiv>
      </React.Fragment>
    );
  }

  onPrimaryInput(colorTheme: any) {
    this.props.onChangeThemeColor(colorTheme, true);
  }

  onSecondaryInput(colorTheme: any) {
    this.props.onChangeThemeColor(colorTheme, false);
  }
}

(ThemeCard as any).displayName="ThemeCard";
export default ThemeCard;
