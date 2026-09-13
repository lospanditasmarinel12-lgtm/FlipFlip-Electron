import * as React from "react";
import clsx from "clsx";
import * as remote from "@electron/remote";
const {getCurrentWindow, Menu, app} = remote;

import { AppBar, Container, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";

import { styled, Theme } from "@mui/material/styles";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

import {createMainMenu, createMenuTemplate} from "../../../main/MainMenu";
import SceneGrid from "../../data/SceneGrid";
import Config from "../../data/Config";
import Scene from "../../data/Scene";
import Tag from "../../data/Tag";
import Player from "./Player";
import ChildCallbackHack from "./ChildCallbackHack";
import {IdleTimer} from "./IdleTimer";
import {deepClone, flatten} from "../../data/utils";

const Root = styled('div')({
  display: 'flex',
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

const AppBarStyled = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  height: theme.spacing(8),
  marginTop: -theme.spacing(8) - 3,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

const HoverBar = styled('div')(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  position: 'absolute',
  opacity: 0,
  height: theme.spacing(5),
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 8px',
  minHeight: 64,
}));

const Fill = styled('div')({
  flexGrow: 1,
});

const ContentMain = styled('main')({
  display: 'flex',
  flexGrow: 1,
  flexDirection: 'column',
  height: '100vh',
});

const ContainerStyled = styled(Container)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(0),
}));

const GridDiv = styled('div')({
  flexGrow: 1,
  display: 'grid',
  height: '100%',
});

const GridCellDiv = styled('div')({
  height: '100%',
  width: '100%',
  display: 'grid',
  overflow: 'hidden',
});

class GridPlayer extends React.Component {
  readonly props: {
    config: Config,
    scene: SceneGrid,
    allScenes: Array<Scene>,
    sceneGrids: Array<SceneGrid>,
    theme: Theme,
    advanceHacks?: Array<ChildCallbackHack>,
    hasStarted?: boolean,
    hideBars?: boolean,
    cache(i: HTMLImageElement | HTMLVideoElement): void,
    getTags(source: string): Array<Tag>,
    goBack(): void,
    onGenerate(scene: Scene | SceneGrid, children?: boolean, force?: boolean): void,
    setCount(sourceURL: string, count: number, countComplete: boolean): void,
    systemMessage(message: string): void,
    finishedLoading?(empty: boolean): void,
    setProgress?(total: number, current: number, message: string[]): void,
    setVideo?(index: number, video: HTMLVideoElement): void,
  };

  readonly state = {
    appBarHover: false,
    scene: deepClone(this.props.scene) as SceneGrid,
    height: this.props.scene.grid && this.props.scene.grid.length > 0 &&
    this.props.scene.grid[0].length ? this.props.scene.grid.length : 1,
    width: this.props.scene.grid && this.props.scene.grid.length > 0 &&
    this.props.scene.grid[0].length > 0 ? this.props.scene.grid[0].length : 1,
    sceneCopyGrid: this.props.scene.grid.map((r) => r.map((): null => null)) as Array<Array<React.ReactNode>>,
    isLoaded: new Array<Array<boolean>>(),
    hideCursor: false,
  };

  readonly idleTimerRef: React.RefObject<HTMLDivElement> = React.createRef();
  _appBarTimeout: any = null;

