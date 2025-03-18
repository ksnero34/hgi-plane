import { makeAutoObservable, runInAction } from "mobx";
import { API_BASE_URL } from "@plane/constants";
import { CoreRootStore } from "@/store/root.store";

export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
}

export interface IWorkspaceConfig {
  id: string;
  workspace: string;
  workspace_detail: IWorkspace;
  role: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IWorkspaceConfigStore {
  configs: IWorkspaceConfig[];
  workspaces: IWorkspace[];
  isLoading: boolean;
  error: Error | null;
  fetchConfigs: () => Promise<IWorkspaceConfig[]>;
  fetchWorkspaces: () => Promise<IWorkspace[]>;
  createConfig: (config: Partial<IWorkspaceConfig>) => Promise<IWorkspaceConfig>;
  updateConfig: (id: string, config: Partial<IWorkspaceConfig>) => Promise<IWorkspaceConfig>;
  deleteConfig: (id: string) => Promise<boolean>;
}

export class WorkspaceConfigStore implements IWorkspaceConfigStore {
  configs: IWorkspaceConfig[] = [];
  workspaces: IWorkspace[] = [];
  isLoading: boolean = false;
  error: Error | null = null;
  
  constructor(private store: CoreRootStore) {
    makeAutoObservable(this);
  }
  
  async fetchConfigs() {
    this.isLoading = true;
    this.error = null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch workspace configs");
      }
      
      const data = await response.json();
      
      runInAction(() => {
        this.configs = data;
        this.isLoading = false;
      });
      
      return data;
    } catch (error) {
      runInAction(() => {
        this.error = error as Error;
        this.isLoading = false;
      });
      throw error;
    }
  }
  
  async fetchWorkspaces() {
    this.isLoading = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/instances/workspaces/`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch workspaces");
      }
      
      const data = await response.json();
      
      runInAction(() => {
        this.workspaces = data;
        this.isLoading = false;
      });
      
      return data;
    } catch (error) {
      runInAction(() => {
        this.error = error as Error;
        this.isLoading = false;
      });
      throw error;
    }
  }
  
  async createConfig(config: Partial<IWorkspaceConfig>) {
    this.isLoading = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create workspace config");
      }
      
      const data = await response.json();
      
      runInAction(() => {
        this.configs.push(data);
        this.isLoading = false;
      });
      
      return data;
    } catch (error) {
      runInAction(() => {
        this.error = error as Error;
        this.isLoading = false;
      });
      throw error;
    }
  }
  
  async updateConfig(id: string, config: Partial<IWorkspaceConfig>) {
    this.isLoading = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/${id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update workspace config");
      }
      
      const data = await response.json();
      
      runInAction(() => {
        const index = this.configs.findIndex(c => c.id === id);
        if (index !== -1) {
          this.configs[index] = data;
        }
        this.isLoading = false;
      });
      
      return data;
    } catch (error) {
      runInAction(() => {
        this.error = error as Error;
        this.isLoading = false;
      });
      throw error;
    }
  }
  
  async deleteConfig(id: string) {
    this.isLoading = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/instances/default-workspaces/${id}/`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete workspace config");
      }
      
      runInAction(() => {
        this.configs = this.configs.filter(c => c.id !== id);
        this.isLoading = false;
      });
      
      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error as Error;
        this.isLoading = false;
      });
      throw error;
    }
  }
} 