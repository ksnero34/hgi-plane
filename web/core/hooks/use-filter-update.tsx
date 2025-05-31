import { useCallback } from "react";
// plane constants
import { EIssueFilterType } from "@plane/constants";
// types
import { IIssueFilterOptions, IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
// helpers
import { calculateFilterValue } from "@/helpers/filter-update.helper";

interface UseFilterUpdateProps {
  workspaceSlug: string | undefined;
  projectId: string | undefined;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: EIssueFilterType,
    filters: Partial<IIssueFilterOptions> | Partial<IIssueDisplayFilterOptions> | Partial<IIssueDisplayProperties>,
    cycleId?: string,
    moduleId?: string
  ) => void;
  issueFilters: any;
  cycleId?: string;
  moduleId?: string;
}

export const useFilterUpdate = ({
  workspaceSlug,
  projectId,
  updateFilters,
  issueFilters,
  cycleId,
  moduleId,
}: UseFilterUpdateProps) => {
  const handleFiltersUpdate = useCallback(
    (key: keyof IIssueFilterOptions, value: string | string[]) => {
      if (!workspaceSlug || !projectId) return;
      
      const updatedValue = calculateFilterValue(key, value, issueFilters?.filters ?? {});
      
      updateFilters(
        workspaceSlug, 
        projectId, 
        EIssueFilterType.FILTERS, 
        { [key]: updatedValue } as Partial<IIssueFilterOptions>, 
        cycleId,
        moduleId
      );
    },
    [workspaceSlug, projectId, cycleId, moduleId, issueFilters, updateFilters]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(
        workspaceSlug, 
        projectId, 
        EIssueFilterType.DISPLAY_FILTERS, 
        updatedDisplayFilter, 
        cycleId,
        moduleId
      );
    },
    [workspaceSlug, projectId, cycleId, moduleId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(
        workspaceSlug, 
        projectId, 
        EIssueFilterType.DISPLAY_PROPERTIES, 
        property, 
        cycleId,
        moduleId
      );
    },
    [workspaceSlug, projectId, cycleId, moduleId, updateFilters]
  );

  return {
    handleFiltersUpdate,
    handleDisplayFilters,
    handleDisplayProperties,
  };
}; 