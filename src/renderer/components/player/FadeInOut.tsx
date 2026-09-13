import * as React from 'react';
import {animated, useTransition} from "@react-spring/web";

import {getEaseFunction} from "../../data/utils";
import {TF} from "../../data/const";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

interface FadeInOutProps {
  toggleFade: boolean,
  currentAudio: Audio,
  timeToNextFrame: number,
  scene: Scene,
  fadeFunction: Function,
  children?: React.ReactNode,
}

function getDuration(props: FadeInOutProps) {
  let duration;
  switch (props.scene.fadeIOTF) {
    case TF.constant:
      duration = Math.max(props.scene.fadeIODuration, 10);
      break;
    case TF.random:
      duration = Math.floor(Math.random() * (Math.max(props.scene.fadeIODurationMax, 10) - Math.max(props.scene.fadeIODurationMin, 10) + 1)) + Math.max(props.scene.fadeIODurationMin, 10);
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.fadeIOSinRate - 100) + 2) * 1000;
      duration = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (Math.max(props.scene.fadeIODurationMax, 10) - Math.max(props.scene.fadeIODurationMin, 10) + 1)) + Math.max(props.scene.fadeIODurationMin, 10);
      break;
    case TF.bpm:
      const bpmMulti = props.scene.fadeIOBPMMulti / 10;
      const bpm = props.currentAudio ? props.currentAudio.bpm : 60;
      duration = 60000 / (bpm * bpmMulti);
      if (!duration) {
        duration = 1000;
      }
      break;
    case TF.scene:
      duration = props.timeToNextFrame;
  }
  duration = duration / 2;
  return duration;
}

function getDelay(props: FadeInOutProps) {
  let delay;
  switch (props.scene.fadeIODelayTF) {
    case TF.constant:
      delay = props.scene.fadeIODelay;
      break;
    case TF.random:
      delay = Math.floor(Math.random() * (props.scene.fadeIODelayMax - props.scene.fadeIODelayMin + 1)) + props.scene.fadeIODelayMin;
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.fadeIODelaySinRate - 100) + 2) * 1000;
      delay = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (props.scene.fadeIODelayMax - props.scene.fadeIODelayMin + 1)) + props.scene.fadeIODelayMin;
      break;
    case TF.bpm:
      const bpmMulti = props.scene.fadeIODelayBPMMulti / 10;
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

export default function FadeInOut(props: FadeInOutProps) {
  const [stateToggleFade, setStateToggleFade] = React.useState(false);
  const [stateDuration, setStateDuration] = React.useState(() => getDuration(props) / 2);

  const fadeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutRef = React.useRef(false);
  const lastToggleRef = React.useRef<any>(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;

  const sceneTiming = props.scene.fadeIOTF == TF.scene;

  if (props.toggleFade != lastToggleRef.current) {
    fadeOutRef.current = false;
    lastToggleRef.current = props.toggleFade;
  }

  const goingOut = sceneTiming ? fadeOutRef.current : stateToggleFade;
  const transitionItem = sceneTiming
    ? (fadeOutRef.current ? null : props.toggleFade)
    : stateToggleFade;

  const fadeTransitions = useTransition(transitionItem, {
    keys: (item: any) => item,
    from: { opacity: goingOut ? 1 : 0 },
    enter: { opacity: goingOut ? 0 : 1 },
    leave: { opacity: goingOut ? 1 : 0 },
    unique: true,
    config: {
      duration: sceneTiming ? getDuration(props) : stateDuration,
      easing: sceneTiming
        ? (goingOut
            ? getEaseFunction(props.scene.fadeIOEndEase, props.scene.fadeIOEndExp, props.scene.fadeIOEndAmp, props.scene.fadeIOEndPer, props.scene.fadeIOEndOv)
            : getEaseFunction(props.scene.fadeIOStartEase, props.scene.fadeIOStartExp, props.scene.fadeIOStartAmp, props.scene.fadeIOStartPer, props.scene.fadeIOStartOv))
        : (stateToggleFade
            ? getEaseFunction(props.scene.panEndEase, props.scene.panEndExp, props.scene.panEndAmp, props.scene.panEndPer, props.scene.panEndOv)
            : getEaseFunction(props.scene.panStartEase, props.scene.panStartExp, props.scene.panStartAmp, props.scene.panStartPer, props.scene.panStartOv))
    },
  });

  React.useEffect(() => {
    if (!sceneTiming) return;
    clearTimeout(fadeTimeoutRef.current as any);
    const p = propsRef.current;
    const dur = getDuration(p);
    if (fadeOutRef.current) {
      p.fadeFunction();
      fadeTimeoutRef.current = setTimeout(() => {
        fadeOutRef.current = false;
      }, dur);
    } else {
      fadeTimeoutRef.current = setTimeout(() => {
        fadeOutRef.current = true;
        setStateToggleFade(t => !t);
      }, dur);
    }
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [sceneTiming, props.toggleFade]);

  React.useEffect(() => {
    fadeOutRef.current = false;
    if (sceneTiming || !props.scene.fadeInOut) return;
    if (props.scene.fadeIOPulse ? props.scene.fadeIODelayTF == TF.scene : props.scene.fadeIOTF == TF.scene) return;

    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const p = propsRef.current;
      const dur = getDuration(p);
      const dly = p.scene.fadeIOPulse ? getDelay(p) : dur;
      setStateDuration(dur);
      setStateToggleFade(t => !t);
      p.fadeFunction();
      fadeTimeoutRef.current = setTimeout(loop, dly);
    };
    loop();

    return () => {
      cancelled = true;
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [sceneTiming, props.scene.fadeIOTF, props.scene.fadeIODelayTF, props.scene.fadeIOPulse, props.scene.fadeInOut]);

  return (
    <React.Fragment>
      {fadeTransitions((springProps, item, transition) => {
        return (
          <animated.div
            key={transition.key}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 2,
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

(FadeInOut as any).displayName="FadeInOut";
