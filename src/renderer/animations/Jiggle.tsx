import * as React from 'react';
import {animated, useSpring} from "@react-spring/web";

interface JiggleProps {
  bounce?: boolean,
  id?: string,
  className?: string,
  style?: any,
  disable?: boolean
  onClick?(): void,
  children?: React.ReactNode,
}

export default function Jiggle(props: JiggleProps) {
  const animatingRef = React.useRef(false);

  const [springProps, api] = useSpring(() => ({
    from: {transform: 'scale(1, 1)'},
    to: {transform: 'scale(1, 1)'},
    config: {duration: 100},
  }));

  const stopJiggle = React.useCallback(() => {
    animatingRef.current = false;
  }, []);

  const jiggle = React.useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const bounce = props.bounce;
    const animate = async () => {
      if (bounce) {
        await api.start({transform: 'scale(1.1, 0.9) translate(0, -5px)', config: {duration: 80}});
        await api.start({transform: 'scale(0.9, 1.1) translate(0, -5px)', config: {duration: 80}});
        await api.start({transform: 'scale(1.0, 1.0) translate(0, 0)', config: {duration: 80}});
      } else {
        await api.start({transform: 'scale(1.1, 0.9)', config: {duration: 100}});
        await api.start({transform: 'scale(0.9, 1.1)', config: {duration: 100}});
        await api.start({transform: 'scale(1.0, 1.0)', config: {duration: 100}});
      }
      stopJiggle();
    };
    animate();
  }, [props.bounce, api, stopJiggle]);

  if (props.disable) {
    return (
      <div
        className={props.className}
        style={props.style}
        onClick={props.onClick}>
        {props.children}
      </div>
    );
  }

  return (
    <animated.div
      id={props.id}
      className={props.className}
      style={props.style ? {...springProps, ...props.style} : springProps}
      onMouseEnter={jiggle}
      onClick={props.onClick}>
      {props.children}
    </animated.div>
  );
}

(Jiggle as any).displayName="Jiggle";
