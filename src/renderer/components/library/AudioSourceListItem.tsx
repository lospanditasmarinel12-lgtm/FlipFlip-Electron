import * as React from "react";
import {existsSync} from "fs";
import * as remote from "@electron/remote";

import {
  Badge,
  Box,
  Checkbox,
  Chip,
  Fab,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";

import { styled } from "@mui/material/styles";

import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

import {getTimestamp} from "../../data/utils";
import Tag from "../../data/Tag";
import {grey} from "@mui/material/colors";
import Audio from "../../data/Audio";
import SourceIcon from "./SourceIcon";

const Outer = styled('div', {
  shouldForwardProp: (prop) => prop !== 'isOdd' && prop !== 'isLastSelected',
})<{ isOdd: boolean; isLastSelected: boolean }>(({ theme, isOdd, isLastSelected }) => ({
  backgroundColor: isOdd
    ? (theme.palette.mode == 'light' ? (theme.palette.primary as any)["100"] : grey[900])
    : (theme.palette.mode == 'light' ? (theme.palette.primary as any)["50"] : theme.palette.background.default),
  '&:hover': {
    backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["200"] : '#080808',
  },
  ...(isLastSelected && {
    backgroundColor: theme.palette.mode == 'light' ? (theme.palette.primary as any)["200"] : '#0F0F0F',
  }),
}));

const StyledSourceIcon = styled(SourceIcon, {
  shouldForwardProp: (prop) => prop !== 'marked',
})<{ url?: string; marked: boolean }>(({ theme, marked }) => ({
  color: marked ? theme.palette.secondary.contrastText : theme.palette.primary.contrastText,
}));

class AudioSourceListItem extends React.Component {
  readonly props: {
    checked: boolean,
    index: number,
    isSelect: boolean,
    lastSelected: boolean,
    source: Audio,
    sources: Array<Audio>,
    style: any,
    onClickAlbum(album: string): void,
    onClickArtist(artist: string): void,
    onDelete(source: Audio): void;
    onEditSource(source: Audio): void;
    onPlay(source: Audio, displaySources: Array<Audio>): void,
    onRemove(source: Audio): void,
    onSourceOptions(source: Audio): void,
    onToggleSelect(): void,
    savePosition(): void,
    systemMessage(message: string): void,
  };

  readonly state = {
    urlInput: this.props.source.url,
  };

  render() {
    return(
      <Outer style={this.props.style} isOdd={this.props.index % 2 !== 0} isLastSelected={this.props.lastSelected}>
        <ListItem sx={{ paddingRight: 110 }}>
          {this.props.isSelect && (
            <Checkbox value={this.props.source.url} onChange={this.props.onToggleSelect.bind(this)}
                      checked={this.props.checked}/>
          )}
          <Badge
            anchorOrigin={{vertical: 'top', horizontal: 'left'}}
            variant={"dot"}
            invisible={!this.props.source.marked}
            overlap="rectangular"
            color="secondary">
            <ListItemAvatar sx={{ width: 56 }}>
              <Badge
                invisible={!this.props.source.trackNum}
                max={999}
                overlap="rectangular"
                color="primary"
                badgeContent={this.props.source.trackNum}>
                <Tooltip disableInteractive placement={this.props.source.comment ? 'right' : 'bottom'}
                         slotProps={this.props.source.comment ? { tooltip: { sx: { fontSize: "medium", maxWidth: 500 } } } : undefined}
                         arrow={!!this.props.source.comment || this.props.source.tags.length > 0}
                         title={
                  this.props.source.comment || this.props.source.tags.length > 0 ?
                    <Box sx={{ whiteSpace: 'pre-line' }}>
                      {this.props.source.comment}
                      {this.props.source.comment && this.props.source.tags.length > 0 && (<br/>)}
                      <Box sx={{ textAlign: 'center' }}>
                        {this.props.source.tags && this.props.source.tags.map((tag: Tag) =>
                          <React.Fragment key={tag.id}>
                            <Chip
                              label={tag.name}
                              color="primary"
                              size="small"/>
                          </React.Fragment>
                        )}
                      </Box>
                    </Box>
                      :
                    <Box>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Click: Library Tagging
                      <br/>
                      Shift+Click: Open Source
                      <br/>
                      &nbsp;&nbsp;Ctrl+Click: Reveal File
                    </Box>
                }>
                  <Box onClick={this.onSourceIconClick.bind(this)}
                       sx={{ height: 40, width: 40, overflow: 'hidden', display: 'flex', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>
                    {this.props.source.thumb != null && (
                      <Box component="img" sx={{ height: '100%' }} src={this.props.source.thumb}/>
                    )}
                    {this.props.source.thumb == null && (
                      <Fab
                        size="small"
                        sx={(theme) => ({
                          backgroundColor: this.props.source.marked ? theme.palette.secondary.main : theme.palette.primary.main,
                          boxShadow: 'none',
                        })}>
                        <StyledSourceIcon url={this.props.source.url} marked={this.props.source.marked}/>
                      </Fab>
                    )}
                  </Box>
                </Tooltip>
              </Badge>
            </ListItemAvatar>
          </Badge>

          <ListItemText slotProps={{ primary: { sx: { display: 'flex' } } }}>
            <Typography noWrap sx={{ maxWidth: 500, minWidth: 250, width: '100%', userSelect: 'none' }}>
              {this.props.source.name}
            </Typography>
            <Typography sx={(theme) => ({ width: 75, textAlign: 'end', marginLeft: theme.spacing(1), marginRight: theme.spacing(3), userSelect: 'none' })}>
              {getTimestamp(this.props.source.duration)}
            </Typography>
            <Box sx={{ minWidth: 225 }} onClick={this.props.onClickArtist.bind(this, this.props.source.artist)}>
              <Typography noWrap sx={{ display: 'inline-block', userSelect: 'none', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                {this.props.source.artist}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 225 }} onClick={this.props.onClickAlbum.bind(this, this.props.source.album)}>
              <Typography sx={{ userSelect: 'none', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {this.props.source.album}
              </Typography>
            </Box>
          </ListItemText>

          {this.props.source.id && (
            <ListItemSecondaryAction>
              {this.props.source.playedCount > 0 && (
                <Chip
                  label={this.props.source.playedCount}
                  color="primary"
                  size="small"/>
              )}
              <IconButton
                onClick={this.props.onEditSource.bind(this, this.props.source)}
                sx={{ marginLeft: 1 }}
                edge="end"
                size="small"
                aria-label="edit">
                <EditIcon/>
              </IconButton>
              <IconButton
                onClick={this.props.onSourceOptions.bind(this, this.props.source)}
                sx={{ marginLeft: 1 }}
                edge="end"
                size="small"
                aria-label="options">
                <BuildIcon/>
              </IconButton>
              <IconButton
                onClick={this.props.onRemove.bind(this, this.props.source)}
                sx={{ backgroundColor: 'error.main', marginLeft: 1, '&:hover': { backgroundColor: 'error.dark' } }}
                edge="end"
                size="small"
                aria-label="delete">
                <DeleteIcon sx={{ color: 'error.contrastText' }} color="inherit"/>
              </IconButton>
            </ListItemSecondaryAction>
          )}
        </ListItem>
      </Outer>
    );
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
      this.props.savePosition();
      try {
        this.props.onPlay(this.props.source, this.props.sources);
      } catch (e) {
        this.props.systemMessage("The source " + sourceURL + " isn't in your Library");
      }
    }
  }

  openExternalURL(url: string) {
    remote.shell.openExternal(url);
  }
}

(AudioSourceListItem as any).displayName="AudioSourceListItem";
export default AudioSourceListItem;
