import * as React from "react";
import {existsSync} from "fs";
import * as remote from "@electron/remote";

import {
  Checkbox,
  Chip,
  Fab,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Radio,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled } from "@mui/material/styles";

import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';

import {urlToPath} from "../../data/utils";
import Tag from "../../data/Tag";
import SourceIcon from "./SourceIcon";
import CaptionScript from "../../data/CaptionScript";
import {grey} from "@mui/material/colors";
import {SP} from "../../data/const";
import EditIcon from "@mui/icons-material/Edit";

const RowDiv = styled('div', {
  shouldForwardProp: (prop) => prop !== '$index' && prop !== '$lastSelected',
})<{ $index: number; $lastSelected: boolean }>(({ theme, $index, $lastSelected }) => {
  const base = $index % 2 == 0 ? {
    backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["50"] : theme.palette.background.default,
    '&:hover': {
      backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["200"] : '#080808',
    },
  } : {
    backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["100"] : grey[900],
    '&:hover': {
      backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["200"] : '#080808',
    },
  };
  return {
    ...base,
    ...($lastSelected && {
      backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["200"] : '#0F0F0F',
    }),
  };
});

const SourceFab = styled(Fab, {
  shouldForwardProp: (prop) => prop !== '$marked',
})<{ $marked?: boolean }>(({ theme, $marked }) => ({
  backgroundColor: $marked ? theme.palette.secondary.main : theme.palette.primary.main,
  boxShadow: 'none',
}));

const StyledSourceIcon = styled(SourceIcon, {
  shouldForwardProp: (prop) => prop !== '$marked',
})<{ url?: string; $marked?: boolean }>(({ theme, $marked }) => ({
  color: $marked ? theme.palette.secondary.contrastText : theme.palette.primary.contrastText,
}));

