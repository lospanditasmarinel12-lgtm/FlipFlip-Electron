import * as React from "react";

import { Card, CardContent, CardMedia, Grid, Tooltip, Typography } from "@mui/material";

import { styled } from "@mui/material/styles";

import AudiotrackIcon from '@mui/icons-material/Audiotrack';

import Audio from "../../data/Audio";

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

class AudioAlbumList extends React.Component {
  readonly props: {
    sources: Array<Audio>,
    showHelp: boolean,
    onClickAlbum(album: string): void,
    onClickArtist(artist: string): void,
  };

  readonly state = {
    albums: this.getAlbums(),
    hover: null as any,
  };

  render() {
    if (this.state.albums.size == 0) {
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
              Add tracks by going to the "Songs" tab and clicking the +
            </EmptyMessage2>
          )}
        </React.Fragment>

      );
    }

    const va = "Various Artists";
    const albums = Array.from(this.state.albums.keys());
    return (
      <Grid container spacing={2}>
        {albums.map((a) => {
          const data = this.state.albums.get(a);
          let thumb: string = data.thumb;
          if (thumb) thumb = thumb.replace(/\\/g,"/");
          const artist = data.artist;
          const count = data.count;
          return (
            <PointerGrid key={a} item xs={6} sm={4} md={3} lg={2}
                  onClick={this.props.onClickAlbum.bind(this, a)}
                  onMouseEnter={this.onMouseEnter.bind(this, a)}
                  onMouseLeave={this.onMouseLeave.bind(this)}>
              <StyledCard>
                {thumb &&  (
                  <MediaCardMedia
                    image={thumb}
                    title={a}/>
                )}
                {!thumb && (
                  <MediaIcon/>
                )}
                <StyledCardContent>
                  <Tooltip disableInteractive title={a} enterDelay={800}>
                    <Typography
                      sx={this.state.hover == a ? { textDecoration: 'underline' } : undefined}
                      noWrap
                      variant="body1">
                      {a}
                    </Typography>
                  </Tooltip>
                  <Typography
                    id={"artist-link"}
                    noWrap
                    onClick={artist == va ? this.nop : this.props.onClickArtist.bind(this, artist)}
                    sx={artist != va ? { '&:hover': { textDecoration: 'underline' } } : undefined}
                    color="textSecondary"
                    variant="body2">
                    {artist}
                  </Typography>
                  <Typography
                    noWrap
                    color="textSecondary"
                    variant="body2">
                    {count} {count == 1 ? "song" : "songs"}
                  </Typography>
                </StyledCardContent>
              </StyledCard>
            </PointerGrid>
          )
        })}
      </Grid>
    );
  }

  nop() {}

  componentDidUpdate(props: any) {
    if (props.sources != this.props.sources) {
      this.setState({albums: this.getAlbums()});
    }
  }

  onMouseEnter(album: string) {
    this.setState({hover: album});
  }

  onMouseLeave() {
    this.setState({hover: null});
  }

  getAlbums(): Map<string, { artist: string, thumb: string, count: number }> {
    const va = "Various Artists";
    const albumMap = new Map<string, { artist: string, thumb: string, count: number }>();
    const songs = Array.from(this.props.sources).sort((a, b) => {
      if (a.album > b.album) {
        return 1;
      } else if (a.album < b.album) {
        return -1;
      } else {
        if (a.trackNum > b.trackNum) {
          return 1;
        } else if (a.trackNum < b.trackNum) {
          return -1;
        } else {
          const reA = /^(A\s|a\s|The\s|the\s)/g
          const aValue = a.name.replace(reA, "");
          const bValue = b.name.replace(reA, "");
          return aValue.localeCompare(bValue, 'en', {numeric: true});
        }
      }
    });
    for (let song of songs) {
      if (song.album && (!albumMap.has(song.album) || !albumMap.get(song.album).thumb || (albumMap.get(song.album).artist != song.artist && albumMap.get(song.album).artist != va))) {
        if (albumMap.has(song.album) && albumMap.get(song.album).artist != song.artist) {
          albumMap.set(song.album, {artist: va, thumb: song.thumb, count: 0});
        } else {
          albumMap.set(song.album, {artist: song.artist, thumb: song.thumb, count: 0});
        }
      }
    }
    for (let song of songs) {
      if (song.album) {
        const album = albumMap.get(song.album);
        albumMap.set(song.album, {artist: album.artist, thumb: album.thumb, count: album.count + 1});
      }
    }
    return albumMap;
  }
}

(AudioAlbumList as any).displayName="AudioAlbumList";
export default AudioAlbumList;
