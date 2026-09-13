import * as React from "react";
import DraggableBase, {DraggableData} from "react-draggable";
const Draggable = DraggableBase as any;

import {styled, Theme} from "@mui/material/styles";

import {
  AppBar, Button, Container, Fab, FormControlLabel, IconButton, Menu, Switch, TextField, Toolbar, Tooltip,
  Typography,
} from "@mui/material";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

import {SGT} from "../../data/const";
import Scene from "../../data/Scene";
import SceneSelect from "../configGroups/SceneSelect";
import SceneGrid from "../../data/SceneGrid";
import SceneGridCell from "../../data/SceneGridCell";

const Root = styled('div')({
  display: 'flex',
  height: '100vh',
});

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  flexWrap: 'nowrap',
  minHeight: 64,
  height: theme.mixins.toolbar.minHeight,
}));

const HeaderLeft = styled('div')({
  flexBasis: '13%',
});

const HeaderRight = styled('div')({
  flexBasis: '13%',
  justifyContent: 'flex-end',
  display: 'flex',
});

const TitleField = styled('form')({
  margin: 0,
  textAlign: 'center',
  flexGrow: 1,
});

const AppBarSpacer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 8px',
  minHeight: 64,
}));

const Content = styled('main')(({ theme }) => ({
  display: 'flex',
  flexGrow: 1,
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
}));

const Grid = styled('div')({
  flexGrow: 1,
  display: 'grid',
  height: '100%',
});

const GridCell = styled(Button)({
  height: '100%',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'column',
});

const DeleteButton = styled(Fab)(({ theme }) => ({
  backgroundColor: theme.palette.error.dark,
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
  zIndex: 3,
}));

class GridSetup extends React.Component {
  readonly props: {
    allScenes: Array<Scene>,
    autoEdit: boolean,
    scene: SceneGrid,
    tutorial: string,
    goBack(): void,
    onDelete(grid: SceneGrid): void,
    onGenerate(scene: Scene | SceneGrid, children?: boolean, force?: boolean): void,
    onPlayGrid(grid: SceneGrid): void,
    onTutorial(tutorial: string): void,
    onUpdateGrid(grid: SceneGrid, fn: (grid: SceneGrid) => void): void,
  };

  readonly state = {
    isEditingName: this.props.autoEdit ? this.props.scene.name : null as string,
    isEditing: null as Array<number>,
    menuAnchorEl: null as any,
    height: this.props.scene.grid && this.props.scene.grid.length > 0 &&
    this.props.scene.grid[0].length ? this.props.scene.grid.length : 1,
    width: this.props.scene.grid && this.props.scene.grid.length > 0 &&
    this.props.scene.grid[0].length > 0 ? this.props.scene.grid[0].length : 1,
    dragging: false,
  };

  readonly nameInputRef: React.RefObject<HTMLInputElement> = React.createRef();

  _colors = ["#FF0000",
    "#FFA500",
    "#FFFF00",
    "#008000",
    "#0000FF",
    "#EE82EE",
    "#4B0082",
    "#800000",
    "#FF4500",
    "#7FFF00",
    "#7FFFD4",
    "#8B4513"]

