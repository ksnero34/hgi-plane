import { useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import { IIssueType } from "@plane/types";
// services
import { ProjectService } from "@/services/project";

const projectService = new ProjectService();

type UseIssueTypeReturn = {
  issueTypes: IIssueType[];
  error: any;
  isLoading: boolean;
  mutateIssueTypes: (
    data?:
      | IIssueType[]
      | Promise<IIssueType[]>
      | ((val: IIssueType[] | undefined) => IIssueType[] | Promise<IIssueType[]> | undefined),
    opts?: any
  ) => Promise<IIssueType[] | undefined>;
  createIssueType: (data: Partial<IIssueType>) => Promise<IIssueType | undefined>;
  updateIssueType: (issueTypeId: string, data: Partial<IIssueType>) => Promise<IIssueType | undefined>;
  deleteIssueType: (issueTypeId: string) => Promise<void>;
};

export const useIssueType = (projectId: string): UseIssueTypeReturn => {
  const { workspaceSlug } = useParams();

  const swrKey = `/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`;

  const fetcher = () => {
    if (!workspaceSlug || !projectId) return Promise.resolve([]);
    return projectService.getProjectIssueTypes(workspaceSlug as string, projectId);
  };

  const {
    data: issueTypes,
    error,
    isValidating,
    mutate: mutateIssueTypes,
  } = useSWR<IIssueType[]>(swrKey, fetcher);

  const createIssueType = useCallback(
    async (data: Partial<IIssueType>) => {
      if (!workspaceSlug || !projectId) return;

      const response = await projectService.createProjectIssueType(workspaceSlug as string, projectId, data);
      mutateIssueTypes((prevData) => (prevData ? [...prevData, response] : [response]));
      return response;
    },
    [workspaceSlug, projectId, mutateIssueTypes]
  );

  const updateIssueType = useCallback(
    async (issueTypeId: string, data: Partial<IIssueType>) => {
      if (!workspaceSlug || !projectId) return;

      const response = await projectService.updateProjectIssueType(
        workspaceSlug as string,
        projectId,
        issueTypeId,
        data
      );
      mutateIssueTypes((prevData) =>
        prevData ? prevData.map((issueType) => (issueType.id === issueTypeId ? response : issueType)) : [response]
      );
      return response;
    },
    [workspaceSlug, projectId, mutateIssueTypes]
  );

  const deleteIssueType = useCallback(
    async (issueTypeId: string) => {
      if (!workspaceSlug || !projectId) return;

      await projectService.deleteProjectIssueType(workspaceSlug as string, projectId, issueTypeId);
      mutateIssueTypes((prevData) => prevData?.filter((issueType) => issueType.id !== issueTypeId));
    },
    [workspaceSlug, projectId, mutateIssueTypes]
  );

  return {
    issueTypes: issueTypes || [],
    error,
    isLoading: isValidating,
    mutateIssueTypes,
    createIssueType,
    updateIssueType,
    deleteIssueType,
  };
};
