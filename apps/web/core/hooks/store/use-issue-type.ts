import { useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import type { IIssueType, IProjectIssueType } from "@plane/types";
// services
import { ProjectService } from "@/services/project";

const projectService = new ProjectService();

// 전역 생성 상태 관리를 위한 Map
const creatingDefaultIssueType = new Map<string, Promise<IProjectIssueType | undefined>>();

type UseIssueTypeReturn = {
  issueTypes: IProjectIssueType[];
  error: any;
  isLoading: boolean;
  mutateIssueTypes: (
    data?:
      | IProjectIssueType[]
      | Promise<IProjectIssueType[]>
      | ((val: IProjectIssueType[] | undefined) => IProjectIssueType[] | Promise<IProjectIssueType[]> | undefined),
    opts?: any
  ) => Promise<IProjectIssueType[] | undefined>;
  createIssueType: (data: Partial<IIssueType>) => Promise<IProjectIssueType | undefined>;
  updateIssueType: (issueTypeId: string, data: Partial<IIssueType>) => Promise<IProjectIssueType | undefined>;
  deleteIssueType: (issueTypeId: string) => Promise<void>;
  getDefaultIssueType: () => IProjectIssueType | undefined;
  getIssueTypeUsageCount: (issueTypeId: string) => Promise<{ count: number }>;
};

export const useIssueType = (projectId: string): UseIssueTypeReturn => {
  const { workspaceSlug } = useParams();

  const swrKey = `/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`;

  const fetcher = (): Promise<IProjectIssueType[]> => {
    if (!workspaceSlug || !projectId) return Promise.resolve([]);
    return projectService.getProjectIssueTypes(workspaceSlug as string, projectId);
  };

  const {
    data: issueTypes,
    error,
    isValidating,
    mutate: mutateIssueTypes,
  } = useSWR<IProjectIssueType[]>(swrKey, fetcher);

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
        prevData
          ? prevData.map((projectIssueType) => (projectIssueType.id === issueTypeId ? response : projectIssueType))
          : [response]
      );
      return response;
    },
    [workspaceSlug, projectId, mutateIssueTypes]
  );

  const deleteIssueType = useCallback(
    async (issueTypeId: string) => {
      if (!workspaceSlug || !projectId) return;

      await projectService.deleteProjectIssueType(workspaceSlug as string, projectId, issueTypeId);
      mutateIssueTypes((prevData) => prevData?.filter((projectIssueType) => projectIssueType.id !== issueTypeId));
    },
    [workspaceSlug, projectId, mutateIssueTypes]
  );

  const getIssueTypeUsageCount = useCallback(
    async (issueTypeId: string) => {
      if (!workspaceSlug || !projectId) return { count: 0 };

      return await projectService.getIssueTypeUsageCount(workspaceSlug as string, projectId, issueTypeId);
    },
    [workspaceSlug, projectId]
  );

  // 기본 이슈 타입 "Issue" 자동 생성 및 기존 이슈들에게 할당
  useEffect(() => {
    const createDefaultIssueTypeAndMigrate = async () => {
      if (!workspaceSlug || !projectId || !issueTypes || isValidating) return;

      // 이슈 타입이 없으면 기본 "Issue" 타입 생성
      if (issueTypes.length === 0) {
        const projectKey = `${workspaceSlug}-${projectId}`;

        // 이미 생성 중인지 확인
        if (creatingDefaultIssueType.has(projectKey)) {
          await creatingDefaultIssueType.get(projectKey);
          return;
        }

        // 생성 Promise를 Map에 저장
        const createPromise = (async () => {
          try {
            // 생성 시도 직전에 다시 한번 확인 (Race condition 방지)
            const latestIssueTypes = await projectService.getProjectIssueTypes(workspaceSlug as string, projectId);
            if (latestIssueTypes.length > 0) {
              return undefined;
            }

            const defaultIssueType = await createIssueType({
              name: "Issue",
              description: "기본 이슈 타입",
              is_default: true,
              icon: "📋",
              color: "#3b82f6",
              logo_props: {
                in_use: "emoji",
                emoji: {
                  value: "128204", // 📋 이모지
                },
              },
            });

            // 기본 이슈 타입 생성 후 기존 이슈들에게 할당
            if (defaultIssueType) {
              try {
                await projectService.assignDefaultIssueTypeToExistingIssues(
                  workspaceSlug as string,
                  projectId,
                  defaultIssueType.issue_type.id
                );
              } catch (error) {
                console.error("기존 이슈들에게 기본 이슈 타입 할당 실패:", error);
              }
            }

            return defaultIssueType;
          } catch (error) {
            console.error("기본 이슈 타입 생성 실패:", error);
            return undefined;
          } finally {
            // 완료 후 Map에서 제거
            creatingDefaultIssueType.delete(projectKey);
          }
        })();

        creatingDefaultIssueType.set(projectKey, createPromise);
        await createPromise;
      }
    };

    createDefaultIssueTypeAndMigrate();
  }, [workspaceSlug, projectId, issueTypes, isValidating, createIssueType]);

  // 기본 이슈 타입을 반환하는 헬퍼 함수
  const getDefaultIssueType = useCallback(() => {
    if (!issueTypes || issueTypes.length === 0) return undefined;

    // 먼저 ProjectIssueType의 is_default=true인 것을 찾기
    const defaultProjectIssueType = issueTypes.find((projectIssueType) => projectIssueType.is_default === true);

    if (defaultProjectIssueType) {
      return defaultProjectIssueType;
    }

    // 그 다음 이름이 "Issue"인 것을 찾기
    const issueTypeByName = issueTypes.find((projectIssueType) => {
      const issueType = projectIssueType.issue_type;
      return issueType.name === "Issue";
    });

    if (issueTypeByName) {
      return issueTypeByName;
    }

    // 기본 타입이 없으면 첫 번째 타입 반환
    const firstType = issueTypes[0];
    return firstType || undefined;
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
    getIssueTypeUsageCount,
  };
};