  render() {
    const colSize = 100 / this.state.width;
    const rowSize = 100 / this.state.height;
    let gridTemplateColumns = "";
    let gridTemplateRows = "";
    for (let w = 0; w < this.state.width; w++) {
      gridTemplateColumns += colSize.toString() + "% ";
    }
    for (let h = 0; h < this.state.height; h++) {
      gridTemplateRows += rowSize.toString() + "% ";
    }

    let count = 0;
    let colors = Array<Array<string>>();
    for (let r = 0; r < this.state.height; r++) {
      let row = Array<string>();
      for (let c = 0; c < this.state.width; c++) {
        row.push("");
      }
      colors.push(row);
    }
    for (let r = 0; r < this.props.scene.grid.length; r++) {
      for (let c = 0; c < this.props.scene.grid[r].length; c++) {
        const cell = this.props.scene.grid[r][c];
        if (cell.sceneCopy && cell.sceneCopy.length > 0) {
          let color = colors[cell.sceneCopy[0]][cell.sceneCopy[1]];
          if (color == "") {
            color = this._colors[count++];
            colors[cell.sceneCopy[0]][cell.sceneCopy[1]] = color;
          }
          colors[r][c] = color;
        }
      }
    }

    return (
      <Root>

        <StyledAppBar position="absolute"
          sx={this.props.tutorial == SGT.dimensions ? { zIndex: (theme) => theme.zIndex.modal + 1 } : undefined}>
          <StyledToolbar>
            <HeaderLeft>
              <Tooltip disableInteractive title="Back" placement="right-end">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  sx={this.props.tutorial == SGT.dimensions ? { pointerEvents: 'none' } : undefined}
                  onClick={this.goBack.bind(this)}
                  size="large">
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </HeaderLeft>

            {this.state.isEditingName != null && (
              <TitleField onSubmit={this.endEditingName.bind(this)}>
                <TextField
                  variant="standard"
                  autoFocus
                  fullWidth
                  id="title"
                  value={this.state.isEditingName}
                  margin="none"
                  ref={this.nameInputRef}
                  slotProps={{
                    htmlInput: {
                      sx: {
                        color: (theme) => theme.palette.primary.contrastText,
                        textAlign: 'center',
                        fontSize: (theme) => theme.typography.h4.fontSize,
                      },
                    },
                  }}
                  onBlur={this.endEditingName.bind(this)}
                  onChange={this.onChangeName.bind(this)} />
              </TitleField>
            )}
            {this.state.isEditingName == null && (
              <Typography component="h1" variant="h4" noWrap
                sx={[
                  { textAlign: 'center', flexGrow: 1 },
                  this.props.scene.name.length == 0 && { width: '33%', height: (theme) => theme.spacing(7) },
                  this.props.tutorial == SGT.dimensions && { pointerEvents: 'none' },
                ]}
                onClick={this.beginEditingName.bind(this)}>
                {this.props.scene.name}
              </Typography>
            )}

            <HeaderRight>
              <TextField
                label="Height"
                margin="dense"
                value={this.state.height}
                onChange={this.onHeightInput.bind(this)}
                onBlur={this.blurHeight.bind(this)}
                variant="filled"
                sx={[
                  {
                    '& .MuiInputBase-input': {
                      color: (theme) => `${theme.palette.primary.contrastText} !important`,
                      minWidth: (theme) => theme.spacing(6),
                    },
                    '& .MuiInputLabel-root': {
                      color: (theme) => `${theme.palette.primary.contrastText} !important`,
                      minWidth: (theme) => theme.spacing(6),
                    },
                  },
                  this.props.tutorial == SGT.dimensions && {
                    borderWidth: 2,
                    borderColor: (theme) => theme.palette.secondary.main,
                    borderStyle: 'solid',
                  },
                ]}
                inputProps={{
                  min: 1,
                  max: 5,
                  type: 'number',
                }}/>
              <TextField
                label="Width"
                margin="dense"
                value={this.state.width}
                onChange={this.onWidthInput.bind(this)}
                onBlur={this.blurWidth.bind(this)}
                variant="filled"
                sx={[
                  {
                    '& .MuiInputBase-input': {
                      color: (theme) => `${theme.palette.primary.contrastText} !important`,
                      minWidth: (theme) => theme.spacing(6),
                    },
                    '& .MuiInputLabel-root': {
                      color: (theme) => `${theme.palette.primary.contrastText} !important`,
                      minWidth: (theme) => theme.spacing(6),
                    },
                  },
                  this.props.tutorial == SGT.dimensions && {
                    borderWidth: 2,
                    borderColor: (theme) => theme.palette.secondary.main,
                    borderStyle: 'solid',
                  },
                ]}
                inputProps={{
                  min: 1,
                  max: 5,
                  type: 'number',
                }}/>
              <IconButton
                edge="end"
                color="inherit"
                aria-label="Play"
                sx={this.props.tutorial == SGT.dimensions ? { pointerEvents: 'none' } : undefined}
                onClick={this.onPlayGrid.bind(this)}
                size="large">
                <PlayCircleOutlineIcon fontSize="large"/>
              </IconButton>
            </HeaderRight>
          </StyledToolbar>
        </StyledAppBar>

        <Content>
          <AppBarSpacer />
          <Container maxWidth={false} sx={{ height: '100%', padding: 0 }}>
            <Grid style={{gridTemplateColumns: gridTemplateColumns, gridTemplateRows: gridTemplateRows}}>
              {this.props.scene.grid.map((row, rowIndex) =>
                <React.Fragment key={rowIndex}>
                  {row.map((cell, colIndex) => {
                    let scene = this.props.allScenes.find((s) => s.id == cell.sceneID);
                    let sceneCopy = null;
                    if (cell.sceneCopy && cell.sceneCopy.length > 0) {
                      sceneCopy = this.props.allScenes.find((s) => s.id == this.props.scene.grid[cell.sceneCopy[0]][cell.sceneCopy[1]].sceneID);
                    }
                    return (
                      <Draggable
                        key={colIndex}
                        bounds='#app'
                        position={{x:0,y:0}}
                        onStop={this.onDragStop.bind(this, rowIndex, colIndex)}
                        onDrag={this.onDrag.bind(this)}
                      >
                        <GridCell
                          id={rowIndex + "-" + colIndex}
                          style={(colors[rowIndex] == undefined || colors[rowIndex][colIndex] == undefined || colors[rowIndex][colIndex] == "") ? {} : {borderStyle: 'solid', borderWidth: 10, borderColor: colors[rowIndex][colIndex]}}
                          variant="outlined">
                          {scene ? scene.name : sceneCopy ? "*" + sceneCopy.name + "*" : ""}
                          {sceneCopy && (
                            <FormControlLabel
                              control={
                                <Switch size={"small"} checked={cell.mirror}/>
                              }
                              label="Mirror"/>
                          )}
                        </GridCell>
                      </Draggable>
                    );
                  })}
                </React.Fragment>
              )}
            </Grid>
            <Menu
              id="scene-menu"
              elevation={1}
              anchorOrigin={{
                vertical: 'center',
                horizontal: 'center',
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
              }}
              anchorEl={this.state.menuAnchorEl}
              keepMounted
              slotProps={{ paper: { sx: { minHeight: 365, minWidth: 250 } } }}
              open={!!this.state.isEditing}
              onClose={this.onCloseMenu.bind(this)}>
              {!!this.state.isEditing &&
                <SceneSelect
                  allScenes={this.props.allScenes}
                  value={this.props.scene.grid[this.state.isEditing[0]][this.state.isEditing[1]] as unknown as number}
                  menuIsOpen
                  autoFocus
                  onlyExtra
                  getSceneName={this.getSceneName.bind(this)}
                  onChange={this.onChooseScene.bind(this)}
                  />
              }
            </Menu>
            <DeleteButton
              onClick={this.props.onDelete.bind(this, this.props.scene)}
              size="small">
              <DeleteIcon sx={{ color: (theme) => theme.palette.error.contrastText }}/>
            </DeleteButton>
          </Container>
        </Content>
      </Root>
    );
  }

