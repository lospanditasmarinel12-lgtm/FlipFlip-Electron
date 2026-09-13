import * as React from "react";

import { Card, CardContent, Grid } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";

import {SDT} from "../../data/const";
import {SceneSettings} from "../../data/Config";
import Scene from "../../data/Scene";
import CrossFadeCard from "../configGroups/CrossFadeCard";
import SlideCard from "../configGroups/SlideCard";
import StrobeCard from "../configGroups/StrobeCard";
import ZoomMoveCard from "../configGroups/ZoomMoveCard";
import FadeIOCard from "../configGroups/FadeIOCard";
import PanningCard from "../configGroups/PanningCard";

class SceneEffects extends React.Component {
  readonly props: {
    scene: Scene | SceneSettings,
    easingControls: boolean,
    tutorial: string,
    onUpdateScene(scene: Scene | SceneSettings, fn: (scene: Scene | SceneSettings) => void): void,
  };

  render() {
    const tutorialZoom = this.props.tutorial == SDT.zoom1 ||
      this.props.tutorial == SDT.zoom2 ||
      this.props.tutorial == SDT.zoom3 ||
      this.props.tutorial == SDT.zoom4;
    const tutorialFade = this.props.tutorial == SDT.fade1 ||
      this.props.tutorial == SDT.fade2;
    return(
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4} sx={theme => ({
          ...(tutorialZoom && { zIndex: theme.zIndex.modal + 1 }),
        })}>
          <Card>
            <CardContent>
              <ZoomMoveCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4} sx={theme => ({
          ...(tutorialFade && { zIndex: theme.zIndex.modal + 1 }),
        })}>
          <Card>
            <CardContent>
              <CrossFadeCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <SlideCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <StrobeCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                sidebar={false}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <FadeIOCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <PanningCard
                scene={this.props.scene}
                easingControls={this.props.easingControls}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }

}

(SceneEffects as any).displayName="SceneEffects";
export default SceneEffects;
