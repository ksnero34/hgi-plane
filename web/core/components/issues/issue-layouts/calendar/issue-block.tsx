"use client";

import { useState, useRef, forwardRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { TIssue } from "@plane/types";
// ui
import { Tooltip, ControlLink } from "@plane/ui";
// helpers
import { cn } from "@/helpers/common.helper";
import { generateWorkItemLink } from "@/helpers/issue.helper";
// hooks
import { useIssueDetail, useIssues, useProject, useProjectState } from "@/hooks/store";
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
  
  // 더 부드러운 색상을 위해 채도와 명도 조정
  const h = hash % 360;
  const s = 65 + (hash % 15); // 65-80% 채도
  const l = 88 + (hash % 7); // 88-95% 명도
  
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
      isEpic = false
    } = props;
    // states
    const [isMenuActive, setIsMenuActive] = useState(false);
    const [isDraggingState, setIsDraggingState] = useState(false);
    // refs
    const blockRef = useRef<HTMLDivElement>(null);
    const menuActionRef = useRef<HTMLDivElement | null>(null);
    // hooks
    const { workspaceSlug } = useParams();
    const { getProjectStates } = useProjectState();
    const { getIsIssuePeeked } = useIssueDetail();
    const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
    const { isMobile } = usePlatformOS();
    const storeType = useIssueStoreType() as CalendarStoreType;
    const { issuesFilter } = useIssues(storeType);
    const { getProjectIdentifierById } = useProject();

    const stateColor = getProjectStates(issue?.project_id)?.find((state) => state?.id == issue?.state_id)?.color || "";
    const projectIdentifier = getProjectIdentifierById(issue?.project_id);

    const isSelected = getIsIssuePeeked(issue.id);

    // 이슈의 배경색과 스타일 계산
    const getBlockStyles = () => {
      // 기본 배경색 설정 - 시작일과 종료일이 있는 경우에만 배경색 적용
      const bgColor = issue.start_date && issue.target_date ? stringToColor(issue.id) : "transparent";
      
      const baseStyles: any = {
        backgroundColor: bgColor,
        // 개별 border 속성 사용
        borderTopColor: stateColor,
        borderBottomColor: stateColor,
        borderLeftColor: stateColor,
        borderRightColor: stateColor,
        borderTopStyle: "solid",
        borderBottomStyle: "solid",
        borderLeftStyle: "solid",
        borderRightStyle: "solid",
        borderTopWidth: "1px",
        borderBottomWidth: "1px",
        borderLeftWidth: "1px",
        borderRightWidth: "1px",
        borderTopLeftRadius: "0.375rem",
        borderTopRightRadius: "0.375rem",
        borderBottomLeftRadius: "0.375rem",
        borderBottomRightRadius: "0.375rem",
        // 연속성을 위한 마진 조정
        marginLeft: "0px",
        marginRight: "0px"
      };

      // 시작일과 종료일이 있는 경우 그라데이션 효과 추가
      if (issue.start_date && issue.target_date) {
        baseStyles.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }

      // 연속된 날짜 표시를 위한 스타일
      if (issueInfo?.isContinuous) {
        // 연속된 블록의 경우 좌우 테두리 제거하고 모서리 둥글기 제거
        baseStyles.borderLeftWidth = "0";
        baseStyles.borderRightWidth = "0";
        baseStyles.borderTopLeftRadius = "0";
        baseStyles.borderTopRightRadius = "0";
        baseStyles.borderBottomLeftRadius = "0";
        baseStyles.borderBottomRightRadius = "0";
        // 연속된 블록 사이의 간격 제거
        baseStyles.marginLeft = "-1px";
        baseStyles.marginRight = "-1px";
        // 연속된 블록의 배경색 유지
        baseStyles.backgroundColor = bgColor;
        // z-index 조정으로 겹침 처리
        baseStyles.position = "relative";
        baseStyles.zIndex = 1;
        
        // 연속된 블록의 상하 테두리 두께 조정
        baseStyles.borderTopWidth = "1px";
        baseStyles.borderBottomWidth = "1px";
        
        // 연속된 블록의 배경색 약간 강조
        if (bgColor !== "transparent") {
          const opacity = 0.15; // 약간 더 진한 배경색
          baseStyles.backgroundColor = stringToColor(issue.id, opacity);
        }
      }

      // 시작일 표시를 위한 스타일
      if (issueInfo?.isStartDate) {
        baseStyles.borderLeftWidth = "3px";
        baseStyles.borderTopLeftRadius = "0.375rem";
        baseStyles.borderBottomLeftRadius = "0.375rem";
        baseStyles.marginLeft = "0px"; // 시작 블록은 마진 없음
        // 시작 블록의 z-index 높임
        baseStyles.position = "relative";
        baseStyles.zIndex = 2;
        
        // 시작일 블록의 오른쪽 테두리 제거 (연결 느낌을 위해)
        if (issue.target_date && issue.start_date !== issue.target_date) {
          baseStyles.borderRightWidth = "0";
          baseStyles.borderTopRightRadius = "0";
          baseStyles.borderBottomRightRadius = "0";
        }
      }

      // 종료일 표시를 위한 스타일
      if (issueInfo?.isEndDate) {
        baseStyles.borderRightWidth = "3px";
        baseStyles.borderTopRightRadius = "0.375rem";
        baseStyles.borderBottomRightRadius = "0.375rem";
        baseStyles.marginRight = "0px"; // 종료 블록은 마진 없음
        // 종료 블록의 z-index 높임
        baseStyles.position = "relative";
        baseStyles.zIndex = 2;
        
        // 종료일 블록의 왼쪽 테두리 제거 (연결 느낌을 위해)
        if (issue.start_date && issue.start_date !== issue.target_date) {
          baseStyles.borderLeftWidth = "0";
          baseStyles.borderTopLeftRadius = "0";
          baseStyles.borderBottomLeftRadius = "0";
        }
      }

      // 선택된 이슈에 대한 스타일 추가
      if (isSelected) {
        baseStyles.boxShadow = "0 0 0 2px rgba(var(--color-primary-500), 0.4)";
        baseStyles.transform = "scale(1.02)";
        baseStyles.zIndex = 10;
        // 선택된 이슈의 테두리 색상 변경
        baseStyles.borderTopColor = "var(--color-primary-70)";
        baseStyles.borderBottomColor = "var(--color-primary-70)";
        baseStyles.borderLeftColor = "var(--color-primary-70)";
        baseStyles.borderRightColor = "var(--color-primary-70)";
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

            // 시작일과 종료일이 같은 경우 특별 처리
            const datesAreEqual = startDateStr && targetDateStr && startDateStr === targetDateStr;
            
            // 최종 isStartDate 결정 로직
            let finalIsStartDate = false;
            
            // 1. issueInfo에 명시적으로 isStartDate가 true로 설정된 경우
            if (issueInfo?.isStartDate === true) {
              finalIsStartDate = true;
            } 
            // 2. 시작일과 종료일이 같고 현재 날짜가 그 날짜인 경우 (시작일로 취급)
            else if (datesAreEqual && isStartDate) {
              finalIsStartDate = true;
            }
            // 3. 시작일과 종료일이 다르고, 현재 날짜가 시작일인 경우
            else if (!datesAreEqual && isStartDate) {
              finalIsStartDate = true;
            }

            // 시작일과 종료일이 같은 경우 특별 처리를 위한 플래그
            const isEqualDatesCase = datesAreEqual && (isStartDate || isTargetDate);

            // console.log("[중요] Issue Block - Drag Initial Data:", {
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
            //     issueInfoStartDate: issueInfo?.isStartDate,
            //     datesAreEqual,
            //     isEqualDatesCase,
            //     finalIsStartDate,
            //     isCurrentDateStartDate: isStartDate,
            //     isCurrentDateTargetDate: isTargetDate,
            //     hasBothDates: !!(startDateStr && targetDateStr),
            //     datesAreDifferent: startDateStr !== targetDateStr,
            //     issueInfo: issueInfo
            //   }
            // });

            // 시작일과 종료일이 같은 경우에는 isStartDate 플래그를 전달하지 않음
            // 이렇게 하면 base-calendar-root.tsx에서 드롭 위치에 따라 처리할 수 있음
            if (isEqualDatesCase) {
              return { 
                id: issue.id, 
                projectId: issue.project_id,
                date: currentDateStr,
                isEqualDatesCase: true,
                isStartDate: null, // null로 설정하여 두 날짜 모두 업데이트
                element,
                issue // 이슈 객체 전달
              };
            } else {
              // 명확하게 현재 날짜가 시작일인지 종료일인지 판단
              // isStartDate와 isTargetDate를 모두 고려하여 정확한 플래그 설정
              const finalIsStartDateFixed = isStartDate && !isTargetDate;
              
              // console.log("[중요] Issue Block - 최종 isStartDate 결정:", {
              //   isStartDate,
              //   isTargetDate,
              //   finalIsStartDateFixed,
              //   currentDate: currentDateStr,
              //   startDate: startDateStr,
              //   targetDate: targetDateStr
              // });
              
              return { 
                id: issue.id, 
                projectId: issue.project_id,
                date: currentDateStr,
                isStartDate: finalIsStartDateFixed,
                isEqualDatesCase: false,
                element,
                issue // 이슈 객체 전달
              };
            }
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
    const workItemLink = generateWorkItemLink({
      workspaceSlug: workspaceSlug?.toString(),
      projectId: issue?.project_id,
      issueId: issue?.id,
      projectIdentifier,
      sequenceId: issue?.sequence_id,
      isEpic,
      isArchived: !!issue?.archived_at,
    });

    return (
      <ControlLink
        id={`issue-${issue.id}`}
        href={workItemLink}
        onClick={handleIssuePeekOverview}
        className={cn(
          "block w-full text-sm text-custom-text-100 transition-all duration-200",
          {
            "bg-custom-background-90 shadow-lg transform scale-[1.02] z-[5]": isDraggingState,
            "hover:bg-custom-background-90 hover:shadow-sm": !isDraggingState && !isSelected,
            "relative after:absolute after:inset-0 after:bg-custom-background-100/10 after:pointer-events-none after:z-[1]": isSelected,
            "overflow-hidden": issueInfo?.isContinuous || issueInfo?.isStartDate || issueInfo?.isEndDate,
            "hover:z-10": issue.start_date && issue.target_date && issue.start_date !== issue.target_date,
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
              "rounded-none": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
              "rounded-l-sm": issueInfo?.isStartDate,
              "rounded-r-sm": issueInfo?.isEndDate,
              "border-l-0": issueInfo?.isContinuous || issueInfo?.isEndDate,
              "border-r-0": issueInfo?.isContinuous || issueInfo?.isStartDate,
            }
          )}
        >
          <div className="flex h-full items-center gap-2 truncate">
            <span
              className={cn("h-full w-1 flex-shrink-0 rounded-full transition-all duration-200", {
                "w-1.5": isSelected,
                // 연속된 블록의 상태 표시줄 스타일
                "opacity-70": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
                "opacity-100": issueInfo?.isStartDate || issueInfo?.isEndDate,
                // 시작일과 종료일 블록의 상태 표시줄 스타일
                "rounded-l-full": issueInfo?.isStartDate,
                "rounded-r-full": issueInfo?.isEndDate,
                "rounded-none": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
              })}
              style={{
                backgroundColor: stateColor,
              }}
            />
            <div className="flex items-center gap-1 truncate">
              {projectIdentifier && (
                <span
                  className={cn(
                    "flex-shrink-0 text-xs font-medium text-custom-text-300",
                    {
                      "text-custom-text-200": isSelected,
                      // 연속된 블록의 프로젝트 식별자 스타일
                      "opacity-90": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
                    }
                  )}
                >
                  {projectIdentifier}-{issue.sequence_id}
                </span>
              )}
              <Tooltip tooltipContent={issue.name} position="top-left" isMobile={isMobile}>
                <span
                  className={cn("truncate text-xs font-medium", {
                    "text-custom-text-200": !isSelected,
                    "text-custom-text-100": isSelected,
                    // 연속된 블록의 텍스트 스타일
                    "opacity-90": issueInfo?.isContinuous && !issueInfo?.isStartDate && !issueInfo?.isEndDate,
                    // 시작일과 종료일 블록의 텍스트 스타일
                    "font-semibold": issueInfo?.isStartDate || issueInfo?.isEndDate,
                  })}
                >
                  {issue.name}
                </span>
              </Tooltip>
            </div>
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