  componentDidUpdate() {
    if (this.props.tutorial == SGT.dimensions && this.state.width ==2 && this.state.height == 2) {
      this.props.onTutorial(SGT.dimensions);
      const sceneID = this.props.allScenes[0].id;
      const newGrid = this.props.scene.grid;
      newGrid[0][0].sceneID = sceneID;
      newGrid[0][1].sceneID = sceneID;
      newGrid[1][0].sceneID = sceneID;
      newGrid[1][1].sceneID = sceneID;
      this.changeKey('grid', newGrid);
    } else if (this.props.tutorial == SGT.cells) {
      let height = this.state.height;
      let width = this.state.width;
      let changed = false;
      if (this.props.scene.grid.length != height) {
        height = this.props.scene.grid.length;
        this.setState({height: height});
        changed = true;
      }
      if (this.props.scene.grid[0].length != width) {
        width = this.props.scene.grid[0].length;
        this.setState({width: width});
        changed = true;
      }
      if (changed && width == 2 && height == 2) {
        this.props.onTutorial(SGT.dimensions);
        const sceneID = this.props.allScenes[0].id;
        const newGrid = this.props.scene.grid;
        newGrid[0][0].sceneID = sceneID;
        newGrid[0][1].sceneID = sceneID;
        newGrid[1][0].sceneID = sceneID;
        newGrid[1][1].sceneID = sceneID;
        this.changeKey('grid', newGrid);
      }
    }
  }

  onChooseScene(sceneID: number) {
    const row = this.state.isEditing[0];
    const col = this.state.isEditing[1];
    let newGrid = this.props.scene.grid;
    newGrid[row][col].sceneID = sceneID;
    newGrid[row][col].sceneCopy = [];
    newGrid[row][col].mirror = false;
    if (sceneID == -1) {
      newGrid = newGrid.map((r) => r.map((c) => {
        if (c.sceneCopy && c.sceneCopy[0] === row && c.sceneCopy[1] === col) {
          c.sceneCopy = []
          c.mirror = false;
        }
        return c;
      }));
    }
    this.changeKey('grid', newGrid);
    this.onCloseMenu();
  }

  onCloseMenu() {
    this.setState({isEditing: null});
  }

  getNewGrid(height: number, width: number) {
    let grid = this.props.scene.grid;

    // Adjust height
    if (grid.length > height) {
      grid.splice(height, grid.length - height);
    } else if (grid.length < height) {
      const newRow = Array<SceneGridCell>(width);
      for (let c = 0; c < newRow.length; c++) {
        newRow[c] = new SceneGridCell();
      }
      grid.push(newRow);
    }
    // Adjust width
    for (let row of grid) {
      if (row.length > width) {
        row.splice(width, row.length - width);
      } else if (row.length < width) {
        while (row.length < width) {
          row.push(new SceneGridCell());
        }
      }
    }

    for (let row of grid) {
      for (let cell of row) {
        if (cell.sceneCopy.length > 0 && (cell.sceneCopy[0] > height - 1 || cell.sceneCopy[1] > width - 1)) {
          cell.sceneCopy = [];
          cell.mirror = false;
        }
      }
    }
    return grid;
  }

