// types
import type {
  IFormattedInstanceConfiguration,
  IInstance,
  IInstanceAdmin,
  IInstanceConfiguration,
  IInstanceInfo,
  IUser,
  IFileSettings,
} from "@plane/types";
// helpers
import { API_BASE_URL } from "@/helpers/common.helper";
import { APIService } from "@/services/api.service";

interface CSRFResponse {
  csrf_token: string;
}

export class InstanceService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getInstanceInfo(): Promise<IInstanceInfo> {
    return this.get<IInstanceInfo>("/api/instances/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getInstanceAdmins(): Promise<IInstanceAdmin[]> {
    return this.get<IInstanceAdmin[]>("/api/instances/admins/")
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  }

  async updateInstanceInfo(data: Partial<IInstance>): Promise<IInstance> {
    return this.patch<Partial<IInstance>, IInstance>("/api/instances/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getInstanceConfigurations() {
    return this.get<IInstanceConfiguration[]>("/api/instances/configurations/")
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  }

  async updateInstanceConfigurations(
    data: Partial<IFormattedInstanceConfiguration>
  ): Promise<IInstanceConfiguration[]> {
    return this.patch<Partial<IFormattedInstanceConfiguration>, IInstanceConfiguration[]>(
      "/api/instances/configurations/",
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async sendTestEmail(receiverEmail: string): Promise<undefined> {
    return this.post<{ receiver_email: string }, undefined>("/api/instances/email-credentials-check/", {
      receiver_email: receiverEmail,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // 모든 인스턴스 멤버 조회
  async fetchInstanceMembers(): Promise<IUser[]> {
    return this.get<IUser[]>("/api/instances/members/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // 멤버 권한 업데이트
  async updateInstanceMember(
    userId: string, 
    data: { is_admin: boolean }
  ): Promise<IUser> {
    const csrfToken = await this.requestCSRFToken();
    
    return this.patch<{ is_admin: boolean }, IUser>(
      `/api/instances/members/${userId}/`,
      data,
      {
        headers: {
          'X-CSRFToken': csrfToken.csrf_token,
        }
      }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // CSRF 토큰 요청 메서드
  private async requestCSRFToken(): Promise<CSRFResponse> {
    return this.get<CSRFResponse>("/auth/get-csrf-token/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getFileSettings(): Promise<IFileSettings> {
    return this.get<IFileSettings>("/api/instances/file-settings/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateFileSettings(data: Partial<IFileSettings>): Promise<IFileSettings> {
    const csrfToken = await this.requestCSRFToken();
    
    return this.patch<Partial<IFileSettings>, IFileSettings>(
      "/api/instances/file-settings/",
      data,
      {
        headers: {
          'X-CSRFToken': csrfToken.csrf_token,
        }
      }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
