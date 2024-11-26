// types
import type { IInstanceInfo, IInstance, IInstanceConfig, IFileSettings } from "@plane/types";
// helpers
import { API_BASE_URL } from "@/helpers/common.helper";
// services
import { APIService } from "@/services/api.service";

export class InstanceService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async requestCSRFToken(): Promise<{ csrf_token: string }> {
    return this.get("/auth/get-csrf-token/")
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  }

  async getInstanceInfo(): Promise<IInstanceInfo> {
    return this.get("/api/instances/")
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  }

  async getFileSettings(): Promise<IFileSettings> {
    const response = await fetch(`${API_BASE_URL}/api/instances/file-settings/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch file settings");
    }

    return response.json();
  }

  async updateFileSettings(data: Partial<IFileSettings>): Promise<IFileSettings> {
    const response = await fetch(`${API_BASE_URL}/api/instances/file-settings/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to update file settings");
    }

    return response.json();
  }
}
