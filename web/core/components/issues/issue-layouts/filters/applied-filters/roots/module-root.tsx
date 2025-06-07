import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { EIssueFilterType, EIssuesStoreType } from "@plane/constants";
import { IIssueFilterOptions, TCustomField } from "@plane/types";
// hooks
import { Header, EHeaderVariant } from "@plane/ui";
import { AppliedFiltersList, SaveFilterView } from "@/components/issues";
import { useIssues, useLabel, useProjectState, useCustomField } from "@/hooks/store";
import { calculateFilterRemovalValue } from "@/helpers/filter-update.helper";
// components
// types

export const ModuleAppliedFiltersRoot: React.FC = observer(() => {
  // router
  const { workspaceSlug, projectId, moduleId } = useParams();
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.MODULE);
  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
  const { customFields } = useCustomField();

  // derived values
  const userFilters = issueFilters?.filters;
  // filters whose value not null or empty array
  const appliedFilters: IIssueFilterOptions = {};
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId || !moduleId) return;

    if (!value) {
      updateFilters(
        workspaceSlug.toString(),
        projectId.toString(),
        EIssueFilterType.FILTERS,
        { [key]: null },
        moduleId.toString()
      );
      return;
    }

    // calculateFilterRemovalValue 함수를 사용하여 모든 필터를 통일된 방식으로 처리
    const updatedValue = calculateFilterRemovalValue(key, value, issueFilters?.filters ?? {});
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { [key]: updatedValue },
      moduleId.toString()
    );
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId || !moduleId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      // calculateFilterRemovalValue로 null 처리를 통일
      const clearedValue = calculateFilterRemovalValue(key as keyof IIssueFilterOptions, null, userFilters ?? {});
      (newFilters as any)[key] = clearedValue;
    });
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { ...newFilters },
      moduleId.toString()
    );
  };

  // return if no filters are applied
  if (!workspaceSlug || !projectId || !moduleId || Object.keys(appliedFilters).length === 0) return null;

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <Header.LeftItem>
        <AppliedFiltersList
          appliedFilters={appliedFilters}
          handleClearAllFilters={handleClearAllFilters}
          handleRemoveFilter={handleRemoveFilter}
          labels={projectLabels ?? []}
          states={projectStates}
          customFields={customFields}
          workspaceSlug={workspaceSlug?.toString()}
          projectId={projectId?.toString()}
        />
      </Header.LeftItem>
      <SaveFilterView
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
        filterParams={{
          filters: { ...appliedFilters, module: [moduleId.toString()] },
          display_filters: issueFilters?.displayFilters,
          display_properties: issueFilters?.displayProperties,
        }}
      />
    </Header>
  );
});
