"use client";

import { useCallback, useState, useEffect } from "react";
import { useParams } from "next/navigation";
// icons
import { Calendar, ChevronDown, Kanban, List } from "lucide-react";
// plane imports
import { EIssueLayoutTypes, EIssueFilterType, ISSUE_LAYOUTS, ISSUE_DISPLAY_FILTERS_BY_PAGE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// types
import { IIssueDisplayFilterOptions, IIssueDisplayProperties, IIssueFilterOptions, TCustomField } from "@plane/types";
// ui
import { CustomMenu } from "@plane/ui";
import { isIssueFilterActive } from "@plane/utils";
// components
import { WorkItemsModal } from "@/components/analytics/work-items/modal";
import { DisplayFiltersSelection, FilterSelection, FiltersDropdown, IssueLayoutIcon } from "@/components/issues";
// helpers
import { calculateFilterValue } from "@plane/utils";
// hooks
import {
  useCycle,
  useIssues,
  useProject,
  useProjectState,
  useLabel,
  useUserPermissions,
  useCustomField,
  useMember,
} from "@/hooks/store";

export const CycleIssuesMobileHeader = () => {
  // i18n
  const { t } = useTranslation();

  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const { workspaceSlug, projectId, cycleId } = useParams();
  const { getCycleById } = useCycle();
  const cycleDetails = cycleId ? getCycleById(cycleId.toString()) : undefined;

  // store hooks
  const { currentProjectDetails } = useProject();
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.CYCLE);
  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
  const {
    project: { projectMemberIds },
  } = useMember();
  const { customFields } = useCustomField(projectId as string);

  const layouts = [
    { key: "list", titleTranslationKey: "issue.layouts.list", icon: List },
    { key: "kanban", titleTranslationKey: "issue.layouts.kanban", icon: Kanban },
    { key: "calendar", titleTranslationKey: "issue.layouts.calendar", icon: Calendar },
  ];

  const activeLayout = issueFilters?.displayFilters?.layout;

  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId || !cycleId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        { layout: layout },
        cycleId.toString()
      );
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!workspaceSlug || !projectId) return;

      const updatedValue = calculateFilterValue(key, value, issueFilters?.filters ?? {});
      updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, { [key]: updatedValue }, cycleId.toString());
    },
    [workspaceSlug, projectId, cycleId, issueFilters, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId || !cycleId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        updatedDisplayFilter,
        cycleId.toString()
      );
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId || !cycleId) return;
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.DISPLAY_PROPERTIES,
        property,
        cycleId.toString()
      );
    },
    [workspaceSlug, projectId, cycleId, updateFilters]
  );

  return (
    <>
      <WorkItemsModal
        projectDetails={currentProjectDetails}
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        cycleDetails={cycleDetails ?? undefined}
      />
      <div className="flex justify-evenly py-2 border-b border-custom-border-200 md:hidden bg-custom-background-100">
        <CustomMenu
          maxHeight={"md"}
          className="flex flex-grow justify-center text-custom-text-200 text-sm"
          placement="bottom-start"
          customButton={
            <span className="flex flex-grow justify-center text-custom-text-200 text-sm">{t("common.layout")}</span>
          }
          customButtonClassName="flex flex-grow justify-center text-custom-text-200 text-sm"
          closeOnSelect
        >
          {layouts.map((layout, index) => (
            <CustomMenu.MenuItem
              key={ISSUE_LAYOUTS[index].key}
              onClick={() => {
                handleLayoutChange(ISSUE_LAYOUTS[index].key);
              }}
              className="flex items-center gap-2"
            >
              <IssueLayoutIcon layout={ISSUE_LAYOUTS[index].key} className="w-3 h-3" />
              <div className="text-custom-text-300">{t(layout.titleTranslationKey)}</div>
            </CustomMenu.MenuItem>
          ))}
        </CustomMenu>
        <div className="flex flex-grow justify-center border-l border-custom-border-200 items-center text-custom-text-200 text-sm">
          <FiltersDropdown
            title={t("common.filters")}
            placement="bottom-end"
            menuButton={
              <span className="flex items-center text-custom-text-200 text-sm">
                {t("common.filters")}
                <ChevronDown className="text-custom-text-200  h-4 w-4 ml-2" />
              </span>
            }
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
              projectId={projectId as string}
              customFields={customFields}
              cycleViewDisabled={!currentProjectDetails?.cycle_view}
              moduleViewDisabled={!currentProjectDetails?.module_view}
            />
          </FiltersDropdown>
        </div>
        <div className="flex flex-grow justify-center border-l border-custom-border-200 items-center text-custom-text-200 text-sm">
          <FiltersDropdown
            title={t("common.display")}
            placement="bottom-end"
            menuButton={
              <span className="flex items-center text-custom-text-200 text-sm">
                {t("common.display")}
                <ChevronDown className="text-custom-text-200 h-4 w-4 ml-2" />
              </span>
            }
          >
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
        </div>

        <span
          onClick={() => setAnalyticsModal(true)}
          className="flex flex-grow justify-center text-custom-text-200 text-sm border-l border-custom-border-200"
        >
          {t("common.analytics")}
        </span>
      </div>
    </>
  );
};