  render() {
    const colSize = 100 / this.state.width;
    const rowSize = 100 / this.state.height;

    const sceneCopyTargets = new Set<string>();
    const grid = this.state.scene.grid || [];
    for (let ri = 0; ri < grid.length; ri++) {
      const row = grid[ri];
      if (!row) continue;
      for (let ci = 0; ci < row.length; ci++) {
        const cp = row[ci]?.sceneCopy;
        if (cp && cp.length === 2) {
          sceneCopyTargets.add(`${cp[0]},${cp[1]}`);
        }
      }
    }

    let gridTemplateColumns = "";
    let gridTemplateRows = "";
    for (let w = 0; w < this.state.width; w++) {
      gridTemplateColumns += colSize.toString() + "% ";
    }
    for (let h = 0; h < this.state.height; h++) {
      gridTemplateRows += rowSize.toString() + "% ";
    }

    return (
      <Root>
        {!this.props.hideBars && (
          <React.Fragment>
            <HoverBar
              onMouseEnter={this.onMouseEnterAppBar.bind(this)}
              onMouseLeave={this.onMouseLeaveAppBar.bind(this)}/>

            <AppBarStyled
             
              position="absolute"
              onMouseEnter={this.onMouseEnterAppBar.bind(this)}
              onMouseLeave={this.onMouseLeaveAppBar.bind(this)}
              sx={this.state.appBarHover ? {
                marginTop: 0,
                transition: 'margin 195ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
              } : undefined}>
              <Toolbar sx={{ height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
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

                <Fill />
                <Typography component="h1" variant="h4" color="inherit" noWrap sx={{ textAlign: 'center' }}>
                  {this.props.scene.name}
                </Typography>
                <Fill />

                <Tooltip disableInteractive title="Toggle Fullscreen">
                  <IconButton
                    edge="start"
                    color="inherit"
                    aria-label="FullScreen"
                    onClick={this.toggleFull.bind(this)}
                    size="large">
                    <FullscreenIcon fontSize="large"/>
                  </IconButton>
                </Tooltip>
              </Toolbar>
            </AppBarStyled>
          </React.Fragment>
        )}

        <ContentMain
          sx={this.state.hideCursor ? { cursor: 'none' } : undefined}
          ref={this.idleTimerRef}>
          <div />
          <IdleTimer
            ref={ref => {return this.idleTimerRef}}
            onActive={this.onActive.bind(this)}
            onIdle={this.onIdle.bind(this)}
            timeout={2000} />
          <ContainerStyled maxWidth={false}>
            <GridDiv
              style={{gridTemplateColumns: gridTemplateColumns, gridTemplateRows: gridTemplateRows}}>
              {this.state.scene.grid.map((row, rowIndex) =>
                <React.Fragment key={rowIndex}>
                  {row.map((cell, colIndex) => {
                    const scene = this.props.allScenes.find((s) => s.id == cell.sceneID);
                    const newLoaded = this.state.isLoaded;
                    let changed = false;
                    while (newLoaded.length <= rowIndex) {
                      newLoaded.push([]);
                      changed = true
                    }
                    while (newLoaded[rowIndex].length <= colIndex) {
                      newLoaded[rowIndex].push(false);
                      changed = true
                    }
                    if (changed) {
                      setTimeout(() => this.setState({isLoaded: newLoaded}), 200);
                    }
                    if (!scene && !newLoaded[rowIndex][colIndex]) {
                      setTimeout(() => this.setCellLoaded(rowIndex, colIndex), 200);
                    }
                    const allLoaded = flatten(this.state.isLoaded).find((l: boolean) => !l) == null
                    if (cell.sceneCopy.length > 0) {
                      const sceneCopyGridCell = this.state.sceneCopyGrid[cell.sceneCopy[0]][cell.sceneCopy[1]];
                      return (
                        <GridCellDiv
                          sx={[
                            !sceneCopyGridCell && { opacity: 0 },
                            cell.mirror && { transform: 'scaleX(-1)' },
                          ]}
                          key={colIndex}>
                          <div style={{
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            display: 'flex',
                            overflow: 'hidden',
                            position: 'relative',
                          }}>
                            <div>
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                              }}>
                                <div style={{
                                  top: 0,
                                  right: 0,
                                  bottom: 0,
                                  left: 0,
                                  position: 'static',
                                }}>
                                  {sceneCopyGridCell}
                                </div>
                              </div>
                            </div>
                          </div>
                        </GridCellDiv>
                      );
                    } else {
                      const loadingIndex = flatten(newLoaded).indexOf(false);
                      const showProgress = loadingIndex >= 0 && loadingIndex == (rowIndex * row.length) + colIndex;
                      return (
                        <GridCellDiv
                          sx={!scene ? { opacity: 0 } : undefined}
                          key={colIndex}>
                          {scene && (
                            <Player
                              preventSleep={rowIndex == 0 && colIndex == 0}
                              advanceHack={this.props.advanceHacks ? this.props.advanceHacks[(rowIndex * row.length) + colIndex] : undefined}
                              config={this.props.config}
                              hasStarted={this.props.hasStarted}
                              scene={scene}
                              nextScene={this.nextScene.bind(this, rowIndex, colIndex)}
                              gridView
                               gridCoordinates={sceneCopyTargets.has(`${rowIndex},${colIndex}`) ? [rowIndex,colIndex] : undefined}
                              scenes={this.props.allScenes}
                              sceneGrids={this.props.sceneGrids}
                              theme={this.props.theme}
                              tutorial={null}
                              captionScale={1 / Math.sqrt(row.length * this.props.scene.grid.length)}
                              allLoaded={allLoaded}
                              cache={this.props.cache.bind(this)}
                              getTags={this.props.getTags.bind(this)}
                              goBack={this.props.goBack.bind(this)}
                              onGenerate={this.props.onGenerate}
                              onLoaded={this.setCellLoaded.bind(this, rowIndex, colIndex)}
                              setCount={this.props.setCount.bind(this)}
                              setProgress={showProgress ? this.props.setProgress : this.nop}
                              setSceneCopy={this.setSceneCopy.bind(this, rowIndex, colIndex)}
                              setVideo={this.props.setVideo ? this.props.setVideo.bind(this, (rowIndex * row.length) + colIndex) : undefined}
                              systemMessage={this.props.systemMessage.bind(this)}
                            />
                          )}
                        </GridCellDiv>
                      );
                    }
                  })}
                </React.Fragment>
              )}
            </GridDiv>
          </ContainerStyled>
        </ContentMain>
      </Root>
    );
  }

  nop() {}

