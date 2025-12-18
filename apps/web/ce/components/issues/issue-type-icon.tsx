import React from "react";
import { Tooltip } from "@plane/propel/tooltip";
import { Logo } from "@plane/propel/emoji-icon-picker";
import type { TLogoProps } from "@plane/types";

interface IssueTypeIconProps {
  issueType: {
    name?: string;
    logo_props?: TLogoProps;
    issue_type?: {
      name: string;
      logo_props?: TLogoProps;
    };
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
  // 중첩된 데이터 구조 처리
  const actualIssueType = issueType?.issue_type || issueType;
  const logoProps = actualIssueType?.logo_props;
  const name = actualIssueType?.name || issueType?.name;

  if (!logoProps) return null;

  const iconElement = (
    <div className={`flex items-center justify-center ${className}`}>
      <Logo logo={logoProps} size={size} />
    </div>
  );

  if (showTooltip) {
    return (
      <Tooltip tooltipContent={name || ""} position="top">
        {iconElement}
      </Tooltip>
    );
  }

  return iconElement;
};
