import * as React from "react";
import {animated, useTransition} from "@react-spring/web";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import {grey} from "@mui/material/colors";

import Audio from "../../data/Audio";

interface AudioAlertProps {
  audio: Audio,
}

function AudioAlert(props: AudioAlertProps) {
  const [visible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (props.audio) {
      setVisible(true);
      timeoutRef.current = setTimeout(() => setVisible(false), 6000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [props.audio]);

  let fadeDuration = 2000;

  const fadeTransitions = useTransition(visible, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: { duration: fadeDuration },
  });

  if (!props.audio) return <React.Fragment/>;

  const infoSx = {
    paddingLeft: (theme: any) => theme.spacing(4),
    paddingRight: (theme: any) => theme.spacing(4),
    zIndex: 9,
    '&:nth-child(2)': {
      paddingBottom: (theme: any) => theme.spacing(4),
      textDecoration: 'underline',
    },
    '&:last-child': {
      paddingTop: (theme: any) => theme.spacing(4),
    },
  };

  return (
    <React.Fragment>
      {fadeTransitions((style, item) => {
        return (
          <animated.div
            style={{
              zIndex: 10,
              position: 'absolute',
              bottom: 0,
              ...style
            }}>
            {item && (
              <Box sx={{ float: 'left', margin: (theme: any) => theme.spacing(5), display: 'flex' }}>
                <Box component="img" sx={{ maxHeight: 250 }} src={props.audio.thumb}/>
                <Box sx={{ display: 'flex', position: 'relative', flexDirection: 'column-reverse' }}>
                  <Box sx={{ position: 'absolute', backgroundColor: grey[500], opacity: 0.5, filter: 'blur(5px)', width: '100%', height: '100%', zIndex: 8 }}/>
                  <Typography variant="h3" sx={infoSx}>
                    {props.audio.name ? props.audio.name : props.audio.url}
                  </Typography>
                  {props.audio.artist && (
                    <Typography variant="h5" sx={infoSx}>
                      {props.audio.artist}
                    </Typography>
                  )}
                  {props.audio.album && (
                    <Typography variant="h6" sx={infoSx}>
                      {props.audio.album}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </animated.div>
        );
      })}
    </React.Fragment>
  );
}

(AudioAlert as any).displayName="AudioAlert";
export default AudioAlert;
