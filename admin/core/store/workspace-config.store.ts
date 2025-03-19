import { makeAutoObservable, runInAction } from "mobx";
import { API_BASE_URL } from "@plane/constants";
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
  workspaces: IWorkspace[];
  isLoading: boolean;
  error: Error | null;
  fetchConfigs: () => Promise<IWorkspace[]>;
  createConfig: (config: { workspace_id: string; role: number }) => Promise<void>;
  updateConfig: (workspaceId: string, config: { role: number }) => Promise<void>;
  deleteConfig: (workspaceId: string) => Promise<void>;
}

export class WorkspaceConfigStore implements IWorkspaceConfigStore {
  workspaces: IWorkspace[] = [];
  isLoading: boolean = false;
  error: Error | null = null;
  
  // 진행 중인 요청을 캐싱하기 위한 프로미스 저장
  private configsPromise: Promise<any> | null = null;
  
  constructor(private store: CoreRootStore) {
    makeAutoObservable(this, {
      configsPromise: false
    });
  }
  
  async fetchConfigs() {
    // 이미 진행 중인 요청이 있다면 그것을 재사용
    if (this.configsPromise) {
      console.log("Reusing existing configs promise");
      return this.configsPromise;
    }

    // 이미 데이터가 있고 로딩 중이 아니면 현재 데이터 반환
    if (this.workspaces.length > 0 && !this.isLoading) {
      console.log("Using cached workspace data");
      return this.workspaces;
    }
    
    this.isLoading = true;
    this.error = null;
    
    // 새 요청 생성 및 저장
    this.configsPromise = (async () => {
      try {
        console.log("Fetching workspace configs from API");
        const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/`, {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch workspace configs:", response.status, errorText);
          throw new Error(`Failed to fetch workspace configs: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Fetched workspace configs:", data);
        
        // API 응답 데이터를 그대로 사용
        runInAction(() => {
          this.workspaces = data.results;
          this.isLoading = false;
        });
        
        return data.results;
      } catch (error) {
        runInAction(() => {
          this.error = error as Error;
          this.isLoading = false;
        });
        throw error;
      } finally {
        // 요청이 완료되면 프로미스 초기화
        this.configsPromise = null;
      }
    })();
    
    return this.configsPromise;
  }
  
  async createConfig(config: { workspace_id: string; role: number }) {
    try {
      // CSRF 토큰 가져오기
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/get-csrf-token/`, {
        method: "GET",
        credentials: "include"
      });
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrf_token;
      
      console.log("Creating workspace config:", config);
      
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Failed to create workspace config:", errorData);
        throw new Error("Failed to create workspace config");
      }
      
      // 설정 목록 다시 불러오기
      await this.fetchConfigs();
    } catch (error) {
      console.error("Error creating workspace config:", error);
      throw error;
    }
  }
  
  async updateConfig(workspaceId: string, config: { role: number }) {
    try {
      // 워크스페이스 찾기
      const workspace = this.workspaces.find(w => w.id === workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }
      
      if (!workspace.config_id) {
        throw new Error("Workspace config not found");
      }

      // CSRF 토큰 가져오기
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/get-csrf-token/`, {
        method: "GET",
        credentials: "include"
      });
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrf_token;
      
      console.log("Updating workspace config:", { workspaceId, configId: workspace.config_id, config });
      
      // 설정 업데이트
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/${workspace.config_id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken
        },
        credentials: "include",
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update workspace config");
      }
      
      // 설정 목록 다시 불러오기
      await this.fetchConfigs();
    } catch (error) {
      console.error("Error updating workspace config:", error);
      throw error;
    }
  }
  
  async deleteConfig(workspaceId: string) {
    try {
      // 워크스페이스와 설정 ID 찾기
      const workspace = this.workspaces.find(w => w.id === workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }
      
      if (!workspace.config_id) {
        throw new Error("Workspace config not found");
      }

      // CSRF 토큰 가져오기
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/get-csrf-token/`, {
        method: "GET",
        credentials: "include"
      });
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrf_token;
      
      console.log("Deleting workspace config:", { workspaceId, configId: workspace.config_id });
      
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/${workspace.config_id}/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete workspace config");
      }
      
      // 삭제 후 상태 초기화
      runInAction(() => {
        this.workspaces = this.workspaces.map(w => {
          if (w.id === workspaceId) {
            return {
              ...w,
              is_default: false,
              role: 15,
              config_id: undefined
            };
          }
          return w;
        });
      });
    } catch (error) {
      console.error("Error deleting workspace config:", error);
      throw error;
    }
  }
} 