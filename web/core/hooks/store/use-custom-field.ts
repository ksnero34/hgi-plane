import { useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import { TCustomField } from "@plane/types";
// services
import { CustomFieldService } from "@/services/custom-field.service";
// hooks
import { useProject } from "./use-project";

const customFieldService = new CustomFieldService();

type UseCustomFieldReturn = {
  customFields: TCustomField[];
  error: any;
  mutateCustomFields: (data?: TCustomField[] | Promise<TCustomField[]> | ((val: TCustomField[] | undefined) => TCustomField[] | Promise<TCustomField[]> | undefined), opts?: any) => Promise<TCustomField[] | undefined>;
  createCustomField: (data: Partial<TCustomField>) => Promise<TCustomField | undefined>;
  updateCustomField: (fieldId: string, data: Partial<TCustomField>) => Promise<TCustomField | undefined>;
  deleteCustomField: (fieldId: string) => Promise<void>;
};

export const useCustomField = (): UseCustomFieldReturn => {
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails } = useProject();
  
  const currentProjectId = projectId as string;

  const {
    data: customFields,
    error,
    mutate: mutateCustomFields,
  } = useSWR<TCustomField[]>(
    currentProjectId && workspaceSlug ? `/api/workspaces/${workspaceSlug}/projects/${currentProjectId}/custom-fields/` : null,
    () =>
      currentProjectId && workspaceSlug
        ? customFieldService.getCustomFields(workspaceSlug as string, currentProjectId)
        : Promise.resolve([])
  );

  const createCustomField = useCallback(
    async (data: Partial<TCustomField>) => {
      if (!currentProjectId || !workspaceSlug) return;

      const response = await customFieldService.createCustomField(workspaceSlug as string, currentProjectId, data);
      mutateCustomFields((prevData) => (prevData ? [...prevData, response] : [response]));
      return response;
    },
    [currentProjectId, workspaceSlug, mutateCustomFields]
  );

  const updateCustomField = useCallback(
    async (fieldId: string, data: Partial<TCustomField>) => {
      if (!currentProjectId || !workspaceSlug) return;

      const response = await customFieldService.updateCustomField(workspaceSlug as string, currentProjectId, fieldId, data);
      mutateCustomFields((prevData) =>
        prevData ? prevData.map((field) => (field.id === fieldId ? response : field)) : [response]
      );
      return response;
    },
    [currentProjectId, workspaceSlug, mutateCustomFields]
  );

  const deleteCustomField = useCallback(
    async (fieldId: string) => {
      if (!currentProjectId || !workspaceSlug) return;

      await customFieldService.deleteCustomField(workspaceSlug as string, currentProjectId, fieldId);
      mutateCustomFields((prevData) => prevData?.filter((field) => field.id !== fieldId));
    },
    [currentProjectId, workspaceSlug, mutateCustomFields]
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