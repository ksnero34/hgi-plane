"use client";

import { FC, useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EIssueGroupByToServerOptions } from "@plane/constants";
import { TGroupedIssues, TIssue } from "@plane/types";
// components
import { TOAST_TYPE, setToast } from "@plane/ui";
import { CalendarChart } from "@/components/issues";
//constants
import { EIssuesStoreType } from "@/constants/issue";
// hooks
import { useIssues, useCalendarView, useUserPermissions } from "@/hooks/store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { EUserPermissions, EUserPermissionsLevel } from "@/plane-web/constants/user-permissions";
// types
import { IQuickActionProps } from "../list/list-view-types";
import { handleDragDrop } from "./utils";

export type CalendarStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW;

interface IBaseCalendarRoot {
  QuickActions: FC<IQuickActionProps>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  isCompletedCycle?: boolean;
  viewId?: string | undefined;
}

const getIssuesForDate = (date: Date, issues: any) => {
  if (!issues || !Array.isArray(issues.issues)) return [];
  
  return {
    date: date.toLocaleString(),
    allIssues: issues,
    filteredIssues: issues.issues.filter((issue: TIssue) => {
      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;
      return (startDate && startDate <= date) || (targetDate && targetDate >= date);
    })
  };
};

export const BaseCalendarRoot: FC<IBaseCalendarRoot> = observer((props: IBaseCalendarRoot) => {
  const { QuickActions, addIssuesToView, isCompletedCycle = false, viewId } = props;

  // router
  const { workspaceSlug, projectId } = useParams();

  // hooks
  const storeType = useIssueStoreType() as CalendarStoreType;
  const { allowPermissions } = useUserPermissions();
  const { issues, issuesFilter, issueMap } = useIssues(storeType);
  const {
    fetchIssues,
    fetchNextIssues,
    quickAddIssue,
    updateIssue,
    removeIssue,
    removeIssueFromView,
    archiveIssue,
    restoreIssue,
    updateFilters,
  } = useIssuesActions(storeType);

  const issueCalendarView = useCalendarView();

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const displayFilters = issuesFilter.issueFilters?.displayFilters;

  const groupedIssueIds = (issues.groupedIssueIds ?? {}) as TGroupedIssues;

  const layout = displayFilters?.calendar?.layout ?? "month";
  const { startDate, endDate } = issueCalendarView.getStartAndEndDate(layout) ?? {};

  useEffect(() => {
    startDate &&
      endDate &&
      layout &&
      fetchIssues(
        "init-loader",
        {
          canGroup: true,
          perPageCount: layout === "month" ? 4 : 30,
          before: endDate,
          after: startDate,
          groupedBy: EIssueGroupByToServerOptions["target_date"],
        },
        viewId
      );
  }, [fetchIssues, storeType, startDate, endDate, layout, viewId]);

  const handleDragAndDrop = async (
    issueId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined
  ) => {
    if (!issueId || !destinationDate || !sourceDate) return;

    const wrappedUpdateIssue = updateIssue 
      ? (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => 
          updateIssue(projectId, issueId, data)
      : undefined;

    await handleDragDrop(
      issueId,
      sourceDate,
      destinationDate,
      workspaceSlug?.toString(),
      projectId?.toString(),
      wrappedUpdateIssue
    ).catch((err) => {
      setToast({
        title: "Error!",
        type: TOAST_TYPE.ERROR,
        message: err?.detail ?? "Failed to perform this action",
      });
    });
  };

  const loadMoreIssues = useCallback(
    (dateString: string) => {
      fetchNextIssues(dateString);
    },
    [fetchNextIssues]
  );

  const getPaginationData = useCallback(
    (groupId: string | undefined) => issues?.getPaginationData(groupId, undefined),
    [issues?.getPaginationData]
  );

  const getGroupIssueCount = useCallback(
    (groupId: string | undefined) => issues?.getGroupIssueCount(groupId, undefined, false),
    [issues?.getGroupIssueCount]
  );

  return (
    <div className="h-full w-full overflow-hidden bg-custom-background-100 pt-4">
      <CalendarChart
        issuesFilterStore={issuesFilter}
        issues={issueMap}
        groupedIssueIds={groupedIssueIds}
        layout={displayFilters?.calendar?.layout}
        showWeekends={displayFilters?.calendar?.show_weekends ?? false}
        issueCalendarView={issueCalendarView}
        quickActions={({ issue, parentRef, customActionButton, placement }) => (
          <QuickActions
            parentRef={parentRef}
            customActionButton={customActionButton}
            issue={issue}
            handleDelete={async () => removeIssue(issue.project_id, issue.id)}
            handleUpdate={async (data) => updateIssue && updateIssue(issue.project_id, issue.id, data)}
            handleRemoveFromView={async () => removeIssueFromView && removeIssueFromView(issue.project_id, issue.id)}
            handleArchive={async () => archiveIssue && archiveIssue(issue.project_id, issue.id)}
            handleRestore={async () => restoreIssue && restoreIssue(issue.project_id, issue.id)}
            readOnly={!isEditingAllowed || isCompletedCycle}
            placements={placement}
          />
        )}
        loadMoreIssues={loadMoreIssues}
        getPaginationData={getPaginationData}
        getGroupIssueCount={getGroupIssueCount}
        addIssuesToView={addIssuesToView}
        quickAddCallback={quickAddIssue}
        readOnly={!isEditingAllowed || isCompletedCycle}
        updateFilters={updateFilters}
        handleDragAndDrop={handleDragAndDrop}
      />
    </div>
  );
});
