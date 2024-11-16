import { observer } from "mobx-react";
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
};

export const CalendarIssueBlocks: React.FC<Props> = observer((props) => {
  const {
    date,
    issueIdList = [],
    quickActions,
    loadMoreIssues,
    isDragDisabled = false,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    addIssuesToView,
    readOnly,
    isMobileView = false,
    getPaginationData,
    getGroupIssueCount,
  } = props;

  const formattedDatePayload = renderFormattedPayloadDate(date);
  const storeType = useIssueStoreType() as CalendarStoreType;
  const { issues } = useIssues(storeType);
  const { issue: { getIssueById } } = useIssueDetail();

  if (!formattedDatePayload) return null;

  const dayIssueCount = getGroupIssueCount(formattedDatePayload, undefined, false);
  const nextPageResults = getPaginationData(formattedDatePayload, undefined)?.nextPageResults;
  const isPaginating = !!issues.getIssueLoader(formattedDatePayload);

  const shouldLoadMore =
    nextPageResults === undefined && dayIssueCount !== undefined
      ? issueIdList?.length < dayIssueCount
      : !!nextPageResults;

  console.log("Current Date:", date);
  console.log("Issue IDs from props:", issueIdList);

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

  console.log("Final Filtered Issues for Date:", {
    currentDate: date.toLocaleString(),
    totalIssues: issueIdList.length,
    filteredCount: filteredIssueIds.length,
    filteredIssues: filteredIssueIds.map(id => {
      const issue = getIssueById(id);
      return {
        id: issue?.id,
        name: issue?.name,
        start_date: issue?.start_date ? new Date(issue.start_date).toLocaleString() : null,
        target_date: issue?.target_date ? new Date(issue.target_date).toLocaleString() : null
      };
    })
  });

  return (
    <>
      {filteredIssueIds.map((issueId) => (
        <div key={issueId} className="relative cursor-pointer p-1 px-2">
          <CalendarIssueBlockRoot
            issueId={issueId}
            quickActions={quickActions}
            isDragDisabled={isDragDisabled || isMobileView}
            date={date}
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
          />
        </div>
      )}

      {shouldLoadMore && !isPaginating && (
        <div className="flex items-center px-2.5 py-1">
          <button
            type="button"
            className="w-min whitespace-nowrap rounded text-xs px-1.5 py-1 font-medium  hover:bg-custom-background-80 text-custom-primary-100 hover:text-custom-primary-200"
            onClick={() => loadMoreIssues(formattedDatePayload)}
          >
            Load More
          </button>
        </div>
      )}
    </>
  );
});
