import * as React from "react";

import { styled, Theme } from "@mui/material/styles";

const StyledRoot = styled("div")(({ theme }: { theme: Theme }) => ({
}));

class Template extends React.Component {
  render() {
    return(
      <StyledRoot/>
    );
  }
}

(Template as any).displayName="Template";
export default Template;
