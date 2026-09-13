import * as React from "react";
import * as fs from "fs";

import {
  Alert,
  AppBar,
  Box,
  Button,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slide,
  Snackbar,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { styled, Theme } from "@mui/material/styles";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LiveHelpIcon from '@mui/icons-material/LiveHelp';
import MenuIcon from'@mui/icons-material/Menu';
import PhotoFilterIcon from '@mui/icons-material/PhotoFilter';
import RestoreIcon from '@mui/icons-material/Restore';
import SettingsIcon from '@mui/icons-material/Settings';

import {MO} from "../../data/const";
import Config, { CacheSettings, DisplaySettings, GeneralSettings, RemoteSettings, SceneSettings } from "../../data/Config";
import LibrarySource from "../../data/LibrarySource";
import Scene from "../../data/Scene";
import SceneGrid from "../../data/SceneGrid";
import Tag from "../../data/Tag";
import GeneralConfig from "./GeneralConfig";
import SceneOptions from "../sceneDetail/SceneOptions";
import SceneEffects from "../sceneDetail/SceneEffects";
import {deepClone, portablePath} from "../../data/utils";

const drawerWidth = 240;

const Root = styled('div')({
  display: 'flex',
});

const AppBarStyled = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
}));

const Fill = styled('div')({
  flexGrow: 1,
});

const Title = styled(Typography)({
  textAlign: 'center',
});

const AppBarSpacer = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 8px',
  minHeight: 64,
}));

const DrawerSpacer = styled('div')(({ theme }) => ({
  minWidth: theme.spacing(7),
  [theme.breakpoints.up('sm')]: {
    minWidth: theme.spacing(9),
  },
}));