const FullTagChip = styled(Chip)(({ theme }) => ({
  userSelect: 'none',
  marginLeft: theme.spacing(1),
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const SimpleTagChip = styled(Chip)(({ theme }) => ({
  userSelect: 'none',
  marginLeft: theme.spacing(1),
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const ActionIconButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

const DeleteActionIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.error.main,
  marginLeft: theme.spacing(1),
}));

const StyledDeleteIcon = styled(DeleteIcon)(({ theme }) => ({
  color: theme.palette.error.contrastText,
}));

const UrlFieldForm = styled('form')({
  width: '100%',
  margin: 0,
});

const UrlFieldTextField = styled(TextField)({
  width: '100%',
  margin: 0,
});

const StyledListItemText = styled(ListItemText)({
  '& .MuiListItemText-primary': {
    display: 'flex',
  },
});

const NoUserSelectTypography = styled(Typography)({
  userSelect: 'none',
});

class ScriptSourceListItem extends React.Component {
  readonly props: {
    checked: boolean,
    index: number,
    isEditing: number,
    specialMode: string,
    lastSelected: boolean,
    source: CaptionScript,
    style: any,
    tutorial: string,
    onDelete(source: CaptionScript): void;
    onEditScript(source: CaptionScript): void,
    onEndEdit(newURL: string): void,
    onPlay(source: CaptionScript): void,
    onRemove(source: CaptionScript): void,
    onSourceOptions(source: CaptionScript): void,
    onStartEdit(id: number): void,
    onToggleSelect(): void,
    savePosition(): void,
    systemMessage(message: string): void,
  };

  readonly state = {
    urlInput: this.props.source.url,
  };

  render() {
    return (
      <RowDiv style={this.props.style}
           $index={this.props.index}
           $lastSelected={this.props.lastSelected}>
        <ListItem>
          {(this.props.specialMode == SP.batchTag || this.props.specialMode == SP.select) && (
            <Checkbox value={this.props.source.url} onChange={this.props.onToggleSelect.bind(this)}
                      checked={this.props.checked}/>
          )}
          {this.props.specialMode == SP.selectSingle && (
            <Radio value={this.props.source.url} onChange={this.props.onToggleSelect.bind(this)}
                      checked={this.props.checked}/>
          )}
          <ListItemAvatar>
            <Tooltip disableInteractive title={
              <div>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Click: Library Tagging
                <br/>
                Shift+Click: Open Source
                <br/>
                &nbsp;&nbsp;Ctrl+Click: Reveal File
              </div>
            }>
              <SourceFab
                size="small"
                onClick={this.onSourceIconClick.bind(this)}
                $marked={this.props.source.marked}>
                <StyledSourceIcon url={this.props.source.url} $marked={this.props.source.marked}/>
              </SourceFab>
            </Tooltip>
          </ListItemAvatar>

          <StyledListItemText>
            {this.props.isEditing == this.props.source.id && (
              <UrlFieldForm onSubmit={this.onEndEdit.bind(this)}>
                <UrlFieldTextField
                  variant="standard"
                  autoFocus
                  fullWidth
                  value={this.state.urlInput}
                  margin="none"
                  onBlur={this.onEndEdit.bind(this)}
                  onChange={this.onEditSource.bind(this)} />
              </UrlFieldForm>
            )}
            {this.props.isEditing != this.props.source.id && (
              <React.Fragment>
                <NoUserSelectTypography
                  noWrap
                  onClick={this.onStartEdit.bind(this, this.props.source)}>
                  {this.props.source.url}
                </NoUserSelectTypography>
                {this.props.source.tags && this.props.source.tags.map((tag: Tag) =>
                  <React.Fragment key={tag.id}>
                    <FullTagChip
                      label={tag.name}
                      color="primary"
                      size="small"
                      variant="outlined"/>
                    <SimpleTagChip
                      label={this.getSimpleTag(tag.name)}
                      color="primary"
                      size="small"
                      variant="outlined"/>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
          </StyledListItemText>

          {this.props.isEditing != this.props.source.id && (
            <ListItemSecondaryAction>
              {!this.props.specialMode && (
                <ActionIconButton
                  onClick={this.props.onEditScript.bind(this, this.props.source)}
                  edge="end"
                  size="small"
                  aria-label="edit">
                  <EditIcon/>
                </ActionIconButton>
              )}
              <ActionIconButton
                onClick={this.props.onSourceOptions.bind(this, this.props.source)}
                edge="end"
                size="small"
                aria-label="options">
                <BuildIcon/>
              </ActionIconButton>
              <DeleteActionIconButton
                onClick={this.props.onRemove.bind(this, this.props.source)}
                edge="end"
                size="small"
                aria-label="delete">
                <StyledDeleteIcon color="inherit"/>
              </DeleteActionIconButton>
            </ListItemSecondaryAction>
          )}
        </ListItem>
      </RowDiv>
    );
  }

  getSimpleTag(tagName: string) {
    tagName = tagName.replace( /[a-z]/g, '' ).replace( /\s/g, '' );
    return tagName;
  }

  onSourceIconClick(e: MouseEvent) {
    const sourceURL = this.props.source.url;
    if (e.shiftKey && e.ctrlKey && e.altKey) {
      this.props.onDelete(this.props.source);
    } else if (e.shiftKey && !e.ctrlKey) {
      this.openExternalURL(sourceURL);
    } else if (!e.shiftKey && e.ctrlKey) {
      if (existsSync(sourceURL)) {
        remote.shell.showItemInFolder(sourceURL);
      }
    } else if (!e.shiftKey && !e.ctrlKey) {
      this.props.onPlay(this.props.source);
    }
  }

  onStartEdit(s: CaptionScript) {
    this.props.onStartEdit(s.id);
  }

  onEditSource(e: MouseEvent) {
    const input = (e.target as HTMLInputElement);
    this.setState({urlInput: input.value});
  }

  onEndEdit() {
    this.props.onEndEdit(this.state.urlInput);
  }

  openDirectory(cachePath: string) {
    if (process.platform === "win32") {
      this.openExternalURL(cachePath);
    } else {
      this.openExternalURL(urlToPath(cachePath));
    }
  }

  openExternalURL(url: string) {
    remote.shell.openExternal(url);
  }
}

(ScriptSourceListItem as any).displayName="ScriptSourceListItem";
export default ScriptSourceListItem;
