import * as React from "react";

import { ISvgIcons } from "./type";

export const OidcIcon: React.FC<ISvgIcons> = ({ width = "24", height = "24", className, color }) => (
  <svg
    width={width}
    height={height}
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_3695_11896)">
      <path d="M83.0398 32.6876C74.2901 27.2397 62.0735 23.8553 48.7013 23.8553C21.7918 23.8553 0 37.3101 0 53.9016C0 69.0898 18.1598 81.554 41.685 83.7001V74.9504C25.8364 72.9693 13.95 64.3022 13.95 53.9016C13.95 42.0977 29.4684 32.44 48.7013 32.44C58.2765 32.44 66.9436 34.8338 73.217 38.7134L64.3022 44.2439H92.1197V27.0746L83.0398 32.6876Z" fill={color ? color : "#CCCCCC"}/>
      <path d="M41.6846 8.99736V74.9504V83.7002L55.6346 74.9504V0L41.6846 8.99736Z" fill="#FF6200"/>
    </g>
    <defs>
      <clipPath id="clip0_3695_11896">
        <rect width="92" height="84" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);
