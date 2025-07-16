import React from "react";
import { Tooltip } from "@plane/ui";
import { Logo } from "@/components/common";
import { TLogoProps } from "@plane/types";

interface IssueTypeIconProps {
  issueType: {
    name: string;
    logo_props?: TLogoProps;
  };
  size?: number;
  showTooltip?: boolean;
  className?: string;
}

export const IssueTypeIcon: React.FC<IssueTypeIconProps> = ({
  issueType,
  size = 16,
  showTooltip = true,
  className = "",
}) => {
  if (!issueType?.logo_props) return null;

  const iconElement = (
    <div className={`flex items-center justify-center ${className}`}>
      <Logo logo={issueType.logo_props} size={size} />
    </div>
  );

  if (showTooltip) {
    return (
      <Tooltip tooltipContent={issueType.name} position="top">
        {iconElement}
      </Tooltip>
    );
  }

  return iconElement;
};