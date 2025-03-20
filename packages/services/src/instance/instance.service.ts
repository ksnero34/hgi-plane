// plane imports
import { API_BASE_URL } from "@plane/constants";
import type {
  IFormattedInstanceConfiguration,
  IInstance,
  IInstanceAdmin,
  IInstanceConfiguration,
  IInstanceInfo,
  TPage,
  IUser,
  IFileSettings,
  IWorkspace,
} from "@plane/types";
// api service
import { APIService } from "../api.service";

interface CSRFResponse {
  csrf_token: string;
}
/**
 * Service class for managing instance-related operations
 * Handles retrieval of instance information and changelog
 * @extends {APIService}
 */
export class InstanceService extends APIService {
  /**
   * Creates an instance of InstanceService
   * Initializes the service with the base API URL
   */
  constructor() {
    super(API_BASE_URL);
  }

  /**
   * Retrieves information about the current instance
   * @returns {Promise<IInstanceInfo>} Promise resolving to instance information
   * @throws {Error} If the API request fails
   * @remarks This method uses the validateStatus: null option to bypass interceptors for unauthorized errors.
   */
  async info(): Promise<IInstanceInfo> {
    return this.get("/api/instances/", { validateStatus: null })
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Fetches the changelog for the current instance
   * @returns {Promise<TPage>} Promise resolving to the changelog page data
   * @throws {Error} If the API request fails
   */
  async changelog(): Promise<TPage> {
    return this.get("/api/instances/changelog/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Fetches the list of instance admins
   * @returns {Promise<IInstanceAdmin[]>} Promise resolving to an array of instance admins
   * @throws {Error} If the API request fails
   * @remarks This method uses the validateStatus: null option to bypass interceptors for unauthorized errors.
   */
  async admins(): Promise<IInstanceAdmin[]> {
    return this.get("/api/instances/admins/", { validateStatus: null })
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Updates the instance information
   * @param {Partial<IInstance>} data Data to update the instance with
   * @returns {Promise<IInstance>} Promise resolving to the updated instance information
   * @throws {Error} If the API request fails
   */
  async update(data: Partial<IInstance>): Promise<IInstance> {
    return this.patch("/api/instances/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Fetches the list of instance configurations
   * @returns {Promise<IInstanceConfiguration[]>} Promise resolving to an array of instance configurations
   * @throws {Error} If the API request fails
   */
  async configurations(): Promise<IInstanceConfiguration[]> {
    return this.get("/api/instances/configurations/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Updates the instance configurations
   * @param {Partial<IFormattedInstanceConfiguration>} data Data to update the instance configurations with
   * @returns {Promise<IInstanceConfiguration[]>} The updated instance configurations
   * @throws {Error} If the API request fails
   */
  async updateConfigurations(data: Partial<IFormattedInstanceConfiguration>): Promise<IInstanceConfiguration[]> {
    return this.patch("/api/instances/configurations/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Sends a test email to the specified receiver to test SMTP configuration
   * @param {string} receiverEmail Email address to send the test email to
   * @returns {Promise<void>} Promise resolving to void
   * @throws {Error} If the API request fails
   */
  async sendTestEmail(receiverEmail: string): Promise<void> {
    return this.post("/api/instances/email-credentials-check/", {
      receiver_email: receiverEmail,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  
  // 모든 인스턴스 멤버 조회
  async fetchInstanceMembers(): Promise<IUser[]> {
    return this.get("/api/instances/members/")
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
    
    return this.patch(
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

  /**
   * CSRF 토큰 요청 메서드
   * @returns {Promise<CSRFResponse>} CSRF 토큰 정보
   */
  public async requestCSRFToken(): Promise<CSRFResponse> {
    return this.get("/auth/get-csrf-token/")
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * 파일 설정을 가져옵니다
   * @returns {Promise<IFileSettings>} 파일 설정 정보
   * @throws {Error} API 요청 실패 시
   */
  async getFileSettings(): Promise<IFileSettings> {
    return this.get("/api/instances/file-settings/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * 파일 설정을 업데이트합니다
   * @param {Partial<IFileSettings>} data - 업데이트할 파일 설정 데이터
   * @returns {Promise<IFileSettings>} 업데이트된 파일 설정 정보
   * @throws {Error} API 요청 실패 시
   */
  async updateFileSettings(data: Partial<IFileSettings>): Promise<IFileSettings> {
    return this.patch("/api/instances/file-settings/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * 기본 워크스페이스 설정 목록을 가져옵니다
   * @returns {Promise<IWorkspace[]>} 기본 워크스페이스 설정 목록
   */
  async getDefaultWorkspaces(): Promise<IWorkspace[]> {
    return this.get("/api/instances/default-workspaces/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * 기본 워크스페이스 설정을 생성합니다
   * @param {Object} data - 기본 워크스페이스 설정 데이터
   * @param {string} data.workspace_id - 워크스페이스 ID
   * @param {number} data.role - 역할 레벨
   * @returns {Promise<IWorkspace>} 생성된 기본 워크스페이스 설정
   */
  async createDefaultWorkspace(data: { workspace_id: string; role: number }): Promise<IWorkspace> {
    const csrfToken = await this.requestCSRFToken();
    
    return this.post(
      "/api/instances/default-workspaces/", 
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

  /**
   * 기본 워크스페이스 설정을 업데이트합니다
   * @param {string} configId - 설정 ID
   * @param {Object} data - 업데이트할 데이터
   * @param {number} data.role - 역할 레벨
   * @returns {Promise<IWorkspace>} 업데이트된 기본 워크스페이스 설정
   */
  async updateDefaultWorkspace(configId: string, data: { role: number }): Promise<IWorkspace> {
    const csrfToken = await this.requestCSRFToken();
    
    return this.patch(
      `/api/instances/default-workspaces/${configId}/`, 
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

  /**
   * 기본 워크스페이스 설정을 삭제합니다
   * @param {string} configId - 설정 ID
   * @returns {Promise<void>}
   */
  async deleteDefaultWorkspace(configId: string): Promise<void> {
    // CSRF 토큰 요청
    const csrfToken = await this.requestCSRFToken();
    
    console.log(`CSRF 토큰 received: ${csrfToken.csrf_token}`);
    console.log(`DELETE 요청 경로: /api/instances/default-workspaces/${configId}/`);
    
    // CSRF 토큰을 헤더에 올바르게 포함
    return this.delete(
      `/api/instances/default-workspaces/${configId}/`,
      {},
      {
        headers: {
          'X-CSRFToken': csrfToken.csrf_token
        }
      }
    )
      .then((response) => {
        console.log("삭제 요청 성공:", response?.status);
        return response?.data;
      })
      .catch((error) => {
        console.error("삭제 요청 실패:", error?.response?.status, error?.response?.data);
        throw error?.response?.data;
      });
  }
}
