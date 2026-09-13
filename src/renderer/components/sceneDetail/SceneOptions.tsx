import * as React from "react";

import { Card, CardContent, Grid } from "@mui/material";
import { styled } from "@mui/material/styles";

import {SDT} from "../../data/const";
import {SceneSettings} from "../../data/Config";
import Scene from "../../data/Scene";
import ImageVideoCard from "../configGroups/ImageVideoCard";
import SceneOptionCard from "../configGroups/SceneOptionCard";
import SceneGrid from "../../data/SceneGrid";

class SceneOptions extends React.Component {
  readonly props: {
    allScenes: Array<Scene>,
    allSceneGrids: Array<SceneGrid>,
    scene: Scene | SceneSettings,
    tutorial: string,
    isConfig: boolean,
    onUpdateScene(scene: Scene | SceneSettings, fn: (scene: Scene | SceneSettings) => void): void,
  };

  render() {
    const tutorial1 = this.props.tutorial == SDT.optionsLeft ||
      this.props.tutorial == SDT.timing ||
      this.props.tutorial == SDT.backForth ||
      this.props.tutorial == SDT.imageSizing ||
      this.props.tutorial == SDT.nextScene ||
      this.props.tutorial == SDT.overlays;
    const tutorial2 = this.props.tutorial == SDT.optionsRight ||
      this.props.tutorial == SDT.imageOptions ||
      this.props.tutorial == SDT.videoOptions ||
      this.props.tutorial == SDT.weighting ||
      this.props.tutorial == SDT.sordering ||
      this.props.tutorial == SDT.ordering;
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} sx={
          tutorial1 ? { zIndex: (theme) => theme.zIndex.modal + 1, pointerEvents: 'none' } : undefined
        }>
          <Card
            sx={{
              ...(this.props.tutorial == SDT.optionsLeft ? { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' } : {}),
              overflow: 'inherit',
            }}
          >
            <CardContent>
              <SceneOptionCard
                allScenes={this.props.allScenes}
                allSceneGrids={this.props.allSceneGrids}
                scene={this.props.scene}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} sx={
          tutorial2 ? { zIndex: (theme) => theme.zIndex.modal + 1, pointerEvents: 'none' } : undefined
        }>
          <Card sx={
            this.props.tutorial == SDT.optionsRight ? { borderWidth: 2, borderColor: (theme) => theme.palette.secondary.main, borderStyle: 'solid' } : undefined
          }>
            <CardContent>
              <ImageVideoCard
                scene={this.props.scene}
                isConfig={this.props.isConfig}
                tutorial={this.props.tutorial}
                onUpdateScene={this.props.onUpdateScene.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }
}

(SceneOptions as any).displayName="SceneOptions";
export default SceneOptions;