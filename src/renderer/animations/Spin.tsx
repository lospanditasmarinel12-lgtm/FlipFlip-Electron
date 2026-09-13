import * as React from 'react';
import {animated, useSpring} from "@react-spring/web";

interface SpinProps {
  className?: string,
  title?: string,
  style?: any,
  onClick?(): void,
  children?: React.ReactNode,
}

export default function Spin(props: SpinProps) {
  const [toggle, setToggle] = React.useState(false);

  const outerProps = useSpring({
    from: {transform: 'rotateY(0deg)'},
    to: {transform: toggle ? 'rotateY(180deg)' : 'rotateY(0deg)'},
  });

  const innerProps = useSpring({
    from: {transform: 'rotateY(0deg)'},
    to: {transform: toggle ? 'rotateY(-180deg)' : 'rotateY(0deg)'},
  });

  return (
    <animated.div
      className={props.className}
      style={props.style ? {...outerProps, ...props.style} : outerProps}
      title={props.title}
      onMouseEnter={() => {setToggle(!toggle)}}
      onClick={props.onClick}>
      <animated.div style={innerProps}>
        {props.children}
      </animated.div>
    </animated.div>
  );
}

(Spin as any).displayName="Spin";