const DrawerButton = styled(ListItem)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  minHeight: theme.spacing(6),
  [theme.breakpoints.down('sm')]: {
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

const TabsStyled = styled(Tabs)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.divider}`,
}));

const TabStyled = styled(Tab)(({ theme }) => ({
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
}));

const Content = styled('main')(({ theme }) => ({
  display: 'flex',
  flexGrow: 1,
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const ContainerStyled = styled(Container)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(0),
  overflowY: 'auto',
}));

const TabPanel = styled('div')({
  display: 'flex',
  height: '100%',
});

function TransitionUp(props: any) {
  return <Slide {...props} direction="up" />;
}

class ConfigForm extends React.Component {
  readonly props: {
    config: Config,
    library: Array<LibrarySource>,
    scenes: Array<Scene>,
    sceneGrids: Array<SceneGrid>,
    tags: Array<Tag>,
    theme: Theme,
    goBack(): void,
    onBackup(): void,
    onChangeThemeColor(colorTheme: any, primary: boolean): void,
    onClean(): void,
    onDefault(): void,
    onResetTutorials(): void,
    onRestore(backupFile: string): void,
    onToggleDarkMode(): void,
    onUpdateConfig(config: Config): void,
  };

  readonly state = {
    changeMade: false,
    config: deepClone(this.props.config),
    drawerOpen: false,
    openMenu: null as string,
    openTab: 2,
    errorSnackOpen: false,
    errorSnack: null as string,
  };

  render() {
    const open = this.state.drawerOpen;
    const { theme } = this.props;

    return (
      <Root>

        <AppBarStyled position="absolute">
          <Toolbar sx={{ height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
            <Tooltip disableInteractive title="Back" placement="right-end">
              <IconButton
                edge="start"
                color="inherit"
                aria-label="Back"
                onClick={this.goBack.bind(this)}
                size="large">
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>

            <Fill />
            <Title variant="h4" color="inherit" noWrap>
              Settings
            </Title>
            <Fill />

            <Tooltip disableInteractive title="Confirm Settings">
              <IconButton
                edge="start"
                color="inherit"
                aria-label="Confirm"
                onClick={this.onConfirmConfig.bind(this)}
                size="large">
                <CheckCircleIcon fontSize="large" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBarStyled>

        <Drawer
          sx={{ position: 'absolute' }}
          variant="permanent"
          slotProps={{
            paper: {
              sx: (theme: Theme) => ({
                position: 'relative',
                whiteSpace: 'nowrap',
                overflowX: 'hidden',
                height: '100vh',
                width: drawerWidth,
                zIndex: theme.zIndex.drawer + 2,
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
                ...(!open && {
                  transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                  }),
                  zIndex: theme.zIndex.drawer,
                  width: theme.spacing(7),
                  [theme.breakpoints.up('sm')]: {
                    width: theme.spacing(9),
                  },
                }),
              }),
            },
          }}
          open={this.state.drawerOpen}>
          <Box sx={!open ? {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 8px',
            minHeight: 64,
          } : {}}>
            <Collapse in={!open}>
              <AppBarSpacer />
            </Collapse>
          </Box>

          <DrawerButton>
            <IconButton onClick={this.onToggleDrawer.bind(this)} size="large">
              <MenuIcon sx={{ color: 'primary.contrastText' }} />
            </IconButton>
          </DrawerButton>

          <Divider />

          <div>
            <TabsStyled
              orientation="vertical"
              value={this.state.openTab}
              onChange={this.onChangeTab.bind(this)}
              aria-label="scene detail tabs">
              <TabStyled
                id="vertical-tab-0"
                aria-controls="vertical-tabpanel-0"
                icon={<BuildIcon/>} label={open ? "Default Options" : ""}
                sx={!open ? (theme: Theme) => ({
                  minWidth: 0,
                  transition: theme.transitions.create(['width', 'margin'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                  }),
                  width: theme.spacing(7),
                  [theme.breakpoints.up('sm')]: {
                    width: theme.spacing(9),
                  },
                }) : undefined}
              />
              <TabStyled
                id="vertical-tab-1"
                aria-controls="vertical-tabpanel-1"
                icon={<PhotoFilterIcon/>} label={open ? "Default Effects" : ""}
                sx={!open ? (theme: Theme) => ({
                  minWidth: 0,
                  transition: theme.transitions.create(['width', 'margin'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                  }),
                  width: theme.spacing(7),
                  [theme.breakpoints.up('sm')]: {
                    width: theme.spacing(9),
                  },
                }) : undefined}
              />
              <TabStyled
                id="vertical-tab-2"
                aria-controls="vertical-tabpanel-2"
                icon={<SettingsIcon/>} label={open ? "General Settings" : ""}
                sx={!open ? (theme: Theme) => ({
                  minWidth: 0,
                  transition: theme.transitions.create(['width', 'margin'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                  }),
                  width: theme.spacing(7),
                  [theme.breakpoints.up('sm')]: {
                    width: theme.spacing(9),
                  },
                }) : undefined}
              />
            </TabsStyled>
          </div>
          <Fill />

          <div>
            <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Reset Tutorials"}>
              <ListItemButton
                disabled={
                  this.props.config.tutorials.scenePicker == null &&
                  this.props.config.tutorials.sceneDetail == null &&
                  this.props.config.tutorials.player == null &&
                  this.props.config.tutorials.library == null &&
                  this.props.config.tutorials.audios == null &&
                  this.props.config.tutorials.scripts == null &&
                  this.props.config.tutorials.scriptor == null &&
                  this.props.config.tutorials.sceneGenerator == null &&
                  this.props.config.tutorials.sceneGrid == null &&
                  this.props.config.tutorials.videoClipper == null
                }
                onClick={this.props.onResetTutorials.bind(this)}
                sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <LiveHelpIcon color="error"/>
                </ListItemIcon>
                <ListItemText primary="Reset Tutorials" />
              </ListItemButton>
            </Tooltip>
            <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Restore Defaults"}>
              <ListItemButton onClick={this.onRestoreDefaults.bind(this)}
                        sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <RestoreIcon color="error"/>
                </ListItemIcon>
                <ListItemText primary="Restore Defaults" />
              </ListItemButton>
            </Tooltip>
            <Dialog
              open={this.state.openMenu == MO.deleteAlert}
              onClose={this.onCloseDialog.bind(this)}
              aria-labelledby="delete-title"
              aria-describedby="delete-description">
              <DialogTitle id="Delete-title">Restore Defaults</DialogTitle>
              <DialogContent>
                <DialogContentText id="delete-description">
                  Are you sure you want to restore all settings to their defaults?
                  This will also reset any configured APIs.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
                  Cancel
                </Button>
                <Button onClick={this.onFinishRestoreDefaults.bind(this)} color="primary">
                  OK
                </Button>
              </DialogActions>
            </Dialog>
          </div>
        </Drawer>

        <Content>
          <AppBarSpacer />
          <ContainerStyled maxWidth={false}>

            {this.state.openTab === 0 && (
              <Typography component="div">
                <TabPanel>
                  <DrawerSpacer />
                  <Box p={2} sx={{ flexGrow: 1 }}>
                    <SceneOptions
                      allScenes={this.props.scenes}
                      allSceneGrids={this.props.sceneGrids}
                      scene={this.state.config.defaultScene}
                      tutorial=""
                      isConfig
                      onUpdateScene={this.onUpdateDefaultScene.bind(this)} />
                  </Box>
                </TabPanel>
              </Typography>
            )}

            {this.state.openTab === 1 && (
              <Typography component="div">
                <TabPanel>
                  <DrawerSpacer />
                  <Box p={2} sx={{ flexGrow: 1 }}>
                    <SceneEffects
                      easingControls={this.state.config.displaySettings.easingControls}
                      scene={this.state.config.defaultScene}
                      tutorial=""
                      onUpdateScene={this.onUpdateDefaultScene.bind(this)} />
                  </Box>
                </TabPanel>
              </Typography>
            )}

            {this.state.openTab === 2 && (
              <Typography component="div">
                <TabPanel>
                  <DrawerSpacer />
                  <Box p={2} sx={{ flexGrow: 1 }}>
                    <GeneralConfig
                      config={this.state.config}
                      library={this.props.library}
                      tags={this.props.tags}
                      theme={this.props.theme}
                      onBackup={this.props.onBackup.bind(this)}
                      onChangeThemeColor={this.props.onChangeThemeColor.bind(this)}
                      onClean={this.props.onClean.bind(this)}
                      onPortableOverride={this.onPortableOverride.bind(this)}
                      onRestore={this.onRestore.bind(this)}
                      onToggleDarkMode={this.props.onToggleDarkMode.bind(this)}
                      onUpdateCachingSettings={this.onUpdateCachingSettings.bind(this)}
                      onUpdateConfig={this.onUpdateConfig.bind(this)}
                      onUpdateGeneralSettings={this.onUpdateGeneralSettings.bind(this)}
                      onUpdateDisplaySettings={this.onUpdateDisplaySettings.bind(this)}
                      onUpdateRemoteSettings={this.onUpdateRemoteSettings.bind(this)} />
                  </Box>
                </TabPanel>
              </Typography>
            )}

          </ContainerStyled>
        </Content>

        <Dialog
          open={this.state.openMenu == MO.error}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="back-title"
          aria-describedby="back-description">
          <DialogTitle id="back-title">Save Changes?</DialogTitle>
          <DialogContent>
            <DialogContentText id="back-description">
              You have unsaved changes. Would you like to save?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.props.goBack.bind(this)} color="inherit">
              Back - Don't Save
            </Button>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onConfirmConfig.bind(this)} color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={this.state.errorSnackOpen}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          autoHideDuration={20000}
          onClose={this.onCloseErrorSnack.bind(this)}
          TransitionComponent={TransitionUp}>
          <Alert onClose={this.onCloseErrorSnack.bind(this)} severity="error">
            Error: {this.state.errorSnack}
          </Alert>
        </Snackbar>
      </Root>
    );
  }

  componentDidUpdate(props: any, state: any) {
    if (this.props.config !== props.config) {
      this.setState({config: deepClone(this.props.config)});
    }
  }

  goBack() {
    if (this.state.changeMade) {
      this.setState({openMenu: MO.error});
    } else {
      this.props.goBack();
    }
  }

  onConfirmConfig() {
    if (this.applyConfig()) this.props.goBack();
  }

  applyConfig(): boolean {
    const errorMessage = this.validate();
    if (errorMessage.length == 0) {
      this.props.onUpdateConfig(this.state.config);
      return true;
    } else {
      console.error(errorMessage);
      this.setState({errorSnackOpen: true, errorSnack: errorMessage});
      return false;
    }
  }

  validate(): string {
    let errorMessages = "";
    if (this.state.config.caching.directory != "" &&
      !fs.existsSync(this.state.config.caching.directory)) {
      errorMessages = "Invalid Cache Directory";
    }
    return errorMessages;
  }

  onPortableOverride() {
    this.onRestore(portablePath);
  }

  onRestore(backupFile: string) {
    this.setState({changeMade: false});
    this.props.onRestore(backupFile);
  }

  onUpdateConfig(fn: (config: Config) => void) {
    const newConfig = deepClone(this.state.config);
    fn(newConfig);
    this.props.onUpdateConfig(newConfig);
    this.setState({config: newConfig, changeMade: false});
  }

  onUpdateDefaultScene(defualtScene: SceneSettings, fn: (settings: SceneSettings) => void) {
    const newConfig = this.state.config;
    fn(newConfig.defaultScene);
    this.setState({config: newConfig, changeMade: true});
  }

  onUpdateGeneralSettings(fn: (keys: GeneralSettings) => void) {
    const newConfig = this.state.config;
    fn(newConfig.generalSettings);
    this.setState({config: newConfig, changeMade: true});
  }

  onUpdateDisplaySettings(fn: (keys: DisplaySettings) => void) {
    const newConfig = this.state.config;
    fn(newConfig.displaySettings);
    this.setState({config: newConfig, changeMade: true});
  }

  onUpdateCachingSettings(fn: (settings: CacheSettings) => void) {
    const newConfig = this.state.config;
    fn(newConfig.caching);
    this.setState({config: newConfig, changeMade: true});
  }

  onUpdateRemoteSettings(fn: (keys: RemoteSettings) => void) {
    const newConfig = this.state.config;
    fn(newConfig.remoteSettings);
    this.setState({config: newConfig});
  }

  onToggleDrawer() {
    this.setState({drawerOpen: !this.state.drawerOpen});
  }

  onChangeTab(e: any, newTab: number) {
    this.setState({openTab: newTab});
  }

  onRestoreDefaults() {
    this.setState({openMenu: MO.deleteAlert});
  }

  onFinishRestoreDefaults() {
    this.props.onDefault();
  }

  onCloseDialog() {
    this.setState({openMenu: null, drawerOpen: false});
  }

  onCloseErrorSnack() {
    this.setState({errorSnackOpen: false});
  }
}

(ConfigForm as any).displayName="ConfigForm";
export default ConfigForm;
