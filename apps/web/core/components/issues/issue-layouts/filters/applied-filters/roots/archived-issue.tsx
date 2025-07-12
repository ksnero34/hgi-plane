import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EIssueFilterType } from "@plane/constants";
import { EIssuesStoreType, IIssueFilterOptions } from "@plane/types";
// hooks
import { Header, EHeaderVariant } from "@plane/ui";
import { AppliedFiltersList, SaveFilterView } from "@/components/issues";
import { useIssues, useLabel, useProjectState } from "@/hooks/store";
import { calculateFilterRemovalValue } from "@plane/utils";
// components
// types

export const ArchivedIssueAppliedFiltersRoot: React.FC = observer(() => {
  // router
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  // store hooks

  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.ARCHIVED);
  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
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
    <div className="flex justify-between p-4 gap-2.5">
      <AppliedFiltersList
        appliedFilters={appliedFilters}
        handleClearAllFilters={handleClearAllFilters}
        handleRemoveFilter={handleRemoveFilter}
        labels={projectLabels ?? []}
        states={projectStates}
      />
    </div>
  );
});
