import useSWR from "swr";
import type { TCustomField } from "@plane/types";
import { API_BASE_URL } from "@plane/constants";
import { CustomFieldService } from "@/services/custom-field.service";

export const useProjectCustomFields = (workspaceSlug?: string, projectId?: string) => {
  const customFieldService = new CustomFieldService();

  const {
    data: customFields,
    error,
    mutate,
  } = useSWR<TCustomField[]>(
    workspaceSlug && projectId
      ? `${API_BASE_URL}/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`
      : null,
    () => customFieldService.getCustomFields(workspaceSlug!, projectId!)
  );

  return {
    customFields: customFields || [],
    isLoading: !error && !customFields,
    isError: error,
    mutateCustomFields: mutate,
  };
};
