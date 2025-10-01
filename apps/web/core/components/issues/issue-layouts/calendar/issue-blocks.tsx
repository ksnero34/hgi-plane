import { useMemo } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { TIssue, TPaginationData } from "@plane/types";
import { IProjectEpicsFilter } from "@/plane-web/store/issue/epic";
import { ICycleIssuesFilter } from "@/store/issue/cycle";
import { IModuleIssuesFilter } from "@/store/issue/module";
import { IProjectIssuesFilter } from "@/store/issue/project";
import { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import { renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
// local components
import { TRenderQuickActions } from "../list/list-view-types";
import { CalendarIssueBlockRoot } from "./issue-block-root";
import { CalendarQuickAddIssueActions } from "./quick-add-issue-actions";

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
  issuesFilterStore?:
    | IProjectIssuesFilter
    | IModuleIssuesFilter
    | ICycleIssuesFilter
    | IProjectViewIssuesFilter
    | IProjectEpicsFilter;
};

const normalizeDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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
    issuesFilterStore,
  } = props;

  const { t } = useTranslation();

  const issuesStore = useIssuesStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const formattedDatePayload = renderFormattedPayloadDate(date);
  if (!formattedDatePayload) return null;

  const dayIssueCount = getGroupIssueCount(formattedDatePayload);
  const nextPageResults = getPaginationData(formattedDatePayload)?.nextPageResults;
  const isPaginating = !!issuesStore.issues.getIssueLoader(formattedDatePayload);

  const shouldLoadMore =
    nextPageResults === undefined && dayIssueCount !== undefined
      ? issueIdList.length < dayIssueCount
      : !!nextPageResults;

  const issueInfoMap = useMemo(() => {
    const map = new Map<string, { isStartDate: boolean; isEndDate: boolean; isContinuous: boolean }>();
    const currentTime = normalizeDate(date);

    issueIdList.forEach((id) => {
      const issue = getIssueById(id);
      if (!issue || currentTime === null) return;

      const startTime = normalizeDate(issue.start_date);
      const endTime = normalizeDate(issue.target_date);

      let isStartDate = false;
      let isEndDate = false;
      let isContinuous = false;

      if (startTime !== null && currentTime === startTime) {
        isStartDate = true;
      }

      if (endTime !== null && currentTime === endTime) {
        isEndDate = true;
      }

      if (startTime !== null && endTime !== null && currentTime > startTime && currentTime < endTime) {
        isContinuous = true;
      }

      map.set(id, {
        isStartDate,
        isEndDate,
        isContinuous,
      });
    });

    return map;
  }, [date, getIssueById, issueIdList]);

  return (
    <>
      {issueIdList.map((issueId) => (
        <div key={issueId} className="relative cursor-pointer p-1 px-2">
          <CalendarIssueBlockRoot
            issueId={issueId}
            quickActions={quickActions}
            isDragDisabled={isDragDisabled || !!readOnly || isMobileView}
            date={date}
            canEditProperties={canEditProperties}
            isEpic={isEpic}
            issueInfo={issueInfoMap.get(issueId)}
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
