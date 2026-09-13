import * as React from 'react';
import {animated, useSpring} from "@react-spring/web";

import {TF} from "../../data/const";
import {getEaseFunction} from "../../data/utils";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

interface StrobeImageProps {
  scene: Scene,
  timeToNextFrame: number,
  currentAudio: Audio,
  children?: React.ReactNode,
}

export default function StrobeImage(props: StrobeImageProps) {
  let duration = 0 as number;
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

  const imageProps = useSpring({
    reset: true,
    from: {
      opacity: 1,
    },
    to: {
      opacity: 0,
    },
    config: {
      duration: duration,
      easing: getEaseFunction(props.scene.transEase, props.scene.transExp, props.scene.transAmp, props.scene.transPer, props.scene.transOv)
    },
  });

  return (
    <animated.div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        zIndex: 2,
        ...imageProps
      }}>
      {props.children}
    </animated.div>
  );
}

(StrobeImage as any).displayName="StrobeImage";
