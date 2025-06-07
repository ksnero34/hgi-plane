import { observer } from "mobx-react";
import { EStartOfTheWeek } from "@plane/constants";
import { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { CalendarDayTile } from "@/components/issues";
// helpers
import { getOrderedDays } from "@/helpers/calendar.helper";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// hooks
import { useUserProfile } from "@/hooks/store";
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
  // hooks
  const { data } = useUserProfile();
  const startOfWeek = data?.start_of_the_week;

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
    
    // 현재 적용된 필터 가져오기
    const appliedFilters = issuesFilterStore?.issueFilters?.filters || {};
    
    // 현재 표시 범위에 해당하는 이슈만 필터링
    const visibleIssues = Object.values(issues).filter(issue => {
      if (!issue) return false;
      
      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;
      
      // 날짜의 범위 검사
      let isVisibleInDateRange = false;
      if (startDate && targetDate) {
        // 시작일과 종료일이 모두 있는 경우
        // 이슈의 기간이 현재 표시 범위와 겹치는지 확인
        isVisibleInDateRange = !(targetDate < firstDate || startDate > lastDate);
      } else if (startDate) {
        // 시작일만 있는 경우
        isVisibleInDateRange = startDate >= firstDate && startDate <= lastDate;
      } else if (targetDate) {
        // 종료일만 있는 경우
        isVisibleInDateRange = targetDate >= firstDate && targetDate <= lastDate;
      }
      
      // 날짜 범위에 없으면 즉시 false 반환
      if (!isVisibleInDateRange) return false;
      
      // 필터 조건에 맞는지 확인
      // 필터가 적용되지 않았다면 (필터가 비어있다면) 바로 true 반환
      if (Object.keys(appliedFilters).length === 0) return true;
      
      // 상태 필터 확인
      if (appliedFilters.state && appliedFilters.state.length > 0) {
        if (!issue.state_id || !appliedFilters.state.includes(issue.state_id)) {
          return false;
        }
      }
      
      // 담당자 필터 확인
      if (appliedFilters.assignees && appliedFilters.assignees.length > 0) {
        if (!issue.assignee_ids || !issue.assignee_ids.some((id: any) => appliedFilters.assignees && appliedFilters.assignees.includes(id))) {
          return false;
        }
      }
      
      // 생성자 필터 확인
      if (appliedFilters.created_by && appliedFilters.created_by.length > 0) {
        if (!issue.created_by || !appliedFilters.created_by.includes(issue.created_by)) {
          return false;
        }
      }
      
      // 레이블 필터 확인
      if (appliedFilters.labels && appliedFilters.labels.length > 0) {
        if (!issue.label_ids || !issue.label_ids.some((id: any) => appliedFilters.labels && appliedFilters.labels.includes(id))) {
          return false;
        }
      }
      
      // 우선순위 필터 확인
      if (appliedFilters.priority && appliedFilters.priority.length > 0) {
        if (!issue.priority || !appliedFilters.priority.includes(issue.priority)) {
          return false;
        }
      }
      
      // 프로젝트 필터 확인
      if (appliedFilters.project && appliedFilters.project.length > 0) {
        if (!issue.project_id || !appliedFilters.project.includes(issue.project_id)) {
          return false;
        }
      }
      
      // 상태 그룹 필터 확인
      if (appliedFilters.state_group && appliedFilters.state_group.length > 0) {
        // issue 객체에 state_detail이 있는지 확인
        const stateGroup = (issue as any).state_detail?.group;
        if (!stateGroup || !appliedFilters.state_group.includes(stateGroup)) {
          return false;
        }
      }
      
      // 멘션 필터 확인
      if (appliedFilters.mentions && appliedFilters.mentions.length > 0) {
        // 멘션은 이슈 내용이나 댓글에서 참조된 사용자를 확인해야 하므로
        // 이슈 객체에 mentions_data 또는 mentions 필드가 있는지 확인
        const mentionsData = (issue as any).mentions_data;
        
        if (!mentionsData) {
          return false;
        }
        
        // 멘션 데이터가 배열인 경우 일치하는 사용자 ID가 있는지 확인
        if (Array.isArray(mentionsData)) {
          if (!mentionsData.some((id: any) => appliedFilters.mentions && appliedFilters.mentions.includes(id))) {
            return false;
          }
        }
        // 멘션 데이터가 사용자 ID 목록인 경우 일치하는 값이 있는지 확인
        else if (typeof mentionsData === 'object') {
          const mentionedUserIds = Object.keys(mentionsData);
          if (!mentionedUserIds.some((id: any) => appliedFilters.mentions && appliedFilters.mentions.includes(id))) {
            return false;
          }
        }
      }
      
      // 모듈 필터 확인
      if (appliedFilters.module && appliedFilters.module.length > 0) {
        // 모듈 ID 배열이 issue.module_ids 또는 다른 형태로 저장되어 있는지 확인
        const moduleIds = (issue as any).module_ids;
        const issueModule = (issue as any).issue_module;
        
        if (!moduleIds && !issueModule) {
          return false;
        }
        
        // module_ids가 있는 경우
        if (moduleIds) {
          if (!moduleIds.some((id: any) => appliedFilters.module && appliedFilters.module.includes(id))) {
            return false;
          }
        } 
        // issue_module이 있는 경우 (다른 형태로 저장되었을 때)
        else if (issueModule) {
          const moduleIdList = Array.isArray(issueModule) 
            ? issueModule.map((m: any) => m.module_id || m.id)
            : [issueModule.module_id || issueModule.id];
          
          if (!moduleIdList.some((id: any) => appliedFilters.module && appliedFilters.module.includes(id))) {
            return false;
          }
        }
      }
      
      // 주기(cycle) 필터 확인
      if (appliedFilters.cycle && appliedFilters.cycle.length > 0) {
        // 주기 ID가 issue.cycle_id 또는 다른 형태로 저장되어 있는지 확인
        const cycleId = (issue as any).cycle_id;
        const issueCycle = (issue as any).issue_cycle;
        
        if (!cycleId && !issueCycle) {
          return false;
        }
        
        // cycle_id가 있는 경우
        if (cycleId) {
          if (!appliedFilters.cycle.includes(cycleId)) {
            return false;
          }
        } 
        // issue_cycle이 있는 경우 (다른 형태로 저장되었을 때)
        else if (issueCycle) {
          const cycleSingleId = issueCycle.cycle_id || issueCycle.id;
          if (!appliedFilters.cycle.includes(cycleSingleId)) {
            return false;
          }
        }
      }
      
      // 이슈 타입 필터 확인
      if (appliedFilters.issue_type && appliedFilters.issue_type.length > 0) {
        const issueType = (issue as any).issue_type;
        if (!issueType || !appliedFilters.issue_type.includes(issueType)) {
          return false;
        }
      }
      
      // 시작일 필터 확인
      if (appliedFilters.start_date && appliedFilters.start_date.length > 0) {
        if (!startDate) return false;
        
        let passesStartDateFilter = false;
        for (const dateFilter of appliedFilters.start_date) {
          const [filterDate, filterType] = dateFilter.split(";");
          const filterDateObj = new Date(filterDate);
          filterDateObj.setHours(0, 0, 0, 0);
          
          switch (filterType) {
            case "before":
              if (startDate.getTime() <= filterDateObj.getTime()) {
                passesStartDateFilter = true;
              }
              break;
            case "after":
              if (startDate.getTime() >= filterDateObj.getTime()) {
                passesStartDateFilter = true;
              }
              break;
            case "on":
              if (startDate.getTime() === filterDateObj.getTime()) {
                passesStartDateFilter = true;
              }
              break;
            default:
              // 사용자 정의 날짜 범위인 경우
              const [startDateStr, endDateStr] = dateFilter.split("-");
              const filterStartDate = new Date(startDateStr);
              const filterEndDate = new Date(endDateStr);
              filterStartDate.setHours(0, 0, 0, 0);
              filterEndDate.setHours(23, 59, 59, 999);
              
              if (startDate.getTime() >= filterStartDate.getTime() && startDate.getTime() <= filterEndDate.getTime()) {
                passesStartDateFilter = true;
              }
          }
          
          if (passesStartDateFilter) break;
        }
        
        if (!passesStartDateFilter) return false;
      }
      
      // 종료일 필터 확인
      if (appliedFilters.target_date && appliedFilters.target_date.length > 0) {
        if (!targetDate) return false;
        
        let passesTargetDateFilter = false;
        for (const dateFilter of appliedFilters.target_date) {
          const [filterDate, filterType] = dateFilter.split(";");
          const filterDateObj = new Date(filterDate);
          filterDateObj.setHours(0, 0, 0, 0);
          
          switch (filterType) {
            case "before":
              if (targetDate.getTime() <= filterDateObj.getTime()) {
                passesTargetDateFilter = true;
              }
              break;
            case "after":
              if (targetDate.getTime() >= filterDateObj.getTime()) {
                passesTargetDateFilter = true;
              }
              break;
            case "on":
              if (targetDate.getTime() === filterDateObj.getTime()) {
                passesTargetDateFilter = true;
              }
              break;
            default:
              // 사용자 정의 날짜 범위인 경우
              const [startDateStr, endDateStr] = dateFilter.split("-");
              const filterStartDate = new Date(startDateStr);
              const filterEndDate = new Date(endDateStr);
              filterStartDate.setHours(0, 0, 0, 0);
              filterEndDate.setHours(23, 59, 59, 999);
              
              if (targetDate.getTime() >= filterStartDate.getTime() && targetDate.getTime() <= filterEndDate.getTime()) {
                passesTargetDateFilter = true;
              }
          }
          
          if (passesTargetDateFilter) break;
        }
        
        if (!passesTargetDateFilter) return false;
      }
      
      // 구독자 필터 확인
      if (appliedFilters.subscriber && appliedFilters.subscriber.length > 0) {
        const subscriberIds = (issue as any).subscriber_ids;
        if (!subscriberIds || !subscriberIds.some((id: any) => appliedFilters.subscriber && appliedFilters.subscriber.includes(id))) {
          return false;
        }
      }
      
      // 모든 필터를 통과하면 true 반환
      return true;
    });
    
    // 정렬 로직:
    // 1. 시작일이 빠른 순
    // 2. 기간이 넓은 순 (종료일-시작일)
    // 3. ID 기준
    return visibleIssues.sort((a, b) => {
      // 시작일 기준으로 정렬 (MAX_SAFE_INTEGER 대신 직접 큰 숫자 사용)
      const MAX_DATE_VALUE = 9007199254740991; // 2^53 - 1, MAX_SAFE_INTEGER 값
      const startDateA = a.start_date ? new Date(a.start_date).getTime() : MAX_DATE_VALUE;
      const startDateB = b.start_date ? new Date(b.start_date).getTime() : MAX_DATE_VALUE;
      
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

  const shouldShowDay = (dayDate: Date) => {
    if (showWeekends) return true;
    const day = dayDate.getDay();
    return !(day === 0 || day === 6);
  };

  const sortedWeekDays = getOrderedDays(Object.values(week), (item) => item.date.getDay(), startOfWeek);

  return (
    <div
      className={cn("grid divide-custom-border-200 md:divide-x-[0.5px]", {
        "grid-cols-7": showWeekends,
        "grid-cols-5": !showWeekends,
        "h-full": calendarLayout !== "month",
      })}
    >
      {sortedWeekDays.map((date: ICalendarDate) => {
        if (!shouldShowDay(date.date)) return null;

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
