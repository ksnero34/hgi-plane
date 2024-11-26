import { observable, action, makeObservable, runInAction } from "mobx";
import { createContext, useContext } from "react";
// types
import { IInstance, IInstanceConfig, IFileSettings } from "@plane/types";
// services
import { InstanceService } from "@/services/instance.service";

// 에러 타입 정의 추가
type TError = {
  status: string;
  message: string;
  data?: {
    is_activated: boolean;
    is_setup_done: boolean;
  };
};

// 기본값 정의
const defaultInstanceStore = {
  isLoading: false,
  instance: undefined,
  config: undefined,
  fileSettings: {
    max_file_size: 5 * 1024 * 1024, // 5MB
    allowed_extensions: ["jpg", "jpeg", "png", "gif", "pdf"]
  },
  error: undefined,
  fetchInstanceInfo: async () => {},
  fetchFileSettings: async () => undefined,
  updateFileSettings: async () => ({} as IFileSettings),
};

// 인터페이스 정의 및 export
export interface IInstanceStore {
  isLoading: boolean;
  instance: IInstance | undefined;
  config: IInstanceConfig | undefined;
  fileSettings: IFileSettings | undefined;
  error: TError | undefined;
  fetchInstanceInfo: () => Promise<void>;
  fetchFileSettings: () => Promise<IFileSettings | undefined>;
  updateFileSettings: (data: Partial<IFileSettings>) => Promise<IFileSettings>;
}

// Context 생성 - 기본값 제공
export const InstanceContext = createContext<InstanceStore | typeof defaultInstanceStore>(defaultInstanceStore);

export class InstanceStore implements IInstanceStore {
  isLoading: boolean = true;
  instance: IInstance | undefined = undefined;
  config: IInstanceConfig | undefined = undefined;
  fileSettings: IFileSettings | undefined = undefined;
  error: TError | undefined = undefined;
  // services
  instanceService;

  constructor() {
    makeObservable(this, {
      // observable
      isLoading: observable.ref,
      instance: observable,
      config: observable,
      fileSettings: observable,
      error: observable,
      // actions
      fetchInstanceInfo: action,
      fetchFileSettings: action,
      updateFileSettings: action,
    });
    // services
    this.instanceService = new InstanceService();
    
    // 생성자에서 fileSettings 초기화
    this.initializeFileSettings();
  }

  private async initializeFileSettings() {
    // SSR 환경 체크
    if (typeof window === 'undefined') {
      console.log("🖥️ Server-side rendering, skipping file settings initialization");
      return;
    }

    // 기본값으로 초기화
    runInAction(() => {
      this.fileSettings = {
        max_file_size: 5 * 1024 * 1024,
        allowed_extensions: ["jpg", "jpeg", "png", "gif", "pdf"]
      };
      console.log("⚠️ Using default file settings initially");
    });

    try {
      console.log("🔄 Initializing file settings...");
      const settings = await this.instanceService.getFileSettings();
      console.log("✅ Received file settings:", settings);
      
      runInAction(() => {
        this.fileSettings = settings;
        console.log("💾 Updated file settings in store:", this.fileSettings);
      });
    } catch (error) {
      console.error("❌ Failed to initialize file settings:", error);
      // 에러 시 기본값 유지
      console.log("⚠️ Using default settings due to error");
    }
  }

  /**
   * @description fetching instance information
   */
  fetchInstanceInfo = async () => {
    try {
      this.isLoading = true;
      this.error = undefined;
      const instanceInfo = await this.instanceService.getInstanceInfo();
      runInAction(() => {
        this.isLoading = false;
        this.instance = instanceInfo.instance;
        this.config = instanceInfo.config;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
        this.error = {
          status: "error",
          message: "Failed to fetch instance info",
        };
      });
    }
  };

  /**
   * @description fetching file settings
   */
  fetchFileSettings = async () => {
    // SSR 환경 체크
    if (typeof window === 'undefined') {
      console.log("🖥️ Server-side rendering, skipping file settings fetch");
      return;
    }

    try {
      console.log("🔄 Fetching file settings...");
      const response = await this.instanceService.getFileSettings();
      console.log("✅ Received file settings:", response);
      
      runInAction(() => {
        this.fileSettings = response;
        console.log("💾 Updated file settings in store:", this.fileSettings);
      });
      return response;
    } catch (error) {
      console.error("❌ Error fetching file settings:", error);
      throw error;
    }
  };

  /**
   * @description updating file settings
   */
  updateFileSettings = async (data: Partial<IFileSettings>) => {
    try {
      const response = await this.instanceService.updateFileSettings(data);
      runInAction(() => {
        this.fileSettings = response;
      });
      return response;
    } catch (error) {
      console.error("Error updating file settings:", error);
      throw error;
    }
  };
}

// Hook - SSG 중에는 기본값 반환
export function useInstance() {
  const context = useContext(InstanceContext);
  if (!context) {
    // SSG 중에는 기본 인스턴스 반환
    if (typeof window === 'undefined') {
      return defaultInstanceStore;
    }
    throw new Error('useInstance must be used within an InstanceProvider');
  }
  return context;
}
