import { makeAutoObservable, runInAction } from "mobx";
import { API_BASE_URL } from "@plane/constants";
import { InstanceService } from "@plane/services";
import { CoreRootStore } from "@/store/root.store";

export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  total_members?: number;
  is_default?: boolean;
  role?: number;
  config_id?: string;
}

export interface IWorkspaceConfigStore {
  workspaces: { results: IWorkspace[] };
  isLoading: boolean;
  error: Error | null;
  fetchConfigs: () => Promise<{ results: IWorkspace[] }>;
  createConfig: (config: { workspace_id: string; role: number }) => Promise<void>;
  updateConfig: (workspaceId: string, config: { role: number }) => Promise<void>;
  deleteConfig: (workspaceId: string) => Promise<void>;
}

export class WorkspaceConfigStore implements IWorkspaceConfigStore {
  workspaces: { results: IWorkspace[] } = { results: [] };
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
  
  async fetchConfigs() {
    try {
      this.isLoading = true;
      this.error = null;
      console.log("API 호출 시작: fetchConfigs");
      
      const response = await this.instanceService.getDefaultWorkspaces();
      console.log("API 응답 받음:", response);

      runInAction(() => {
        this.workspaces = {
          results: Array.isArray(response.results) ? response.results : []
        };
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

      runInAction(() => {
        this.workspaces = [...this.workspaces, response];
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
  
  async updateConfig(workspaceId: string, config: { role: number }) {
    try {
      const workspace = this.workspaces.results.find(w => w.id === workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (!workspace.config_id) {
        throw new Error("Workspace config not found");
      }

      const response = await this.instanceService.updateDefaultWorkspace(workspace.config_id, config);
      
      runInAction(() => {
        const index = this.workspaces.results.findIndex(w => w.id === workspaceId);
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
  
  async deleteConfig(workspaceId: string) {
    try {
      const workspace = this.workspaces.results.find(w => w.id === workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (!workspace.config_id) {
        throw new Error("Workspace config not found");
      }

      await this.instanceService.deleteDefaultWorkspace(workspace.config_id);
      
      runInAction(() => {
        this.workspaces.results = this.workspaces.results.filter(w => w.id !== workspaceId);
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