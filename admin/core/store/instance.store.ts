import set from "lodash/set";
import { observable, action, computed, makeObservable, runInAction } from "mobx";
import {
  IInstance,
  IInstanceAdmin,
  IInstanceConfiguration,
  IFormattedInstanceConfiguration,
  IInstanceInfo,
  IInstanceConfig,
  IUser,
  IFileSettings,
} from "@plane/types";
// helpers
import { EInstanceStatus, TInstanceStatus } from "@/helpers/instance.helper";
// services
import { InstanceService } from "@/services/instance.service";
// root store
import { CoreRootStore } from "@/store/root.store";

export interface IInstanceStore {
  // issues
  isLoading: boolean;
  error: any;
  instanceStatus: TInstanceStatus | undefined;
  instance: IInstance | undefined;
  config: IInstanceConfig | undefined;
  instanceAdmins: IInstanceAdmin[] | undefined;
  instanceConfigurations: IInstanceConfiguration[] | undefined;
  fileSettings: IFileSettings | undefined;
  // computed
  formattedConfig: IFormattedInstanceConfiguration | undefined;
  // action
  hydrate: (data: IInstanceInfo) => void;
  fetchInstanceInfo: () => Promise<IInstanceInfo | undefined>;
  updateInstanceInfo: (data: Partial<IInstance>) => Promise<IInstance | undefined>;
  fetchInstanceAdmins: () => Promise<IInstanceAdmin[] | undefined>;
  fetchInstanceConfigurations: () => Promise<IInstanceConfiguration[] | undefined>;
  updateInstanceConfigurations: (data: Partial<IFormattedInstanceConfiguration>) => Promise<IInstanceConfiguration[]>;
  fetchInstanceMembers: () => Promise<IUser[]>;
  updateInstanceMember: (userId: string, data: { is_admin: boolean }) => Promise<IUser>;
  fetchFileSettings: () => Promise<IFileSettings | undefined>;
  updateFileSettings: (data: Partial<IFileSettings>) => Promise<IFileSettings>;
}

export class InstanceStore implements IInstanceStore {
  isLoading: boolean = true;
  error: any = undefined;
  instanceStatus: TInstanceStatus | undefined = undefined;
  instance: IInstance | undefined = undefined;
  config: IInstanceConfig | undefined = undefined;
  instanceAdmins: IInstanceAdmin[] | undefined = undefined;
  instanceConfigurations: IInstanceConfiguration[] | undefined = undefined;
  fileSettings: IFileSettings | undefined = undefined;
  // service
  instanceService;

  constructor(private store: CoreRootStore) {
    makeObservable(this, {
      // observable
      isLoading: observable.ref,
      error: observable.ref,
      instanceStatus: observable,
      instance: observable,
      instanceAdmins: observable,
      instanceConfigurations: observable,
      fileSettings: observable,
      // computed
      formattedConfig: computed,
      // actions
      hydrate: action,
      fetchInstanceInfo: action,
      fetchInstanceAdmins: action,
      updateInstanceInfo: action,
      fetchInstanceConfigurations: action,
      updateInstanceConfigurations: action,
      fetchInstanceMembers: action,
      updateInstanceMember: action,
      fetchFileSettings: action,
      updateFileSettings: action,
    });

    this.instanceService = new InstanceService();
  }

  hydrate = (data: IInstanceInfo) => {
    if (data) {
      this.instance = data.instance;
      this.config = data.config;
    }
  };

  /**
   * computed value for instance configurations data for forms.
   * @returns configurations in the form of {key, value} pair.
   */
  get formattedConfig() {
    if (!this.instanceConfigurations) return undefined;
    return this.instanceConfigurations?.reduce((formData: IFormattedInstanceConfiguration, config) => {
      formData[config.key] = config.value;
      return formData;
    }, {} as IFormattedInstanceConfiguration);
  }

