import { makeAutoObservable, runInAction } from "mobx";
import { IInstanceStore } from "@/types/store/instance";

export interface IFileSettings {
  allowed_extensions: string[];
  max_file_size: number;
}

export class InstanceStore implements IInstanceStore {
  // ... 기존 코드 ...
  fileSettings: IFileSettings | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  fetchFileSettings = async () => {
    try {
      const response = await this.instanceService.getFileSettings();
      runInAction(() => {
        this.fileSettings = response;
      });
    } catch (error) {
      console.error(error);
    }
  };

  updateFileSettings = async (data: Partial<IFileSettings>) => {
    try {
      const response = await this.instanceService.updateFileSettings(data);
      runInAction(() => {
        this.fileSettings = response;
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
} 