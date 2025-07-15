import { useCallback, useEffect } from "react";
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
  getDefaultIssueType: () => IIssueType | undefined;
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

  // 기본 이슈 타입 "Issue" 자동 생성 및 기존 이슈들에게 할당
  useEffect(() => {
    const createDefaultIssueTypeAndMigrate = async () => {
      if (!workspaceSlug || !projectId || !issueTypes || isValidating) return;
      
      // 이슈 타입이 없으면 기본 "Issue" 타입 생성
      if (issueTypes.length === 0) {
        try {
          const defaultIssueType = await createIssueType({
            name: "Issue",
            description: "기본 이슈 타입",
            is_default: true,
            icon: "📋",
            color: "#3b82f6",
            logo_props: {
              in_use: "emoji",
              emoji: {
                value: "128204" // 📋 이모지
              }
            }
          });

          // 기본 이슈 타입 생성 후 기존 이슈들에게 할당
          if (defaultIssueType) {
            try {
              await projectService.assignDefaultIssueTypeToExistingIssues(
                workspaceSlug as string, 
                projectId, 
                defaultIssueType.id
              );
            } catch (error) {
              console.error("기존 이슈들에게 기본 이슈 타입 할당 실패:", error);
            }
          }
        } catch (error) {
          console.error("기본 이슈 타입 생성 실패:", error);
        }
      }
    };

    createDefaultIssueTypeAndMigrate();
  }, [workspaceSlug, projectId, issueTypes, isValidating, createIssueType]);

  // 기본 이슈 타입을 반환하는 헬퍼 함수
  const getDefaultIssueType = useCallback(() => {
    if (!issueTypes || issueTypes.length === 0) return undefined;
    
    // 먼저 ProjectIssueType의 is_default=true인 것을 찾기
    const defaultProjectIssueType = issueTypes.find(projectIssueType => 
      projectIssueType.is_default === true
    );
    
    if (defaultProjectIssueType) {
      return defaultProjectIssueType.issue_type || defaultProjectIssueType;
    }
    
    // 그 다음 이름이 "Issue"인 것을 찾기
    const issueTypeByName = issueTypes.find(projectIssueType => {
      const issueType = projectIssueType.issue_type || projectIssueType;
      return issueType.name === "Issue";
    });
    
    if (issueTypeByName) {
      return issueTypeByName.issue_type || issueTypeByName;
    }
    
    // 기본 타입이 없으면 첫 번째 타입 반환
    const firstType = issueTypes[0];
    return firstType ? (firstType.issue_type || firstType) : undefined;
  }, [issueTypes]);

  return {
    issueTypes: issueTypes || [],
    error,
    isLoading: isValidating,
    mutateIssueTypes,
    createIssueType,
    updateIssueType,
    deleteIssueType,
    getDefaultIssueType,
  };
};
