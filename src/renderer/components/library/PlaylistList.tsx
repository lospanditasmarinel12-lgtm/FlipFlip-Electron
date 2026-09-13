import * as React from "react";

import { Card, CardContent, CardMedia, Grid, Tooltip, Typography } from "@mui/material";

import { styled } from "@mui/material/styles";

import Audio from "../../data/Audio";
import Playlist from "../../data/Playlist";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";

const EmptyMessage = styled(Typography)({
  textAlign: 'center',
  marginTop: '25%',
});

const EmptyMessage2 = styled(Typography)({
  textAlign: 'center',
});

const MediaCardMedia = styled(CardMedia)({
  height: 0,
  paddingTop: "100%",
});

const MediaIcon = styled(AudiotrackIcon)({
  width: '100%',
  height: 'auto',
});

const PointerGrid = styled(Grid)({
  cursor: 'pointer',
});

const StyledCard = styled(Card)({
  borderRadius: 1,
});

const StyledCardContent = styled(CardContent)(({ theme }) => ({
  '&:last-child': {
    paddingBottom: theme.spacing(2),
  },
}));

const ArtistTypography = styled(Typography)({
  '&:hover': {
    textDecoration: 'underline',
  },
});

class PlaylistList extends React.Component {
  readonly props: {
    playlists: Array<Playlist>,
    audios: Array<Audio>,
    showHelp: boolean,
    onClickPlaylist(playlist: string): void,
  };

  readonly state = {
    playlists: this.getPlaylists(),
    hover: null as any,
  };

  render() {
    if (this.state.playlists.size == 0) {
      return (
        <React.Fragment>
          <EmptyMessage variant="h3" color="inherit" noWrap>
            乁( ◔ ౪◔)「
          </EmptyMessage>
          <EmptyMessage2 variant="h4" color="inherit" noWrap>
            Nothing here
          </EmptyMessage2>
          {this.props.showHelp && (
            <EmptyMessage2 variant="h6" color="inherit" noWrap>
              Create playlists by clicking "Add to Playlist" in the sidebar
            </EmptyMessage2>
          )}
        </React.Fragment>

      );
    }

    const playlists = Array.from(this.state.playlists.keys());
    return (
      <Grid container spacing={2}>
        {playlists.map((p) => {
          const thumbs = this.state.playlists.get(p).map((thumb) => thumb.replace(/\\/g,"/"));
          if (thumbs.length == 2) {
            thumbs.push("");
            thumbs.push("");
            thumbs[3]=thumbs[1];
            thumbs[1]="";
          }
          return (
            <PointerGrid key={p} item xs={6} sm={4} md={3} lg={2}
                  onClick={this.props.onClickPlaylist.bind(this, p)}
                  onMouseEnter={this.onMouseEnter.bind(this, p)}
                  onMouseLeave={this.onMouseLeave.bind(this)}>
              <StyledCard>
                <Grid container>
                  {thumbs.map((t, index) =>
                    <Grid item xs={thumbs.length == 1 ? 12 : 6} key={index}>
                      {t && (
                        <MediaCardMedia
                          image={t}
                        />
                      )}
                    </Grid>
                  )}
                  {thumbs.length == 0 && (
                    <Grid item xs={12}>
                      <MediaIcon/>
                    </Grid>
                  )}
                </Grid>
                <StyledCardContent>
                  <Typography
                    sx={this.state.hover == p ? { textDecoration: 'underline' } : undefined}
                    noWrap
                    variant="body1">
                    {p}
                  </Typography>
                </StyledCardContent>
              </StyledCard>
            </PointerGrid>
          )
        })}
      </Grid>
    );
  }

  componentDidUpdate(props: any) {
    if (props.playlists != this.props.playlists) {
      this.setState({playlists: this.getPlaylists()});
    }
  }

  onMouseEnter(album: string) {
    this.setState({hover: album});
  }

  onMouseLeave() {
    this.setState({hover: null});
  }

  getPlaylists(): Map<string, Array<string>> {
    const playlistsMap = new Map<string, Array<string>>();
    for (let playlist of this.props.playlists) {
      let thumbs: Array<string> = [];
      for (let aID of playlist.audios) {
        const audio = this.props.audios.find((a) => a.id == aID);
        if (audio && audio.thumb && !thumbs.includes(audio.thumb)) {
          thumbs.push(audio.thumb);
        }
        if (thumbs.length == 4) {
          break;
        }
      }
      playlistsMap.set(playlist.name, thumbs);
    }
    return playlistsMap;
  }
}

(PlaylistList as any).displayName="PlaylistList";
export default PlaylistList;
