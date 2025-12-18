import { makeAutoObservable, runInAction } from "mobx";
import { API_BASE_URL } from "@plane/constants";
import { InstanceService } from "@plane/services";
import type { IWorkspace } from "@plane/types";
import { CoreRootStore } from "@/store/root.store";

export interface IWorkspaceConfig extends IWorkspace {
  is_default?: boolean;
  role: number;
  config_id?: string;
  excluded_user_groups?: string[];
}

// API 응답 타입 정의
interface IWorkspaceResponse {
  results: IWorkspaceConfig[];
  [key: string]: any;
}

export interface IWorkspaceConfigStore {
  workspaces: { results: IWorkspaceConfig[] };
  isLoading: boolean;
  error: Error | null;
  fetchConfigs: () => Promise<{ results: IWorkspaceConfig[] }>;
  createConfig: (config: { workspace_id: string; role: number }) => Promise<void>;
  updateConfig: (workspaceId: string, config: { role?: number; excluded_user_groups?: string[] }) => Promise<void>;
  deleteConfig: (configIdOrWorkspaceId: string) => Promise<void>;
}

export class WorkspaceConfigStore implements IWorkspaceConfigStore {
  workspaces: { results: IWorkspaceConfig[] } = { results: [] };
  isLoading: boolean = false;
  error: Error | null = null;
  private instanceService: InstanceService;

  constructor(private store: CoreRootStore) {
    makeAutoObservable(this);
    this.instanceService = new InstanceService();
  }

  private handle401Error() {
    window.location.replace(`/god-mode/?next_path=${window.location.pathname}`);
  }

  // 응답이 IWorkspaceResponse 형식인지 확인하는 타입 가드
  private isWorkspaceResponseObject(response: any): response is IWorkspaceResponse {
    return response && typeof response === "object" && "results" in response;
  }

  async fetchConfigs() {
    try {
      this.isLoading = true;
      this.error = null;
      console.log("API 호출 시작: fetchConfigs");

      const response = await this.instanceService.getDefaultWorkspaces();
      console.log("API 응답 받음:", response);

      runInAction(() => {
        // API 응답 형식이 배열이면 results 객체로 포장하고, 이미 results 형식이면 그대로 사용
        if (Array.isArray(response)) {
          this.workspaces = { results: response as IWorkspaceConfig[] };
        } else if (this.isWorkspaceResponseObject(response)) {
          this.workspaces = response;
        } else {
          this.workspaces = { results: [] };
        }
        this.isLoading = false;
      });

      return this.workspaces;
    } catch (error: any) {
      console.error("API 에러 발생:", error);
      runInAction(() => {
        this.error = error;
        this.isLoading = false;
        this.workspaces = { results: [] }; // 에러 발생 시 빈 배열로 초기화
      });

      if (error?.response?.status === 401) {
        this.handle401Error();
      }

      throw error;
    }
  }

  async createConfig(config: { workspace_id: string; role: number }) {
    try {
      this.isLoading = true;
      this.error = null;
      console.log("API 호출 시작: createConfig", config);

      const response = await this.instanceService.createDefaultWorkspace(config);
      console.log("API 응답 받음:", response);

      // 생성 후 목록 다시 불러오기
      await this.fetchConfigs();

      runInAction(() => {
        this.isLoading = false;
      });
    } catch (error: any) {
      console.error("API 에러 발생:", error);
      runInAction(() => {
        this.error = error;
        this.isLoading = false;
      });

      if (error?.response?.status === 401) {
        this.handle401Error();
      }

      throw error;
    }
  }

  async updateConfig(workspaceId: string, config: { role?: number; excluded_user_groups?: string[] }) {
    try {
      const workspace = this.workspaces.results.find((w) => w.id === workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (!workspace.config_id) {
        throw new Error("Workspace config not found");
      }

      const response = await this.instanceService.updateDefaultWorkspace(workspace.config_id, config);

      runInAction(() => {
        const index = this.workspaces.results.findIndex((w) => w.id === workspaceId);
        if (index !== -1) {
          this.workspaces.results[index] = { ...this.workspaces.results[index], ...response };
        }
      });
    } catch (error: any) {
      console.error("워크스페이스 설정 업데이트 실패:", error);

      if (error?.response?.status === 401) {
        this.handle401Error();
      }

      throw error;
    }
  }

  async deleteConfig(configIdOrWorkspaceId: string) {
    try {
      console.log("삭제 요청 받음 - configIdOrWorkspaceId:", configIdOrWorkspaceId);

      // 먼저 configId로 직접 삭제를 시도
      try {
        console.log("config_id로 직접 삭제 시도:", configIdOrWorkspaceId);
        await this.instanceService.deleteDefaultWorkspace(configIdOrWorkspaceId);

        console.log("삭제 성공 후 목록 갱신");

        // 삭제 성공 후 목록 갱신 및 UI 업데이트
        await this.fetchConfigs();

        // UI에서 해당 워크스페이스 제거 (config_id로 삭제된 경우에는 필요 없을 수 있음)
        runInAction(() => {
          this.workspaces.results = this.workspaces.results.filter((w) => w.config_id !== configIdOrWorkspaceId);
        });

        return;
      } catch (directDeleteError: any) {
        console.log("직접 삭제 시도 실패:", directDeleteError);
        console.log("워크스페이스 ID로 검색 후 시도합니다.");
        // 에러가 발생하면 워크스페이스 ID로 시도
      }

      // 워크스페이스 ID로 찾기
      const workspace = this.workspaces.results.find((w) => w.id === configIdOrWorkspaceId);
      if (!workspace) {
        console.error("워크스페이스를 찾을 수 없음:", configIdOrWorkspaceId);
        throw new Error("Workspace not found");
      }

      if (!workspace.config_id) {
        console.error("워크스페이스 설정 ID가 없음:", workspace);
        throw new Error("Workspace config not found");
      }

      console.log("워크스페이스의 config_id로 삭제 시도:", workspace.config_id);
      await this.instanceService.deleteDefaultWorkspace(workspace.config_id);

      console.log("삭제 성공, UI 업데이트");

      // 삭제 후 UI에서 해당 워크스페이스 제거
      runInAction(() => {
        this.workspaces.results = this.workspaces.results.filter((w) => w.id !== configIdOrWorkspaceId);
      });
    } catch (error: any) {
      console.error("워크스페이스 설정 삭제 실패:", error);

      if (error?.response?.status === 401) {
        this.handle401Error();
      }

      throw error;
    }
  }
}