  /**
   * @description fetching instance configuration
   * @returns {IInstance} instance
   */
  fetchInstanceInfo = async () => {
    try {
      if (this.instance === undefined) this.isLoading = true;
      this.error = undefined;
      const instanceInfo = await this.instanceService.getInstanceInfo();
      // handling the new user popup toggle
      if (this.instance === undefined && !instanceInfo?.instance?.workspaces_exist)
        this.store.theme.toggleNewUserPopup();
      runInAction(() => {
        console.log("instanceInfo: ", instanceInfo);
        console.log("config: ", instanceInfo.config);
        console.log("is_oidc_enabled: ", instanceInfo.config?.is_oidc_enabled);
        this.isLoading = false;
        this.instance = instanceInfo.instance;
        this.config = instanceInfo.config;
      });
      return instanceInfo;
    } catch (error) {
      console.error("Error fetching the instance info", error);
      this.isLoading = false;
      this.error = { message: "Failed to fetch the instance info" };
      this.instanceStatus = {
        status: EInstanceStatus.ERROR,
      };
      throw error;
    }
  };

  /**
   * @description updating instance information
   * @param {Partial<IInstance>} data
   * @returns void
   */
  updateInstanceInfo = async (data: Partial<IInstance>) => {
    try {
      const instanceResponse = await this.instanceService.updateInstanceInfo(data);
      if (instanceResponse) {
        runInAction(() => {
          if (this.instance) set(this.instance, "instance", instanceResponse);
        });
      }
      return instanceResponse;
    } catch (error) {
      console.error("Error updating the instance info");
      throw error;
    }
  };

  /**
   * @description fetching instance admins
   * @return {IInstanceAdmin[]} instanceAdmins
   */
  fetchInstanceAdmins = async () => {
    try {
      const instanceAdmins = await this.instanceService.getInstanceAdmins();
      if (instanceAdmins) runInAction(() => (this.instanceAdmins = instanceAdmins));
      return instanceAdmins;
    } catch (error) {
      console.error("Error fetching the instance admins");
      throw error;
    }
  };

  /**
   * @description fetching instance configurations
   * @return {IInstanceAdmin[]} instanceConfigurations
   */
  fetchInstanceConfigurations = async () => {
    try {
      const instanceConfigurations = await this.instanceService.getInstanceConfigurations();
      if (instanceConfigurations) runInAction(() => (this.instanceConfigurations = instanceConfigurations));
      return instanceConfigurations;
    } catch (error) {
      console.error("Error fetching the instance configurations");
      throw error;
    }
  };

  /**
   * @description updating instance configurations
   * @param data
   */
  updateInstanceConfigurations = async (data: Partial<IFormattedInstanceConfiguration>) => {
    try {
      const response = await this.instanceService.updateInstanceConfigurations(data);
      runInAction(() => {
        this.instanceConfigurations = this.instanceConfigurations?.map((config) => {
          const item = response.find((item) => item.key === config.key);
          if (item) return item;
          return config;
        });
      });
      return response;
    } catch (error) {
      console.error("Error updating the instance configurations");
      throw error;
    }
  };

  fetchInstanceMembers = async () => {
    try {
      const members = await this.instanceService.fetchInstanceMembers();
      return members;
    } catch (error) {
      console.error("Error fetching instance members");
      throw error;
    }
  };

  updateInstanceMember = async (userId: string, data: { is_admin: boolean }) => {
    try {
      const response = await this.instanceService.updateInstanceMember(userId, data);
      
      // 멤버 목록을 다시 불러와서 상태 업데이트
      await this.fetchInstanceMembers()
        .then(members => {
          return response;
        });
        
      return response;
    } catch (error) {
      console.error("Error updating instance member");
      throw error;
    }
  };

  fetchFileSettings = async () => {
    try {
      const response = await this.instanceService.getFileSettings();
      runInAction(() => {
        this.fileSettings = response;
      });
      return response;
    } catch (error) {
      console.error("Error fetching file settings");
      throw error;
    }
  };

  updateFileSettings = async (data: Partial<IFileSettings>) => {
    try {
      const response = await this.instanceService.updateFileSettings(data);
      runInAction(() => {
        this.fileSettings = response;
      });
      return response;
    } catch (error) {
      console.error("Error updating file settings");
      throw error;
    }
  };
}
