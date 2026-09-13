import * as React from "react";
import * as fs from "fs";
import * as remote from "@electron/remote";

import {
  AppBar,
  Backdrop,
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
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
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled, Theme } from "@mui/material/styles";

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DescriptionIcon from '@mui/icons-material/Description';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import GetAppIcon from '@mui/icons-material/GetApp';
import HttpIcon from '@mui/icons-material/Http';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import MenuIcon from'@mui/icons-material/Menu';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ShuffleIcon from "@mui/icons-material/Shuffle";
import SortIcon from '@mui/icons-material/Sort';

import {AF, MO, SF, SP, SLT} from "../../data/const";
import {getFilesRecursively, isText} from "../../data/utils";
import en from "../../data/en";
import Tag from "../../data/Tag";
import LibrarySearch from "./LibrarySearch";
import CaptionScript from "../../data/CaptionScript";
import ScriptSourceList from "./ScriptSourceList";
import Scene from "../../data/Scene";

const drawerWidth = 240;

class ScriptLibrary extends React.Component {
  readonly props: {
    allScenes: Array<Scene>,
    filters: Array<string>,
    library: Array<CaptionScript>,
    selected: Array<string>,
    specialMode: string,
    tags: Array<Tag>,
    tutorial: string,
    yOffset: number,
    goBack(): void,
    onBatchTag(): void,
    onEditScript(source: CaptionScript): void,
    onImportFromLibrary(sources: Array<CaptionScript>): void,
    onImportToScriptor(source: CaptionScript): void,
    onManageTags(): void,
    onPlay(source: CaptionScript, sceneID: string, displayed: Array<CaptionScript>): void,
    onSort(algorithm: string, ascending: boolean): void,
    onTutorial(tutorial: string): void,
    onUpdateLibrary(fn: (library: Array<CaptionScript>) => void): void,
    onUpdateMode(mode: string): void,
    onUpdateScript(script: CaptionScript): void,
    savePosition(yOffset: number, filters:Array<string>, selected: Array<string>): void,
    systemMessage(message: string): void,
  };

  readonly state = {
    displaySources: Array<CaptionScript>(),
    drawerOpen: false,
    filters: this.props.filters,
    selected: this.props.selected,
    selectedTags: Array<string>(),
    menuAnchorEl: null as any,
    openMenu: null as string,
  };

  render() {
    const open = this.state.drawerOpen;

    return (
      <Box sx={{ display: 'flex' }}>
        <AppBar position="absolute"
          sx={(theme) => ({
            zIndex: theme.zIndex.drawer + 1,
            ...(this.props.tutorial == SLT.toolbar && {
              zIndex: theme.zIndex.modal + 1,
              pointerEvents: 'none',
            }),
          })}>
          <Toolbar sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexWrap: 'nowrap', minHeight: 64, height: (theme: Theme) => theme.mixins.toolbar.minHeight }}>
            <Box sx={{ flexBasis: '20%' }}>
              <Tooltip disableInteractive title={this.props.specialMode == SP.select || this.props.specialMode == SP.selectSingle ?
                "Cancel Import" : "Back"} placement="right-end">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  sx={{ float: 'left' }}
                  onClick={this.goBack.bind(this)}
                  size="large">
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography component="h1" variant="h4" color="inherit" noWrap
                        sx={{ textAlign: 'center', flexGrow: 1 }}>
              Caption Script Library
            </Typography>