  onUpdateHeight(height: number) {
    const grid = this.getNewGrid(height, this.state.width);
    this.changeKey('grid', grid);
    this.setState({height: height});
  }

  onUpdateWidth(width: number) {
    const grid = this.getNewGrid(this.state.height, width);
    this.changeKey('grid', grid);
    this.setState({width: width});
  }

  onHeightInput(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    if (input.value === '') {
      this.onUpdateHeight(1);
    } else {
      this.onUpdateHeight(Number(input.value));
    }
  }

  blurHeight(e: MouseEvent) {
    const min = (e.currentTarget as any).min ? (e.currentTarget as any).min : null;
    const max = (e.currentTarget as any).max ? (e.currentTarget as any).max : null;
    if (min && this.state.height < min) {
      this.onUpdateHeight(min);
    } else if (max && this.state.height > max) {
      this.onUpdateHeight(max);
    }
  }

  onWidthInput(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    if (input.value === '') {
      this.onUpdateWidth(1);
    } else {
      this.onUpdateWidth(Number(input.value));
    }
  }

  blurWidth(e: MouseEvent) {
    const min = (e.currentTarget as any).min ? (e.currentTarget as any).min : null;
    const max = (e.currentTarget as any).max ? (e.currentTarget as any).max : null;
    if (min && this.state.width < min) {
      this.onUpdateWidth(min);
    } else if (max && this.state.width > max) {
      this.onUpdateWidth(max);
    }
  }

  onDrag() {
    if (!this.state.dragging) {
      this.setState({dragging: true});
    }
  }

  onDragStop(rowIndex: number, colIndex: number, e: MouseEvent, position: DraggableData) {
    if (this.state.dragging) {
      this.onDragDrop(rowIndex, colIndex , e, position);
    } else {
      this.onClickCell(rowIndex, colIndex, e);
    }
    this.setState({dragging: false});
  }

  onDragDrop(rowIndex: number, colIndex: number, e: any, position: DraggableData) {
    if (!e.path || e.path.length == 0) return;

    const newRowIndex = e.path[0].id.split("-")[0];
    const newColIndex = e.path[0].id.split("-")[1];
    if (rowIndex == newRowIndex && colIndex == newColIndex || this.props.scene.grid[rowIndex][colIndex].sceneID == -1) return;

    const newGrid = this.props.scene.grid;
    newGrid[newRowIndex][newColIndex].sceneID = -1;
    if (newGrid[rowIndex][colIndex].sceneCopy && newGrid[rowIndex][colIndex].sceneCopy.length > 0) {
      newGrid[newRowIndex][newColIndex].sceneCopy = newGrid[rowIndex][colIndex].sceneCopy;
    } else {
      newGrid[newRowIndex][newColIndex].sceneCopy = [rowIndex, colIndex];
    }
    this.changeKey('grid', newGrid);
  }

  onClickCell(rowIndex: number, colIndex: number, e: MouseEvent) {
    if ((e.target as Element).className?.includes("MuiSwitch-input")) {
      this.onToggleMirror(rowIndex, colIndex);
    } else {
      this.setState({menuAnchorEl: e.target, isEditing: [rowIndex, colIndex], reset: null});
    }
  }

  onToggleMirror(rowIndex: number, colIndex: number) {
    const newGrid = this.props.scene.grid;
    newGrid[rowIndex][colIndex].mirror = !newGrid[rowIndex][colIndex].mirror;
    this.changeKey('grid', newGrid);
  }

  beginEditingName() {
    this.setState({isEditingName: this.props.scene.name});
  }

  endEditingName(e: Event) {
    e.preventDefault();
    this.changeKey('name', this.state.isEditingName);
    this.setState({isEditingName: null});
  }

  onChangeName(e: React.FormEvent<HTMLInputElement>) {
    this.setState({isEditingName:  e.currentTarget.value});
  }

  changeKey(key: string, value: any) {
    this.update((s) => s[key] = value);
  }

  update(fn: (scene: any) => void) {
    this.props.onUpdateGrid(this.props.scene, fn);
  }

  goBack() {
    this.props.goBack();
  }

  onPlayGrid() {
    // Regenerate scene(s) before playback
    this.props.onGenerate(this.props.scene);
    this.props.onPlayGrid(this.props.scene);
  }

  getSceneName(id: string): string {
    if (id === "-1") return "~~EMPTY~~";
    const scene = this.props.allScenes.find((s) => s.id.toString() === id)
    return scene ? scene.name : "~~EMPTY~~";
  }
}

(GridSetup as any).displayName="GridSetup";
export default GridSetup;
