import { observer } from "mobx-react";
import { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
// components
import { CalendarDayTile } from "@/components/issues";
// helpers
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// types
import { IProjectEpicsFilter } from "@/plane-web/store/issue/epic";
import { ICycleIssuesFilter } from "@/store/issue/cycle";
import { IModuleIssuesFilter } from "@/store/issue/module";
import { IProjectIssuesFilter } from "@/store/issue/project";
import { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import { TRenderQuickActions } from "../list/list-view-types";
import { ICalendarDate, ICalendarWeek } from "./types";
// hooks
import { useCalendarView } from "@/hooks/store/use-calendar-view";

type Props = {
  issuesFilterStore:
    | IProjectIssuesFilter
    | IModuleIssuesFilter
    | ICycleIssuesFilter
    | IProjectViewIssuesFilter
    | IProjectEpicsFilter;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  week: ICalendarWeek | undefined;
  quickActions: TRenderQuickActions;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  handleDragAndDrop: (
    issueId: string | undefined,
    issueProjectId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined
  ) => Promise<void>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  readOnly?: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
};

export const CalendarWeekDays: React.FC<Props> = observer((props) => {
  const {
    issuesFilterStore,
    issues,
    groupedIssueIds,
    week,
    quickActions,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    handleDragAndDrop,
    addIssuesToView,
    readOnly,
    selectedDate,
    setSelectedDate,
    canEditProperties,
    isEpic,
  } = props;

  const calendarLayout = issuesFilterStore.issueFilters?.displayFilters?.calendar?.layout ?? "month";
  const showWeekends = issuesFilterStore.issueFilters?.displayFilters?.calendar?.show_weekends ?? false;
  
  // 캘린더 뷰 훅 사용
  const issueCalendarView = useCalendarView();
  
  const getGlobalIssueOrder = () => {
    if (!week || !issues) return [];
    
    // 현재 레이아웃(월/주)에 따라 startDate와 endDate 가져오기
    const dateRange = issueCalendarView.getStartAndEndDate(calendarLayout);
    if (!dateRange) return [];
    
    const { startDate, endDate } = dateRange;
    
    // 문자열 날짜를 Date 객체로 변환
    const firstDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    // 날짜의 시간 정보 제거
    firstDate.setHours(0, 0, 0, 0);
    lastDate.setHours(23, 59, 59, 999);
    
    // 현재 표시 범위에 해당하는 이슈만 필터링
    const visibleIssues = Object.values(issues).filter(issue => {
      if (!issue) return false;
      
      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;
      
      // 날짜의 범위 검사
      if (startDate && targetDate) {
        // 시작일과 종료일이 모두 있는 경우
        // 이슈의 기간이 현재 표시 범위와 겹치는지 확인
        return !(targetDate < firstDate || startDate > lastDate);
      } else if (startDate) {
        // 시작일만 있는 경우
        return startDate >= firstDate && startDate <= lastDate;
      } else if (targetDate) {
        // 종료일만 있는 경우
        return targetDate >= firstDate && targetDate <= lastDate;
      }
      
      return false;
    });
    
    // 정렬 로직:
    // 1. 시작일이 빠른 순
    // 2. 기간이 넓은 순 (종료일-시작일)
    // 3. ID 기준
    return visibleIssues.sort((a, b) => {
      // 시작일 기준으로 정렬
      const startDateA = a.start_date ? new Date(a.start_date).getTime() : Number.MAX_SAFE_INTEGER;
      const startDateB = b.start_date ? new Date(b.start_date).getTime() : Number.MAX_SAFE_INTEGER;
      
      if (startDateA !== startDateB) return startDateA - startDateB;
      
      // 시작일이 같으면 기간으로 정렬 (더 넓은 범위가 위에)
      const endDateA = a.target_date ? new Date(a.target_date).getTime() : startDateA;
      const endDateB = b.target_date ? new Date(b.target_date).getTime() : startDateB;
      
      const durationA = endDateA - startDateA;
      const durationB = endDateB - startDateB;
      
      if (durationA !== durationB) return durationB - durationA; // 내림차순 (더 긴 기간이 위에)
      
      // 마지막으로 ID로 정렬
      return a.id.localeCompare(b.id);
    }).map(issue => issue.id);
  };
  
  // 전체 이슈 순서를 계산
  const globalIssueOrder = getGlobalIssueOrder();

  if (!week) return null;

  return (
    <div
      className={`grid divide-custom-border-200 md:divide-x-[0.5px] ${showWeekends ? "grid-cols-7" : "grid-cols-5"} ${
        calendarLayout === "month" ? "" : "h-full"
      }`}
    >
      {Object.values(week).map((date: ICalendarDate) => {
        if (!showWeekends && (date.date.getDay() === 0 || date.date.getDay() === 6)) return null;

        return (
          <CalendarDayTile
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            issuesFilterStore={issuesFilterStore}
            key={renderFormattedPayloadDate(date.date)}
            date={date}
            issues={issues}
            groupedIssueIds={groupedIssueIds}
            loadMoreIssues={loadMoreIssues}
            getPaginationData={getPaginationData}
            getGroupIssueCount={getGroupIssueCount}
            quickActions={quickActions}
            enableQuickIssueCreate={enableQuickIssueCreate}
            disableIssueCreation={disableIssueCreation}
            quickAddCallback={quickAddCallback}
            addIssuesToView={addIssuesToView}
            readOnly={readOnly}
            handleDragAndDrop={handleDragAndDrop}
            canEditProperties={canEditProperties}
            isEpic={isEpic}
            issueInfo={new Map()}
            globalIssueOrder={globalIssueOrder} // 전역 이슈 순서 전달
          />
        );
      })}
    </div>
  );
});
