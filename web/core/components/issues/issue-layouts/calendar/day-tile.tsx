"use client";

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { differenceInCalendarDays } from "date-fns";
import { observer } from "mobx-react";
// types
import { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
// ui
import { TOAST_TYPE, setToast } from "@plane/ui";
// components
import { CalendarIssueBlocks, ICalendarDate } from "@/components/issues";
import { highlightIssueOnDrop } from "@/components/issues/issue-layouts/utils";
// helpers
import { MONTHS_LIST } from "@/constants/calendar";
// helpers
import { cn } from "@/helpers/common.helper";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// types
import { ICycleIssuesFilter } from "@/store/issue/cycle";
import { IModuleIssuesFilter } from "@/store/issue/module";
import { IProjectIssuesFilter } from "@/store/issue/project";
import { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import { TRenderQuickActions } from "../list/list-view-types";
import { useParams } from "next/navigation";
import { useIssueDetail } from "@/hooks/store";

type Props = {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  date: ICalendarDate;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  quickActions: TRenderQuickActions;
  handleDragAndDrop: (
    issueId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined
  ) => Promise<void>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  readOnly?: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  issueInfo?: Map<string, {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  }>;
};

export const CalendarDayTile: React.FC<Props> = observer((props) => {
  const {
    issuesFilterStore,
    date,
    issues,
    groupedIssueIds,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    quickActions,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    addIssuesToView,
    readOnly = false,
    selectedDate,
    handleDragAndDrop,
    setSelectedDate,
    issueInfo,
  } = props;

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { workspaceSlug, projectId: rawProjectId } = useParams();
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const { updateIssue } = useIssueDetail();

  const calendarLayout = issuesFilterStore?.issueFilters?.displayFilters?.calendar?.layout ?? "month";

  const formattedDatePayload = renderFormattedPayloadDate(date.date);

  const dayTileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = dayTileRef.current;

    if (!element) return;

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ date: formattedDatePayload }),
        onDragEnter: () => {
          setIsDraggingOver(true);
        },
        onDragLeave: () => {
          setIsDraggingOver(false);
        },
        onDrop: ({ source, self }) => {
          setIsDraggingOver(false);
          const sourceData = source?.data as { id: string; date: string; isStartDate: boolean } | undefined;
          const destinationData = self?.data as { date: string } | undefined;
          if (!sourceData || !destinationData || !workspaceSlug || !projectId || !updateIssue) return;

          const issueDetails = issues?.[sourceData?.id];
          if (!issueDetails) return;

          const newDate = new Date(destinationData.date);

          // start_date를 변경하는 경우
          if (sourceData.isStartDate) {
            const targetDate = issueDetails.target_date ? new Date(issueDetails.target_date) : null;

            // target_date가 있고, 새로운 start_date가 target_date보다 이후인 경우
            if (targetDate && newDate > targetDate) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Start date cannot be after the due date.",
              });
              return;
            }

            // start_date 업데이트
            updateIssue(workspaceSlug.toString(), projectId, sourceData.id, { start_date: destinationData.date })
              .then(() => {
                highlightIssueOnDrop(source?.element?.id, false);
              })
              .catch((error) => {
                setToast({
                  type: TOAST_TYPE.ERROR,
                  title: "Error!",
                  message: "Failed to update start date.",
                });
              });
          } 
          // target_date(due date)를 변경하는 경우
          else {
            const startDate = issueDetails.start_date ? new Date(issueDetails.start_date) : null;

            // start_date가 있고, 새로운 target_date가 start_date보다 이전인 경우
            if (startDate && newDate < startDate) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Due date cannot be before the start date.",
              });
              return;
            }

            // target_date 업데이트
            updateIssue(workspaceSlug.toString(), projectId, sourceData.id, { target_date: destinationData.date })
              .then(() => {
                highlightIssueOnDrop(source?.element?.id, false);
              })
              .catch((error) => {
                setToast({
                  type: TOAST_TYPE.ERROR,
                  title: "Error!",
                  message: "Failed to update due date.",
                });
              });
          }
        },
      })
    );
  }, [dayTileRef?.current, formattedDatePayload, workspaceSlug, projectId, updateIssue]);

  if (!formattedDatePayload) return null;

  const getIssuesForDate = () => {
    const issueIds = new Set<string>();

    if (groupedIssueIds?.[formattedDatePayload]) {
      groupedIssueIds[formattedDatePayload].forEach(id => issueIds.add(id));
    }

    // 날짜 범위에 있는 이슈들 수집
    Object.values(issues || {}).forEach(issue => {
      if (!issue) return;

      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;

      if (startDate && targetDate) {
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        if (currentDate >= startDate && currentDate <= targetDate) {
          issueIds.add(issue.id);
        }
      } else if (startDate) {
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        if (currentDate.getTime() === startDate.getTime()) {
          issueIds.add(issue.id);
        }
      } else if (targetDate) {
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        if (currentDate.getTime() === targetDate.getTime()) {
          issueIds.add(issue.id);
        }
      }
    });

    // 수집된 이슈 ID들을 정렬
    const sortedIssueIds = Array.from(issueIds).sort((a, b) => {
      const issueA = issues?.[a];
      const issueB = issues?.[b];
      
      if (!issueA || !issueB) return 0;

      // 1. 시작일 기준 정렬
      const startDateA = issueA.start_date ? new Date(issueA.start_date) : null;
      const startDateB = issueB.start_date ? new Date(issueB.start_date) : null;
      
      if (startDateA && !startDateB) return -1;
      if (!startDateA && startDateB) return 1;
      if (startDateA && startDateB) {
        const startDateCompare = startDateA.getTime() - startDateB.getTime();
        if (startDateCompare !== 0) return startDateCompare;
      }

      // 2. 종료일 기준 정렬
      const targetDateA = issueA.target_date ? new Date(issueA.target_date) : null;
      const targetDateB = issueB.target_date ? new Date(issueB.target_date) : null;
      
      if (targetDateA && !targetDateB) return -1;
      if (!targetDateA && targetDateB) return 1;
      if (targetDateA && targetDateB) {
        const targetDateCompare = targetDateA.getTime() - targetDateB.getTime();
        if (targetDateCompare !== 0) return targetDateCompare;
      }

      // 3. 우선순위 기준 정렬
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      const priorityA = priorityOrder[issueA.priority || "none"];
      const priorityB = priorityOrder[issueB.priority || "none"];
      if (priorityA !== priorityB) return priorityA - priorityB;

      // 4. 이슈 생성일 기준 정렬
      const createdAtA = new Date(issueA.created_at).getTime();
      const createdAtB = new Date(issueB.created_at).getTime();
      return createdAtA - createdAtB;
    });

    // console.log("Sorted Issues for date:", {
    //   date: date.date.toLocaleString(),
    //   totalIssues: sortedIssueIds.length,
    //   issues: sortedIssueIds.map(id => ({
    //     id,
    //     issue: issues?.[id],
    //     start_date: issues?.[id]?.start_date,
    //     target_date: issues?.[id]?.target_date,
    //     priority: issues?.[id]?.priority,
    //     created_at: issues?.[id]?.created_at
    //   }))
    // });

    return sortedIssueIds;
  };

  const issueIds = getIssuesForDate();

  const isToday = date.date.toDateString() === new Date().toDateString();
  const isSelectedDate = date.date.toDateString() == selectedDate.toDateString();

  const isWeekend = [0, 6].includes(date.date.getDay());
  const isMonthLayout = calendarLayout === "month";

  const normalBackground = isWeekend ? "bg-custom-background-90" : "bg-custom-background-100";
  const draggingOverBackground = isWeekend ? "bg-custom-background-80" : "bg-custom-background-90";

  return (
    <>
      <div ref={dayTileRef} className="group relative flex h-full w-full flex-col bg-custom-background-90">
        {/* header */}
        <div
          className={`hidden flex-shrink-0 items-center justify-end px-2 py-1.5 text-right text-xs md:flex ${
            isMonthLayout // if month layout, highlight current month days
              ? date.is_current_month
                ? "font-medium"
                : "text-custom-text-300"
              : "font-medium" // if week layout, highlight all days
          } ${isWeekend ? "bg-custom-background-90" : "bg-custom-background-100"} `}
        >
          {date.date.getDate() === 1 && MONTHS_LIST[date.date.getMonth() + 1].shortTitle + " "}
          {isToday ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-custom-primary-100 text-white">
              {date.date.getDate()}
            </span>
          ) : (
            <>{date.date.getDate()}</>
          )}
        </div>

        {/* content */}
        <div className="h-full w-full hidden md:block">
          <div
            className={cn(
              `h-full w-full select-none ${isDraggingOver ? `${draggingOverBackground} opacity-70` : normalBackground}`,
              {
                "min-h-[5rem]": isMonthLayout,
              }
            )}
          >
            <CalendarIssueBlocks
              date={date.date}
              issueIdList={issueIds}
              //issueInfo={issueInfo}
              quickActions={quickActions}
              loadMoreIssues={loadMoreIssues}
              getPaginationData={getPaginationData}
              getGroupIssueCount={getGroupIssueCount}
              isDragDisabled={readOnly}
              addIssuesToView={addIssuesToView}
              disableIssueCreation={disableIssueCreation}
              enableQuickIssueCreate={enableQuickIssueCreate}
              quickAddCallback={quickAddCallback}
              readOnly={readOnly}
            />
          </div>
        </div>

        {/* Mobile view content */}
        <div
          onClick={() => setSelectedDate(date.date)}
          className={cn(
            "text-sm py-2.5 h-full w-full font-medium mx-auto flex flex-col justify-start items-center md:hidden cursor-pointer opacity-80",
            {
              "bg-custom-background-100": !isWeekend,
            }
          )}
        >
          <div
            className={cn("size-6 flex items-center justify-center rounded-full", {
              "bg-custom-primary-100 text-white": isSelectedDate,
              "bg-custom-primary-100/10 text-custom-primary-100 ": isToday && !isSelectedDate,
            })}
          >
            {date.date.getDate()}
          </div>
        </div>
      </div>
    </>
  );
});
