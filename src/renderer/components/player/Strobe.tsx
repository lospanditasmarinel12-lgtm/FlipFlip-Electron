import * as React from 'react';
import {animated, useTransition} from "@react-spring/web";

import {getEaseFunction, getRandomColor, getRandomListItem} from "../../data/utils";
import {SC, SL, TF} from "../../data/const";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

interface StrobeProps {
  toggleStrobe: boolean,
  scene: Scene,
  timeToNextFrame: number,
  currentAudio: Audio
  zIndex: number,
  strobeFunction?: Function,
  children?: React.ReactNode,
}

function getDuration(props: StrobeProps) {
  let duration;
  switch (props.scene.strobeTF) {
    case TF.constant:
      duration = Math.max(props.scene.strobeTime, 10);
      break;
    case TF.random:
      duration = Math.floor(Math.random() * (Math.max(props.scene.strobeTimeMax, 10) - Math.max(props.scene.strobeTimeMin, 10) + 1)) + Math.max(props.scene.strobeTimeMin, 10);
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.strobeSinRate - 100) + 2) * 1000;
      duration = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (Math.max(props.scene.strobeTimeMax, 10) - Math.max(props.scene.strobeTimeMin, 10) + 1)) + Math.max(props.scene.strobeTimeMin, 10);
      break;
    case TF.bpm:
      const bpmMulti = props.scene.strobeBPMMulti / 10;
      const bpm = props.currentAudio ? props.currentAudio.bpm : 60;
      duration = 60000 / (bpm * bpmMulti);
      if (!duration) {
        duration = 1000;
      }
      break;
    case TF.scene:
      duration = props.timeToNextFrame;
  }
  return duration;
}

function getDelay(props: StrobeProps) {
  let delay;
  switch (props.scene.strobeDelayTF) {
    case TF.constant:
      delay = props.scene.strobeDelay;
      break;
    case TF.random:
      delay = Math.floor(Math.random() * (props.scene.strobeDelayMax - props.scene.strobeDelayMin + 1)) + props.scene.strobeDelayMin;
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.strobeDelaySinRate - 100) + 2) * 1000;
      delay = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (props.scene.strobeDelayMax - props.scene.strobeDelayMin + 1)) + props.scene.strobeDelayMin;
      break;
    case TF.bpm:
      const bpmMulti = props.scene.strobeDelayBPMMulti / 10;
      const bpm = props.currentAudio ? props.currentAudio.bpm : 60;
      delay = 60000 / (bpm * bpmMulti);
      if (!delay) {
        delay = 1000;
      }
      break;
    case TF.scene:
      delay = props.timeToNextFrame;
  }
  return delay;
}

export default function Strobe(props: StrobeProps) {
  const [stateToggleStrobe, setStateToggleStrobe] = React.useState(false);
  const [stateDuration, setStateDuration] = React.useState(() => getDuration(props));

  const strobeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;

  const sceneTiming = props.scene.strobeTF == TF.scene;

  const getStrobeColor = React.useCallback(() => {
    let color = null;
    if (props.scene.strobeColorType == SC.color) {
      color = props.scene.strobeColor;
    } else if (props.scene.strobeColorType == SC.colorSet) {
      if (props.scene.strobeColorSet.length > 0) {
        color = getRandomListItem(props.scene.strobeColorSet);
      }
    } else {
      color = getRandomColor();
    }
    const validColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/g.exec(color);
    return validColor ? color : "";
  }, [props.scene.strobeColorType, props.scene.strobeColor, props.scene.strobeColorSet]);

  const strobeTransitions = useTransition(stateToggleStrobe, {
    keys: (toggle: any) => toggle,
    from: {
      backgroundColor: props.scene.strobeLayer == SL.image ? "" : getStrobeColor(),
      opacity: props.scene.strobeLayer == SL.bottom ? props.scene.strobeOpacity : 1,
    },
    enter: {
      opacity: 0,
    },
    leave: {
      opacity: 0,
    },
    reset: true,
    unique: true,
    config: {
      duration: stateDuration,
      easing: getEaseFunction(props.scene.strobeEase, props.scene.strobeExp, props.scene.strobeAmp, props.scene.strobePer, props.scene.strobeOv)
    },
  });

  React.useEffect(() => {
    if (sceneTiming && props.scene.strobeTF == TF.scene) {
      if (props.toggleStrobe != undefined) {
        setStateToggleStrobe(t => !t);
      }
    }
  }, [sceneTiming, props.toggleStrobe]);

  React.useEffect(() => {
    if (sceneTiming || !props.scene.strobePulse && props.scene.strobeTF == TF.scene) return;
    if (props.scene.strobePulse ? props.scene.strobeDelayTF == TF.scene : props.scene.strobeTF == TF.scene) return;

    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const p = propsRef.current;
      const dur = getDuration(p);
      const dly = p.scene.strobePulse ? getDelay(p) : dur;
      setStateDuration(dur);
      setStateToggleStrobe(t => !t);
      if (p.strobeFunction) {
        p.strobeFunction();
      }
      strobeTimeoutRef.current = setTimeout(loop, dly);
    };
    loop();

    return () => {
      cancelled = true;
      if (strobeTimeoutRef.current) clearTimeout(strobeTimeoutRef.current);
    };
  }, [props.scene.strobeTF, props.scene.strobeDelayTF, props.scene.strobePulse]);

  return (
    <React.Fragment>
      {strobeTransitions((springProps, item, transition) => {
        return (
          <animated.div
            key={transition.key}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: props.zIndex,
              willChange: 'opacity',
              ...springProps
            }}>
            {props.children}
          </animated.div>
        );
      })}
    </React.Fragment>
  );
}

(Strobe as any).displayName="Strobe";
