import * as React from 'react';
import {ipcRenderer} from "electron";
import * as remote from "@electron/remote";
import wretch from "wretch";
import Sortable from "react-sortablejs";
import fs from "fs";

import {
  AppBar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  IconButton,
  InputAdornment,
  Link,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled, Theme } from "@mui/material/styles";

import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import FolderIcon from "@mui/icons-material/Folder";
import GetAppIcon from '@mui/icons-material/GetApp';
import GridOnIcon from '@mui/icons-material/GridOn';
import HelpIcon from '@mui/icons-material/Help';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import MenuIcon from '@mui/icons-material/Menu';
import MovieIcon from '@mui/icons-material/Movie';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SortIcon from '@mui/icons-material/Sort';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';

import {arrayMove, getRandomListItem} from "../data/utils";
import {IPC, MO, SF, SG, SPT} from "../data/const";
import en from "../data/en";
import Config from "../data/Config";
import Scene from "../data/Scene";
import SceneGroup from "../data/SceneGroup";
import Jiggle from "../animations/Jiggle";
import VSpin from "../animations/VSpin";
import SceneGrid from "../data/SceneGrid";
import SceneSearch from "../SceneSearch";

const drawerWidth = 240;

const s = {
  root: { display: 'flex' },
  appBar: (theme: Theme) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  }),
  appBarShift: (theme: Theme) => ({
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth})`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  logo: (theme: Theme) => ({
    marginLeft: '24px',
    width: theme.spacing(6),
    height: theme.spacing(6),
    marginRight: '5px',
    background: 'url("./src/renderer/icons/flipflip_logo.png") no-repeat',
    backgroundSize: theme.spacing(6),
    transition: theme.transitions.create(['opacity', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  drawerLogo: { marginLeft: 0 },
  title: (theme: Theme) => ({
    transition: theme.transitions.create(['opacity', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  version: (theme: Theme) => ({
    marginTop: '35px',
    marginLeft: '-11px',
    transition: theme.transitions.create(['opacity', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  updateIcon: { float: 'right' },
  drawerPaper: (theme: Theme) => ({
    position: 'relative',
    whiteSpace: 'nowrap',
    overflowX: 'hidden',
    height: '100vh',
    width: drawerWidth,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  drawerPaperClose: (theme: Theme) => ({
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: { width: theme.spacing(9) },
  }),
  drawerToolbar: (theme: Theme) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    color: theme.palette.primary.contrastText,
    padding: '0 8px',
    paddingLeft: '23px',
    backgroundColor: theme.palette.primary.main,
    minHeight: 64,
  }),
  drawerBottom: (theme: Theme) => ({
    width: drawerWidth,
    padding: '8px',
    paddingLeft: '16px',
    transition: theme.transitions.create(['opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  drawerBottomClose: (theme: Theme) => ({
    opacity: 0,
    transition: theme.transitions.create(['opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  }),
  chip: (theme: Theme) => ({
    transition: theme.transitions.create(['opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  chipClose: (theme: Theme) => ({
    opacity: 0,
    transition: theme.transitions.create(['opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  }),
  appBarSpacer: (theme: Theme) => ({
    backgroundColor: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px',
    minHeight: 64,
  }),
  content: (theme: Theme) => ({
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: theme.palette.background.default,
  }),
  container: (theme: Theme) => ({
    padding: theme.spacing(0),
    overflowY: 'auto',
  }),
  sceneList: (theme: Theme) => ({
    padding: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
  }),
  scene: (theme: Theme) => ({
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  }),
  deleteScene: (theme: Theme) => ({
    backgroundColor: theme.palette.error.main,
  }),
  deleteButton: (theme: Theme) => ({
    backgroundColor: theme.palette.error.main,
    margin: 0,
    top: 'auto',
    right: 20,
    bottom: 20,
    left: 'auto',
    position: 'fixed',
  }),
  addMenuButton: (theme: Theme) => ({
    backgroundColor: theme.palette.primary.dark,
    margin: 0,
    top: 'auto',
    right: 20,
    bottom: 20,
    left: 'auto',
    position: 'fixed',
  }),
  sortMenuButton: (theme: Theme) => ({
    backgroundColor: theme.palette.secondary.dark,
    margin: 0,
    top: 'auto',
    right: 80,
    bottom: 20,
    left: 'auto',
    position: 'fixed',
  }),
  randomButton: (theme: Theme) => ({
    backgroundColor: theme.palette.secondary.light,
    margin: 0,
    top: 'auto',
    right: 132,
    bottom: 20,
    left: 'auto',
    position: 'fixed',
  }),
  extraWindowRandomButton: { right: 28, bottom: 25 },
  generateTooltip: (theme: Theme) => ({
    top: 'auto',
    right: 28,
    bottom: 140,
    left: 'auto',
    position: 'fixed',
    borderRadius: '50%',
    width: theme.spacing(5),
    height: theme.spacing(5),
  }),
  gridTooltip: (theme: Theme) => ({
    top: 'auto',
    right: 28,
    bottom: 85,
    left: 'auto',
    position: 'fixed',
    borderRadius: '50%',
    width: theme.spacing(5),
    height: theme.spacing(5),
  }),
  addButton: (theme: Theme) => ({
    backgroundColor: theme.palette.primary.main,
    margin: '0px',
    top: 'auto',
    right: 28,
    bottom: 25,
    left: 'auto',
    position: 'fixed',
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  addSceneButton: { marginBottom: '170px' },
  addGeneratorButton: { marginBottom: '115px' },
  addGridButton: { marginBottom: '60px' },
  importSceneButton: { marginBottom: '225px' },
  deleteScenesButton: (theme: Theme) => ({
    marginBottom: '280px',
    backgroundColor: theme.palette.error.main,
  }),
  addButtonClose: (theme: Theme) => ({
    marginBottom: '0px',
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  }),
  icon: (theme: Theme) => ({ color: theme.palette.primary.contrastText }),
  sortMenu: { width: 200 },
  tabs: (theme: Theme) => ({ borderRight: `1px solid ${theme.palette.divider}` }),
  tab: (theme: Theme) => ({
    width: drawerWidth,
    height: theme.spacing(12),
    transition: theme.transitions.create(['width', 'margin', 'background', 'opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.08)',
      opacity: 1,
      transition: theme.transitions.create(['background', 'opacity'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
    },
  }),
  tabClose: (theme: Theme) => ({
    minWidth: 0,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: { width: theme.spacing(9) },
  }),
  fill: { flexGrow: 1 },
  backdropTop: (theme: Theme) => ({ zIndex: theme.zIndex.modal + 1 }),
  highlight: (theme: Theme) => ({
    borderWidth: 2,
    borderColor: theme.palette.secondary.main,
    borderStyle: 'solid',
  }),
  disable: { pointerEvents: 'none' },
  groupTitle: (theme: Theme) => ({
    lineHeight: '45px',
    minWidth: '20px',
    color: theme.palette.text.primary,
  }),
  titleInput: (theme: Theme) => ({
    color: theme.palette.text.primary,
    fontSize: theme.typography.h6.fontSize,
  }),
  groupHandle: (theme: Theme) => ({ margin: theme.spacing(1), cursor: 'move' }),
};

const StyledSortable = styled(Sortable as any)(({ theme }) => ({
  padding: theme.spacing(1),
  display: 'flex',
  flexWrap: 'wrap',
}));

const StyledJiggle = styled(Jiggle as any)(({ theme }) => ({
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

class ScenePicker extends React.Component {
  readonly props: {
    canGenerate: boolean,
    canGrid: boolean,
    config: Config,
    grids: Array<SceneGrid>,
    audioLibraryCount: number,
    scriptLibraryCount: number,
    libraryCount: number,
    openTab: number,
    scenes: Array<Scene>,
    sceneGroups: Array<SceneGroup>,
    tutorial: string,
    version: string,
    onAddGenerator(): void,
    onAddGrid(): void,
    onAddGroup(type: string): void,
    onAddScene(): void,
    onChangeTab(newTab: number): void,
    onDeleteGroup(group: SceneGroup): void,
    onDeleteScenes(sceneIDs: Array<number>): void,
    onImportScene(importScenes: any, addToLibrary: boolean): void,
    onOpenConfig(): void,
    onOpenAudioLibrary(): void,
    onOpenScriptLibrary(): void,
    onOpenCaptionScriptor(): void,
    onOpenLibrary(): void,
    onOpenScene(scene: Scene): void,
    onOpenGrid(grid: SceneGrid): void,
    onTutorial(tutorial: string): void,
    onSort(algorithm: string, ascending: boolean): void,
    onUpdateConfig(config: Config): void,
    onUpdateGroups(groups: Array<SceneGroup>): void,
    onUpdateScenes(scenes: Array<Scene>): void,
    onUpdateGrids(grids: Array<SceneGrid>): void,
    startTutorial(): void,
    systemMessage(message: string): void,
  };

  readonly state = {
    drawerOpen: false,
    newVersion: "",
    newVersionLink: "",
    isFirstWindow: false,
    menuAnchorEl: null as any,
    openMenu: null as string,
    displayScenes: Array<Scene>(),
    displayGrids: Array<SceneGrid>(),
    filters: Array<string>(),
    deleteScenes: null as Array<number>,
    importFile: "",
    importSources: false,
    isEditing: -1,
    isEditingName: "",
  };

  render() {
    const open = this.state.drawerOpen;
    let groupedScenes: Array<number> = []
    let groupedGenerators: Array<number> = []
    let groupedGrids: Array<number> = [];
    for (let g of this.props.sceneGroups.filter((g) => g.type == SG.scene)) {
      groupedScenes = groupedScenes.concat(g.scenes);
    }
    for (let g of this.props.sceneGroups.filter((g) => g.type == SG.generator)) {
      groupedGenerators = groupedGenerators.concat(g.scenes);
    }
    for (let g of this.props.sceneGroups.filter((g) => g.type == SG.grid)) {
      groupedGrids = groupedGrids.concat(g.scenes);
    }
    return (
      <Box sx={s.root} onClick={this.onClickCloseMenu.bind(this)}>

        <AppBar position="absolute" sx={[s.appBar, open && s.appBarShift, this.props.tutorial == SPT.scenePicker && s.backdropTop]}>
          <Toolbar sx={{ height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Toggle Drawer"
              sx={[this.props.tutorial == SPT.scenePicker && s.highlight]}
              onClick={this.onToggleDrawer.bind(this)}
              size="large">
              <MenuIcon />
            </IconButton>
            <VSpin>
              <Box sx={s.logo}/>
            </VSpin>
            <Typography component="h1" variant="h4" color="inherit" noWrap sx={s.title}>
              FlipFlip
            </Typography>
            <Typography variant="caption" color="inherit" noWrap sx={s.version}>
              v{this.props.version}
            </Typography>
            <Box sx={s.fill}/>
            {this.state.newVersion != "" && (
              <Tooltip disableInteractive title={`Download ${this.state.newVersion}`}>
                <IconButton
                  color="inherit"
                  sx={s.updateIcon}
                  onClick={this.openGitRelease.bind(this)}
                  size="large">
                  <Badge variant="dot" color="secondary">
                    <SystemUpdateIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <SceneSearch
              displaySources={this.state.displayScenes}
              filters={this.state.filters}
              placeholder={"Search ..."}
              onUpdateFilters={this.onUpdateFilters.bind(this)}/>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="permanent"
          sx={this.props.tutorial == SPT.drawer ? [s.backdropTop, s.disable, s.highlight] : undefined}
          slotProps={{ paper: { sx: [s.drawerPaper, !open && s.drawerPaperClose] } }}
          open={open}>

          <Box sx={s.drawerToolbar}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Toggle Drawer"
              onClick={this.onToggleDrawer.bind(this)}
              size="large">
              <MenuIcon />
            </IconButton>
            <VSpin>
              <Box sx={[s.logo, s.drawerLogo]}/>
            </VSpin>
            <Typography component="h1" variant="h6" color="inherit" noWrap>
              FlipFlip
            </Typography>
          </Box>

          <Divider />

          <div>
            <Tabs
              orientation="vertical"
              value={this.props.openTab}
              onChange={this.onChangeTab.bind(this)}
              aria-label="scene picker tabs"
              sx={s.tabs}>
              <Tab id="vertical-tab-0"
                   aria-controls="vertical-tabpanel-0"
                   icon={<MovieIcon/>} label={open ? `Scenes (${this.props.scenes.filter((s) => !s.generatorWeights).length})` : ""}
                   sx={[s.tab, !open && s.tabClose]}/>
              <Tab id="vertical-tab-1"
                   aria-controls="vertical-tabpanel-1"
                   icon={<MovieFilterIcon/>} label={open ? `Scene Generators (${this.props.scenes.filter((s) => !!s.generatorWeights).length})` : ""}
                   sx={[s.tab, !open && s.tabClose]}/>
              <Tab id="vertical-tab-2"
                   aria-controls="vertical-tabpanel-2"
                   icon={<GridOnIcon/>} label={open ? `Scene Grids (${this.props.grids.length})` : ""}
                   sx={[s.tab, !open && s.tabClose]}/>
            </Tabs>
          </div>

          {this.state.isFirstWindow && (
            <React.Fragment>
              <Divider />

              <div>
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Library"}>
                  <ListItemButton onClick={this.props.onOpenLibrary.bind(this)}>
                    <ListItemIcon>
                      <LocalLibraryIcon />
                    </ListItemIcon>
                    <ListItemText primary="Library" />
                    {this.props.libraryCount > 0 && (
                      <Chip
                        sx={[s.chip, !open && s.chipClose]}
                        label={this.props.libraryCount}
                        color='primary'
                        size='small'
                        variant='outlined'/>
                    )}
                  </ListItemButton>
                </Tooltip>
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Audio Library"}>
                  <ListItemButton onClick={this.props.onOpenAudioLibrary.bind(this)}>
                    <ListItemIcon>
                      <LibraryMusicIcon/>
                    </ListItemIcon>
                    <ListItemText primary="Audio Library" />
                    {this.props.audioLibraryCount > 0 && (
                      <Chip
                        sx={[s.chip, !open && s.chipClose]}
                        label={this.props.audioLibraryCount}
                        color='primary'
                        size='small'
                        variant='outlined'/>
                    )}
                  </ListItemButton>
                </Tooltip>
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Script Library"}>
                  <ListItemButton onClick={this.props.onOpenScriptLibrary.bind(this)}>
                    <ListItemIcon>
                      <LibraryBooksIcon/>
                    </ListItemIcon>
                    <ListItemText primary="Script Library" />
                    {this.props.scriptLibraryCount > 0 && (
                      <Chip
                        sx={[s.chip, !open && s.chipClose]}
                        label={this.props.scriptLibraryCount}
                        color='primary'
                        size='small'
                        variant='outlined'/>
                    )}
                  </ListItemButton>
                </Tooltip>
              </div>

              <Divider />

              <div>
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Caption Scripter"}>
                  <ListItemButton onClick={this.props.onOpenCaptionScriptor.bind(this)}>
                    <ListItemIcon>
                      <CodeIcon />
                    </ListItemIcon>
                    <ListItemText primary="Caption Scripter" />
                  </ListItemButton>
                </Tooltip>
              </div>

              <Divider />

              <div>
                {this.props.scenes.length > 0 && (
                  <React.Fragment>
                    <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "New Window"}>
                      <ListItemButton onClick={this.onNewWindow.bind(this)}>
                        <ListItemIcon>
                          <OpenInNewIcon />
                        </ListItemIcon>
                        <ListItemText primary="New Window" />
                      </ListItemButton>
                    </Tooltip>

                    <Dialog
                      open={this.state.openMenu == MO.newWindowAlert}
                      onClose={this.onCloseDialog.bind(this)}
                      aria-labelledby="new-window-title"
                      aria-describedby="new-window-description">
                      <DialogTitle id="new-window-title">New Window Warning</DialogTitle>
                      <DialogContent>
                        <DialogContentText id="new-window-description">
                          Please be aware that only changes made in the main window (this window) will be saved.
                        </DialogContentText>
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={this.newWindow.bind(this, true)} color="secondary">
                          Don't show again
                        </Button>
                        <Button onClick={this.newWindow.bind(this, false)} color="primary">
                          OK
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </React.Fragment>
                )}
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Settings"}>
                  <ListItemButton onClick={this.props.onOpenConfig.bind(this)}>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Settings" />
                  </ListItemButton>
                </Tooltip>
                <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "User Manual"}>
                  <ListItemButton onClick={this.openLink.bind(this,"https://ififfy.github.io/flipflip/#/")}>
                    <ListItemIcon>
                      <HelpIcon />
                    </ListItemIcon>
                    <ListItemText primary="User Manual" />
                  </ListItemButton>
                </Tooltip>
              </div>
            </React.Fragment>
          )}
          <Box sx={s.fill}/>

          <Box sx={[s.drawerBottom, !open && s.drawerBottomClose]}>
            <Typography variant="body2" color="inherit">
              Questions? Suggestions?
              <br/>
              Visit us on <Link
              href="#"
              onClick={this.openLink.bind(this, "https://github.com/ififfy/flipflip")}
              underline="hover">GitHub</Link> or <Link
              href="#"
              onClick={this.openLink.bind(this, "https://www.reddit.com/r/flipflip")}
              underline="hover">Reddit</Link>
            </Typography>
          </Box>
        </Drawer>

        <Box component="main" sx={s.content}>
          <Box sx={s.appBarSpacer} />
          <Container maxWidth={false} sx={s.container}>

            {this.props.openTab === 0 && (
              <Typography component="div">
                <StyledSortable
                  options={{
                    group: {
                      name: SG.scene,
                      pull: true,
                      put: true,
                    },
                    animation: 150,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.scenes.filter((s) => !s.generatorWeights && this.state.displayScenes.includes(s) && !groupedScenes.includes(s.id));
                    let newScenes = Array.from(this.props.scenes);
                    let oldIndex = null, newIndex = null;
                    if (evt.type == "update") {
                      oldIndex = newScenes.indexOf(filteredList[evt.oldIndex]);
                      newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                    } else if (filteredList.length == order.length) {
                      oldIndex = newScenes.indexOf(newScenes.find((s) => s.id == evt.item.id));
                      newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                    }
                    if (oldIndex != null && newIndex != null) {
                      arrayMove(newScenes, oldIndex, newIndex);
                      this.props.onUpdateScenes(newScenes);
                    }
                  }}>
                  {this.props.scenes.filter((s) => !s.generatorWeights && this.state.displayScenes.includes(s) && !groupedScenes.includes(s.id)).map((scene) =>
                    <StyledJiggle id={scene.id.toString()} key={scene.id} bounce disable={this.state.deleteScenes?.includes(scene.id)}>
                      <Card sx={[this.state.deleteScenes?.includes(scene.id) && s.deleteScene]}>
                        <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenScene.bind(this, scene) : this.onToggleDelete.bind(this, scene.id)}>
                          <CardContent>
                            <Typography component="h2" variant="h6">
                              {scene.name}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </StyledJiggle>
                  )}
                </StyledSortable>
                <StyledSortable
                  options={{
                    group: {
                      name: 'group',
                      pull: false,
                      put: false,
                    },
                    animation: 150,
                    handle: ".group-handle",
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.sceneGroups.filter((g) => g.type == SG.scene);
                    let newGroups = Array.from(this.props.sceneGroups);
                    let oldIndex = newGroups.indexOf(filteredList[evt.oldIndex]);
                    let newIndex = newGroups.indexOf(filteredList[evt.newIndex]);
                    arrayMove(newGroups, oldIndex, newIndex);
                    this.props.onUpdateGroups(newGroups);
                  }}>
                  {this.props.sceneGroups.filter((g) => g.type == SG.scene).map((g) =>
                    <div key={g.id}>
                      <Box sx={s.root}>
                        <DragHandleIcon className={"group-handle"} sx={s.groupHandle}/>
                        {this.state.isEditing == g.id && (
                          <Box component="form" onSubmit={this.endEditingName.bind(this)} sx={s.groupTitle}>
                            <TextField
                              variant="standard"
                              autoFocus
                              id="title"
                              value={this.state.isEditingName}
                              margin="none"
                              slotProps={{ htmlInput: { sx: s.titleInput } }}
                              onBlur={this.endEditingName.bind(this)}
                              onChange={this.onChangeName.bind(this)} />
                          </Box>
                        )}
                        {this.state.isEditing != g.id && (
                          <Typography variant={"h6"}
                                      onClick={this.beginEditingName.bind(this, g)}
                                      sx={s.groupTitle}>{g.name}</Typography>
                        )}
                        <Box sx={s.fill}/>
                        <IconButton
                          color="inherit"
                          aria-label="Delete"
                          onClick={this.props.onDeleteGroup.bind(this, g)}
                          size="large">
                          <CloseIcon />
                        </IconButton>
                      </Box>
                      <StyledSortable
                        options={{
                          group: {
                            name: SG.scene,
                            pull: true,
                            put: true,
                          },
                          animation: 150,
                          easing: "cubic-bezier(1, 0, 0, 1)",
                        }}
                        onChange={(order: any, sortable: any, evt: any) => {
                          let filteredList = this.props.scenes.filter((s) => !s.generatorWeights && this.state.displayScenes.includes(s) && g.scenes.includes(s.id));
                          let newScenes = Array.from(this.props.scenes);
                          let oldIndex = null, newIndex = null;
                          if (evt.type == "update") {
                            oldIndex = newScenes.indexOf(filteredList[evt.oldIndex]);
                            newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                          } else if (order.length > filteredList.length) {
                            oldIndex = newScenes.indexOf(newScenes.find((s) => s.id == evt.item.id));
                            if (evt.newIndex == 0) {
                              newIndex = 0;
                            } else if (evt.newIndex == filteredList.length) {
                              newIndex = newScenes.indexOf(filteredList[evt.newIndex-1]) + 1;
                            } else {
                              newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                              if (oldIndex < newIndex) newIndex--;
                            }
                            if (!!evt.item.id) {
                              let newGroups = Array.from(this.props.sceneGroups);
                              let group = newGroups.find((gr) => gr.id == g.id);
                              group.scenes = group.scenes.concat([parseInt(evt.item.id)]);
                              this.props.onUpdateGroups(newGroups);
                            }
                          } else if (order.length < filteredList.length) {
                            let newGroups = Array.from(this.props.sceneGroups);
                            let group = newGroups.find((gr) => gr.id == g.id);
                            group.scenes = group.scenes.filter((id) => id.toString() != evt.item.id);
                            this.props.onUpdateGroups(newGroups);
                          }
                          if (oldIndex != null && newIndex != null) {
                            arrayMove(newScenes, oldIndex, newIndex);
                            this.props.onUpdateScenes(newScenes);
                          }
                        }}>
                        {this.props.scenes.filter((s) => !s.generatorWeights && this.state.displayScenes.includes(s) && g.scenes.includes(s.id)).map((scene) =>
                          <StyledJiggle id={scene.id.toString()} key={scene.id} bounce disable={this.state.deleteScenes?.includes(scene.id)}>
                            <Card sx={[this.state.deleteScenes?.includes(scene.id) && s.deleteScene]}>
                              <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenScene.bind(this, scene) : this.onToggleDelete.bind(this, scene.id)}>
                                <CardContent>
                                  <Typography component="h2" variant="h6">
                                    {scene.name}
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          </StyledJiggle>
                        )}
                      </StyledSortable>
                    </div>
                  )}
                </StyledSortable>
              </Typography>
            )}

            {this.props.openTab === 1 && (
              <Typography component="div">
                <StyledSortable
                  options={{
                    group: {
                      name: SG.generator,
                      pull: true,
                      put: true,
                    },
                    animation: 150,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.scenes.filter((s) => s.generatorWeights && this.state.displayScenes.includes(s) && !groupedGenerators.includes(s.id));
                    let newScenes = Array.from(this.props.scenes);
                    let oldIndex = null, newIndex = null;
                    if (evt.type == "update") {
                      oldIndex = newScenes.indexOf(filteredList[evt.oldIndex]);
                      newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                    } else if (filteredList.length == order.length) {
                      oldIndex = newScenes.indexOf(newScenes.find((s) => s.id == evt.item.id));
                      newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                    }
                    if (oldIndex != null && newIndex != null) {
                      arrayMove(newScenes, oldIndex, newIndex);
                      this.props.onUpdateScenes(newScenes);
                    }
                  }}>
                  {this.props.scenes.filter((s) => s.generatorWeights && this.state.displayScenes.includes(s) && !groupedGenerators.includes(s.id)).map((scene) =>
                    <StyledJiggle id={scene.id.toString()} key={scene.id} bounce disable={this.state.deleteScenes?.includes(scene.id)}>
                      <Card sx={[this.state.deleteScenes?.includes(scene.id) && s.deleteScene]}>
                        <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenScene.bind(this, scene) : this.onToggleDelete.bind(this, scene.id)}>
                          <CardContent>
                            <Typography component="h2" variant="h6">
                              {scene.name}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </StyledJiggle>
                  )}
                </StyledSortable>
                <StyledSortable
                  options={{
                    group: {
                      name: 'group',
                      pull: false,
                      put: false,
                    },
                    animation: 150,
                    handle: ".group-handle",
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.sceneGroups.filter((g) => g.type == SG.generator);
                    let newGroups = Array.from(this.props.sceneGroups);
                    let oldIndex = newGroups.indexOf(filteredList[evt.oldIndex]);
                    let newIndex = newGroups.indexOf(filteredList[evt.newIndex]);
                    arrayMove(newGroups, oldIndex, newIndex);
                    this.props.onUpdateGroups(newGroups);
                  }}>
                  {this.props.sceneGroups.filter((g) => g.type == SG.generator).map((g) =>
                    <div key={g.id}>
                      <Box sx={s.root}>
                        <DragHandleIcon className={"group-handle"} sx={s.groupHandle}/>
                        {this.state.isEditing == g.id && (
                          <Box component="form" onSubmit={this.endEditingName.bind(this)} sx={s.groupTitle}>
                            <TextField
                              variant="standard"
                              autoFocus
                              id="title"
                              value={this.state.isEditingName}
                              margin="none"
                              slotProps={{ htmlInput: { sx: s.titleInput } }}
                              onBlur={this.endEditingName.bind(this)}
                              onChange={this.onChangeName.bind(this)} />
                          </Box>
                        )}
                        {this.state.isEditing != g.id && (
                          <Typography variant={"h6"}
                                      onClick={this.beginEditingName.bind(this, g)}
                                      sx={s.groupTitle}>{g.name}</Typography>
                        )}
                        <Box sx={s.fill}/>
                        <IconButton
                          color="inherit"
                          aria-label="Delete"
                          onClick={this.props.onDeleteGroup.bind(this, g)}
                          size="large">
                          <CloseIcon />
                        </IconButton>
                      </Box>
                      <StyledSortable
                        options={{
                          group: {
                            name: SG.generator,
                            pull: true,
                            put: true,
                          },
                          animation: 150,
                          easing: "cubic-bezier(1, 0, 0, 1)",
                        }}
                        onChange={(order: any, sortable: any, evt: any) => {
                          let filteredList = this.props.scenes.filter((s) => s.generatorWeights && this.state.displayScenes.includes(s) && g.scenes.includes(s.id));
                          let newScenes = Array.from(this.props.scenes);
                          let oldIndex = null, newIndex = null;
                          if (evt.type == "update") {
                            oldIndex = newScenes.indexOf(filteredList[evt.oldIndex]);
                            newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                          } else if (order.length > filteredList.length) {
                            oldIndex = newScenes.indexOf(newScenes.find((s) => s.id == evt.item.id));
                            if (evt.newIndex == 0) {
                              newIndex = 0;
                            } else if (evt.newIndex == filteredList.length) {
                              newIndex = newScenes.indexOf(filteredList[evt.newIndex-1]) + 1;
                            } else {
                              newIndex = newScenes.indexOf(filteredList[evt.newIndex]);
                              if (oldIndex < newIndex) newIndex--;
                            }
                            if (!!evt.item.id) {
                              let newGroups = Array.from(this.props.sceneGroups);
                              let group = newGroups.find((gr) => gr.id == g.id);
                              group.scenes = group.scenes.concat([parseInt(evt.item.id)]);
                              this.props.onUpdateGroups(newGroups);
                            }
                          } else if (order.length < filteredList.length) {
                            let newGroups = Array.from(this.props.sceneGroups);
                            let group = newGroups.find((gr) => gr.id == g.id);
                            group.scenes = group.scenes.filter((id) => id.toString() != evt.item.id);
                            this.props.onUpdateGroups(newGroups);
                          }
                          if (oldIndex != null && newIndex != null) {
                            arrayMove(newScenes, oldIndex, newIndex);
                            this.props.onUpdateScenes(newScenes);
                          }
                        }}>
                        {this.props.scenes.filter((s) => s.generatorWeights && this.state.displayScenes.includes(s) && g.scenes.includes(s.id)).map((scene) =>
                          <StyledJiggle id={scene.id.toString()} key={scene.id} bounce disable={this.state.deleteScenes?.includes(scene.id)}>
                            <Card sx={[this.state.deleteScenes?.includes(scene.id) && s.deleteScene]}>
                              <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenScene.bind(this, scene) : this.onToggleDelete.bind(this, scene.id)}>
                                <CardContent>
                                  <Typography component="h2" variant="h6">
                                    {scene.name}
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          </StyledJiggle>
                        )}
                      </StyledSortable>
                    </div>
                  )}
                </StyledSortable>
              </Typography>
            )}

            {this.props.openTab === 2 && (
              <Typography component="div">
                <StyledSortable
                  options={{
                    group: {
                      name: SG.grid,
                      pull: true,
                      put: true,
                    },
                    animation: 150,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.grids.filter((g) => this.state.displayGrids.includes(g) && !groupedGrids.includes(g.id));
                    let newGrids = Array.from(this.props.grids);
                    let oldIndex = null, newIndex = null;
                    if (evt.type == "update") {
                      oldIndex = newGrids.indexOf(filteredList[evt.oldIndex]);
                      newIndex = newGrids.indexOf(filteredList[evt.newIndex]);
                    } else if (filteredList.length == order.length) {
                      oldIndex = newGrids.indexOf(newGrids.find((s) => s.id == evt.item.id));
                      newIndex = newGrids.indexOf(filteredList[evt.newIndex]);
                    }
                    if (oldIndex != null && newIndex != null) {
                      arrayMove(newGrids, oldIndex, newIndex);
                      this.props.onUpdateGrids(newGrids);
                    }
                  }}>
                  {this.props.grids.filter((g) => this.state.displayGrids.includes(g) && !groupedGrids.includes(g.id)).map((grid) =>
                    <StyledJiggle id={grid.id.toString()} key={grid.id} bounce disable={this.state.deleteScenes?.includes(parseInt("999" + grid.id))}>
                      <Card sx={[this.state.deleteScenes?.includes(parseInt("999" + grid.id)) && s.deleteScene]}>
                        <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenGrid.bind(this, grid) : this.onToggleDelete.bind(this, parseInt("999" + grid.id))}>
                          <CardContent>
                            <Typography component="h2" variant="h6">
                              {grid.name}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </StyledJiggle>
                  )}
                </StyledSortable>
                <StyledSortable
                  options={{
                    group: {
                      name: 'group',
                      pull: false,
                      put: false,
                    },
                    animation: 150,
                    handle: ".group-handle",
                    easing: "cubic-bezier(1, 0, 0, 1)",
                  }}
                  onChange={(order: any, sortable: any, evt: any) => {
                    let filteredList = this.props.sceneGroups.filter((g) => g.type == SG.grid);
                    let newGroups = Array.from(this.props.sceneGroups);
                    let oldIndex = newGroups.indexOf(filteredList[evt.oldIndex]);
                    let newIndex = newGroups.indexOf(filteredList[evt.newIndex]);
                    arrayMove(newGroups, oldIndex, newIndex);
                    this.props.onUpdateGroups(newGroups);
                  }}>
                  {this.props.sceneGroups.filter((g) => g.type == SG.grid).map((g) =>
                    <div key={g.id}>
                      <Box sx={s.root}>
                        <DragHandleIcon className={"group-handle"} sx={s.groupHandle}/>
                        {this.state.isEditing == g.id && (
                          <Box component="form" onSubmit={this.endEditingName.bind(this)} sx={s.groupTitle}>
                            <TextField
                              variant="standard"
                              autoFocus
                              id="title"
                              value={this.state.isEditingName}
                              margin="none"
                              slotProps={{ htmlInput: { sx: s.titleInput } }}
                              onBlur={this.endEditingName.bind(this)}
                              onChange={this.onChangeName.bind(this)} />
                          </Box>
                        )}
                        {this.state.isEditing != g.id && (
                          <Typography variant={"h6"}
                                      onClick={this.beginEditingName.bind(this, g)}
                                      sx={s.groupTitle}>
                            {g.name}
                          </Typography>
                        )}
                        <Box sx={s.fill}/>
                        <IconButton
                          color="inherit"
                          aria-label="Delete"
                          onClick={this.props.onDeleteGroup.bind(this, g)}
                          size="large">
                          <CloseIcon />
                        </IconButton>
                      </Box>
                      <StyledSortable
                        options={{
                          group: {
                            name: SG.grid,
                            pull: true,
                            put: true,
                          },
                          animation: 150,
                          easing: "cubic-bezier(1, 0, 0, 1)",
                        }}
                        onChange={(order: any, sortable: any, evt: any) => {
                          let filteredList = this.props.grids.filter((gr) => this.state.displayGrids.includes(gr) && g.scenes.includes(gr.id));
                          let newGrids = Array.from(this.props.grids);
                          let oldIndex = null, newIndex = null;
                          if (evt.type == "update") {
                            oldIndex = newGrids.indexOf(filteredList[evt.oldIndex]);
                            newIndex = newGrids.indexOf(filteredList[evt.newIndex]);
                          } else if (order.length > filteredList.length) {
                            oldIndex = newGrids.indexOf(newGrids.find((s) => s.id == evt.item.id));
                            if (evt.newIndex == 0) {
                              newIndex = 0;
                            } else if (evt.newIndex == filteredList.length) {
                              newIndex = newGrids.indexOf(filteredList[evt.newIndex-1]) + 1;
                            } else {
                              newIndex = newGrids.indexOf(filteredList[evt.newIndex]);
                              if (oldIndex < newIndex) newIndex--;
                            }
                            if (!!evt.item.id) {
                              let newGroups = Array.from(this.props.sceneGroups);
                              let group = newGroups.find((gr) => gr.id == g.id);
                              group.scenes = group.scenes.concat([parseInt(evt.item.id)]);
                              this.props.onUpdateGroups(newGroups);
                            }
                          } else if (order.length < filteredList.length) {
                            let newGroups = Array.from(this.props.sceneGroups);
                            let group = newGroups.find((gr) => gr.id == g.id);
                            group.scenes = group.scenes.filter((id) => id.toString() != evt.item.id);
                            this.props.onUpdateGroups(newGroups);
                          }
                          if (oldIndex != null && newIndex != null) {
                            arrayMove(newGrids, oldIndex, newIndex);
                            this.props.onUpdateGrids(newGrids);
                          }
                        }}>
                        {this.props.grids.filter((gr) => this.state.displayGrids.includes(gr) && g.scenes.includes(gr.id)).map((grid) =>
                          <StyledJiggle id={grid.id.toString()} key={grid.id} bounce disable={this.state.deleteScenes?.includes(parseInt("999" + grid.id))}>
                            <Card sx={[this.state.deleteScenes?.includes(parseInt("999" + grid.id)) && s.deleteScene]}>
                              <CardActionArea onClick={this.state.deleteScenes == null ? this.props.onOpenGrid.bind(this, grid) : this.onToggleDelete.bind(this, parseInt("999" + grid.id))}>
                                <CardContent>
                                  <Typography component="h2" variant="h6">
                                    {grid.name}
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          </StyledJiggle>
                        )}
                      </StyledSortable>
                    </div>
                  )}
                </StyledSortable>
              </Typography>
            )}

          </Container>
        </Box>

        {this.state.deleteScenes != null && (
          <React.Fragment>
            <Tooltip disableInteractive title={"Delete Selected Scenes"}>
              <Fab
                sx={s.deleteButton}
                onClick={this.onFinishDelete.bind(this)}
                size="large">
                <DeleteIcon sx={s.icon} />
              </Fab>
            </Tooltip>
            <Tooltip disableInteractive title={"Cancel Delete"}>
              <Fab
                sx={s.sortMenuButton}
                onClick={this.onCancelDelete.bind(this)}
                size="medium">
                <CloseIcon sx={s.icon} />
              </Fab>
            </Tooltip>
          </React.Fragment>
        )}

        {this.state.deleteScenes == null && (
          <React.Fragment>
            {this.state.isFirstWindow &&  (
              <React.Fragment>
                {this.props.scenes.length > 0 && (
                  <Tooltip disableInteractive title="Delete Scenes"  placement="left">
                    <Fab
                      sx={[s.addButton, s.deleteScenesButton, this.state.openMenu != MO.new && s.addButtonClose]}
                      onClick={this.onDeleteScenes.bind(this)}
                      size="small">
                      <DeleteIcon sx={s.icon} />
                    </Fab>
                  </Tooltip>
                )}
                <Tooltip disableInteractive title="Import Scene"  placement="left">
                  <Fab
                    sx={[s.addButton, s.importSceneButton, this.state.openMenu != MO.new && s.addButtonClose]}
                    onClick={this.onImportScene.bind(this)}
                    size="small">
                    <GetAppIcon sx={s.icon} />
                  </Fab>
                </Tooltip>
                <Tooltip disableInteractive title="Add Scene"  placement="left">
                  <Fab
                    sx={(theme: Theme) => ({
                      ...s.addButton(theme),
                      ...s.addSceneButton,
                      ...(this.state.openMenu != MO.new ? s.addButtonClose(theme) : {}),
                      ...(this.props.tutorial == SPT.add2 && {
                        ...s.backdropTop(theme),
                        ...s.highlight(theme),
                      }),
                    })}
                    onClick={this.onAddScene.bind(this)}
                    size="small">
                    <MovieIcon sx={s.icon} />
                  </Fab>
                </Tooltip>
                <Tooltip disableInteractive title="Add Scene Generator"  placement="left">
                  <Box component="span" sx={[s.generateTooltip, !this.props.canGenerate ? { pointerEvents: "none" } : undefined]}>
                    <Fab
                      sx={[s.addButton, s.addGeneratorButton, this.state.openMenu != MO.new && s.addButtonClose]}
                      onClick={this.props.onAddGenerator.bind(this)}
                      disabled={!this.props.canGenerate}
                      size="small">
                      <MovieFilterIcon sx={s.icon} />
                    </Fab>
                  </Box>
                </Tooltip>
                <Tooltip disableInteractive title="Add Scene Grid"  placement="left">
                  <Box component="span" sx={[s.gridTooltip, !this.props.canGrid ? { pointerEvents: "none" } : undefined]}>
                    <Fab
                      sx={[s.addButton, s.addGridButton, this.state.openMenu != MO.new && s.addButtonClose]}
                      onClick={this.props.onAddGrid.bind(this)}
                      disabled={!this.props.canGrid}
                      size="small">
                      <GridOnIcon sx={s.icon} />
                    </Fab>
                  </Box>
                </Tooltip>
                <Tooltip disableInteractive title="Add Group"  placement="left">
                  <Fab
                    sx={[s.addButton, s.addGridButton, this.state.openMenu == MO.new && s.addButtonClose]}
                    onClick={this.onAddGroup.bind(this)}
                    size="small">
                    <CreateNewFolderIcon sx={s.icon} />
                  </Fab>
                </Tooltip>
                <Fab
                  sx={[s.addMenuButton, (this.props.tutorial == SPT.add1 || this.props.tutorial == SPT.add2) && s.backdropTop, this.props.tutorial == SPT.add1 && s.highlight]}
                  onClick={this.onToggleNewMenu.bind(this)}
                  size="large">
                  <AddIcon sx={s.icon} />
                </Fab>

                {this.props.scenes.length >= 2 && (
                  <React.Fragment>
                    <Fab
                      sx={s.sortMenuButton}
                      aria-haspopup="true"
                      aria-controls="sort-menu"
                      aria-label="Sort Scenes"
                      onClick={this.onOpenSortMenu.bind(this)}
                      size="medium">
                      <SortIcon sx={s.icon} />
                    </Fab>
                    <Menu
                      id="sort-menu"
                      elevation={1}
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'center',
                      }}
                      transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                      anchorEl={this.state.menuAnchorEl}
                      keepMounted
                      slotProps={{ paper: { sx: s.sortMenu } }}
                      open={this.state.openMenu == MO.sort}
                      onClose={this.onCloseDialog.bind(this)}>
                      {[SF.alpha, SF.date, SF.count].map((sf) =>
                        <MenuItem key={sf}>
                          <ListItemText primary={en.get(sf)}/>
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={this.props.onSort.bind(this, sf, true)} size="large">
                              <ArrowUpwardIcon/>
                            </IconButton>
                            <IconButton edge="end" onClick={this.props.onSort.bind(this, sf, false)} size="large">
                              <ArrowDownwardIcon/>
                            </IconButton>
                          </ListItemSecondaryAction>
                        </MenuItem>
                      )}
                      <MenuItem key={SF.random}>
                        <ListItemText primary={en.get(SF.random)}/>
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={this.props.onSort.bind(this, SF.random, true)}
                            size="large">
                            <ShuffleIcon/>
                          </IconButton>
                        </ListItemSecondaryAction>
                      </MenuItem>
                    </Menu>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
            <Tooltip disableInteractive title="Random Scene">
              <Fab
                sx={[s.randomButton, !this.state.isFirstWindow && s.extraWindowRandomButton]}
                onClick={this.onRandomScene.bind(this)}
                size="small">
                <CasinoIcon sx={s.icon} />
              </Fab>
            </Tooltip>
          </React.Fragment>
        )}

        <Dialog
          open={this.state.openMenu == MO.urlImport}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="import-title"
          aria-describedby="import-description">
          <DialogTitle id="import-title">Import Scene</DialogTitle>
          <DialogContent>
            <DialogContentText id="import-description">
              To import a scene, enter the URL or open a local file. You can also choose whether or not to import sources into your Library.
            </DialogContentText>
            <TextField
              variant="standard"
              label="Import File"
              fullWidth
              placeholder="Paste URL Here"
              margin="dense"
              value={this.state.importFile}
              InputProps={{
                endAdornment:
                  <InputAdornment position="end">
                    <Tooltip disableInteractive title="Open File">
                      <IconButton onClick={this.onOpenImportFile.bind(this)} size="large">
                        <FolderIcon/>
                      </IconButton>
                    </Tooltip>
                    <Tooltip disableInteractive title="Import Sources into Library">
                      <Checkbox value={this.state.importSources} onChange={this.onChangeImportSources.bind(this)}
                                checked={this.state.importSources}/>
                    </Tooltip>
                  </InputAdornment>,
              }}
              onChange={this.onChangeImportFile.bind(this)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)}>
              Cancel
            </Button>
            <Button color="primary"
                    disabled={this.state.importFile.length == 0}
                    onClick={this.onFinishImportScene.bind(this, this.state.importFile, this.state.importSources)}>
              Import
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  componentDidMount() {
    this.props.startTutorial();
    this.setState({displayScenes: this.getDisplayScenes(), displayGrids: this.getDisplayGrids()});
    if (remote.getCurrentWindow().id == 1) {
      this.setState({isFirstWindow: true});
      wretch("https://api.github.com/repos/ififfy/flipflip/releases")
        .get()
        .json(json => {
          const newestReleaseTag = json[0].tag_name;
          const newestReleaseURL = json[0].html_url;
          let releaseVersion = newestReleaseTag.replace("v", "").replace(".", "").replace(".", "");
          let releaseBetaVersion = -1;
          if (releaseVersion.includes("-")) {
            const releaseSplit = releaseVersion.split("-");
            releaseVersion = releaseSplit[0];
            const betaString = releaseSplit[1];
            const betaNumber = betaString.replace("beta", "");
            if (betaNumber == "") {
              releaseBetaVersion = 0;
            } else {
              releaseBetaVersion = parseInt(betaNumber);
            }
          }
          let thisVersion = this.props.version.replace(".", "").replace(".", "");
          let thisBetaVersion = -1;
          if (thisVersion.includes("-")) {
            const releaseSplit = thisVersion.split("-");
            thisVersion = releaseSplit[0];
            const betaString = releaseSplit[1];
            const betaNumber = betaString.replace("beta", "");
            if (betaNumber == "") {
              thisBetaVersion = 0;
            } else {
              thisBetaVersion = parseInt(betaNumber);
            }
          }
          if (parseInt(releaseVersion) > parseInt(thisVersion)) {
            this.setState({
              newVersion: newestReleaseTag,
              newVersionLink: newestReleaseURL,
            })
          } else if (parseInt(releaseVersion) == parseInt(thisVersion)) {
            if ((releaseBetaVersion == -1 && thisBetaVersion >= 0) ||
              releaseBetaVersion > thisBetaVersion) {
              this.setState({
                newVersion: newestReleaseTag,
                newVersionLink: newestReleaseURL,
              })
            }
          }
        })
        .catch((e) => console.error(e));
    }
  }

  componentDidUpdate(props: any, state: any) {
    if (state.filters != this.state.filters || props.scenes != this.props.scenes || props.grids != this.props.grids) {
      this.setState({displayScenes: this.getDisplayScenes(), displayGrids: this.getDisplayGrids()});
    }
    if (this.props.sceneGroups.length > props.sceneGroups.length) {
      this.beginEditingName(this.props.sceneGroups[this.props.sceneGroups.length - 1]);
    }
  }

  onUpdateFilters(filters: Array<string>) {
    this.setState({filters: filters, displayScenes: this.getDisplayScenes(), displayGrids: this.getDisplayGrids()});
  }

  onImportScene() {
    this.setState({openMenu: MO.urlImport});
  }

  onDeleteScenes() {
    this.setState({openMenu: null, deleteScenes: Array<number>()});
  }

  onCancelDelete() {
    this.setState({deleteScenes: null});
  }

  onFinishDelete() {
    this.props.onDeleteScenes(this.state.deleteScenes);
    this.setState({deleteScenes: null});
  }

  onToggleDelete(sceneID: number) {
    const newDeleteScenes = Array.from(this.state.deleteScenes);
    if (newDeleteScenes.includes(sceneID)) {
      newDeleteScenes.splice(newDeleteScenes.indexOf(sceneID), 1);
    } else {
      newDeleteScenes.push(sceneID);
    }
    this.setState({deleteScenes: newDeleteScenes});
  }

  onFinishImportScene() {
    if (this.state.importFile.startsWith("http")) {
      wretch(this.state.importFile)
        .get()
        .text((text) => {
          let json;
          try {
            json = JSON.parse(text);
            this.props.onImportScene(json, this.state.importSources);
            this.onCloseDialog();
          } catch (e) {
            this.props.systemMessage("This is not a valid JSON file");
          }
        })
        .catch((e) => {
          this.props.systemMessage("Error accessing URL");
        });
    } else {
      this.props.onImportScene(JSON.parse(fs.readFileSync(this.state.importFile, 'utf-8')), this.state.importSources);
      this.onCloseDialog();
    }
  }

  onNewWindow() {
    if (!this.props.config.newWindowAlerted) {
      this.setState({openMenu: MO.newWindowAlert});
    } else {
      this.newWindow(false);
    }
  }

  onChangeTab(e: MouseEvent, tab: number) {
    if (this.props.openTab != tab) {
      this.props.onChangeTab(tab);
    }
  }

  newWindow(hideFutureWarnings: boolean) {
    if (this.state.openMenu == MO.newWindowAlert) {
      this.setState({openMenu: null});
      if (hideFutureWarnings) {
        let newConfig = { ...this.props.config, newWindowAlerted: true } as any;
        this.props.onUpdateConfig(newConfig);
      }
    }
    ipcRenderer.send(IPC.newWindow);
  }

  onToggleDrawer() {
    if (this.props.tutorial == SPT.scenePicker) {
      this.props.onTutorial(SPT.scenePicker);
    }
    this.setState({drawerOpen: !this.state.drawerOpen});
  }

  onToggleNewMenu() {
    if (this.props.tutorial == SPT.add1) {
      this.props.onTutorial(SPT.add1);
    }
    this.setState({openMenu: this.state.openMenu == MO.new ? null : MO.new});
  }

  onAddScene() {
    if (this.props.tutorial == SPT.add2) {
      this.props.onTutorial(SPT.add2);
    }
    this.props.onAddScene();
  }

  onAddGroup() {
    if (this.props.openTab == 0) {
      this.props.onAddGroup(SG.scene);
    } else if (this.props.openTab == 1) {
      this.props.onAddGroup(SG.generator);
    } else if (this.props.openTab == 2) {
      this.props.onAddGroup(SG.grid);
    }
  }

  beginEditingName(group: SceneGroup) {
    this.setState({isEditing: group.id, isEditingName: group.name});
  }

  endEditingName(e: Event) {
    e.preventDefault();
    const newGroups = this.props.sceneGroups;
    const editGroup = newGroups.find((g) => g.id == this.state.isEditing);
    editGroup.name = this.state.isEditingName;
    this.props.onUpdateGroups(newGroups);
    this.setState({isEditing: -1, isEditingName: ""});
  }

  onChangeName(e: React.FormEvent<HTMLInputElement>) {
    this.setState({isEditingName:  e.currentTarget.value});
  }

  onOpenSortMenu(e: MouseEvent) {
    this.setState({menuAnchorEl: e.currentTarget, openMenu: MO.sort});
  }

  onClickCloseMenu(e: MouseEvent) {
    if (this.state.openMenu == MO.new) {
      let parent: any = e.target;
      do {
        let className = parent.className;
        if ((typeof className !== 'string') && className.baseVal != null) {
          className = className.baseVal;
        }
        if (className.includes("MuiFab-")) {
          return;
        }
        if (className.includes("ScenePicker-root")) {
          break;
        }
      } while ((parent = parent.parentNode) != null);
      this.setState({menuAnchorEl: null, openMenu: null});
    }
  }

  onOpenImportFile() {
    remote.dialog.showOpenDialog(remote.getCurrentWindow(),
      {filters: [{name:'All Files (*.*)', extensions: ['*']},{name: 'JSON Document', extensions: ['json']}], properties: ['openFile']}).then(result => {
      if (result.canceled || !result.filePaths.length) return;
      this.setState({importFile: result.filePaths[0]});
    });
  }

  onChangeImportFile(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({importFile: input.value});
  }

  onChangeImportSources(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({importSources: input.checked});
  }

  onCloseDialog() {
    this.setState({menuAnchorEl: null, openMenu: null, importFile: "", importSources: false});
  }

  onRandomScene() {
    this.props.onOpenScene(getRandomListItem(this.props.scenes));
  }

  openGitRelease() {
    this.openLink(this.state.newVersionLink);
  }

  openLink(url: string) {
    remote.shell.openExternal(url);
  }

  getDisplayScenes() {
    let displayScenes = [];
    const filtering = this.state.filters.length > 0;
    if (filtering) {
      for (let scene of this.props.scenes) {
        let matchesFilter = true;
        for (let filter of this.state.filters) {
          if (((filter.startsWith('"') || filter.startsWith('-"')) && filter.endsWith('"')) ||
            ((filter.startsWith('\'') || filter.startsWith('-\'')) && filter.endsWith('\''))) {
            if (filter.startsWith("-")) {
              filter = filter.substring(2, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(scene.name);
            } else {
              filter = filter.substring(1, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(scene.name);
            }
          } else { // This is a search filter
            filter = filter.replace("\\", "\\\\");
            if (filter.startsWith("-")) {
              filter = filter.substring(1, filter.length);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(scene.name);
            } else {
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(scene.name);
            }
          }
          if (!matchesFilter) break;
        }
        if (matchesFilter) {
          displayScenes.push(scene);
        }
      }
    } else {
      displayScenes = this.props.scenes;
    }
    return displayScenes;
  }

  getDisplayGrids() {
    let displayGrids = [];
    const filtering = this.state.filters.length > 0;
    if (filtering) {
      for (let grid of this.props.grids) {
        let matchesFilter = true;
        for (let filter of this.state.filters) {
          if (((filter.startsWith('"') || filter.startsWith('-"')) && filter.endsWith('"')) ||
            ((filter.startsWith('\'') || filter.startsWith('-\'')) && filter.endsWith('\''))) {
            if (filter.startsWith("-")) {
              filter = filter.substring(2, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(grid.name);
            } else {
              filter = filter.substring(1, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(grid.name);
            }
          } else { // This is a search filter
            filter = filter.replace("\\", "\\\\");
            if (filter.startsWith("-")) {
              filter = filter.substring(1, filter.length);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(grid.name);
            } else {
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(grid.name);
            }
          }
          if (!matchesFilter) break;
        }
        if (matchesFilter) {
          displayGrids.push(grid);
        }
      }
    } else {
      displayGrids = this.props.grids;
    }
    return displayGrids;
  }
}

(ScenePicker as any).displayName="ScenePicker";
export default ScenePicker;