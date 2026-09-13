import * as React from 'react';
import {animated, useTransition} from "@react-spring/web";

import {STF, TF} from "../../data/const";
import {getEaseFunction, getRandomNumber} from "../../data/utils";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

interface SlideProps {
  image: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement,
  scene: Scene,
  timeToNextFrame: number,
  currentAudio: Audio,
  children?: React.ReactNode,
}

export default function Slide(props: SlideProps) {
  let slideDuration = 0;
  switch (props.scene.slideTF) {
    case TF.scene:
      slideDuration = props.timeToNextFrame;
      break;
    case TF.constant:
      slideDuration = props.scene.slideDuration;
      break;
    case TF.random:
      slideDuration = Math.floor(Math.random() * (props.scene.slideDurationMax - props.scene.slideDurationMin + 1)) + props.scene.slideDurationMin;
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.slideSinRate - 100) + 2) * 1000;
      slideDuration = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (props.scene.slideDurationMax - props.scene.slideDurationMin + 1)) + props.scene.slideDurationMin;
      break;
    case TF.bpm:
      const bpmMulti = props.scene.slideBPMMulti / 10;
      const bpm = props.currentAudio ? props.currentAudio.bpm : 60;
      slideDuration = 60000 / (bpm * bpmMulti);
      if (!slideDuration) {
        slideDuration = 1000;
      }
      break;
  }

  let slideHStart = 0, slideHEnd = 0, slideVStart = 0, slideVEnd = 0;
  let slideType = props.scene.slideType;
  if (slideType == STF.leftright) {
    slideType = getRandomNumber(0, 1) == 0 ? STF.left : STF.right;
  } else if (slideType == STF.updown) {
    slideType = getRandomNumber(0, 1) == 0 ? STF.up : STF.down;
  } else if (slideType == STF.random) {
    const rand = getRandomNumber(0, 3);
    switch (rand) {
      case 0:
        slideType = STF.left;
        break;
      case 1:
        slideType = STF.right;
        break;
      case 2:
        slideType = STF.up;
        break;
      case 3:
        slideType = STF.down;
        break;
    }
  }

  switch (slideType) {
    case (STF.left):
      slideHStart = 100;
      slideHEnd = props.scene.slideDistance * -1;
      slideVStart = 0;
      slideVEnd = 0;
      break;
    case (STF.right):
      slideHStart = -100;
      slideHEnd = props.scene.slideDistance;
      slideVStart = 0;
      slideVEnd = 0;
      break;
    case (STF.up):
      slideVStart = 100;
      slideVEnd = props.scene.slideDistance * -1;
      slideHStart = 0;
      slideHEnd = 0;
      break;
    case (STF.down):
      slideVStart = -100;
      slideVEnd = props.scene.slideDistance;
      slideHStart = 0;
      slideHEnd = 0;
      break;
  }

  const slideTransitions = useTransition(props.image, {
    keys: (image: any) => image.key,
    from: {
      transform: `translate3d(${slideHStart}%,${slideVStart}%,0)`
    },
    enter: {
      transform: 'translate3d(0%,0%,0)'
    },
    leave: {
      transform: `translate3d(${slideHEnd}%,${slideVEnd}%,0)`
    },
    unique: true,
    config: {
      duration: slideDuration,
      easing: getEaseFunction(props.scene.slideEase, props.scene.slideExp, props.scene.slideAmp, props.scene.slidePer, props.scene.slideOv)
    },
  });

  return (
    <React.Fragment>
      {slideTransitions((springProps, item, transition) => {
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
              willChange: 'transform',
              ...springProps
            }}
            {...{ volume: (springProps as any).volume } as any}>
            {props.children}
          </animated.div>
        );
      })}
    </React.Fragment>
  );
}

(Slide as any).displayName="Slide";
