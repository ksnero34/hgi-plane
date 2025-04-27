import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { TIssue, TPaginationData } from "@plane/types";
// components
import { CalendarQuickAddIssueActions, CalendarIssueBlockRoot } from "@/components/issues";
// helpers
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
import { useIssueDetail, useIssues } from "@/hooks/store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { TRenderQuickActions } from "../list/list-view-types";
import { CalendarStoreType } from "./base-calendar-root";

type Props = {
  date: Date;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  issueIdList: string[];
  quickActions: TRenderQuickActions;
  isDragDisabled?: boolean;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  readOnly?: boolean;
  isMobileView?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
  issueInfo?: Map<string, {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  }>;
};

export const CalendarIssueBlocks: React.FC<Props> = observer((props) => {
  const {
    date,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    issueIdList = [],
    quickActions,
    isDragDisabled = false,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    addIssuesToView,
    readOnly,
    isMobileView = false,
    canEditProperties,
    isEpic = false,
    issueInfo
  } = props;

  const { t } = useTranslation();

  const storeType = useIssueStoreType() as CalendarStoreType;
  const { issues } = useIssues(storeType);
  const { issue: { getIssueById } } = useIssueDetail();
  const formattedDatePayload = renderFormattedPayloadDate(date);

  if (!formattedDatePayload) return null;

  const dayIssueCount = getGroupIssueCount(formattedDatePayload);
  const nextPageResults = getPaginationData(formattedDatePayload)?.nextPageResults;
  const isPaginating = !!issues.getIssueLoader(formattedDatePayload);

  const shouldLoadMore =
    nextPageResults === undefined && dayIssueCount !== undefined
      ? issueIdList?.length < dayIssueCount
      : !!nextPageResults;

  // 이슈 필터링 및 날짜 계산 함수
  const isIssueVisibleOnDate = (issueId: string, currentDate: Date) => {
    const issue = getIssueById(issueId);
    if (!issue) return false;

    currentDate = new Date(currentDate);
    currentDate.setHours(0, 0, 0, 0);
    const currentTime = currentDate.getTime();

    // start_date와 target_date를 Date 객체로 변환
    const startDate = issue.start_date ? new Date(issue.start_date) : null;
    const targetDate = issue.target_date ? new Date(issue.target_date) : null;
    
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (targetDate) targetDate.setHours(0, 0, 0, 0);

    // 시작일과 종료일이 모두 있는 경우
    if (startDate && targetDate) {
      return currentTime >= startDate.getTime() && currentTime <= targetDate.getTime();
    }

    // 시작일만 있는 경우
    if (startDate && !targetDate) {
      return currentTime === startDate.getTime();
    }

    // 종료일만 있는 경우 
    if (!startDate && targetDate) {
      return currentTime === targetDate.getTime();
    }

    return false;
  };
  
  // 이슈 정렬 및 처리
  const processIssues = () => {
    // 1. 먼저 해당 날짜에 표시할 이슈 ID 필터링
    const visibleIssueIds = issueIdList.filter(id => isIssueVisibleOnDate(id, date));
    
    // 2. 전체 이슈 정보 가져오기 (정렬을 위한 데이터)
    const issuesWithData = visibleIssueIds.map(id => getIssueById(id)).filter((issue): issue is TIssue => Boolean(issue));
    
    // 3. 중요도에 따른 이슈 정렬
    const sortedIssues = [...issuesWithData].sort((a, b) => {
      // 시작일 기준으로 정렬
      const startDateA = a.start_date ? new Date(a.start_date).getTime() : Number.MAX_VALUE;
      const startDateB = b.start_date ? new Date(b.start_date).getTime() : Number.MAX_VALUE;
      
      if (startDateA !== startDateB) return startDateA - startDateB;
      
      // 기간이 긴 이슈 우선 (종료일이 늦은 것)
      const targetDateA = a.target_date ? new Date(a.target_date).getTime() : 0;
      const targetDateB = b.target_date ? new Date(b.target_date).getTime() : 0;
      const durationA = targetDateA - (a.start_date ? new Date(a.start_date).getTime() : 0);
      const durationB = targetDateB - (b.start_date ? new Date(b.start_date).getTime() : 0);
      
      if (durationA !== durationB) return durationB - durationA;
      
      // 마지막으로 ID로 정렬 (일관성)
      return a.id.localeCompare(b.id);
    });
    
    // 4. 정렬된 이슈 ID 반환
    return sortedIssues.map(issue => issue.id);
  };
  
  // 정렬된 이슈 ID 배열
  const sortedIssueIds = processIssues();
  
  // 빈 공간 생성
  const calculateEmptySpaces = () => {
    // 먼저 전체 캘린더에서 사용되는 모든 이슈 ID 수집
    // 이슈 ID 맵 - 각 이슈의 글로벌 위치를 저장
    const globalPositions: Record<string, number> = {};
    
    // 이슈들의 전역 순서 가져오기 (간단한 방식)
    // issues.issueMap에 직접 접근하지 않고 getIssueById 함수를 사용
    const allIssueIds = issueIdList.filter(id => {
      const issue = getIssueById(id);
      return issue && (issue.start_date || issue.target_date);
    });
    
    // 이슈 ID에 인덱스 할당 (순서 부여)
    allIssueIds.forEach((id, index) => {
      globalPositions[id] = index;
    });
    
    // 실제 표시할 이슈와 빈 공간을 포함한 배열 생성
    type RenderItem = { type: 'empty'; position: number } | { type: 'issue'; issueId: string; position: number };
    const result: RenderItem[] = [];
    
    // 우리가 보여줄 이슈의 위치 추적
    for (let i = 0; i < sortedIssueIds.length; i++) {
      const issueId = sortedIssueIds[i];
      const position = globalPositions[issueId] || i;
      
      // 이전 빈 공간을 필요한 만큼 추가
      for (let j = result.length; j < position; j++) {
        result.push({ type: 'empty', position: j });
      }
      
      // 실제 이슈 추가
      result.push({ type: 'issue', issueId, position });
    }
    
    return result;
  };
  
  // 빈 공간을 포함한 렌더링 항목
  const renderItems = calculateEmptySpaces();

  return (
    <>
      {renderItems.map(item => 
        item.type === 'empty' ? (
          <div key={`empty-${item.position}`} className="h-10 md:h-8 w-full p-1 px-2 opacity-0">
            <div className="w-full h-full rounded border border-transparent"></div>
          </div>
        ) : (
          <div key={item.issueId} className="relative cursor-pointer p-1 px-2">
            <CalendarIssueBlockRoot
              issueId={item.issueId}
              quickActions={quickActions}
              isDragDisabled={isDragDisabled || isMobileView}
              date={date}
              canEditProperties={canEditProperties}
              isEpic={isEpic}
              issueInfo={issueInfo?.get(item.issueId)}
            />
          </div>
        )
      )}

      {isPaginating && (
        <div className="p-1 px-2">
          <div className="flex h-10 md:h-8 w-full items-center justify-between gap-1.5 rounded md:px-1 px-4 py-1.5 bg-custom-background-80 animate-pulse" />
        </div>
      )}

      {enableQuickIssueCreate && !disableIssueCreation && !readOnly && (
        <div className="border-b border-custom-border-200 px-1 py-1 md:border-none md:px-2">
          <CalendarQuickAddIssueActions
            prePopulatedData={{
              target_date: formattedDatePayload,
            }}
            quickAddCallback={quickAddCallback}
            addIssuesToView={addIssuesToView}
            isEpic={isEpic}
          />
        </div>
      )}

      {shouldLoadMore && !isPaginating && (
        <div className="flex items-center px-2.5 py-1">
          <button
            type="button"
            className="w-min whitespace-nowrap rounded text-xs px-1.5 py-1 font-medium hover:bg-custom-background-80 text-custom-primary-100 hover:text-custom-primary-200"
            onClick={() => loadMoreIssues(formattedDatePayload)}
          >
            {t("common.load_more")}
          </button>
        </div>
      )}
    </>
  );
});
