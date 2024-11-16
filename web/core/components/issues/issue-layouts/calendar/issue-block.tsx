"use client";

import { useState, useRef, forwardRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/helpers";
// types
import { TIssue } from "@plane/types";
// ui
import { Tooltip, ControlLink } from "@plane/ui";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useIssueDetail, useIssues, useProjectState } from "@/hooks/store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web components
import { IssueIdentifier } from "@/plane-web/components/issues/issue-details";
// local components
import { TRenderQuickActions } from "../list/list-view-types";
import { CalendarStoreType } from "./base-calendar-root";

// 배경색 생성을 위한 해시 함수
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 부드러운 파스텔톤의 배경색 생성
  const hue = hash % 360;
  return `hsla(${hue}, 30%, 90%, 0.3)`;
};

type Props = {
  issue: TIssue;
  quickActions: TRenderQuickActions;
  isDragging?: boolean;
  date: Date;
  issueInfo?: {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  };
};

export const CalendarIssueBlock = observer(
  forwardRef<HTMLAnchorElement, Props>((props, ref) => {
    const { issue, quickActions, isDragging = false, date, issueInfo } = props;
    // states
    const [isMenuActive, setIsMenuActive] = useState(false);
    // refs
    const blockRef = useRef(null);
    const menuActionRef = useRef<HTMLDivElement | null>(null);
    // hooks
    const { workspaceSlug, projectId } = useParams();
    const { getProjectStates } = useProjectState();
    const { getIsIssuePeeked } = useIssueDetail();
    const { handleRedirection } = useIssuePeekOverviewRedirection();
    const { isMobile } = usePlatformOS();
    const storeType = useIssueStoreType() as CalendarStoreType;
    const { issuesFilter } = useIssues(storeType);

    const stateColor = getProjectStates(issue?.project_id)?.find((state) => state?.id == issue?.state_id)?.color || "";

    // 이슈의 배경색 계산
    const getBackgroundColor = () => {
      if (!issue.start_date || !issue.target_date) return "transparent";
      return stringToColor(issue.id);
    };

    useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

    const handleIssuePeekOverview = () => {
      if (workspaceSlug) {
        handleRedirection(workspaceSlug.toString(), issue, isMobile);
      }
    };

    const customActionButton = (
      <div
        ref={menuActionRef}
        className={`w-full cursor-pointer rounded p-1 text-custom-sidebar-text-400 hover:bg-custom-background-80 ${
          isMenuActive ? "bg-custom-background-80 text-custom-text-100" : "text-custom-text-200"
        }`}
        onClick={() => setIsMenuActive(!isMenuActive)}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </div>
    );

    const isMenuActionRefAboveScreenBottom =
      menuActionRef?.current && menuActionRef?.current?.getBoundingClientRect().bottom < window.innerHeight - 220;

    const placement = isMenuActionRefAboveScreenBottom ? "bottom-end" : "top-end";

    return (
      <ControlLink
        id={`issue-${issue.id}`}
        href={`/${workspaceSlug?.toString()}/projects/${projectId?.toString()}/issues/${issue.id}`}
        onClick={handleIssuePeekOverview}
        className={cn(
          "block w-full text-sm text-custom-text-100",
          {
            "rounded-l-md border-l-2": issueInfo?.isStartDate,
            "rounded-r-md border-r-2": issueInfo?.isEndDate,
            "border-l-0 border-r-0": issueInfo?.isContinuous && !issueInfo.isStartDate && !issueInfo.isEndDate,
            "border-t-2 border-b-2": true,
            "bg-custom-background-90 shadow-custom-shadow-rg": isDragging,
            "hover:bg-custom-background-90": !isDragging,
            "border-custom-primary-70": getIsIssuePeeked(issue.id),
          },
          issue.start_date && issue.target_date ? "border-custom-border-200" : ""
        )}
        style={{
          backgroundColor: getBackgroundColor(),
          borderColor: stateColor,
        }}
        disabled={!!issue?.tempId || isMobile}
        ref={ref}
      >
        <div
          ref={blockRef}
          className={cn(
            "group/calendar-block flex h-10 md:h-8 w-full items-center justify-between gap-1.5 px-2 py-1.5",
            {
              "bg-custom-background-90": isDragging,
              "hover:bg-custom-background-90/50": !isDragging,
            }
          )}
        >
          <div className="flex h-full items-center gap-1.5 truncate">
            <span
              className="h-full w-0.5 flex-shrink-0 rounded"
              style={{
                backgroundColor: stateColor,
              }}
            />
            {issue.project_id && (
              <IssueIdentifier
                issueId={issue.id}
                projectId={issue.project_id}
                textContainerClassName="text-sm md:text-xs text-custom-text-300"
                displayProperties={issuesFilter?.issueFilters?.displayProperties}
              />
            )}
            <Tooltip tooltipContent={issue.name} isMobile={isMobile}>
              <div className="truncate text-sm font-medium md:font-normal md:text-xs">{issue.name}</div>
            </Tooltip>
          </div>
          <div
            className={cn("flex-shrink-0 size-5", {
              "hidden group-hover/calendar-block:block": !isMobile,
              block: isMenuActive,
            })}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {quickActions({
              issue,
              parentRef: blockRef,
              customActionButton,
              placement,
            })}
          </div>
        </div>
      </ControlLink>
    );
  })
);

CalendarIssueBlock.displayName = "CalendarIssueBlock";
