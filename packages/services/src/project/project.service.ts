import { http } from "../api.service";
import { IIssueType, IProject, TProjectIssues } from "@plane/types";

const projectService = {
  async getProjectIssueTypes(workspaceSlug: string, projectId: string): Promise<IIssueType[]> {
    return http.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`);
  },

  async createProjectIssueType(workspaceSlug: string, projectId: string, data: any): Promise<IIssueType> {
    return http.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`, data);
  },

  async updateProjectIssueType(
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: any
  ): Promise<IIssueType> {
    return http.put(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/${issueTypeId}/`, data);
  },

  async deleteProjectIssueType(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<any> {
    return http.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/${issueTypeId}/`);
  },
};

export default projectService;
