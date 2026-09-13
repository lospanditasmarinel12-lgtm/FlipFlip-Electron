import * as React from 'react';
import {animated, useSpring} from "@react-spring/web";

interface VSpinProps {
  className?: string,
  title?: string,
  style?: any,
  onClick?(): void,
  children?: React.ReactNode,
}

export default function VSpin(props: VSpinProps) {
  const [toggle, setToggle] = React.useState(false);

  const springProps = useSpring({
    from: {transform: 'rotateX(0deg)'},
    to: {transform: toggle ? 'rotateX(360deg)' : 'rotateX(0deg)'},
  });

  return (
    <animated.div
      className={props.className}
      style={props.style ? {...springProps, ...props.style} : springProps}
      title={props.title}
      onMouseEnter={() => {setToggle(!toggle)}}
      onClick={props.onClick}>
      {props.children}
    </animated.div>
  );
}

(VSpin as any).displayName="VSpin";
