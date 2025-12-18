import type { FC, ReactNode } from "react";
import { cn } from "@plane/utils";

export type GanttChartGroupHeaderProps = {
  group: {
    name: string;
    icon?: ReactNode;
  };
  count: number;
  className?: string;
  isPlaceholder?: boolean;
};

export const GanttChartGroupHeader: FC<GanttChartGroupHeaderProps> = (props) => {
  const { group, count, className, isPlaceholder = false } = props;

  return (
    <div
      className={cn(
        "relative min-w-full w-max border-b border-custom-border-200 bg-custom-background-90 px-2 py-1.5",
        {
          "opacity-0 pointer-events-none select-none": isPlaceholder,
        },
        className
      )}
      aria-hidden={isPlaceholder}
    >
      <div className="flex items-center gap-2 text-xs">
        {group.icon && <span className="flex-shrink-0 text-custom-text-400">{group.icon}</span>}
        <h3 className="text-xs font-medium text-custom-text-300 truncate">{group.name}</h3>
        <span className="text-xs text-custom-text-400">({count})</span>
      </div>
    </div>
  );
};
