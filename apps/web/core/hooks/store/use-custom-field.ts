import { useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import type { TCustomField } from "@plane/types";
// services
import { CustomFieldService } from "@/services/custom-field.service";
// hooks
import { useProject } from "./use-project";

const customFieldService = new CustomFieldService();

type UseCustomFieldReturn = {
  customFields: TCustomField[];
  error: any;
  isLoading: boolean;
  mutateCustomFields: (
    data?:
      | TCustomField[]
      | Promise<TCustomField[]>
      | ((val: TCustomField[] | undefined) => TCustomField[] | Promise<TCustomField[]> | undefined),
    opts?: any
  ) => Promise<TCustomField[] | undefined>;
  createCustomField: (data: Partial<TCustomField>) => Promise<TCustomField | undefined>;
  updateCustomField: (fieldId: string, data: Partial<TCustomField>) => Promise<TCustomField | undefined>;
  deleteCustomField: (fieldId: string) => Promise<void>;
  getCustomFieldUsageCount: (fieldId: string) => Promise<{ count: number; sample_issues?: string[] }>;
};

export const useCustomField = (
  arg?: string | { projectId?: string; workspaceLevel?: boolean }
): UseCustomFieldReturn => {
  let projectId: string | undefined;
  let workspaceLevel = false;

  if (typeof arg === "string") {
    projectId = arg;
  } else if (arg && typeof arg === "object") {
    projectId = arg.projectId;
    workspaceLevel = !!arg.workspaceLevel;
  }

  const { workspaceSlug, projectId: projectIdFromParams } = useParams();
  const { currentProjectDetails } = useProject();

  const currentProjectId = projectId || (projectIdFromParams as string);

  const swrKey = workspaceSlug
    ? workspaceLevel
      ? `/api/workspaces/${workspaceSlug}/custom-fields/`
      : currentProjectId
        ? `/api/workspaces/${workspaceSlug}/projects/${currentProjectId}/custom-fields/`
        : null
    : null;

  const fetcher = () => {
    if (!workspaceSlug) return Promise.resolve([]);
    if (workspaceLevel) {
      return fetch(`/api/workspaces/${workspaceSlug}/custom-fields/`, {
        credentials: "include",
      }).then((res) => res.json());
    }
    if (currentProjectId) {
      return customFieldService.getCustomFields(workspaceSlug as string, currentProjectId);
    }
    return Promise.resolve([]);
  };

  const {
    data: customFields,
    error,
    isValidating,
    mutate: mutateCustomFields,
  } = useSWR<TCustomField[]>(swrKey, fetcher);

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

      const response = await customFieldService.updateCustomField(
        workspaceSlug as string,
        currentProjectId,
        fieldId,
        data
      );
      mutateCustomFields((prevData) =>
        prevData ? prevData.map((field) => (field.id === fieldId ? response : field)) : [response]
      );
      return response;
    },
    [currentProjectId, workspaceSlug, mutateCustomFields]
  );

  const getCustomFieldUsageCount = useCallback(
    async (fieldId: string) => {
      if (!currentProjectId || !workspaceSlug) return { count: 0 };

      return await customFieldService.getCustomFieldUsageCount(workspaceSlug as string, currentProjectId, fieldId);
    },
    [currentProjectId, workspaceSlug]
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
    isLoading: isValidating,
    mutateCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getCustomFieldUsageCount,
  };
};