  componentDidUpdate(prevProps: any) {
    // Clear scene copies for cells that have changed targets or become empty.
    // sceneCopyGrid may hold live <img>/<video> elements (and their decoded
    // data); dropping stale subtrees lets GC/Blink release them between
    // transitions instead of retaining them for the whole grid session.
    if (prevProps.scene && this.props.scene && prevProps.scene !== this.props.scene) {
      const grid = this.props.scene.grid || [];
      const targets = new Set<string>();
      for (let ri = 0; ri < grid.length; ri++) {
        const row = grid[ri];
        if (!row) continue;
        for (let ci = 0; ci < row.length; ci++) {
          const cp = row[ci]?.sceneCopy;
          if (cp && cp.length === 2) targets.add(`${cp[0]},${cp[1]}`);
        }
      }
      const oldGrid = prevProps.scene.grid || [];
      const newCopy = this.state.sceneCopyGrid.map((row, ri) =>
        row.map((cell, ci) => {
          const prevCp = oldGrid[ri]?.[ci]?.sceneCopy;
          const prevKey = prevCp && prevCp.length === 2 ? `${prevCp[0]},${prevCp[1]}` : null;
          if (prevKey && !targets.has(prevKey)) return null;
          return cell;
        })
      );
      this.setState({sceneCopyGrid: newCopy});
    }
  }

  setSceneCopy(rowIndex: number, colIndex: number, children: React.ReactNode) {
    const newSceneCopyGrid = this.state.sceneCopyGrid;
    newSceneCopyGrid[rowIndex][colIndex] = children;
    this.setState({sceneCopyGrid: newSceneCopyGrid});
  }

  nextScene(rowIndex: number, colIndex: number) {
    const cell = this.state.scene.grid[rowIndex][colIndex];
    const scene = this.props.allScenes.find((s) => s.id == cell.sceneID);
    const newGrid = this.state.scene;
    if (scene.nextSceneID == -1) {
      newGrid.grid[rowIndex][colIndex].sceneID = scene.nextSceneRandomID;
    } else {
      newGrid.grid[rowIndex][colIndex].sceneID = scene.nextSceneID;
    }
    this.setState({grid: newGrid});
  }

  onActive() {
    this.setState({hideCursor: false})
  }

  onIdle() {
    this.setState({hideCursor: true})
  }

  setCellLoaded(rowIndex: number, colIndex: number) {
    const newLoaded = this.state.isLoaded;
    newLoaded[rowIndex][colIndex] = true;
    if (this.props.finishedLoading && flatten(newLoaded).find((l: boolean) => !l) == null) {
      this.props.finishedLoading(false);
    }
    this.setState({isLoaded: newLoaded});
  }

  onMouseEnterAppBar() {
    clearTimeout(this._appBarTimeout);
    this.setState({appBarHover: true});
  }

  closeAppBar() {
    this.setState({appBarHover: false});
  }

  onMouseLeaveAppBar() {
    clearTimeout(this._appBarTimeout);
    this._appBarTimeout = setTimeout(this.closeAppBar.bind(this), 1000);
  }

  toggleFull() {
    this.setFullscreen(!getCurrentWindow().isFullScreen());
    this.setMenuBarVisibility(!getCurrentWindow().isFullScreen());
  }

  setAlwaysOnTop(alwaysOnTop: boolean){
    this.props.config.displaySettings.alwaysOnTop = alwaysOnTop;
    this.buildMenu();
    getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
  }

  setMenuBarVisibility(showMenu: boolean) {
    this.props.config.displaySettings.showMenu = showMenu;
    this.buildMenu();
    getCurrentWindow().setMenuBarVisibility(showMenu);
  }

  setFullscreen(fullScreen: boolean) {
    this.props.config.displaySettings.fullScreen = fullScreen;
    this.buildMenu();
    getCurrentWindow().setFullScreen(fullScreen);
  }

  buildMenu() {
    createMainMenu(Menu, createMenuTemplate(app, {
      label: 'Player controls',
      submenu: Array.from(this.getKeyMap().entries()).map(([k, v]) => {
        const [label, accelerator] = v;
        return {
          label,
          accelerator,
          click: (this as any)[k as any].bind(this),
        };
      })
    }));
  }

  getKeyMap() {
    return new Map<String, Array<string>>([
      ['navigateBack', ['Go Back to Grid Setup', 'escape']],
      ['toggleFullscreen', ['Toggle Fullscreen ' + (this.props.config.displaySettings.fullScreen ? '(On)' : '(Off)'), 'Control+F']],
      ['toggleAlwaysOnTop', ['Toggle Always On Top ' + (this.props.config.displaySettings.alwaysOnTop ? '(On)' : '(Off)'), 'Control+T']],
      ['toggleMenuBarDisplay', ['Toggle Menu Bar ' + (this.props.config.displaySettings.showMenu ? '(On)' : '(Off)'), 'Control+G']],
    ]);
  }

  toggleAlwaysOnTop() {
    this.setAlwaysOnTop(!this.props.config.displaySettings.alwaysOnTop);
  }

  toggleMenuBarDisplay() {
    this.setMenuBarVisibility(!this.props.config.displaySettings.showMenu);
  }

  toggleFullscreen() {
    this.setFullscreen(!this.props.config.displaySettings.fullScreen);
  }

  navigateBack() {
    const window = getCurrentWindow();
    window.setFullScreen(false);
    window.setMenuBarVisibility(true);
    this.props.goBack();
  }
}

(GridPlayer as any).displayName="GridPlayer";
export default GridPlayer;
