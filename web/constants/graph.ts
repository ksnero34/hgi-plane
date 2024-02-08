// nivo
import { Theme } from "@nivo/core";

export const CHARTS_THEME: Theme = {
  background: "transparent",
  textColor: "rgb(var(--color-neutral-110))",
  axis: {
    domain: {
      line: {
        stroke: "rgb(var(--color-background-80))",
        strokeWidth: 0.5,
      },
    },
  },
  tooltip: {
    container: {
      background: "rgb(var(--color-background-80))",
      color: "rgb(var(--color-neutral-110))",
      fontSize: "0.8rem",
      border: "1px solid rgb(var(--color-neutral-70))",
    },
  },
  grid: {
    line: {
      stroke: "rgb(var(--color-neutral-60))",
    },
  },
};

export const DEFAULT_MARGIN = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50,
};
