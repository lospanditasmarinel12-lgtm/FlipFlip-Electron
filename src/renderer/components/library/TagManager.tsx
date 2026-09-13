import * as React from "react";
import Sortable from "react-sortablejs";

import {
  AppBar,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  IconButton,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled } from "@mui/material/styles";

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SortIcon from '@mui/icons-material/Sort';

import {MO, SF} from "../../data/const";
import {arrayMove, deepClone, removeDuplicatesBy} from "../../data/utils";
import en from "../../data/en";
import Scene from "../../data/Scene";
import Tag from "../../data/Tag";
import Jiggle from "../../animations/Jiggle";

const Root = styled('div')({
  display: 'flex',
});

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
}));

const StyledAppBarSpacer = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 8px',
  minHeight: 64,
}));

const StyledBackButton = styled(IconButton)({
  float: 'left',
});

const StyledTitle = styled(Typography)({
  textAlign: 'center',
  flexGrow: 1,
});

const StyledHeaderBar = styled(Toolbar)({
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  flexWrap: 'nowrap',
});

const StyledHeaderLeft = styled('div')({
  flexBasis: '3%',
});

const StyledContent = styled('main')(({ theme }) => ({
  display: 'flex',
  flexGrow: 1,
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(0),
  overflowY: 'auto',
}));

const StyledSortable = styled(Sortable)(({ theme }) => ({
  padding: theme.spacing(1),
  display: 'flex',
  flexWrap: 'wrap',
}));

const StyledTag = styled(Card)(({ theme }) => ({
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const StyledAddMenuButton = styled(Fab)(({ theme }) => ({
  backgroundColor: theme.palette.primary.dark,
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}));

const StyledSortMenuButton = styled(Fab)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.dark,
  margin: 0,
  top: 'auto',
  right: 80,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}));

const StyledRemoveAllButton = styled(Fab)(({ theme }) => ({
  backgroundColor: theme.palette.error.main,
  margin: 0,
  top: 'auto',
  right: 130,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}));

const RootFill = styled('div')({
  display: 'flex',
  flexGrow: 1,
});

class TagManager extends React.Component {
  readonly props: {
    tags: Array<Tag>,
    goBack(): void,
    onSort(scene: Scene, algorithm: string, ascending: boolean): void,
    onUpdateTags(tags: Array<Tag>): void,
  };

  readonly state = {
    openMenu: null as string,
    menuAnchorEl: null as any,
    tags: Array<Tag>(),
    isEditing: -1,
    tagName: "",
    tagPhrase: "",
  };

