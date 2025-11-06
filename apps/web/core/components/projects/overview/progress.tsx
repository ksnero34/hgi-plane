import type { FC } from "react";
import { STATE_GROUPS } from "@plane/constants";
import type { TProjectOverviewSnapshot, TStateGroups } from "@plane/types";
import { Loader } from "@plane/ui";

const STATE_ORDER: TStateGroups[] = ["backlog", "unstarted", "started", "completed", "cancelled"];

type Props = {
  data?: TProjectOverviewSnapshot;
  isLoading: boolean;
};

export const ProjectOverviewProgress: FC<Props> = (props) => {
  const { data, isLoading } = props;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-custom-border-200 bg-custom-background-100 p-6">
        <Loader.Item height="18px" width="120px" />
        <Loader.Item height="12px" width="100%" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Loader.Item key={index} height="60px" width="100%" />
          ))}
        </div>
      </div>
    );
  }

  const total = data?.total_issues ?? 0;

  const segments = STATE_ORDER.map((group) => {
    const count = data?.state_distribution?.[group] ?? 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      key: group,
      label: STATE_GROUPS[group].label,
      color: STATE_GROUPS[group].color,
      count,
      percentage,
    };
  });

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-custom-border-200 bg-custom-background-100 p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-custom-text-300">Progress</h3>
        <span className="text-sm text-custom-text-200">
          {total} work item{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded bg-custom-background-80">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${total === 0 ? 0 : segment.percentage}%`, backgroundColor: segment.color }}
            className="h-full transition-all duration-300"
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="flex flex-col gap-2 rounded-md border border-custom-border-200 bg-custom-background-90 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: segment.color }} />
              <span className="text-sm font-medium text-custom-text-200">{segment.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-custom-text-100">{segment.count}</span>
              <span className="text-xs text-custom-text-300">{segment.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
