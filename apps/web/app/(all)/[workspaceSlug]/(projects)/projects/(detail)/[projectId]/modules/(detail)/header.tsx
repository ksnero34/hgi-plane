"use client";

import { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { ChartNoAxesColumn, ListFilter, PanelRight, SlidersHorizontal, Edit3 } from "lucide-react";
// plane imports
import {
  EIssueFilterType,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  EUserPermissions,
  EUserPermissionsLevel,
  EProjectFeatureKey,
  WORK_ITEM_TRACKER_ELEMENTS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { DiceIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import {
  EIssuesStoreType,
  ICustomSearchSelectOption,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  EIssueLayoutTypes,
  TCustomField,
  TIssue
} from "@plane/types";
import { Breadcrumbs, Button, Header, BreadcrumbNavigationSearchDropdown, setToast, TOAST_TYPE } from "@plane/ui";
import { cn, isIssueFilterActive, calculateFilterValue } from "@plane/utils";
// components
import { WorkItemsModal } from "@/components/analytics/work-items/modal";
import { SwitcherLabel } from "@/components/common/switcher-label";
import {
  DisplayFiltersSelection,
  FiltersDropdown,
  FilterSelection,
  LayoutSelection,
  MobileLayoutSelection,
} from "@/components/issues/issue-layouts/filters";
// helpers
import { ModuleQuickActions } from "@/components/modules";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useCustomField } from "@/hooks/store/use-custom-field";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import useLocalStorage from "@/hooks/use-local-storage";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
import { BulkEditModal } from "@/plane-web/components/issues/bulk-operations/bulk-edit-modal";

export const ModuleIssuesHeader: React.FC = observer(() => {
  // refs
  const parentRef = useRef<HTMLDivElement>(null);
  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId, moduleId } = useParams();
  // i18n
  const { t } = useTranslation();
  // hooks
  const { isMobile } = usePlatformOS();
  // store hooks
  const {
    issuesFilter: { issueFilters },
    issues: { getGroupIssueCount },
  } = useIssues(EIssuesStoreType.MODULE);
  const { updateFilters } = useIssuesActions(EIssuesStoreType.MODULE);
  const { fetchIssues } = useIssuesActions(EIssuesStoreType.MODULE);
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { projectModuleIds, getModuleById } = useModule();
  const { toggleCreateIssueModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();
  const { currentProjectDetails, loader } = useProject();
  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
  const {
    project: { projectMemberIds },
  } = useMember();
  const { customFields } = useCustomField(projectId as string);
  const {
    setValue: setModuleSidebarCollapsed,
    storedValue: moduleSidebarCollapsed,
  } = useLocalStorage<string | boolean>("module_sidebar_collapsed", false);

  const isSidebarCollapsed = moduleSidebarCollapsed === null
    ? false
    : typeof moduleSidebarCollapsed === "boolean"
      ? moduleSidebarCollapsed
      : moduleSidebarCollapsed === "true";
  const toggleSidebar = () => {
    setModuleSidebarCollapsed(!isSidebarCollapsed);
  };

  const activeLayout = issueFilters?.displayFilters?.layout;

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!projectId) return;
      updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, { layout: layout });
    },
    [projectId, updateFilters]
  );

  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!projectId) return;

      const updatedValue = calculateFilterValue(key, value, issueFilters?.filters ?? {});
      updateFilters(projectId.toString(), EIssueFilterType.FILTERS, { [key]: updatedValue });
    },
    [projectId, issueFilters, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!projectId) return;
      updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter);
    },
    [projectId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!projectId) return;
      updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_PROPERTIES, property);
    },
    [projectId, updateFilters]
  );

  // derived values
  const moduleDetails = moduleId ? getModuleById(moduleId.toString()) : undefined;
  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const workItemsCount = getGroupIssueCount(undefined, undefined, false);

  const switcherOptions = projectModuleIds
    ?.map((id) => {
      const _module = id === moduleId ? moduleDetails : getModuleById(id);
      if (!_module) return;
      return {
        value: _module.id,
        query: _module.name,
        content: <SwitcherLabel name={_module.name} LabelIcon={DiceIcon} />,
      };
    })
    .filter((option) => option !== undefined) as ICustomSearchSelectOption[];

  // 일괄변경을 위한 핸들러 함수
  const handleBulkUpdate = async (bulkUpdatePayload: any) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/bulk-operation-issues/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(bulkUpdatePayload),
        }
      );

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
        await fetchIssues(
          "mutation",
          {
            canGroup: true,
            perPageCount: issueFilters?.displayFilters?.per_page || 100
          }
        );

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
    .map(issueId => getIssueById(issueId))
    .filter((issue): issue is TIssue => issue !== undefined);

  return (
    <>
      <WorkItemsModal
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        moduleDetails={moduleDetails ?? undefined}
        projectDetails={currentProjectDetails}
      />
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2">
            <Breadcrumbs onBack={router.back} isLoading={loader === "init-loader"}>
              <CommonProjectBreadcrumbs
                workspaceSlug={workspaceSlug?.toString() ?? ""}
                projectId={projectId?.toString() ?? ""}
                featureKey={EProjectFeatureKey.MODULES}
              />
              <Breadcrumbs.Item
                component={
                  <BreadcrumbNavigationSearchDropdown
                    selectedItem={moduleId?.toString() ?? ""}
                    navigationItems={switcherOptions}
                    onChange={(value: string) => {
                      router.push(`/${workspaceSlug}/projects/${projectId}/modules/${value}`);
                    }}
                    title={moduleDetails?.name}
                    icon={<DiceIcon className="size-3.5 flex-shrink-0 text-custom-text-300" />}
                    isLast
                  />
                }
              />
            </Breadcrumbs>
            {workItemsCount && workItemsCount > 0 ? (
              <Tooltip
                isMobile={isMobile}
                tooltipContent={`There are ${workItemsCount} ${
                  workItemsCount > 1 ? "work items" : "work item"
                } in this module`}
                position="bottom"
              >
                <span className="flex flex-shrink-0 cursor-default items-center justify-center rounded-xl bg-custom-primary-100/20 px-2 text-center text-xs font-semibold text-custom-primary-100">
                  {workItemsCount}
                </span>
              </Tooltip>
            ) : null}
          </div>
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <div className="hidden gap-2 md:flex">
            <div className="hidden @4xl:flex">
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
            </div>
            <div className="flex @4xl:hidden">
              <MobileLayoutSelection
                layouts={[
                  EIssueLayoutTypes.LIST,
                  EIssueLayoutTypes.KANBAN,
                  EIssueLayoutTypes.CALENDAR,
                  EIssueLayoutTypes.SPREADSHEET,
                  EIssueLayoutTypes.GANTT,
                ]}
                onChange={(layout) => handleLayoutChange(layout)}
                activeLayout={activeLayout}
              />
            </div>
            <FiltersDropdown
              title="필터"
              placement="bottom-end"
              isFiltersApplied={isIssueFilterActive(issueFilters)}
              miniIcon={<ListFilter className="size-3.5" />}
            >
              <FilterSelection
                filters={issueFilters?.filters ?? {}}
                handleFiltersUpdate={handleFiltersUpdate}
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                labels={projectLabels}
                memberIds={projectMemberIds ?? undefined}
                states={projectStates}
                projectId={projectId as string}
                customFields={customFields}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>
            <FiltersDropdown
              title="Display"
              placement="bottom-end"
              miniIcon={<SlidersHorizontal className="size-3.5" />}
            >
              <DisplayFiltersSelection
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                displayProperties={issueFilters?.displayProperties ?? {}}
                handleDisplayPropertiesUpdate={handleDisplayProperties}
                ignoreGroupedFilters={["module"]}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>
          </div>

          {canUserCreateIssue ? (
            <>
              <Button
                className="hidden md:block"
                onClick={() => setAnalyticsModal(true)}
                variant="neutral-primary"
                size="sm"
              >
                <div className="hidden @4xl:flex">Analytics</div>
                <div className="flex @4xl:hidden">
                  <ChartNoAxesColumn className="size-3.5" />
                </div>
              </Button>
              {isSelectionActive && selectedEntityIds.length > 0 && (
                <Button
                  onClick={() => setIsBulkEditModalOpen(true)}
                  size="sm"
                  variant="neutral-primary"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {t("issue.bulk_edit.label")} ({selectedEntityIds.length})
                </Button>
              )}
              <Button
                className="hidden sm:flex"
                onClick={() => {
                  toggleCreateIssueModal(true, EIssuesStoreType.MODULE);
                }}
                data-ph-element={WORK_ITEM_TRACKER_ELEMENTS.HEADER_ADD_BUTTON.MODULE}
                size="sm"
              >
                Add work item
              </Button>
            </>
          ) : (
            <></>
          )}
          <button
            type="button"
            className="p-1.5 rounded outline-none hover:bg-custom-sidebar-background-80 bg-custom-background-80/70"
            onClick={toggleSidebar}
          >
            <PanelRight className={cn("h-4 w-4", !isSidebarCollapsed ? "text-[#3E63DD]" : "text-custom-text-200")} />
          </button>
          <ModuleQuickActions
            parentRef={parentRef}
            moduleId={moduleId?.toString()}
            projectId={projectId.toString()}
            workspaceSlug={workspaceSlug.toString()}
            customClassName="flex-shrink-0 flex items-center justify-center bg-custom-background-80/70 rounded size-[26px]"
          />
        </Header.RightItem>
      </Header>

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIssues={selectedIssuesList}
        onBulkUpdate={handleBulkUpdate}
      />
    </>
  );
});
