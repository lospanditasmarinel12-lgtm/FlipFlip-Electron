import * as React from 'react';
import {animated, useTransition} from "@react-spring/web";

import {TF} from "../../data/const";
import {getEaseFunction} from "../../data/utils";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

export default function CrossFade(props: {
  image: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement,
  scene: Scene,
  timeToNextFrame: number,
  currentAudio: Audio,
  children?: React.ReactNode,
}) {
  let fadeDuration = 0;
  switch (props.scene.fadeTF) {
    case TF.scene:
      fadeDuration = props.timeToNextFrame;
      break;
    case TF.constant:
      fadeDuration = props.scene.fadeDuration;
      break;
    case TF.random:
      fadeDuration = Math.floor(Math.random() * (props.scene.fadeDurationMax - props.scene.fadeDurationMin + 1)) + props.scene.fadeDurationMin;
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.fadeSinRate - 100) + 2) * 1000;
      fadeDuration = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (props.scene.fadeDurationMax - props.scene.fadeDurationMin + 1)) + props.scene.fadeDurationMin;
      break;
    case TF.bpm:
      const bpmMulti = props.scene.fadeBPMMulti / 10;
      const bpm = props.currentAudio ? props.currentAudio.bpm : 60;
      fadeDuration = 60000 / (bpm * bpmMulti);
      if (!fadeDuration) {
        fadeDuration = 1000;
      }
      break;
  }

  const fadeTransitions = useTransition(props.image, {
    keys: (image: any) => image.key,
    initial: {
      opacity: 1,
      volume: 1,
    },
    from: {
      opacity: 0,
      volume: 0,
    },
    enter: {
      opacity: 1,
      volume: 1,
    },
    leave: {
      opacity: 0,
      volume: 0,
    },
    unique: true,
    config: {
      duration: fadeDuration,
      easing: getEaseFunction(props.scene.fadeEase, props.scene.fadeExp, props.scene.fadeAmp, props.scene.fadePer, props.scene.fadeOv)
    },
  });

  if (props.scene.crossFade) {
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
                willChange: 'opacity',
                ...springProps
              }}
              {...{ volume: (springProps as any).volume } as any}>
              {props.children}
            </animated.div>
          );
        })}
      </React.Fragment>
    );
  } else {
    return <>{props.children}</>;
  }
}

(CrossFade as any).displayName="CrossFade";
