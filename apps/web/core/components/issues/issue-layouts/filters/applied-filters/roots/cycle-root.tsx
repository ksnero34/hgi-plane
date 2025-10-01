import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EIssueFilterType, PROJECT_VIEW_TRACKER_ELEMENTS } from "@plane/constants";
import { EIssuesStoreType, IIssueFilterOptions } from "@plane/types";
import { Header, EHeaderVariant } from "@plane/ui";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useCustomField } from "@/hooks/store/use-custom-field";
// local imports
import { SaveFilterView } from "../../../save-filter-view";
import { AppliedFiltersList } from "../filters-list";
import { calculateFilterRemovalValue } from "@plane/utils";

export const CycleAppliedFiltersRoot: React.FC = observer(() => {
  // router
  const { workspaceSlug, projectId, cycleId } = useParams();
  // store hooks
  const {
    issuesFilter: { issueFilters, updateFilters },
  } = useIssues(EIssuesStoreType.CYCLE);

  const { projectLabels } = useLabel();
  const { projectStates } = useProjectState();
  const { customFields } = useCustomField(projectId as string);

  // derived values
  const userFilters = issueFilters?.filters;
  const displayFilters = issueFilters?.displayFilters;
  const displayProperties = issueFilters?.displayProperties;

  // filters whose value not null or empty array
  const appliedFilters: IIssueFilterOptions = {};
  Object.entries(userFilters ?? {}).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;
    appliedFilters[key as keyof IIssueFilterOptions] = value;
  });

  const handleRemoveFilter = (key: keyof IIssueFilterOptions, value: string | null) => {
    if (!workspaceSlug || !projectId || !cycleId) return;

    // calculateFilterRemovalValue 함수를 사용하여 모든 필터를 통일된 방식으로 처리
    const updatedValue = calculateFilterRemovalValue(key as string, value, userFilters ?? {});
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { [key]: updatedValue },
      cycleId.toString()
    );
  };

  const handleClearAllFilters = () => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    const newFilters: IIssueFilterOptions = {};
    Object.keys(userFilters ?? {}).forEach((key) => {
      // calculateFilterRemovalValue로 null 처리를 통일
      const clearedValue = calculateFilterRemovalValue(key as string, null, userFilters ?? {});
      (newFilters as any)[key] = clearedValue;
    });
    updateFilters(
      workspaceSlug.toString(),
      projectId.toString(),
      EIssueFilterType.FILTERS,
      { ...newFilters },
      cycleId.toString()
    );
  };

  // return if no filters are applied
  if (Object.keys(appliedFilters).length === 0 || !workspaceSlug || !projectId || !cycleId) return null;

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
          filters: { ...appliedFilters, cycle: [cycleId?.toString()] },
          display_filters: displayFilters,
          display_properties: displayProperties,
        }}
        trackerElement={PROJECT_VIEW_TRACKER_ELEMENTS.CYCLE_HEADER_SAVE_AS_VIEW_BUTTON}
      />
    </Header>
  );
});
