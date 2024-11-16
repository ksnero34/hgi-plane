// services
import type { IIssueFiltersResponse, IIssueFilterOptions } from "@plane/types";
import { API_BASE_URL } from "@/helpers/common.helper";
import { APIService } from "@/services/api.service";
// types

// 필요한 타입 정의 추가
interface IIssueFiltersRequest {
  filters?: {
    layout?: string;
    start_date?: string[];
    target_date?: string[];
    [key: string]: any;
  };
  display_filters?: {
    layout?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class IssueFiltersService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // // workspace issue filters
  // async fetchWorkspaceFilters(workspaceSlug: string): Promise<IIssueFiltersResponse> {
  //   return this.get(`/api/workspaces/${workspaceSlug}/user-properties/`)
  //     .then((response) => response?.data)
  //     .catch((error) => {
  //       throw error?.response?.data;
  //     });
  // }
  // async patchWorkspaceFilters(
  //   workspaceSlug: string,
  //   data: Partial<IIssueFiltersResponse>
  // ): Promise<IIssueFiltersResponse> {
  //   return this.patch(`/api/workspaces/${workspaceSlug}/user-properties/`, data)
  //     .then((response) => response?.data)
  //     .catch((error) => {
  //       throw error?.response?.data;
  //     });
  // }

  // project issue filters
  async fetchProjectIssueFilters(workspaceSlug: string, projectId: string): Promise<IIssueFiltersResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/user-properties/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
  async patchProjectIssueFilters(
    workspaceSlug: string,
    projectId: string,
    data: Partial<IIssueFiltersResponse>
  ): Promise<any> {
    if (data.display_filters?.layout === 'calendar') {
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      data = {
        ...data,
        filters: {
          ...data.filters,
          start_date: [firstDayOfMonth.toISOString().split('T')[0]],
          target_date: [lastDayOfMonth.toISOString().split('T')[0]]
        }
      };
    }

    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/user-properties/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // cycle issue filters
  async fetchCycleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<IIssueFiltersResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/user-properties/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
  async patchCycleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    data: Partial<IIssueFiltersResponse>
  ): Promise<any> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/user-properties/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // module issue filters
  async fetchModuleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    moduleId: string
  ): Promise<IIssueFiltersResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/user-properties/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
  async patchModuleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<IIssueFiltersResponse>
  ): Promise<any> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/modules/${moduleId}/user-properties/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateFilters(workspaceSlug: string, projectId: string, data: IIssueFiltersRequest): Promise<IIssueFilterOptions> {
    // 캘린더 뷰를 위한 날짜 범위 계산
    if (data.filters?.layout === "calendar") {
      const firstDayOfMonth = new Date(data.filters.start_date?.[0] || new Date());
      firstDayOfMonth.setDate(1);
      
      const lastDayOfMonth = new Date(firstDayOfMonth);
      lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
      lastDayOfMonth.setDate(0);

      return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-filters/`, {
        ...data,
        filters: {
          ...data.filters,
          start_date: [firstDayOfMonth.toISOString().split('T')[0]],
          target_date: [lastDayOfMonth.toISOString().split('T')[0]]
        }
      })
        .then((response) => response?.data)
        .catch((error) => {
          throw error?.response?.data;
        });
    }

    // 일반적인 필터 업데이트
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-filters/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
