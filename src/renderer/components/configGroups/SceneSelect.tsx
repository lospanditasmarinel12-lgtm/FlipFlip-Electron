import Select from "react-select";
import * as React from "react";

import { styled } from "@mui/material/styles";

import Scene from "../../data/Scene";
import SceneGrid from "../../data/SceneGrid";
import {areWeightsValid} from "../../data/utils";


class SceneSelect extends React.Component {
  readonly props: {
    allScenes: Array<Scene>,
    value: number,
    allSceneGrids?: Array<SceneGrid>,
    scene?: Scene,
    menuIsOpen?: boolean,
    autoFocus?: boolean,
    includeExtra?: boolean
    onlyExtra?: boolean
    getSceneName(sceneID: string): string,
    onChange(sceneID: number): void,
  }

  render() {
    let defaults = [this.props.onlyExtra ? "-1" : "0"];
    if (this.props.includeExtra) {
      defaults = ["0", "-1"];
    }
    // Match the main grid: show every regular (non-generator) scene, and only
    // valid generator scenes. The old `sources.length > 0` filter hid scenes
    // the grid still displayed (e.g. after a save where `sources` went empty),
    // making the in-player picker look blank while the grid was full.
    const scenes = this.props.allScenes.filter((s) => (!this.props.scene || s.id !== this.props.scene.id) && (!s.generatorWeights || (s.regenerate && areWeightsValid(s)))).map((s) => s.id.toString());
    let idList = defaults.concat(scenes);
    if (this.props.allSceneGrids) {
      idList = idList.concat(this.props.allSceneGrids.map((s) => "999" + s.id));
    }
    const options = idList.map((id) => {return{label: this.props.getSceneName(id), value: id}}).filter((o) => o.label != "library_scene_temp");
    return (
      <Select
        value={{label: this.props.getSceneName(this.props.value.toString()), value: this.props.value}}
        options={options}
        backspaceRemovesValue={false}
        menuIsOpen={this.props.menuIsOpen}
        autoFocus={this.props.autoFocus}
        onChange={this.onChange.bind(this)} />
    )
  }

  onChange(e: {label: any, value: any}) {
    this.props.onChange(e.value);
  }
}

(SceneSelect as any).displayName="SceneSelect";
export default SceneSelect;