import { useCallback } from "react";
// plane constants
import { EIssueFilterType } from "@plane/constants";
// types
import { IIssueFilterOptions, IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";

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
      
      // 커스텀 필드의 경우 특별한 처리 (JSON 문자열로 직접 전달)
      if (key === "custom_fields") {
        updateFilters(
          workspaceSlug, 
          projectId, 
          EIssueFilterType.FILTERS, 
          { [key]: value } as Partial<IIssueFilterOptions>, 
          cycleId,
          moduleId
        );
        return;
      }
      
      // 다른 필터들은 기존 로직 유지
      const newValues: string[] = (issueFilters?.filters?.[key] as string[]) ?? [];

      if (Array.isArray(value)) {
        value.forEach((val) => {
          const valIndex = newValues.indexOf(val);
          if (valIndex === -1) {
            newValues.push(val);
          } else {
            newValues.splice(valIndex, 1);
          }
        });
      } else {
        const valueIndex = newValues.indexOf(value);
        if (valueIndex === -1) {
          newValues.push(value);
        } else {
          newValues.splice(valueIndex, 1);
        }
      }

      updateFilters(
        workspaceSlug, 
        projectId, 
        EIssueFilterType.FILTERS, 
        { [key]: newValues }, 
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