  render() {
    return (
      <Root>
        <StyledAppBar position="absolute">
          <StyledHeaderBar>
            <StyledHeaderLeft>
              <Tooltip disableInteractive title="Back" placement="right-end">
                <StyledBackButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  onClick={this.goBack.bind(this)}
                  size="large">
                  <ArrowBackIcon />
                </StyledBackButton>
              </Tooltip>
            </StyledHeaderLeft>

            <StyledTitle variant="h4" color="inherit" noWrap>
              Tag Manager
            </StyledTitle>

            <StyledHeaderLeft/>
          </StyledHeaderBar>
        </StyledAppBar>

        <StyledContent>
          <StyledAppBarSpacer />

          <RootFill>
            <StyledContainer maxWidth={false}>
              <StyledSortable
                options={{
                  animation: 150,
                  easing: "cubic-bezier(1, 0, 0, 1)",
                }}
                onChange={(order: any, sortable: any, evt: any) => {
                  let newTags = Array.from(this.state.tags);
                  arrayMove(newTags, evt.oldIndex, evt.newIndex);
                  this.setState({tags: newTags});
                }}>
                {this.state.tags.map((tag) =>
                  <Jiggle key={tag.id + tag.name} bounce>
                    <StyledTag>
                      <CardActionArea onClick={this.onEditTag.bind(this, tag)}>
                        <CardContent>
                          <Typography component="h2" variant="h6">
                            {tag.name}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </StyledTag>
                  </Jiggle>
                )}
              </StyledSortable>
            </StyledContainer>
          </RootFill>
          <Dialog
            open={this.state.isEditing != -1}
            onClose={this.onCloseEditDialog.bind(this)}
            aria-labelledby="edit-title">
            <DialogTitle id="edit-title">Edit Tag</DialogTitle>
            <DialogContent>
              <TextField
                variant="standard"
                autoFocus
                fullWidth
                required
                label="Name"
                value={this.state.tagName}
                margin="dense"
                onChange={this.onChangeTitle.bind(this)} />
              <TextField
                variant="standard"
                fullWidth
                multiline
                label="Tag Phrases"
                helperText="These are used in place of $TAG_PHRASE for Caption scripts. One per line."
                id="phrase"
                value={this.state.tagPhrase}
                margin="dense"
                sx={{ '& .MuiInputBase-input': { minWidth: 200, minHeight: 100 } }}
                onChange={this.onChangePhrase.bind(this)} />
            </DialogContent>
            <DialogActions>
              <IconButton
                onClick={this.onRemoveTag.bind(this)}
                style={{marginRight: 'auto'}}
                size="large">
                <DeleteIcon color="error"/>
              </IconButton>
              <Button onClick={this.onCloseEditDialog.bind(this)} color="secondary">
                Cancel
              </Button>
              <Button disabled={!this.state.tagName} onClick={this.onFinishEdit.bind(this)} color="primary">
                OK
              </Button>
            </DialogActions>
          </Dialog>
        </StyledContent>

        {this.props.tags.length > 0 && (
          <React.Fragment>
            <Tooltip disableInteractive title="Remove All Tags">
              <StyledRemoveAllButton
                onClick={this.onRemoveAll.bind(this)}
                size="small">
                <DeleteSweepIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
              </StyledRemoveAllButton>
            </Tooltip>
            <Dialog
              open={this.state.openMenu == MO.removeAllAlert}
              onClose={this.onCloseDialog.bind(this)}
              aria-labelledby="remove-all-title"
              aria-describedby="remove-all-description">
              <DialogTitle id="remove-all-title">Delete Tags</DialogTitle>
              <DialogContent>
                <DialogContentText id="remove-all-description">
                  Are you sure you want to remove all Tags? This will untag all sources as well.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
                  Cancel
                </Button>
                <Button onClick={this.onFinishRemoveAll.bind(this)} color="primary">
                  OK
                </Button>
              </DialogActions>
            </Dialog>
          </React.Fragment>
        )}

        {this.props.tags.length >= 2 && (
          <React.Fragment>
            <StyledSortMenuButton
              aria-haspopup="true"
              aria-controls="sort-menu"
              aria-label="Sort Tags"
              onClick={this.onOpenSortMenu.bind(this)}
              size="medium">
              <SortIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
            </StyledSortMenuButton>
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
              slotProps={{ paper: { sx: { width: 200 } } }}
              open={this.state.openMenu == MO.sort}
              onClose={this.onCloseDialog.bind(this)}>
              {[SF.alpha, SF.date].map((sf) =>
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
            </Menu>
          </React.Fragment>
        )}

        <StyledAddMenuButton
          onClick={this.onAddTag.bind(this)}
          size="large">
          <AddIcon sx={(theme) => ({ color: theme.palette.primary.contrastText })} />
        </StyledAddMenuButton>
      </Root>
    );
  }

  componentDidMount() {
    let newTags = Array<Tag>();
    for (let tag of this.props.tags) {
      newTags.push(deepClone(tag));
    }
    this.setState({tags: newTags});
  }

  goBack() {
    this.props.onUpdateTags(this.state.tags);
    this.props.goBack();
  }

  onCloseDialog() {
    this.setState({menuAnchorEl: null, openMenu: null, isEditing: -1, tagName: "", tagPhrase: ""});
  }

  onAddTag() {
    let id = this.state.tags.length + 1;
    this.state.tags.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    this.props.tags.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });

    let newTags = this.state.tags;
    newTags = newTags.concat([new Tag({
      name: "",
      id: id,
    })]);
    this.setState({isEditing: id, tagName: "", tagPhrase: "", tags: newTags});
  }

  onRemoveTag() {
    this.setState({tags: this.state.tags.filter((t) => t.id != this.state.isEditing), isEditing: -1, tagName: "", tagPhrase: ""});
  }

  onChangeTitle(e: MouseEvent) {
    this.setState({tagName: (e.currentTarget as HTMLInputElement).value});
  }

  onChangePhrase(e: MouseEvent) {
    this.setState({tagPhrase: (e.currentTarget as HTMLInputElement).value});
  }

  onEditTag(tag: Tag) {
    this.setState({isEditing: tag.id, tagName: tag.name, tagPhrase: tag.phraseString});
  }

  onFinishEdit() {
    const tag = this.state.tags.find((t) => t.id == this.state.isEditing);
    tag.name = this.state.tagName;
    tag.phraseString = this.state.tagPhrase;
    this.setState({tags: removeDuplicatesBy((t: Tag) => t.name, this.state.tags.filter((t) => t.name != "")), isEditing: -1, tagName: "", tagPhrase: ""});
  }

  onRemoveAll() {
    this.setState({openMenu: MO.removeAllAlert});
  }

  onOpenSortMenu(e: MouseEvent) {
    this.setState({menuAnchorEl: e.currentTarget, openMenu: MO.sort});
  }

  onCloseEditDialog() {
    if (this.state.isEditing == this.state.tags[this.state.tags.length - 1].id && this.state.tagName === "") {
      this.onRemoveTag();
    } else {
      this.onCloseDialog();
    }
  }

  onFinishRemoveAll() {
    this.props.onUpdateTags([]);
    this.onCloseDialog();
  }
}

(TagManager as any).displayName="TagManager";
export default TagManager;
