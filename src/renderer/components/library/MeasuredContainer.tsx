import * as React from "react";

/**
 * Self-measuring container that passes its box (width/height) to a render prop.
 * Drop-in replacement for react-virtualized-auto-sizer that does not depend on
 * its parent resolving a percentage height, so list rows always get a real
 * viewport height regardless of layout.
 */
type MCProps = { children: (size: { width: number; height: number }) => React.ReactNode };
type MCState = { width: number; height: number };

export class MeasuredContainer extends React.Component<MCProps, MCState> {
  ref = React.createRef<HTMLDivElement>();
  ro: ResizeObserver | null = null;
  raf = 0;
  state: MCState = { width: 0, height: 0 };

  schedule = () => {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.update);
  };

  update = () => {
    const el = this.ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Guard against unstyled/collapsed parents: never hand back a zero box,
    // otherwise the virtual list renders no rows at all.
    const height = r.height >= 10 ? r.height : Math.max(window.innerHeight - 220, 200);
    const width = r.width >= 10 ? r.width : window.innerWidth;
    this.setState((s) => (s.width === width && s.height === height ? s : { width, height }));
  };

  componentDidMount() {
    this.update();
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.schedule());
      if (this.ref.current) this.ro.observe(this.ref.current);
    }
    window.addEventListener("resize", this.schedule);
  }

  componentWillUnmount() {
    if (this.ro) this.ro.disconnect();
    window.removeEventListener("resize", this.schedule);
    cancelAnimationFrame(this.raf);
  }

  render() {
    return (
      <div ref={this.ref} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {this.props.children({ width: this.state.width, height: this.state.height })}
      </div>
    );
  }
}
