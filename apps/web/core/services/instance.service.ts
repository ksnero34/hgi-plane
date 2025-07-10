// types
import { API_BASE_URL } from "@plane/constants";
import type { IInstanceInfo, IInstance, IInstanceConfig, IFileSettings, ICsrfTokenData, TPage, IInstanceMember } from "@plane/types";
// helpers
// services
import { APIService } from "@/services/api.service";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";

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

  async getFileSettings(): Promise<IFileSettings> {
    // console.log("🌐 Making API request to get file settings...");
    try {
      // CSRF 토큰 가져오기
      const { csrf_token } = await this.requestCSRFToken();
      // console.log("🔑 Got CSRF token:", csrf_token);
      // console.log("📨 Request headers:", {
      //   'Content-Type': 'application/json',
      //   'X-CSRFToken': csrf_token
      // });
      
      const response = await this.get("/api/instances/file-settings/", {}, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf_token
        }
      });
      // console.log("✅ API response for file settings:", response);
      return response.data;
    } catch (error: any) {
      // console.error("❌ API request failed:", {
      //   status: error.response?.status,
      //   statusText: error.response?.statusText,
      //   data: error.response?.data,
      //   headers: error.response?.headers,
      //   config: error.config
      // });
      
      if (error.response?.status === 401 || error) {
        // console.log("⚠️ Using default settings due to unauthorized or error");
        return {
          max_file_size: MAX_FILE_SIZE,
          allowed_extensions: ["jpg", "jpeg", "png", "gif", "pdf"]
        };
      }
      throw error;
    }
  }

  async updateFileSettings(data: Partial<IFileSettings>): Promise<IFileSettings> {
    // console.log("🌐 Making API request to update file settings...", data);
    try {
      const { csrf_token } = await this.requestCSRFToken();
      // console.log("🔑 Got CSRF token:", csrf_token);
      
      const response = await this.patch("/api/instances/file-settings/", data, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf_token
        }
      });
      // console.log("✅ API response for update:", response);
      return response.data;
    } catch (error) {
      // console.error("❌ API request failed:", error);
      throw error;
    }
  }

  async getInstanceInfo(): Promise<IInstanceInfo> {
    return this.get("/api/instances/")
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  }

  /**
   * @description 인스턴스 멤버 목록을 가져옵니다
   * @returns Promise<IInstanceMember[]>
   */
  async getInstanceMembers(): Promise<IInstanceMember[]> {
    try {
      const { csrf_token } = await this.requestCSRFToken();
      
      const response = await this.get("/api/instances/public/members/", {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf_token
        }
      });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch instance members:", error);
      throw error;
    }
  }
}
