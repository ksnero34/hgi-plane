"use client";

import { useCallback, useState, useEffect } from "react";
import { observer } from "mobx-react";
// plane constants
import { EIssueLayoutTypes, EIssueFilterType, EIssuesStoreType, ISSUE_STORE_TO_FILTERS_MAP } from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import { IIssueDisplayFilterOptions, IIssueDisplayProperties, IIssueFilterOptions, TCustomField } from "@plane/types";
import { Button } from "@plane/ui";
// components
import { DisplayFiltersSelection, FiltersDropdown, FilterSelection, LayoutSelection } from "@/components/issues";
// helpers
import { isIssueFilterActive } from "@/helpers/filter.helper";
import { calculateFilterValue } from "@/helpers/filter-update.helper";
// hooks
import { useLabel, useProjectState, useMember, useIssues } from "@/hooks/store";
// plane web types
import { TProject } from "@/plane-web/types";
import { ProjectAnalyticsModal } from "../analytics";

type Props = {
  currentProjectDetails: TProject | undefined;
  projectId: string;
  workspaceSlug: string;
  canUserCreateIssue: boolean | undefined;
  storeType?: EIssuesStoreType.PROJECT | EIssuesStoreType.EPIC;
};
const HeaderFilters = observer((props: Props) => {
  const {
    currentProjectDetails,
    projectId,
    workspaceSlug,
    canUserCreateIssue,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false);
  // store hooks
  const {
    project: { projectMemberIds },
  } = useMember();
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(storeType);
  const { projectStates } = useProjectState();
  const { projectLabels } = useLabel();
  // derived values
  const activeLayout = issueFilters?.displayFilters?.layout;
  const layoutDisplayFiltersOptions = ISSUE_STORE_TO_FILTERS_MAP[storeType]?.[activeLayout];

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId || isLoadingCustomFields) return;
      
      try {
        setIsLoadingCustomFields(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setCustomFields(data);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoadingCustomFields(false);
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!workspaceSlug || !projectId) return;
      
      const updatedValue = calculateFilterValue(key, value, issueFilters?.filters ?? {});
      updateFilters(workspaceSlug, projectId, EIssueFilterType.FILTERS, { [key]: updatedValue });
    },
    [workspaceSlug, projectId, issueFilters, updateFilters]
  );
  const handleLayoutChange = useCallback(
    (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout: layout });
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_PROPERTIES, property);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  return (
    <>
      <ProjectAnalyticsModal
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        projectDetails={currentProjectDetails ?? undefined}
      />
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
          displayFilters={issueFilters?.displayFilters ?? {}}
          handleDisplayFiltersUpdate={handleDisplayFilters}
          layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
          labels={projectLabels}
          memberIds={projectMemberIds ?? undefined}
          projectId={projectId}
          states={projectStates}
          customFields={customFields}
          cycleViewDisabled={!currentProjectDetails?.cycle_view}
          moduleViewDisabled={!currentProjectDetails?.module_view}
          isEpic={storeType === EIssuesStoreType.EPIC}
        />
      </FiltersDropdown>
      <FiltersDropdown title={t("common.display")} placement="bottom-end">
        <DisplayFiltersSelection
          layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
          displayFilters={issueFilters?.displayFilters ?? {}}
          handleDisplayFiltersUpdate={handleDisplayFilters}
          displayProperties={issueFilters?.displayProperties ?? {}}
          handleDisplayPropertiesUpdate={handleDisplayProperties}
          cycleViewDisabled={!currentProjectDetails?.cycle_view}
          moduleViewDisabled={!currentProjectDetails?.module_view}
          isEpic={storeType === EIssuesStoreType.EPIC}
        />
      </FiltersDropdown>
      {canUserCreateIssue ? (
        <Button className="hidden md:block" onClick={() => setAnalyticsModal(true)} variant="neutral-primary" size="sm">
          {t("common.analytics")}
        </Button>
      ) : (
        <></>
      )}
    </>
  );
});

export default HeaderFilters;
