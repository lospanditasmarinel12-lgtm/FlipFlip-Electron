import * as React from "react";

import { Avatar, Typography } from "@mui/material";

import { styled } from "@mui/material/styles";

import AudiotrackIcon from "@mui/icons-material/Audiotrack";

import Audio from "../../data/Audio";

const EmptyMessage = styled(Typography)({
  textAlign: 'center',
  marginTop: '25%',
});

const EmptyMessage2 = styled(Typography)({
  textAlign: 'center',
});

const MediaIcon = styled(AudiotrackIcon)({
  width: '100%',
  height: 'auto',
});

const ArtistContainer = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
});

const ArtistDiv = styled('div')({
  paddingTop: 0,
  textAlign: 'center',
  cursor: 'pointer',
});

const StyledAvatar = styled(Avatar, {
  shouldForwardProp: (prop) => prop !== '$hovered',
})<{ $hovered?: boolean }>(({ theme, $hovered }) => ({
  width: theme.spacing(20),
  height: theme.spacing(20),
  borderStyle: "double",
  borderColor: theme.palette.text.primary,
  borderWidth: 2,
  ...($hovered && {
    boxShadow: theme.shadows[10],
  }),
}));

const TrackArtistTypography = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$hovered',
})<{ $hovered?: boolean }>(({ theme, $hovered }) => ({
  maxWidth: theme.spacing(20),
  ...($hovered && {
    textDecoration: 'underline',
  }),
}));

class AudioArtistList extends React.Component {
  readonly props: {
    sources: Array<Audio>,
    showHelp: boolean,
    onClickArtist(artist: string): void,
  };

  readonly state = {
    artists: this.getArtists(),
    hover: null as any,
  };

  render() {
    if (this.state.artists.size == 0) {
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

    const artists = Array.from(this.state.artists.keys());
    const width = window.innerWidth - 104; // 72px drawer + 2x18px padding
    const numIcons = Math.floor(width / 178); // 160xp width + 2x9px padding
    const remainingWidth = width - (numIcons * 178);
    const padding = Math.floor(remainingWidth / numIcons / 2) + 6;
    return (
      <ArtistContainer>
        {artists.map((a) => {
          let thumb: string = this.state.artists.get(a);
          if (thumb) thumb = thumb.replace(/\\/g,"/");
          return (
            <ArtistDiv key={a}
                  style={{padding: padding}}
                  onClick={this.props.onClickArtist.bind(this, a)}
                  onMouseEnter={this.onMouseEnter.bind(this, a)}
                  onMouseLeave={this.onMouseLeave.bind(this)}>
              <StyledAvatar alt={a} src={thumb} $hovered={this.state.hover == a}>
                {thumb == null && (
                  <MediaIcon/>
                )}
              </StyledAvatar>
              <TrackArtistTypography
                $hovered={this.state.hover == a}
                display={"block"}
                variant={"h6"}>
                {a}
              </TrackArtistTypography>
            </ArtistDiv>
          )
        })}
      </ArtistContainer>
    );
  }

  componentDidUpdate(props: any) {
    if (props.sources != this.props.sources) {
      this.setState({artists: this.getArtists()});
    }
  }

  onMouseEnter(artist: string) {
    this.setState({hover: artist});
  }

  onMouseLeave() {
    this.setState({hover: null});
  }

  getArtists(): Map<string, string> {
    const artistsMap = new Map<string, string>();
    const songs = Array.from(this.props.sources).sort((a, b) => {
      if (a.artist > b.artist) {
        return 1;
      } else if (a.artist < b.artist) {
        return -1;
      } else {
        const reA = /^(A\s|a\s|The\s|the\s)/g
        const aValue = a.name.replace(reA, "");
        const bValue = b.name.replace(reA, "");
        return aValue.localeCompare(bValue, 'en', { numeric: true });
      }
    });
    for (let song of songs) {
      if (song.artist && (!artistsMap.has(song.artist) || !artistsMap.get(song.artist))) {
        artistsMap.set(song.artist, song.thumb);
      }
    }
    return artistsMap;
  }
}

(AudioArtistList as any).displayName="AudioArtistList";
export default AudioArtistList;