            <Box sx={{ flexBasis: '20%', justifyContent: 'flex-end', display: 'flex' }}>
              <Box sx={(theme) => ({
                float: 'right', display: 'flex', maxWidth: '100%',
                ...(this.props.tutorial == SLT.toolbar && {
                  borderWidth: 2,
                  borderColor: theme.palette.secondary.main,
                  borderStyle: 'solid',
                }),
              })}>
                {this.props.library.length > 0 && (
                  <Chip
                    sx={(theme) => ({ color: theme.palette.primary.contrastText, marginTop: 3, marginRight: theme.spacing(1) })}
                    label={this.props.library.length}
                    size='medium'
                    variant='outlined'/>
                )}
                {this.state.filters.length > 0 && (
                  <Chip
                    sx={{ marginTop: 3, marginRight: 1 }}
                    label={this.state.displaySources.length}
                    size='medium'/>
                )}
                <LibrarySearch
                  displaySources={this.state.displaySources}
                  filters={this.state.filters}
                  tags={this.props.tags}
                  placeholder={"Search ..."}
                  isCreatable
                  onlyUsed
                  noTypes
                  onUpdateFilters={this.onUpdateFilters.bind(this)}/>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        <Drawer
          sx={(theme) => ({
            position: 'absolute',
            ...((this.props.tutorial == SLT.sidebar1 || this.props.tutorial == SLT.sidebar2 || this.state.drawerOpen) && {
              zIndex: theme.zIndex.modal + 1,
            }),
            ...(this.props.tutorial == SLT.sidebar2 && {
              borderWidth: 2,
              borderColor: theme.palette.secondary.main,
              borderStyle: 'solid',
            }),
          })}
          variant="permanent"
          slotProps={{
            paper: {
              sx: (theme) => ({
                position: 'relative',
                whiteSpace: 'nowrap',
                overflowX: 'hidden',
                height: '100vh',
                width: this.props.specialMode ? 0 : (open ? drawerWidth : theme.spacing(7)),
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: this.props.specialMode ? theme.transitions.duration.leavingScreen : (open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen),
                }),
                ...(!this.props.specialMode && {
                  [theme.breakpoints.up('sm')]: {
                    width: open ? drawerWidth : theme.spacing(9),
                  },
                }),
              }),
            },
          }}
          open={this.state.drawerOpen}>
          <Box sx={!open ? { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 8px', minHeight: 64 } : undefined}>
            <Collapse in={!open}>
              <Box sx={(theme) => ({ backgroundColor: theme.palette.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 8px', minHeight: 64 })} />
            </Collapse>
          </Box>

          <ListItem sx={(theme) => ({ backgroundColor: theme.palette.primary.main, minHeight: theme.spacing(6), [theme.breakpoints.down('sm')]: { paddingLeft: 0, paddingRight: 0 } })}>
            <IconButton
              sx={(theme) => ({
                ...(this.props.tutorial == SLT.sidebar1 && {
                  borderWidth: 2,
                  borderColor: theme.palette.secondary.main,
                  borderStyle: 'solid',
                }),
              })}
              onClick={this.onToggleDrawer.bind(this)}
              size="large">
              <MenuIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })}/>
            </IconButton>
          </ListItem>

          <Divider />

          <Box sx={(theme) => ({
            ...(this.props.tutorial != null && { pointerEvents: 'none' }),
          })}>
            <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Manage Tags"}>
              <ListItemButton onClick={this.props.onManageTags.bind(this)}>
                <ListItemIcon>
                  <LocalOfferIcon />
                </ListItemIcon>
                <ListItemText primary="Manage Tags" />
                {this.props.tags.length > 0 && (
                  <Chip
                    sx={(theme) => ({
                      transition: theme.transitions.create(['opacity'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                      }),
                      ...(!open && {
                        opacity: 0,
                        transition: theme.transitions.create(['opacity'], {
                          easing: theme.transitions.easing.sharp,
                          duration: theme.transitions.duration.leavingScreen,
                        }),
                      }),
                    })}
                    label={this.props.tags.length}
                    color='primary'
                    size='small'
                    variant='outlined'/>
                )}
              </ListItemButton>
            </Tooltip>
            <Tooltip disableInteractive title={this.state.drawerOpen ? "" : "Batch Tag"}>
              <ListItemButton onClick={this.onBatchTag.bind(this)}>
                <ListItemIcon>
                  <FormatListBulletedIcon />
                </ListItemIcon>
                <ListItemText primary="Batch Tag" />
              </ListItemButton>
            </Tooltip>
          </Box>
        </Drawer>

        <Box
          component="main"
          sx={(theme) => ({
            display: 'flex',
            flexGrow: 1,
            flexDirection: 'column',
            height: '100vh',
            backgroundColor: theme.palette.background.default,
          })}>
          <Box sx={(theme) => ({ backgroundColor: theme.palette.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 8px', minHeight: 64 })} />
          <Box sx={{ display: 'flex', flexGrow: 1 }}>
            {!this.props.specialMode &&  (
              <Box sx={(theme) => ({
                width: theme.spacing(7),
                [theme.breakpoints.up('sm')]: {
                  width: theme.spacing(9),
                },
              })}/>
            )}
            <Container maxWidth={false} sx={(theme) => ({
              padding: theme.spacing(0),
              overflow: 'hidden',
              flexGrow: 1,
              position: 'relative',
              ...(this.state.displaySources.length > 0 && { display: 'flex' }),
            })}>
              <ScriptSourceList
                specialMode={this.props.specialMode}
                library={this.props.library}
                scenes={this.props.allScenes}
                selected={this.state.selected}
                showHelp={!this.props.specialMode && this.state.filters.length == 0}
                tutorial={this.props.tutorial}
                sources={this.state.displaySources}
                yOffset={this.props.yOffset}
                onEditScript={this.props.onEditScript}
                onPlay={this.props.onPlay.bind(this)}
                onUpdateSelected={this.onUpdateSelected.bind(this)}
                onUpdateLibrary={this.props.onUpdateLibrary.bind(this)}
                onUpdateScript={this.props.onUpdateScript.bind(this)}
                savePosition={this.savePosition.bind(this)}
                systemMessage={this.props.systemMessage.bind(this)}/>
            </Container>
          </Box>
        </Box>

        <Backdrop
          sx={(theme) => ({ zIndex: theme.zIndex.modal, height: '100%', width: '100%' })}
          onClick={this.onCloseDialog.bind(this)}
          open={this.props.tutorial == null && (this.state.openMenu == MO.new || this.state.drawerOpen)} />

        {this.props.specialMode && (
          <React.Fragment>
            <Tooltip disableInteractive title="Clear"  placement="top-end">
              <Fab
                sx={(theme) => ({
                  backgroundColor: theme.palette.secondary.light,
                  margin: 0,
                  top: 'auto',
                  right: 180,
                  bottom: 20,
                  left: 'auto',
                  position: 'fixed',
                })}
                onClick={this.onSelectNone.bind(this)}
                size="small">
                <ClearIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
              </Fab>
            </Tooltip>
            <Tooltip disableInteractive title="Select All"  placement="top-end">
              <Fab
                sx={(theme) => ({
                  backgroundColor: theme.palette.secondary.dark,
                  margin: 0,
                  top: 'auto',
                  right: 130,
                  bottom: 20,
                  left: 'auto',
                  position: 'fixed',
                })}
                onClick={this.onSelectAll.bind(this)}
                size="medium">
                <SelectAllIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
              </Fab>
            </Tooltip>
            <Tooltip disableInteractive title={this.props.specialMode == SP.batchTag ? "Batch Tag" : "Import"}  placement="top-end">
              <Badge
                slotProps={{
                  badge: {
                    sx: (theme) => ({
                      top: 'auto',
                      right: 30,
                      bottom: 50,
                      left: 'auto',
                      position: 'fixed',
                      zIndex: theme.zIndex.fab + 1,
                    }),
                  },
                }}
                overlap="circular"
                color="secondary"
                badgeContent={this.state.selected.length}
                max={999}>
                <Fab
                  sx={(theme) => ({
                    backgroundColor: theme.palette.primary.dark,
                    margin: 0,
                    top: 'auto',
                    right: 20,
                    bottom: 20,
                    left: 'auto',
                    position: 'fixed',
                  })}
                  disabled={this.state.selected.length == 0}
                  onClick={this.props.specialMode == SP.batchTag ? this.onToggleBatchTagModal.bind(this) :
                    this.props.specialMode == SP.select ? this.onImportFromLibrary.bind(this) : this.onImportSingleFromLibrary.bind(this)}
                  size="large">
                  {(this.props.specialMode == SP.select || this.props.specialMode == SP.selectSingle) && (
                    <GetAppIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
                  )}
                  {this.props.specialMode == SP.batchTag && (
                    <LocalOfferIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
                  )}
                </Fab>
              </Badge>
            </Tooltip>
          </React.Fragment>
        )}

        {!this.props.specialMode && (
          <React.Fragment>
            {this.props.library.length > 0 && (
              <Tooltip disableInteractive title={this.state.filters.length == 0 ? "Delete All Sources" : "Delete These Sources"}  placement="left">
                <Fab
                  sx={(theme) => ({
                    backgroundColor: theme.palette.error.main,
                    margin: 0,
                    top: 'auto',
                    right: 130,
                    bottom: 20,
                    left: 'auto',
                    position: 'fixed',
                  })}
                  onClick={this.onRemoveAll.bind(this)}
                  size="small">
                  <DeleteSweepIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
                </Fab>
              </Tooltip>
            )}
            <Dialog
              open={this.state.openMenu == MO.removeAllAlert}
              onClose={this.onCloseDialog.bind(this)}
              aria-labelledby="remove-all-title"
              aria-describedby="remove-all-description">
              {this.state.filters.length == 0 && (
                <React.Fragment>
                  <DialogTitle id="remove-all-title">Delete Caption Script Library</DialogTitle>
                  <DialogContent>
                    <DialogContentText id="remove-all-description">
                      Are you sure you really wanna delete your entire caption script library...? ಠ_ಠ
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
                      Cancel
                    </Button>
                    <Button onClick={this.onFinishRemoveAll.bind(this)} color="primary">
                      Yea... I'm sure
                    </Button>
                  </DialogActions>
                </React.Fragment>
              )}
              {this.state.filters.length > 0 && (
                <React.Fragment>
                  <DialogTitle id="remove-all-title">Delete Sources</DialogTitle>
                  <DialogContent>
                    <DialogContentText id="remove-all-description">
                      Are you sure you want to remove these sources from your caption script library?
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
                      Cancel
                    </Button>
                    <Button onClick={this.onFinishRemoveVisible.bind(this)} color="primary">
                      Confirm
                    </Button>
                  </DialogActions>
                </React.Fragment>
              )}
            </Dialog>
            <Tooltip disableInteractive title={this.state.filters.length > 0 ? "" : "Local Script"}  placement="left">
              <Fab
                sx={(theme) => ({
                  backgroundColor: theme.palette.primary.main,
                  margin: 0,
                  top: 'auto',
                  right: 28,
                  bottom: 25,
                  left: 'auto',
                  position: 'fixed',
                  transition: theme.transitions.create('margin', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                  }),
                  marginBottom: '115px',
                  ...(this.state.openMenu != MO.new && {
                    marginBottom: 0,
                    transition: theme.transitions.create(['margin', 'opacity'], {
                      easing: theme.transitions.easing.sharp,
                      duration: theme.transitions.duration.leavingScreen + theme.transitions.duration.standard,
                    }),
                  }),
                  ...(this.state.openMenu == MO.new && {
                    zIndex: theme.zIndex.modal + 1,
                  }),
                  ...(this.state.filters.length > 0 && {
                    opacity: 0,
                    transition: theme.transitions.create(['margin', 'opacity'], {
                      easing: theme.transitions.easing.sharp,
                      duration: 100,
                    }),
                  }),
                })}
                disabled={this.state.filters.length > 0}
                onClick={this.onAddSource.bind(this, AF.script)}
                size="small">
                <DescriptionIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
              </Fab>
            </Tooltip>
            <Tooltip disableInteractive title={this.state.filters.length > 0 ? "" : "URL"}  placement="left">
              <Fab
                sx={(theme) => ({
                  backgroundColor: theme.palette.primary.main,
                  margin: 0,
                  top: 'auto',
                  right: 28,
                  bottom: 25,
                  left: 'auto',
                  position: 'fixed',
                  transition: theme.transitions.create('margin', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                  }),
                  marginBottom: '60px',
                  ...(this.state.openMenu != MO.new && {
                    marginBottom: 0,
                    transition: theme.transitions.create(['margin', 'opacity'], {
                      easing: theme.transitions.easing.sharp,
                      duration: theme.transitions.duration.leavingScreen + theme.transitions.duration.standard,
                    }),
                  }),
                  ...(this.state.openMenu == MO.new && {
                    zIndex: theme.zIndex.modal + 1,
                  }),
                  ...(this.state.filters.length > 0 && {
                    opacity: 0,
                    transition: theme.transitions.create(['margin', 'opacity'], {
                      easing: theme.transitions.easing.sharp,
                      duration: 100,
                    }),
                  }),
                })}
                disabled={this.state.filters.length > 0}
                onClick={this.onAddSource.bind(this, AF.url)}
                size="small">
                <HttpIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
              </Fab>
            </Tooltip>
            <Fab
              sx={(theme) => ({
                backgroundColor: theme.palette.primary.dark,
                margin: 0,
                top: 'auto',
                right: 20,
                bottom: 20,
                left: 'auto',
                position: 'fixed',
                ...(this.state.openMenu == MO.new && {
                  zIndex: theme.zIndex.modal + 1,
                }),
              })}
              disabled={this.state.filters.length > 0}
              onClick={this.onToggleNewMenu.bind(this)}
              size="large">
              <AddIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
            </Fab>
          </React.Fragment>
        )}

        <Fab
          disabled={this.props.library.length < 2}
          sx={(theme) => ({
            backgroundColor: theme.palette.secondary.dark,
            margin: 0,
            top: 'auto',
            right: 80,
            bottom: 20,
            left: 'auto',
            position: 'fixed',
          })}
          aria-haspopup="true"
          aria-controls="sort-menu"
          aria-label="Sort Sources"
          onClick={this.onOpenSortMenu.bind(this)}
          size="medium">
          <SortIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
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
          slotProps={{
            paper: {
              sx: { width: 200 },
            },
          }}
          open={this.state.openMenu == MO.sort}
          onClose={this.onCloseDialog.bind(this)}>
          {[SF.alpha, SF.alphaFull, SF.date].map((sf) =>
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

        <Dialog
          slotProps={{
            paper: {
              sx: { overflow: 'visible' },
            },
          }}
          open={this.state.openMenu == MO.batchTag}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="batch-tag-title"
          aria-describedby="batch-tag-description">
          <DialogTitle id="batch-tag-title">Batch Tag</DialogTitle>
          <DialogContent sx={{ overflow: 'visible' }}>
            <DialogContentText id="batch-tag-description">
              Choose tags to add, remove, or overwrite on the selected source(s)
            </DialogContentText>
            {this.state.openMenu == MO.batchTag &&
            <LibrarySearch
              displaySources={this.props.library}
              filters={this.state.selectedTags}
              tags={this.props.tags}
              placeholder={"Tag These Sources"}
              isClearable
              onlyTags
              showCheckboxes
              hideSelectedOptions={false}
              onUpdateFilters={this.onSelectTags.bind(this)}/>
            }
          </DialogContent>
          <DialogActions>
            <Button disabled={this.state.selectedTags && this.state.selectedTags.length == 0}
                    onClick={this.batchTagRemove.bind(this)} color="secondary">
              - Remove
            </Button>
            <Button disabled={this.state.selectedTags && this.state.selectedTags.length == 0}
                    onClick={this.batchTagAdd.bind(this)} color="secondary">
              + Add
            </Button>
            <Button onClick={this.batchTagOverwrite.bind(this)} color="primary">
              Overwrite
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  componentDidMount() {
    this.setState({displaySources: this.getDisplaySources()});
    window.addEventListener('keydown', this.onKeyDown, false);
  }

  componentDidUpdate(props: any, state: any) {
    if (state.filters != this.state.filters || props.library != this.props.library) {
      this.setState({displaySources: this.getDisplaySources()});
    }
    if (this.props.tutorial == SLT.final && this.state.drawerOpen) {
      this.setState({drawerOpen: false});
    }
  }

  componentWillUnmount() {
    this.savePosition();
    window.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (e: KeyboardEvent) => {
    if (!e.shiftKey && !e.ctrlKey && e.altKey && (e.key == 'm' || e.key == 'µ')) {
      this.toggleMarked();
    } else if (e.shiftKey && !e.ctrlKey && e.altKey && (e.key == 'M' || e.key == 'µ')) {
      this.addMarked();
    } else if (e.shiftKey && e.ctrlKey && e.altKey && (e.key == 'M' || e.key == 'µ')) {
      this.removeMarked();
    } else if (e.key == 'Escape' && this.props.specialMode != null) {
      this.goBack();
    }
  };

  onBatchTag() {
    this.onCloseDialog();
    this.props.onBatchTag();
  }

  goBack() {
    if (this.props.specialMode == SP.batchTag) {
      this.setState({selected: [], selectedTags: []});
      this.props.onBatchTag();
    } else {
      this.props.goBack();
    }
  }

  onUpdateFilters(filters: Array<string>) {
    this.setState({filters: filters, displaySources: this.getDisplaySources()});
  }

  onAddSource(type: string, e: MouseEvent) {
    this.onCloseDialog();
    switch (type) {
      case AF.url:
        const originalSources = Array.from(this.props.library);
        let id = originalSources.length + 1;
        originalSources.forEach((s) => {
          id = Math.max(s.id + 1, id);
        });
        originalSources.unshift(new CaptionScript({
          url: "",
          id: id,
          tags: [],
        }));
        this.props.onUpdateLibrary((l) => {
          l.splice(0, l.length);
          l.push(...originalSources);
        });
        break;
      case AF.script:
        (async () => {
          let aResult = new Array<string>();
          if (e.shiftKey) {
            const adResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(),
              {filters: [{name:'All Files (*.*)', extensions: ['*']}], properties: ['openDirectory', 'multiSelections']});
            if (adResult.canceled || !adResult.filePaths.length) return;
            for (let path of adResult.filePaths) {
              if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
                aResult = aResult.concat(getFilesRecursively(path));
              } else {
                aResult.push(path);
              }
            }
          } else {
            const fileResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(),
              {filters: [{name: 'All Files (*.*)', extensions: ['*']}, {name: 'Text files', extensions: ['txt']}], properties: ['openFile', 'multiSelections']});
            if (fileResult.canceled || !fileResult.filePaths.length) return;
            aResult = fileResult.filePaths;
          }
          aResult = aResult.filter((r) => isText(r, true));
          this.setState({loadingSources: true});
          this.addScriptSources(aResult);
        })();
        break;
    }
  }

  addScriptSources(newSources: Array<string>) {
    const originalSources = Array.from(this.props.library);
    // dedup
    let sourceURLs = originalSources.map((s) => s.url);
    newSources = newSources.filter((s) => !sourceURLs.includes(s));

    let id = originalSources.length + 1;
    originalSources.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });

    for (let url of newSources) {
      if (fs.existsSync(url)) {
        const newText = new CaptionScript({
          url: url,
          id: id,
          tags: [],
        });
        id += 1;
        originalSources.unshift(newText);
      }
    }

    this.props.onUpdateLibrary((l) => {
      l.splice(0, l.length);
      l.push(...originalSources);
    });
  }

  onToggleBatchTagModal() {
    if (this.state.openMenu == MO.batchTag) {
      this.setState({openMenu: null, selectedTags: []});
    } else {
      this.setState({openMenu: MO.batchTag, selectedTags: this.getSelectedTags()});
    }
  }

  onSelectTags(selectedTags: Array<string>) {
    this.setState({selectedTags: selectedTags});
  }

  onToggleDrawer() {
    if (this.props.tutorial == SLT.sidebar1) {
      this.props.onTutorial(SLT.sidebar1);
    }
    this.setState({drawerOpen: !this.state.drawerOpen});
  }

  onToggleNewMenu() {
    this.setState({openMenu: this.state.openMenu == MO.new ? null : MO.new});
  }

  onOpenSortMenu(e: MouseEvent) {
    this.setState({menuAnchorEl: e.currentTarget, openMenu: MO.sort});
  }

  onCloseDialog() {
    this.setState({menuAnchorEl: null, openMenu: null, drawerOpen: false});
  }

  onRemoveAll() {
    this.setState({openMenu: MO.removeAllAlert});
  }

  onFinishRemoveAll() {
    this.props.onUpdateLibrary((l) => {
      l.splice(0, l.length);
    });
    this.onCloseDialog();
  }

  onFinishRemoveVisible() {
    this.props.onUpdateLibrary((l) => {
      const displayIDs = this.state.displaySources.map((s) => s.id);
      for (let i = l.length -1; i >= 0 ; i--) {
        if (displayIDs.includes(l[i].id)) {
          l.splice(i, 1);
        }
      }
    });
    this.onCloseDialog();
    this.setState({filters: []});
  }

  onImportFromLibrary() {
    const selected = this.state.selected;
    const sources = new Array<CaptionScript>();
    for (let url of selected) {
      const source = this.props.library.find((s) => s.url == url);
      if (source) {
        sources.push(source);
      }
    }
    this.props.onImportFromLibrary(sources);
  }

  onImportSingleFromLibrary() {
    for (let url of this.state.selected) {
      const source = this.props.library.find((s) => s.url == url);
      if (source) {
        this.props.onImportToScriptor(source);
        break;
      }
    }

  }

  onUpdateSelected(selected: Array<string>) {
    this.setState({selected: selected});
  }

  onSelectAll() {
    const displaySources = this.state.displaySources;
    const newSelected = Array.from(this.state.selected);
    for (let source of displaySources.map((s) => s.url)) {
      if (!newSelected.includes(source)) {
        newSelected.push(source);
      }
    }
    this.setState({selected: newSelected});
  }

  onSelectNone() {
    const displaySources = this.state.displaySources;
    let newSelected = Array.from(this.state.selected);
    for (let source of displaySources.map((s) => s.url)) {
      if (newSelected.includes(source)) {
        newSelected.splice(newSelected.indexOf(source), 1)
      }
    }
    this.setState({selected: newSelected});
  }

  savePosition() {
    const sortableList = document.getElementById("sortable-list");
    if (sortableList) {
      const scrollElement = sortableList.firstElementChild;
      const scrollTop = scrollElement ? scrollElement.scrollTop : 0;
      this.props.savePosition(scrollTop, this.state.filters, this.state.selected);
    }
  }

  toggleMarked(taggingMode?: boolean) {
    if (taggingMode == null) {
      taggingMode = this.props.library.find((s) => s.marked) == null;
    }

    if (taggingMode) { // We're marking sources
      this.props.onUpdateLibrary((l) => {
        for (let source of this.state.displaySources) {
          l.find((s) => s.id == source.id).marked = true;
        }
      });
    } else { // We're unmarking sources
      this.props.onUpdateLibrary((l) => {
        for (let source of l) {
          source.marked = false;
        }
      });
    }
  }

  addMarked() {
    this.toggleMarked(true);
  }

  removeMarked() {
    this.toggleMarked(false);
  }

  batchTagOverwrite() {
    this.props.onUpdateLibrary((l) => {
      for (let sourceURL of this.state.selected) {
        const source = l.find((s) => s.url === sourceURL);
        source.tags = new Array<Tag>();
        for (let tag of this.state.selectedTags) {
          source.tags.push(new Tag({name: tag, id: this.props.tags.find((t) => t.name == tag).id}));
        }
      }
    });
    this.onCloseDialog();
  }

  batchTagAdd() {
    this.props.onUpdateLibrary((l) => {
      for (let sourceURL of this.state.selected) {
        const source = l.find((s) => s.url === sourceURL);
        const sourceTags = source.tags.map((t) => t.name);
        for (let tag of this.state.selectedTags) {
          if (!sourceTags.includes(tag)) {
            source.tags.push(new Tag({name: tag, id: this.props.tags.find((t) => t.name == tag).id}));
          }
        }
      }
    });
    this.onCloseDialog();
  }

  batchTagRemove() {
    this.props.onUpdateLibrary((l) => {
      for (let sourceURL of this.state.selected) {
        const source = l.find((s) => s.url === sourceURL);
        const sourceTags = source.tags.map((t) => t.name);
        for (let tag of this.state.selectedTags) {
          if (sourceTags.includes(tag)) {
            const indexOf = sourceTags.indexOf(tag);
            source.tags.splice(indexOf, 1);
            sourceTags.splice(indexOf, 1);
          }
        }
      }
    });
    this.onCloseDialog();
  }

  getSelectedTags() {
    let tagSelectValue = new Array<string>();
    let commonTags = Array<Tag>();
    for (let sourceURL of this.state.selected) {
      const source = this.props.library.find((s) => s.url === sourceURL);
      const tags = source.tags;
      if (commonTags.length == 0) {
        commonTags = tags;
      } else {
        const tagNames = tags.map((t) => t.name);
        commonTags = commonTags.filter((t) => tagNames.includes(t.name));
      }

      if (commonTags.length == 0) break;
    }

    if (commonTags.length > 0) {
      tagSelectValue = commonTags.map((t) => t.name);
    }

    return tagSelectValue;
  }

  getDisplaySources() {
    let displaySources = [];
    const filtering = this.state.filters.length > 0;
    if (filtering) {
      for (let source of this.props.library) {
        let matchesFilter = true;
        let countRegex;
        for (let filter of this.state.filters) {
          if (filter == "<Marked>") { // This is a marked filter
            matchesFilter = source.marked;
          }else if (filter == "<Untagged>") { // This is untagged filter
            matchesFilter = source.tags.length === 0;
          } else if ((filter.startsWith("[") || filter.startsWith("-[")) && filter.endsWith("]")) { // This is a tag filter
            if (filter.startsWith("-")) {
              let tag = filter.substring(2, filter.length-1);
              matchesFilter = source.tags.find((t) => t.name == tag) == null;
            } else {
              let tag = filter.substring(1, filter.length-1);
              matchesFilter = source.tags.find((t) => t.name == tag) != null;
            }
          } else if (((filter.startsWith('"') || filter.startsWith('-"')) && filter.endsWith('"')) ||
            ((filter.startsWith('\'') || filter.startsWith('-\'')) && filter.endsWith('\''))) {
            if (filter.startsWith("-")) {
              filter = filter.substring(2, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(source.url);
            } else {
              filter = filter.substring(1, filter.length - 1);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(source.url);
            }
          } else { // This is a search filter
            filter = filter.replace("\\", "\\\\");
            if (filter.startsWith("-")) {
              filter = filter.substring(1, filter.length);
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = !regex.test(source.url);
            } else {
              const regex = new RegExp(filter.replace("\\", "\\\\"), "i");
              matchesFilter = regex.test(source.url);
            }
          }
          if (!matchesFilter) break;
        }
        if (matchesFilter) {
          displaySources.push(source);
        }
      }
    } else {
      displaySources = this.props.library;
    }
    return displaySources;
  }
}

(ScriptLibrary as any).displayName="ScriptLibrary";
export default ScriptLibrary;
