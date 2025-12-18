import { API_BASE_URL } from "@plane/constants";
import { APIService } from "../api.service";
import type { IIssueType, IProject, IProjectIssueType } from "@plane/types";

export class ProjectService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProjectIssueTypes(workspaceSlug: string, projectId: string): Promise<IProjectIssueType[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createProjectIssueType(workspaceSlug: string, projectId: string, data: any): Promise<IIssueType> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateProjectIssueType(
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: any
  ): Promise<IIssueType> {
    return this.put(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/${issueTypeId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteProjectIssueType(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<any> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/${issueTypeId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

const projectService = new ProjectService();
export default projectService;
