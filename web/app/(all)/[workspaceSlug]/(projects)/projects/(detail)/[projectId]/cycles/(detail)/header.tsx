"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
// icons
import { PanelRight, Edit3 } from "lucide-react";
// plane constants
import {
  EIssueLayoutTypes,
  EIssueFilterType,
  EIssuesStoreType,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  EUserPermissions,
  EUserPermissionsLevel,
} from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import {
  ICustomSearchSelectOption,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  TCustomField,
  TIssue,
} from "@plane/types";
// ui
import { Breadcrumbs, Button, ContrastIcon, Tooltip, Header, CustomSearchSelect, setToast, TOAST_TYPE } from "@plane/ui";
// components
import { WorkItemsModal } from "@/components/analytics/work-items/modal";
import { BreadcrumbLink, SwitcherLabel } from "@/components/common";
import { CycleQuickActions } from "@/components/cycles";
import { DisplayFiltersSelection, FiltersDropdown, FilterSelection, LayoutSelection } from "@/components/issues";
// helpers
import { cn } from "@/helpers/common.helper";
import { calculateFilterValue } from "@/helpers/filter-update.helper";
import { isIssueFilterActive } from "@/helpers/filter.helper";
// hooks
import {
  useEventTracker,
  useCycle,
  useLabel,
  useMember,
  useProject,
  useProjectState,
  useIssues,
  useCommandPalette,
  useUserPermissions,
  useMultipleSelectStore,
  useCustomField,
} from "@/hooks/store";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import useLocalStorage from "@/hooks/use-local-storage";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web
import { ProjectBreadcrumb } from "@/plane-web/components/breadcrumbs";
import { BulkEditModal } from "@/plane-web/components/issues/bulk-operations/bulk-edit-modal";

