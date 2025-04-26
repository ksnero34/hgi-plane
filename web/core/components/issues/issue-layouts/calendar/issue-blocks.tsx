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

  // 현재 날짜에 표시할 이슈 필터링
  const filteredIssueIds = issueIdList.filter((issueId) => {
    const issue = getIssueById(issueId);
    if (!issue) return false;

    // 날짜 비교를 위한 시간 초기화
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    // start_date와 target_date를 Date 객체로 변환
    const startDate = issue.start_date ? new Date(issue.start_date) : null;
    const targetDate = issue.target_date ? new Date(issue.target_date) : null;
    
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (targetDate) targetDate.setHours(0, 0, 0, 0);

    // 1. start_date와 target_date가 모두 있는 경우
    if (startDate && targetDate) {
      return currentDate >= startDate && currentDate <= targetDate;
    }

    // 2. start_date만 있는 경우
    if (startDate && !targetDate) {
      return currentDate.getTime() === startDate.getTime();
    }

    // 3. target_date만 있는 경우 
    if (!startDate && targetDate) {
      return currentDate.getTime() === targetDate.getTime();
    }

    return false;
  });

  // 전역적으로 일관된 순서 정렬 함수 
  const sortIssuesByGlobalOrder = (issueIds: string[]) => {
    // 실제 이슈 객체를 얻어서 정렬에 사용
    const issuesWithData = issueIds
      .map(id => getIssueById(id))
      .filter(Boolean); // null/undefined 제거
    
    // 정렬 기준:
    // 1. 시작일 빠른 순
    // 2. 시작일 같으면 종료일 긴 순(기간이 넓은 이슈가 위에 오도록)
    // 3. 시작일과 종료일 모두 같으면 이슈 ID로 정렬
    const sortedIssues = [...issuesWithData].sort((a, b) => {
      // 시작일 기준 정렬
      const startDateA = a.start_date ? new Date(a.start_date).getTime() : 9007199254740991; // MAX_SAFE_INTEGER 값
      const startDateB = b.start_date ? new Date(b.start_date).getTime() : 9007199254740991;
      
      if (startDateA !== startDateB) return startDateA - startDateB;
      
      // 시작일이 같으면 종료일 기준으로 정렬 (기간이 긴 것을 위에)
      const targetDateA = a.target_date ? new Date(a.target_date).getTime() : 0;
      const targetDateB = b.target_date ? new Date(b.target_date).getTime() : 0;
      
      if (targetDateA !== targetDateB) return targetDateB - targetDateA; // 역순 - 종료일이 늦을수록 위로
      
      // 시작일과 종료일이 모두 같으면 이슈 ID로 정렬
      return (a.id || "").localeCompare(b.id || "");
    });
    
    // 정렬된 순서대로 ID 반환
    return sortedIssues.map(issue => issue.id);
  };

  // 전역 순서를 기준으로 정렬
  const sortedIssueIds = sortIssuesByGlobalOrder(filteredIssueIds);

  return (
    <>
      {sortedIssueIds.map((issueId) => (
        <div key={issueId} className="relative cursor-pointer p-1 px-2">
          <CalendarIssueBlockRoot
            issueId={issueId}
            quickActions={quickActions}
            isDragDisabled={isDragDisabled || isMobileView}
            date={date}
            canEditProperties={canEditProperties}
            isEpic={isEpic}
            issueInfo={issueInfo?.get(issueId)}
          />
        </div>
      ))}

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
