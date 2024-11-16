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
          const sourceData = source?.data as { id: string; date: string } | undefined;
          const destinationData = self?.data as { date: string } | undefined;
          if (!sourceData || !destinationData) return;

          const issueDetails = issues?.[sourceData?.id];
          if (issueDetails?.start_date) {
            const issueStartDate = new Date(issueDetails.start_date);
            const targetDate = new Date(destinationData?.date);
            const diffInDays = differenceInCalendarDays(targetDate, issueStartDate);
            if (diffInDays < 0) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Due date cannot be before the start date of the issue.",
              });
              return;
            }
          }

          handleDragAndDrop(sourceData?.id, sourceData?.date, destinationData?.date);
          highlightIssueOnDrop(source?.element?.id, false);
        },
      })
    );
  }, [dayTileRef?.current, formattedDatePayload]);

  if (!formattedDatePayload) return null;

  const getIssuesForDate = () => {
    const issueIds = new Set<string>();

    if (groupedIssueIds?.[formattedDatePayload]) {
      groupedIssueIds[formattedDatePayload].forEach(id => issueIds.add(id));
    }

    Object.values(issues || {}).forEach(issue => {
      if (!issue) return;

      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;

      if (startDate && targetDate) {
        // 날짜 비교를 위해 시간을 0으로 설정
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        // 시작일부터 종료일까지 모든 날짜에 이슈 표시
        if (currentDate >= startDate && currentDate <= targetDate) {
          issueIds.add(issue.id);
        }
      } else if (startDate) {
        // start_date만 있는 경우
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        if (currentDate.getTime() === startDate.getTime()) {
          issueIds.add(issue.id);
        }
      } else if (targetDate) {
        // target_date만 있는 경우
        const currentDate = new Date(date.date);
        currentDate.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        if (currentDate.getTime() === targetDate.getTime()) {
          issueIds.add(issue.id);
        }
      }
    });

    console.log("Issues for date:", {
      date: date.date.toLocaleString(),
      totalIssues: issueIds.size,
      issues: Array.from(issueIds).map(id => ({
        id,
        issue: issues?.[id],
        start_date: issues?.[id]?.start_date,
        target_date: issues?.[id]?.target_date,
        isStartDate: issues?.[id]?.start_date === date.date.toISOString().split('T')[0],
        isTargetDate: issues?.[id]?.target_date === date.date.toISOString().split('T')[0]
      }))
    });

    return Array.from(issueIds);
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
              issueInfo={issueInfo}
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
