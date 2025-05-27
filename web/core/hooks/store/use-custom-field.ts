import { useCallback } from "react";
import useSWR from "swr";
// types
import { TCustomField } from "@plane/types";
// services
import { CustomFieldService } from "@/services/custom-field.service";
// hooks
import { useProject } from "./use-project";

const customFieldService = new CustomFieldService();

export const useCustomField = () => {
  const { currentProjectId } = useProject();

  const {
    data: customFields,
    error,
    mutate: mutateCustomFields,
  } = useSWR<TCustomField[]>(
    currentProjectId ? `/api/workspaces/${workspaceSlug}/projects/${currentProjectId}/custom-fields/` : null,
    () =>
      currentProjectId
        ? customFieldService.getCustomFields(workspaceSlug, currentProjectId)
        : Promise.resolve([])
  );

  const createCustomField = useCallback(
    async (data: Partial<TCustomField>) => {
      if (!currentProjectId) return;

      const response = await customFieldService.createCustomField(workspaceSlug, currentProjectId, data);
      mutateCustomFields((prevData) => (prevData ? [...prevData, response] : [response]));
      return response;
    },
    [currentProjectId, mutateCustomFields]
  );

  const updateCustomField = useCallback(
    async (fieldId: string, data: Partial<TCustomField>) => {
      if (!currentProjectId) return;

      const response = await customFieldService.updateCustomField(workspaceSlug, currentProjectId, fieldId, data);
      mutateCustomFields((prevData) =>
        prevData ? prevData.map((field) => (field.id === fieldId ? response : field)) : [response]
      );
      return response;
    },
    [currentProjectId, mutateCustomFields]
  );

  const deleteCustomField = useCallback(
    async (fieldId: string) => {
      if (!currentProjectId) return;

      await customFieldService.deleteCustomField(workspaceSlug, currentProjectId, fieldId);
      mutateCustomFields((prevData) => prevData?.filter((field) => field.id !== fieldId));
    },
    [currentProjectId, mutateCustomFields]
  );

  return {
    customFields: customFields || [],
    error,
    mutateCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
  };
}; 