export const CycleIssuesHeader: React.FC = observer(() => {
  // refs
  const parentRef = useRef<HTMLDivElement>(null);
  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  // router
  const router = useRouter();
  const { workspaceSlug, projectId, cycleId } = useParams() as {
    workspaceSlug: string;
    projectId: string;
    cycleId: string;
  };
  // i18n
  const { t } = useTranslation();
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
    issues: { getGroupIssueCount },
  } = useIssues(EIssuesStoreType.CYCLE);
  const { fetchIssues } = useIssuesActions(EIssuesStoreType.CYCLE);
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { currentProjectCycleIds, getCycleById } = useCycle();
  const { toggleCreateIssueModal } = useCommandPalette();
  const { setTrackElement } = useEventTracker();
  const { currentProjectDetails, loader } = useProject();
  const { projectStates } = useProjectState();
  const { projectLabels } = useLabel();
  const {
    project: { projectMemberIds },
  } = useMember();
  const { isMobile } = usePlatformOS();
  const { allowPermissions } = useUserPermissions();
  const { customFields } = useCustomField(projectId as string);

  const activeLayout = issueFilters?.displayFilters?.layout;

  const { setValue, storedValue } = useLocalStorage("cycle_sidebar_collapsed", false);

  const isSidebarCollapsed = storedValue ? (storedValue === true ? true : false) : false;
  const toggleSidebar = () => {
    setValue(!isSidebarCollapsed);
  };

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout: layout }, cycleId);
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!workspaceSlug || !projectId) return;

      const updatedValue = calculateFilterValue(key, value, issueFilters?.filters ?? {});
      updateFilters(workspaceSlug, projectId, EIssueFilterType.FILTERS, { [key]: updatedValue }, cycleId);
    },
    [workspaceSlug, projectId, cycleId, issueFilters, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter, cycleId);
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_PROPERTIES, property, cycleId);
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  // derived values
  const cycleDetails = cycleId ? getCycleById(cycleId.toString()) : undefined;
  const isCompletedCycle = cycleDetails?.status?.toLocaleLowerCase() === "completed";
  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const switcherOptions = currentProjectCycleIds
    ?.map((id) => {
      const _cycle = id === cycleId ? cycleDetails : getCycleById(id);
      if (!_cycle) return;
      return {
        value: _cycle.id,
        query: _cycle.name,
        content: <SwitcherLabel name={_cycle.name} LabelIcon={ContrastIcon} />,
      };
    })
    .filter((option) => option !== undefined) as ICustomSearchSelectOption[];

  const workItemsCount = getGroupIssueCount(undefined, undefined, false);

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
        projectDetails={currentProjectDetails}
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        cycleDetails={cycleDetails ?? undefined}
      />
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2">
            <Breadcrumbs onBack={router.back} isLoading={loader === "init-loader"}>
              <Breadcrumbs.BreadcrumbItem
                type="text"
                link={
                  <span>
                    <span className="hidden md:block">
                      <ProjectBreadcrumb />
                    </span>
                    <Link
                      href={`/${workspaceSlug}/projects/${currentProjectDetails?.id}/issues`}
                      className="block pl-2 text-custom-text-300 md:hidden"
                    >
                      ...
                    </Link>
                  </span>
                }
              />
              <Breadcrumbs.BreadcrumbItem
                type="text"
                link={
                  <BreadcrumbLink
                    label={t("common.cycles")}
                    href={`/${workspaceSlug}/projects/${projectId}/cycles`}
                    icon={<ContrastIcon className="h-4 w-4 text-custom-text-300" />}
                  />
                }
              />
              <Breadcrumbs.BreadcrumbItem
                type="component"
                component={
                  <CustomSearchSelect
                    options={switcherOptions}
                    value={cycleId}
                    onChange={(value: string) => {
                      router.push(`/${workspaceSlug}/projects/${projectId}/cycles/${value}`);
                    }}
                    label={
                      <div className="flex items-center gap-1">
                        <SwitcherLabel name={cycleDetails?.name} LabelIcon={ContrastIcon} />
                        {workItemsCount && workItemsCount > 0 ? (
                          <Tooltip
                            isMobile={isMobile}
                            tooltipContent={`There are ${workItemsCount} ${
                              workItemsCount > 1 ? "work items" : "work item"
                            } in this cycle`}
                            position="bottom"
                          >
                            <span className="flex flex-shrink-0 cursor-default items-center justify-center rounded-xl bg-custom-primary-100/20 px-2 text-center text-xs font-semibold text-custom-primary-100">
                              {workItemsCount}
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                    }
                  />
                }
              />
            </Breadcrumbs>
          </div>
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <div className="hidden items-center gap-2 md:flex">
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
            <FiltersDropdown
              title={t("common.filters")}
              placement="bottom-end"
              isFiltersApplied={isIssueFilterActive(issueFilters)}
            >
              <FilterSelection
                filters={issueFilters?.filters ?? {}}
                handleFiltersUpdate={handleFiltersUpdate}
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                labels={projectLabels}
                memberIds={projectMemberIds ?? undefined}
                states={projectStates}
                projectId={projectId}
                customFields={customFields}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>
            <FiltersDropdown title={t("common.display")} placement="bottom-end">
              <DisplayFiltersSelection
                layoutDisplayFiltersOptions={
                  activeLayout ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues[activeLayout] : undefined
                }
                displayFilters={issueFilters?.displayFilters ?? {}}
                handleDisplayFiltersUpdate={handleDisplayFilters}
                displayProperties={issueFilters?.displayProperties ?? {}}
                handleDisplayPropertiesUpdate={handleDisplayProperties}
                ignoreGroupedFilters={["cycle"]}
                cycleViewDisabled={!currentProjectDetails?.cycle_view}
                moduleViewDisabled={!currentProjectDetails?.module_view}
              />
            </FiltersDropdown>

            {canUserCreateIssue && (
              <>
                <Button onClick={() => setAnalyticsModal(true)} variant="neutral-primary" size="sm">
                  {t("common.analytics")}
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
                {!isCompletedCycle && (
                  <Button
                    className="h-full self-start"
                    onClick={() => {
                      setTrackElement("Cycle work items page");
                      toggleCreateIssueModal(true, EIssuesStoreType.CYCLE);
                    }}
                    size="sm"
                  >
                    {t("issue.add.label")}
                  </Button>
                )}
              </>
            )}
            <button
              type="button"
              className="p-1.5 rounded outline-none hover:bg-custom-sidebar-background-80 bg-custom-background-80/70"
              onClick={toggleSidebar}
            >
              <PanelRight className={cn("h-4 w-4", !isSidebarCollapsed ? "text-[#3E63DD]" : "text-custom-text-200")} />
            </button>
            <CycleQuickActions
              parentRef={parentRef}
              cycleId={cycleId}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              customClassName="flex-shrink-0 flex items-center justify-center size-[26px] bg-custom-background-80/70 rounded"
            />
          </div>
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
