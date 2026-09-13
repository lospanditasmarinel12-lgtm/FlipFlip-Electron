import * as React from 'react';
import {animated, useTransition} from "@react-spring/web";

import {HTF, TF, VTF} from "../../data/const";
import {getEaseFunction} from "../../data/utils";
import Scene from "../../data/Scene";
import Audio from "../../data/Audio";

interface PanningProps {
  togglePan: boolean,
  currentAudio: Audio,
  timeToNextFrame: number,
  scene: Scene,
  panFunction: Function,
  image?: HTMLImageElement | HTMLVideoElement | HTMLIFrameElement,
  parentHeight?: number,
  parentWidth?: number,
  children?: React.ReactNode,
}

function getDuration(props: PanningProps) {
  let duration;
  switch (props.scene.panTF) {
    case TF.constant:
      duration = Math.max(props.scene.panDuration, 10);
      break;
    case TF.random:
      duration = Math.floor(Math.random() * (Math.max(props.scene.panDurationMax, 10) - Math.max(props.scene.panDurationMin, 10) + 1)) + Math.max(props.scene.panDurationMin, 10);
      break;
    case TF.sin:
      const sinRate = (Math.abs(props.scene.panSinRate - 100) + 2) * 1000;
      duration = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (Math.max(props.scene.panDurationMax, 10) - Math.max(props.scene.panDurationMin, 10) + 1)) + Math.max(props.scene.panDurationMin, 10);
      break;
    case TF.bpm:
      const bpmMulti = props.scene.panBPMMulti / 10;
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

export default function Panning(props: PanningProps) {
  const [stateTogglePan, setStateTogglePan] = React.useState(false);
  const [stateDuration, setStateDuration] = React.useState(() => getDuration(props));

  const panTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const panOutRef = React.useRef(false);
  const lastToggleRef = React.useRef<any>(null);
  const lastHorizRandomRef = React.useRef(0);
  const lastVertRandomRef = React.useRef(0);
  const propsRef = React.useRef(props);
  propsRef.current = props;

  const sceneTiming = props.scene.panTF == TF.scene;

  if (props.togglePan != lastToggleRef.current) {
    panOutRef.current = false;
    lastToggleRef.current = props.togglePan;
  }

  const image = props.image;

  let horizTransLevel = 0;
  let horizPix = false;
  if (props.scene.panHorizTransType != HTF.none) {
    if (image && props.scene.panHorizTransImg) {
      const height = image.offsetHeight;
      const width = image.offsetWidth;
      const parentHeight = props.parentHeight ? props.parentHeight : window.innerHeight;
      const parentWidth = props.parentWidth ? props.parentWidth : window.innerWidth;
      const heightDiff = Math.max(height - parentHeight, 0);
      const widthDiff = Math.max(width - parentWidth - heightDiff, 0);
      horizTransLevel = widthDiff / 2;
      horizPix = true;
    } else {
      horizTransLevel = props.scene.panHorizTransLevel;
      if (props.scene.panHorizTransRandom) {
        horizTransLevel = Math.floor(Math.random() * (props.scene.panHorizTransLevelMax - props.scene.panHorizTransLevelMin + 1)) + props.scene.panHorizTransLevelMin;
      }
    }
    if (props.scene.panHorizTransType == HTF.left) {
      horizTransLevel = -horizTransLevel;
    } else if (props.scene.panHorizTransType == HTF.right) {
      // Already set
    } else if (props.scene.panHorizTransType == HTF.random) {
      if ((sceneTiming && panOutRef.current) || (!sceneTiming && stateTogglePan)) {
        const type = Math.floor(Math.random() * 2);
        if (type) {
          horizTransLevel = -horizTransLevel;
        }
        lastHorizRandomRef.current = type;
      } else {
        if (lastHorizRandomRef.current == 0) {
          // Already set
        } else {
          horizTransLevel = -horizTransLevel;
        }
      }
    }
  }
  const horizSuffix = horizPix ? "px" : "%";

  let vertTransLevel = 0;
  let vertPix = false;
  if (props.scene.panVertTransType != VTF.none) {
    if (image && props.scene.panVertTransImg) {
      const height = image.offsetHeight;
      const width = image.offsetWidth;
      const parentHeight = props.parentHeight ? props.parentHeight : window.innerHeight;
      const parentWidth = props.parentWidth ? props.parentWidth : window.innerWidth;
      const widthDiff = Math.max(width - parentWidth, 0);
      const heightDiff = Math.max(height - parentHeight - widthDiff, 0);
      vertTransLevel = heightDiff / 2;
      vertPix = true;
    } else {
      vertTransLevel = props.scene.panVertTransLevel;
      if (props.scene.panVertTransRandom) {
        vertTransLevel = Math.floor(Math.random() * (props.scene.panVertTransLevelMax - props.scene.panVertTransLevelMin + 1)) + props.scene.panVertTransLevelMin;
      }
    }
    if (props.scene.panVertTransType == VTF.up) {
      vertTransLevel = -vertTransLevel;
    } else if (props.scene.panVertTransType == VTF.down) {
      // Already set
    } else if (props.scene.panVertTransType == VTF.random) {
      if ((sceneTiming && panOutRef.current) || (!sceneTiming && stateTogglePan)) {
        const type = Math.floor(Math.random() * 2);
        if (type) {
          vertTransLevel = -vertTransLevel;
        }
        lastVertRandomRef.current = type;
      } else {
        if (lastVertRandomRef.current == 0) {
          // Already set
        } else {
          vertTransLevel = -vertTransLevel;
        }
      }
    }
  }
  const vertSuffix = vertPix ? "px" : "%";

  const horizTransLevelNeg = -horizTransLevel;
  const vertTransLevelNeg = -vertTransLevel;

  const goingOut = sceneTiming ? panOutRef.current : stateTogglePan;
  const transitionItem = sceneTiming
    ? (panOutRef.current ? null : props.togglePan)
    : stateTogglePan;

  const panTransitions = useTransition(transitionItem, {
    keys: (toggle: any) => toggle,
    from: {
      transform: goingOut
        ? `translate3d(${horizTransLevel}${horizSuffix}, ${vertTransLevel}${vertSuffix}, 0)`
        : `translate3d(${horizTransLevelNeg}${horizSuffix}, ${vertTransLevelNeg}${vertSuffix}, 0)`,
    },
    enter: {
      transform: goingOut
        ? `translate3d(${horizTransLevelNeg}${horizSuffix}, ${vertTransLevelNeg}${vertSuffix}, 0)`
        : `translate3d(${horizTransLevel}${horizSuffix}, ${vertTransLevel}${vertSuffix}, 0)`,
    },
    leave: {
      transform: goingOut
        ? `translate3d(${horizTransLevel}${horizSuffix}, ${vertTransLevel}${vertSuffix}, 0)`
        : `translate3d(${horizTransLevelNeg}${horizSuffix}, ${vertTransLevelNeg}${vertSuffix}, 0)`,
    },
    config: {
      duration: sceneTiming ? getDuration(props) : stateDuration,
      easing: goingOut
        ? getEaseFunction(props.scene.panEndEase, props.scene.panEndExp, props.scene.panEndAmp, props.scene.panEndPer, props.scene.panEndOv)
        : getEaseFunction(props.scene.panStartEase, props.scene.panStartExp, props.scene.panStartAmp, props.scene.panStartPer, props.scene.panStartOv)
    },
  });

  React.useEffect(() => {
    if (!sceneTiming) return;
    clearTimeout(panTimeoutRef.current as any);
    const p = propsRef.current;
    const dur = getDuration(p);
    if (panOutRef.current) {
      p.panFunction();
      panTimeoutRef.current = setTimeout(() => {
        panOutRef.current = false;
      }, dur);
    } else {
      panTimeoutRef.current = setTimeout(() => {
        panOutRef.current = true;
        setStateTogglePan(t => !t);
      }, dur);
    }
    return () => {
      if (panTimeoutRef.current) clearTimeout(panTimeoutRef.current);
    };
  }, [sceneTiming, props.togglePan]);

  React.useEffect(() => {
    panOutRef.current = false;
    lastHorizRandomRef.current = 0;
    lastVertRandomRef.current = 0;
    if (sceneTiming || !props.scene.panning) return;

    let cancelled = false;
    let panIn = true;
    const loop = () => {
      if (cancelled) return;
      const p = propsRef.current;
      const dur = getDuration(p);
      setStateDuration(dur);
      setStateTogglePan(panIn);
      p.panFunction();
      panIn = !panIn;
      panTimeoutRef.current = setTimeout(loop, dur);
    };
    loop();

    return () => {
      cancelled = true;
      if (panTimeoutRef.current) clearTimeout(panTimeoutRef.current);
    };
  }, [sceneTiming, props.scene.panTF, props.scene.panning]);

  return (
    <React.Fragment>
      {panTransitions((springProps, item, transition) => {
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
            }}>
            {props.children}
          </animated.div>
        );
      })}
    </React.Fragment>
  );
}

(Panning as any).displayName="Panning";
