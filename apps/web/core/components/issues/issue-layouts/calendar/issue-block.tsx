"use client";

/* eslint-disable react/display-name */
import { useState, useRef, forwardRef, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { TIssue } from "@plane/types";
// ui
import { Tooltip } from "@plane/propel/tooltip";
import { ControlLink } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web components
import { IssueIdentifier } from "@/plane-web/components/issues/issue-details/issue-identifier";
// local components
import { TRenderQuickActions } from "../list/list-view-types";
import { CalendarStoreType } from "./base-calendar-root";

const stringToColor = (str: string, opacity: number = 0.15) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  const s = 65 + (hash % 15);
  const l = 92 + (hash % 4);
  return `hsla(${h}, ${s}%, ${l}%, ${opacity})`;
};

type Props = {
  issue: TIssue;
  quickActions: TRenderQuickActions;
  isDragging?: boolean;
  isDragDisabled?: boolean;
  date: Date;
  issueInfo?: {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  };
  isEpic?: boolean;
  className?: string;
};

export const CalendarIssueBlock = observer(
  forwardRef<HTMLAnchorElement, Props>((props, ref) => {
    const {
      issue,
      quickActions,
      isDragging = false,
      isDragDisabled = false,
      date,
      issueInfo,
      isEpic = false,
      className = "",
    } = props;

    const [isMenuActive, setIsMenuActive] = useState(false);

    const isDraggingState = isDragging;

    const blockRef = useRef<HTMLDivElement>(null);
    const menuActionRef = useRef<HTMLDivElement | null>(null);

    const { workspaceSlug } = useParams();
    const { getProjectStates } = useProjectState();
    const { getIsIssuePeeked } = useIssueDetail();
    const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
    const { isMobile } = usePlatformOS();
    const storeType = useIssueStoreType() as CalendarStoreType;
    const { issuesFilter } = useIssues(storeType);
    const { getProjectIdentifierById } = useProject();

    const stateColor = getProjectStates(issue?.project_id)?.find((state) => state?.id === issue?.state_id)?.color || "";
    const projectIdentifier = getProjectIdentifierById(issue?.project_id);

    const workItemLink = generateWorkItemLink({
      workspaceSlug: workspaceSlug?.toString(),
      projectId: issue?.project_id,
      issueId: issue?.id,
      projectIdentifier,
      sequenceId: issue?.sequence_id,
      isEpic,
      isArchived: !!issue?.archived_at,
    });

    const handleIssuePeekOverview = (currentIssue: TIssue) =>
      handleRedirection(workspaceSlug?.toString(), currentIssue, isMobile);

    useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

    const isSelected = getIsIssuePeeked(issue.id);

    const customActionButton = (
      <div
        ref={menuActionRef}
        className={cn(
          "w-full cursor-pointer rounded p-1 text-custom-text-200 hover:bg-custom-background-80",
          {
            "bg-custom-background-80 text-custom-text-100": isMenuActive,
          }
        )}
        onClick={() => setIsMenuActive((prev) => !prev)}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </div>
    );

    const isMenuActionRefAboveScreenBottom =
      menuActionRef.current && menuActionRef.current.getBoundingClientRect().bottom < window.innerHeight - 220;

    const placement = isMenuActionRefAboveScreenBottom ? "bottom-end" : "top-end";

    const blockStyles = useMemo(() => {
      const hasDates = issue.start_date && issue.target_date;
      const backgroundColor = hasDates ? stringToColor(issue.id) : "transparent";

      const base = {
        backgroundColor,
        borderColor: stateColor,
        borderWidth: "1px",
        borderStyle: "solid" as const,
        borderRadius: "0.5rem",
        boxShadow: "rgba(0, 0, 0, 0.08) 0px 2px 4px, rgba(0, 0, 0, 0.03) 0px 0px 2px",
        position: "relative" as const,
        zIndex: 1,
        transition: "all 0.2s ease-in-out",
      };

      if (issueInfo?.isContinuous || issueInfo?.isStartDate || issueInfo?.isEndDate) {
        return {
          ...base,
          marginLeft: 0,
          marginRight: 0,
        };
      }
      return base;
    }, [issue.id, issue.start_date, issue.target_date, issueInfo?.isContinuous, issueInfo?.isStartDate, issueInfo?.isEndDate, stateColor]);

    return (
      <ControlLink
        id={`issue-${issue.id}`}
        href={workItemLink}
        onClick={() => handleIssuePeekOverview(issue)}
        className={cn(
          "block w-full text-sm text-custom-text-100 transition-all duration-200",
          {
            "bg-custom-background-90 shadow-lg scale-[1.02] z-[5]": isDragging,
            "hover:bg-custom-background-90 hover:shadow-sm": !isDragging && !isSelected,
            "relative after:absolute after:inset-0 after:bg-custom-background-100/10 after:pointer-events-none after:z-[1]": isSelected,
            "hover:z-10": issue.start_date && issue.target_date && issue.start_date !== issue.target_date,
          },
          className
        )}
        style={blockStyles}
        disabled={!!issue?.tempId || isMobile || isDragDisabled}
        ref={ref}
      >
        {issue?.tempId !== undefined && (
          <div className="absolute left-0 top-0 z-[2] h-full w-full animate-pulse bg-custom-background-100/20" />
        )}

        <div
          ref={blockRef}
          className={cn(
            "group/calendar-block flex h-12 md:h-11 w-full items-start justify-between gap-1.5 px-2.5 py-1.5 rounded-sm transition-all duration-200",
            {
              "bg-custom-background-90/50 backdrop-blur-sm": isDraggingState,
              "hover:bg-custom-background-90/30": !isDraggingState && !isSelected,
              "bg-custom-background-90/30 backdrop-blur-sm": isSelected,
              "rounded-none": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
              "rounded-l-sm": issueInfo?.isStartDate,
              "rounded-r-sm": issueInfo?.isEndDate,
            }
          )}
        >
          <div className="flex h-full items-start gap-2 truncate pt-1.5">
            <span
              className={cn("h-full w-1 flex-shrink-0 rounded-full transition-all duration-200 mt-[-9px]", {
                "w-1.5": isSelected,
                "opacity-80": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
              })}
              style={{
                backgroundColor: stateColor,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            />
            <div className="flex items-center gap-1 truncate">
              {projectIdentifier && (
                <div
                  className={cn("flex-shrink-0", {
                    "opacity-95": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
                  })}
                >
                  <IssueIdentifier
                    issueId={issue.id}
                    projectId={issue.project_id || ""}
                    size="xs"
                    textContainerClassName={cn("text-xs font-medium text-custom-text-300", {
                      "text-custom-text-200": isSelected,
                    })}
                    displayProperties={{ key: true, issue_type: true }}
                  />
                </div>
              )}
              <Tooltip tooltipContent={issue.name} position="top-start" isMobile={isMobile}>
                <span
                  className={cn("truncate text-xs font-medium", {
                    "text-custom-text-200": !isSelected,
                    "text-custom-text-100": isSelected,
                    "opacity-95": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
                    "font-semibold": issueInfo?.isStartDate || issueInfo?.isEndDate,
                  })}
                >
                  {issue.name}
                </span>
              </Tooltip>
            </div>
          </div>
          <div
            className={cn("flex-shrink-0 size-5 transition-all duration-200 pt-1", {
              "opacity-0 group-hover/calendar-block:opacity-100": !isMobile && !isSelected,
              "opacity-100": isMenuActive || isSelected,
            })}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
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
