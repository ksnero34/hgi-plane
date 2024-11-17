"use client";

import { useState, useRef, forwardRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
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
import { HIGHLIGHT_CLASS } from "./utils";

// 배경색 생성을 위한 해시 함수 개선
const stringToColor = (str: string, opacity: number = 0.1) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 부드러운 파스텔톤의 배경색 생성 (채도와 명도 조정)
  const hue = hash % 360;
  return `hsla(${hue}, 70%, 85%, ${opacity})`;
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
};

export const CalendarIssueBlock = observer(
  forwardRef<HTMLAnchorElement, Props>((props, ref) => {
    const { 
      issue, 
      quickActions, 
      isDragging = false, 
      isDragDisabled = false, 
      date, 
      issueInfo 
    } = props;
    // states
    const [isMenuActive, setIsMenuActive] = useState(false);
    const [isDraggingState, setIsDraggingState] = useState(false);
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

    const isSelected = getIsIssuePeeked(issue.id);

    // 이슈의 배경색과 스타일 계산
    const getBlockStyles = () => {
      const baseStyles: any = {
        backgroundColor: issue.start_date && issue.target_date ? stringToColor(issue.id) : "transparent",
        borderColor: stateColor,
      };

      // 시작일과 종료일이 있는 경우 그라데이션 효과 추가
      if (issue.start_date && issue.target_date) {
        baseStyles.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }

      // 선택된 이슈에 대한 스타일 추가
      if (isSelected) {
        baseStyles.boxShadow = "0 0 0 2px rgba(var(--color-primary-500), 0.4)";
        baseStyles.transform = "scale(1.02)";
        baseStyles.zIndex = 10;
      }

      return baseStyles;
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

    useEffect(() => {
      const element = blockRef.current;

      if (!element || !issue) return;

      return combine(
        draggable({
          element,
          canDrag: () => !isDragDisabled,
          getInitialData: () => {
            // 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
            const formatToLocalDate = (date: Date | string) => {
              const d = new Date(date);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };

            // 날짜 비교를 위해 로컬 시간 기준으로 문자열 변환
            const currentDateStr = formatToLocalDate(date);
            const startDateStr = issue.start_date ? formatToLocalDate(issue.start_date) : null;
            const targetDateStr = issue.target_date ? formatToLocalDate(issue.target_date) : null;

            // 현재 날짜가 start_date와 일치하는지 확인
            const isStartDate = startDateStr === currentDateStr;
            const isTargetDate = targetDateStr === currentDateStr;

            // start_date와 target_date가 모두 있고, 현재 날짜가 start_date와 일치하는 경우에만 start_date로 처리
            const shouldTreatAsStartDate = isStartDate && 
              !isTargetDate && // start_date와 target_date가 같은 날짜가 아닌 경우
              startDateStr && 
              targetDateStr;

            // console.log("Drag Initial Data:", {
            //   issue: {
            //     id: issue.id,
            //     name: issue.name,
            //     originalStartDate: issue.start_date,
            //     originalTargetDate: issue.target_date
            //   },
            //   dates: {
            //     currentDate: {
            //       raw: date,
            //       formatted: currentDateStr
            //     },
            //     startDate: {
            //       raw: issue.start_date,
            //       formatted: startDateStr
            //     },
            //     targetDate: {
            //       raw: issue.target_date,
            //       formatted: targetDateStr
            //     }
            //   },
            //   checks: {
            //     isStartDate,
            //     isTargetDate,
            //     shouldTreatAsStartDate,
            //     isCurrentDateStartDate: isStartDate,
            //     isCurrentDateTargetDate: isTargetDate,
            //     hasBothDates: !!(startDateStr && targetDateStr),
            //     datesAreDifferent: startDateStr !== targetDateStr
            //   }
            // });

            return { 
              id: issue.id, 
              date: currentDateStr,
              isStartDate: shouldTreatAsStartDate
            };
          },
          onDragStart: () => {
            setIsDraggingState(true);
            element.classList.add(HIGHLIGHT_CLASS);
          },
          onDrop: () => {
            setIsDraggingState(false);
            element.classList.remove(HIGHLIGHT_CLASS);
          },
        })
      );
    }, [blockRef?.current, issue, isDragDisabled, date]);

    return (
      <ControlLink
        id={`issue-${issue.id}`}
        href={`/${workspaceSlug?.toString()}/projects/${projectId?.toString()}/issues/${issue.id}`}
        onClick={handleIssuePeekOverview}
        className={cn(
          "block w-full text-sm text-custom-text-100 transition-all duration-200",
          {
            "rounded-l-md border-l-[3px]": issueInfo?.isStartDate,
            "rounded-r-md border-r-[3px]": issueInfo?.isEndDate,
            "border-l-0 border-r-0": issueInfo?.isContinuous && !issueInfo.isStartDate && !issueInfo.isEndDate,
            "border-t border-b": true,
            "bg-custom-background-90 shadow-lg transform scale-[1.02] z-[5]": isDraggingState,
            "hover:bg-custom-background-90 hover:shadow-sm": !isDraggingState && !isSelected,
            "border-custom-primary-70": isSelected,
            "relative after:absolute after:inset-0 after:bg-custom-background-100/10 after:pointer-events-none after:z-[1]": isSelected,
          }
        )}
        style={getBlockStyles()}
        disabled={!!issue?.tempId || isMobile}
        ref={ref}
      >
        <div
          ref={blockRef}
          className={cn(
            "group/calendar-block flex h-10 md:h-8 w-full items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-sm transition-all duration-200",
            {
              "bg-custom-background-90/50 backdrop-blur-sm": isDraggingState,
              "hover:bg-custom-background-90/30": !isDraggingState && !isSelected,
              "bg-custom-background-90/30 backdrop-blur-sm": isSelected,
            }
          )}
        >
          <div className="flex h-full items-center gap-2 truncate">
            <span
              className={cn("h-full w-1 flex-shrink-0 rounded-full transition-all duration-200", {
                "w-1.5": isSelected,
              })}
              style={{
                backgroundColor: stateColor,
              }}
            />
            {issue.project_id && (
              <IssueIdentifier
                issueId={issue.id}
                projectId={issue.project_id}
                textContainerClassName={cn("text-sm md:text-xs text-custom-text-300", {
                  "font-medium": isSelected,
                })}
                displayProperties={issuesFilter?.issueFilters?.displayProperties}
              />
            )}
            <Tooltip tooltipContent={issue.name} isMobile={isMobile}>
              <div 
                className={cn("truncate text-sm md:text-xs", {
                  "font-medium": !isSelected,
                  "font-semibold": isSelected,
                })}
              >
                {issue.name}
              </div>
            </Tooltip>
          </div>
          <div
            className={cn("flex-shrink-0 size-5 transition-all duration-200", {
              "opacity-0 group-hover/calendar-block:opacity-100": !isMobile && !isSelected,
              "opacity-100": isMenuActive || isSelected,
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
