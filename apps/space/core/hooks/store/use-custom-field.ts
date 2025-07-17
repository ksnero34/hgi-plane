import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import { TCustomField } from "@plane/types";
// services
import { CustomFieldService } from "@/services/custom-field.service";

const customFieldService = new CustomFieldService();

type UseCustomFieldReturn = {
  customFields: TCustomField[];
  error: any;
  isLoading: boolean;
};

export const useCustomField = (projectId?: string): UseCustomFieldReturn => {
  const { workspaceSlug: workspaceSlugFromParams, projectId: projectIdFromParams } = useParams();

  const currentProjectId = projectId || (projectIdFromParams as string);
  const workspaceSlug = workspaceSlugFromParams as string;

  const swrKey = workspaceSlug && currentProjectId
    ? `/api/workspaces/${workspaceSlug}/projects/${currentProjectId}/custom-fields/`
    : null;

  const fetcher = () => {
    if (!workspaceSlug || !currentProjectId) return Promise.resolve([]);
    return customFieldService.getCustomFields(workspaceSlug, currentProjectId);
  };

  const {
    data: customFields,
    error,
    isValidating,
  } = useSWR<TCustomField[]>(swrKey, fetcher);

  return {
    customFields: customFields || [],
    error,
    isLoading: isValidating,
  };
};