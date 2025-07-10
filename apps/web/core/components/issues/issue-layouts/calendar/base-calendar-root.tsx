"use client";

import { FC, useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EIssueGroupByToServerOptions, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssuesStoreType, TGroupedIssues, TIssue } from "@plane/types";
// components
import { TOAST_TYPE, setToast } from "@plane/ui";
import { CalendarChart } from "@/components/issues";
//constants
// hooks
import { useIssues, useCalendarView, useUserPermissions } from "@/hooks/store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// types
import { IQuickActionProps } from "../list/list-view-types";
import { handleDragAndDrop as utilsHandleDragAndDrop } from "./utils";

export type CalendarStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.TEAM
  | EIssuesStoreType.TEAM_VIEW
  | EIssuesStoreType.EPIC;

interface IBaseCalendarRoot {
  QuickActions: FC<IQuickActionProps>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  isCompletedCycle?: boolean;
  viewId?: string | undefined;
  isEpic?: boolean;
  canEditPropertiesBasedOnProject?: (projectId: string) => boolean;
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

// export const BaseCalendarRoot: FC<IBaseCalendarRoot> = observer((props: IBaseCalendarRoot) => {
//   const { QuickActions, addIssuesToView, isCompletedCycle = false, viewId } = props;
export const BaseCalendarRoot = observer((props: IBaseCalendarRoot) => {
  const {
    QuickActions,
    addIssuesToView,
    isCompletedCycle = false,
    viewId,
    isEpic = false,
    canEditPropertiesBasedOnProject,
  } = props;

  // router
  const { workspaceSlug } = useParams();

  // hooks
  const storeType = isEpic ? EIssuesStoreType.EPIC : (useIssueStoreType() as CalendarStoreType);
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

  const { enableInlineEditing } = issues?.viewFlags || {};

  const displayFilters = issuesFilter.issueFilters?.displayFilters;

  const groupedIssueIds = (issues.groupedIssueIds ?? {}) as TGroupedIssues;

  const layout = displayFilters?.calendar?.layout ?? "month";
  const { startDate, endDate } = issueCalendarView.getStartAndEndDate(layout) ?? {};

  useEffect(() => {
    if (startDate && endDate && layout) {
      const perPageFromFilter = displayFilters?.per_page || (layout === "month" ? 4 : 30);
      fetchIssues(
        "init-loader",
        {
          canGroup: true,
          perPageCount: layout === "month" ? 4 : 30,
          perPageFromDisplayFilter: perPageFromFilter,
          before: endDate,
          after: startDate,
          groupedBy: EIssueGroupByToServerOptions["target_date"],
        },
        viewId
      );
    }
  }, [fetchIssues, storeType, startDate, endDate, layout, viewId, displayFilters?.per_page]);

  const handleDragAndDrop = async (
    issueId: string | undefined,
    issueProjectId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined,
    isStartDate?: boolean,
    issueObject?: TIssue
  ) => {
    if (!issueId || !destinationDate || !sourceDate || !issueProjectId) return;

    // console.log("[중요] base-calendar-root - 함수 호출 시 전달된 isStartDate:", isStartDate);

    const wrappedUpdateIssue = updateIssue 
      ? (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => 
          updateIssue(projectId, issueId, data)
      : undefined;
    
    // 이슈 객체 가져오기 - 직접 전달받은 객체가 있으면 사용, 없으면 스토어에서 조회
    const issueDetail = issueObject || (issueId ? issueMap[issueId] : undefined);
    
    // 시작일과 종료일이 같은 경우에만 로그 출력
    const hasBothDates = !!(issueDetail?.start_date && issueDetail?.target_date);
    const datesAreEqual = hasBothDates && 
      (issueDetail.start_date && issueDetail.target_date) ? 
      new Date(issueDetail.start_date).toDateString() === new Date(issueDetail.target_date).toDateString() : 
      false;
    
    // if (datesAreEqual) {
    //   console.log("[중요] base-calendar-root - 드래그 정보:", {
    //     issueId,
    //     sourceDate,
    //     destinationDate,
    //     isStartDate,
    //     start_date: issueDetail?.start_date,
    //     target_date: issueDetail?.target_date
    //   });
    // }

    try {
      // 직접 handleDragDrop 유틸리티 함수 사용
      if (workspaceSlug && issueDetail && wrappedUpdateIssue) {
        // workspaceSlug가 배열인 경우 첫 번째 요소를 사용
        const workspaceSlugStr = Array.isArray(workspaceSlug) ? workspaceSlug[0] : workspaceSlug;
        
        // 원본 이슈 객체 복사 (API 호출 전에 변경되지 않도록)
        const originalIssue = { ...issueDetail };
        // console.log("[중요] base-calendar-root - 원본 이슈 객체:", originalIssue);
        
        // 업데이트할 데이터 결정
        let updateData: Partial<TIssue> = {};
        
        // isStartDate 값에 따라 업데이트할 필드 결정
        if (isStartDate === null) {
          // 두 날짜 모두 업데이트 (시작일과 종료일이 같은 경우)
          updateData = { start_date: destinationDate, target_date: destinationDate };
          // console.log("[중요] base-calendar-root - 두 날짜 모두 업데이트:", updateData);
        } else if (isStartDate === true) {
          // 시작일만 업데이트
          updateData = { start_date: destinationDate };
          // console.log("[중요] base-calendar-root - 시작일만 업데이트:", updateData);
        } else {
          // 종료일만 업데이트
          updateData = { target_date: destinationDate };
          // console.log("[중요] base-calendar-root - 종료일만 업데이트:", updateData);
        }
        
        // API 호출
        await wrappedUpdateIssue(workspaceSlugStr, issueProjectId, issueId, updateData);
        
        // 성공 메시지 표시
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "이슈 업데이트 성공",
          message: "이슈 날짜가 성공적으로 업데이트되었습니다."
        });

        // 업데이트된 이슈 객체 생성
        const updatedIssue = {
          ...issueDetail,
          ...updateData
        };

        // 이슈 업데이트 이벤트 발생 (다른 컴포넌트에 알림)
        const event = new CustomEvent("calendar-issue-updated", {
          detail: {
            issueId,
            updatedIssue,
            forceRender: true
          }
        });
        window.dispatchEvent(event);
        
        // 반환값 제거 (void 반환)
      }
    } catch (error) {
      console.error("[중요] base-calendar-root - 이슈 업데이트 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "이슈 업데이트 실패",
        message: "이슈 날짜 업데이트 중 오류가 발생했습니다."
      });
      throw error;
    }
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

  const canEditProperties = useCallback(
    (projectId: string | undefined) => {
      const isEditingAllowedBasedOnProject =
        canEditPropertiesBasedOnProject && projectId ? canEditPropertiesBasedOnProject(projectId) : isEditingAllowed;

      return enableInlineEditing && isEditingAllowedBasedOnProject;
    },
    [canEditPropertiesBasedOnProject, enableInlineEditing, isEditingAllowed]
  );

  return (
    <>
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
              readOnly={!canEditProperties(issue.project_id ?? undefined) || isCompletedCycle}
              placements={placement}
            />
          )}
          loadMoreIssues={loadMoreIssues}
          getPaginationData={getPaginationData}
          getGroupIssueCount={getGroupIssueCount}
          addIssuesToView={addIssuesToView}
          quickAddCallback={quickAddIssue}
          readOnly={isCompletedCycle}
          updateFilters={updateFilters}
          handleDragAndDrop={handleDragAndDrop}
          canEditProperties={canEditProperties}
          isEpic={isEpic}
        />
      </div>
    </>
  );
});
