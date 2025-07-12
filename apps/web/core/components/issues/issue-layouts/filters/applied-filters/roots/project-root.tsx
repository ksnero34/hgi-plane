import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
// types
import { EIssueFilterType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssuesStoreType, IIssueFilterOptions, TCustomField } from "@plane/types";
// ui
import { Header, EHeaderVariant } from "@plane/ui";
// components
import { AppliedFiltersList, SaveFilterView } from "@/components/issues";
// constants
// hooks
import { useLabel, useProjectState, useUserPermissions } from "@/hooks/store";
import { useIssues } from "@/hooks/store/use-issues";
import { calculateFilterRemovalValue } from "@plane/utils";
import { useCustomField } from "@/hooks/store/use-custom-field";
// plane web constants

type TProjectAppliedFiltersRootProps = {
  storeType?: EIssuesStoreType.PROJECT | EIssuesStoreType.EPIC;
};

export const ProjectAppliedFiltersRoot: React.FC<TProjectAppliedFiltersRootProps> = observer((props) => {
  const { storeType = EIssuesStoreType.PROJECT } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { customFields } = useCustomField();
  const { projectLabels } = useLabel();
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(storeType);
  const { allowPermissions } = useUserPermissions();

  const { projectStates } = useProjectState();

  // derived values
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const userFilters = issueFilters?.filters;
  // filters whose value not null or empty array
  const appliedFilters: IIssueFilterOptions = {};
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId) return;

    if (!value) {
      updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, {
        [key]: null,
      });
      return;
    }

    const updatedValue = calculateFilterRemovalValue(key, value, issueFilters?.filters ?? {});
    updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, {
      [key]: updatedValue,
    });
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      const clearedValue = calculateFilterRemovalValue(key as keyof IIssueFilterOptions, null, userFilters ?? {});
      (newFilters as any)[key] = clearedValue;
    });
    updateFilters(workspaceSlug.toString(), projectId.toString(), EIssueFilterType.FILTERS, { ...newFilters });
  };

  // return if no filters are applied
  if (Object.keys(appliedFilters).length === 0) return null;

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
          alwaysAllowEditing
          workspaceSlug={workspaceSlug?.toString()}
          projectId={projectId?.toString()}
        />
      </Header.LeftItem>
      <Header.RightItem>
        {isEditingAllowed && (
          <SaveFilterView
            workspaceSlug={workspaceSlug?.toString()}
            projectId={projectId?.toString()}
            filterParams={{
              filters: appliedFilters,
              display_filters: issueFilters?.displayFilters,
              display_properties: issueFilters?.displayProperties,
            }}
          />
        )}
      </Header.RightItem>
    </Header>
  );
});
