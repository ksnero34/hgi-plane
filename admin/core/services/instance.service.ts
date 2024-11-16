// types
import type {
  IFormattedInstanceConfiguration,
  IInstance,
  IInstanceAdmin,
  IInstanceConfiguration,
  IInstanceInfo,
  IUser,
} from "@plane/types";
// helpers
import { API_BASE_URL } from "@/helpers/common.helper";
import { APIService } from "@/services/api.service";

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
    const csrfToken = await this.requestCSRFToken();  // CSRF 토큰 요청
    
    return this.patch<{ is_admin: boolean }, IUser>(
      `/api/instances/members/${userId}/`,
      data,
      {
        headers: {
          'X-CSRFToken': csrfToken?.csrf_token,  // CSRF 토큰 포함
        }
      }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // CSRF 토큰 요청 메서드
  private async requestCSRFToken() {
    return this.get("/auth/get-csrf-token/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
