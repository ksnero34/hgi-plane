import React from "react";
import { cn } from "./utils";

type Props = {
  isVisible: boolean;
  classNames?: string;
};

export function DropIndicator(props: Props) {
  const { isVisible, classNames = "" } = props;

  return (
    <div
      className={cn(
        "relative block w-full",
        isVisible
          ? `h-[2px]
        before:left-0 before:relative before:block before:top-[-2px] before:h-[6px] before:w-[6px] before:rounded
        after:left-[calc(100%-6px)] after:relative after:block after:top-[-8px] after:h-[6px] after:w-[6px] after:rounded
        bg-custom-primary-100 before:bg-custom-primary-100 after:bg-custom-primary-100`
          : "h-0 before:hidden after:hidden",
        classNames
      )}
    />
  );
}
