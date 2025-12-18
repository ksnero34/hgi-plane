import { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
// plane imports
import {
  EIssueFilterType,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  EUserPermissions,
  EUserPermissionsLevel,
  WORK_ITEM_TRACKER_ELEMENTS,
} from "@plane/constants";
import { Button } from "@plane/propel/button";
import { ViewsIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type {
  ICustomSearchSelectOption,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TBulkOperationsPayload,
  TIssue,
} from "@plane/types";
import { EIssuesStoreType, EViewAccess, EIssueLayoutTypes } from "@plane/types";
import { Breadcrumbs, Header, BreadcrumbNavigationSearchDropdown } from "@plane/ui";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SwitcherIcon, SwitcherLabel } from "@/components/common/switcher-label";
import { DisplayFiltersSelection, FiltersDropdown, LayoutSelection } from "@/components/issues/issue-layouts/filters";
import { ViewQuickActions } from "@/components/views/quick-actions";
import { WorkItemFiltersToggle } from "@/components/work-item-filters/filters-toggle";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUserPermissions } from "@/hooks/store/user";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
// plane web
import { useAppRouter } from "@/hooks/use-app-router";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { BulkEditModal } from "@/plane-web/components/issues/bulk-operations/bulk-edit-modal";

export const ProjectViewIssuesHeader = observer(function ProjectViewIssuesHeader() {
  // refs
  const parentRef = useRef(null);
  // states
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId, viewId: routerViewId } = useParams();
  const viewId = routerViewId ? routerViewId.toString() : undefined;
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
    issueMap,
  } = useIssues(EIssuesStoreType.PROJECT_VIEW);
  const { toggleCreateIssueModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();
  const { selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const { fetchIssues } = useIssuesActions(EIssuesStoreType.PROJECT_VIEW);

  const { currentProjectDetails, loader } = useProject();
  const { projectViewIds, getViewById } = useProjectView();

  const activeLayout = issueFilters?.displayFilters?.layout;

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        { layout: layout },
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        updatedDisplayFilter,
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId || !viewId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_PROPERTIES,
        property,
        viewId.toString()
      );
    },
    [workspaceSlug, projectId, viewId, updateFilters]
  );

  const viewDetails = viewId ? getViewById(viewId.toString()) : null;

  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  // 일괄변경을 위한 핸들러 함수
  const handleBulkUpdate = async (bulkUpdatePayload: TBulkOperationsPayload) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/bulk-operation-issues/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(bulkUpdatePayload),
      });

      if (response.ok) {
        const result = await response.json();

        // 성공 메시지 표시
        let message = `${result.updated_issues || 0}개 작업 항목이 성공적으로 업데이트되었습니다.`;

        // 권한으로 인해 건너뛴 이슈가 있는 경우 경고 메시지 추가
        if (result.skipped_issues && result.skipped_issues > 0) {
          message += ` ${result.skipped_issues}개 작업 항목은 권한이 없어 건너뛰었습니다.`;
        }

        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: message,
        });

        // 이슈 목록 새로고침
        await fetchIssues("mutation", {
          canGroup: true,
          perPageCount: issueFilters?.displayFilters?.per_page || 100,
        });

        // 선택 해제
        clearSelection();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "업데이트에 실패했습니다.");
      }
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: `업데이트 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  // 선택된 이슈들의 데이터를 가져오기 (완전한 이슈 데이터가 있는 것만)
  const selectedIssuesList = selectedEntityIds
    .map((issueId) => issueMap[issueId])
    .filter((issue): issue is TIssue => issue !== undefined);

  if (!viewDetails) return;

  const switcherOptions = projectViewIds
    ?.map((id) => {
      const _view = id === viewId ? viewDetails : getViewById(id);
      if (!_view) return;
      return {
        value: _view.id,
        query: _view.name,
        content: <SwitcherLabel logo_props={_view.logo_props} name={_view.name} LabelIcon={ViewsIcon} />,
      };
    })
    .filter((option) => option !== undefined) as ICustomSearchSelectOption[];

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Views"
                href={`/${workspaceSlug}/projects/${projectId}/views/`}
                icon={<ViewsIcon className="h-4 w-4 text-custom-text-300" />}
              />
            }
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbNavigationSearchDropdown
                selectedItem={viewId?.toString() ?? ""}
                navigationItems={switcherOptions}
                onChange={(value: string) => {
                  router.push(`/${workspaceSlug}/projects/${projectId}/views/${value}`);
                }}
                title={viewDetails?.name}
                icon={
                  <Breadcrumbs.Icon>
                    <SwitcherIcon logo_props={viewDetails.logo_props} LabelIcon={ViewsIcon} size={16} />
                  </Breadcrumbs.Icon>
                }
                isLast
              />
            }
          />
        </Breadcrumbs>

        {viewDetails?.access === EViewAccess.PRIVATE ? (
          <div className="cursor-default text-custom-text-300">
            <Tooltip tooltipContent={"Private"}>
              <Lock className="h-4 w-4" />
            </Tooltip>
          </div>
        ) : (
          <></>
        )}
      </Header.LeftItem>
      <Header.RightItem className="items-center">
        <>
          {!viewDetails.is_locked && (
            <LayoutSelection
              layouts={[
                EIssueLayoutTypes.LIST,
                EIssueLayoutTypes.KANBAN,
                EIssueLayoutTypes.CALENDAR,
                EIssueLayoutTypes.SPREADSHEET,
                EIssueLayoutTypes.GANTT,
              ]}
              onChange={(layout) => handleLayoutChange(layout)}
              selectedLayout={activeLayout}
            />
          )}
          {viewId && <WorkItemFiltersToggle entityType={EIssuesStoreType.PROJECT_VIEW} entityId={viewId} />}
          {!viewDetails.is_locked && (
            <FiltersDropdown title="Display" placement="bottom-end">
              <DisplayFiltersSelection
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.layoutOptions[activeLayout] : undefined
                }
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                displayProperties={issueFilters?.displayProperties ?? {}}
                handleDisplayPropertiesUpdate={handleDisplayProperties}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>
          )}
        </>
        {canUserCreateIssue ? (
          <Button
            onClick={() => {
              toggleCreateIssueModal(true, EIssuesStoreType.PROJECT_VIEW);
            }}
            data-ph-element={WORK_ITEM_TRACKER_ELEMENTS.HEADER_ADD_BUTTON.PROJECT_VIEW}
            size="sm"
          >
            Add work item
          </Button>
        ) : (
          <></>
        )}
        <div className="hidden md:block">
          <ViewQuickActions
            parentRef={parentRef}
            customClassName="flex-shrink-0 flex items-center justify-center size-[26px] bg-custom-background-80/70 rounded"
            projectId={projectId.toString()}
            view={viewDetails}
            workspaceSlug={workspaceSlug.toString()}
          />
        </div>
      </Header.RightItem>

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIssues={selectedIssuesList}
        onBulkUpdate={handleBulkUpdate}
      />
    </Header>
  );
});
