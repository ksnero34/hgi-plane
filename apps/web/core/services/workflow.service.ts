import type {
  IWorkflowTemplate,
  IWorkflowState,
  IWorkflowTransition,
  IWorkflowAssignmentRule,
  IWorkflowTemplateFormData,
  IWorkflowStateFormData,
  IWorkflowTransitionFormData,
  IWorkflowAssignmentRuleFormData,
  IWorkflowValidation,
  IWorkflowValidationResponse,
} from "@plane/types";
// constants
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "./api.service";

export class WorkflowService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // Workflow Templates
  async getWorkflowTemplates(workspaceSlug: string, projectId: string): Promise<IWorkflowTemplate[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/`).then(
      (response) => response?.data
    );
  }

  async createWorkflowTemplate(
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowTemplateFormData
  ): Promise<IWorkflowTemplate> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/`, data).then(
      (response) => response?.data
    );
  }

  async getWorkflowTemplate(workspaceSlug: string, projectId: string, workflowId: string): Promise<IWorkflowTemplate> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/`).then(
      (response) => response?.data
    );
  }

  async updateWorkflowTemplate(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: Partial<IWorkflowTemplateFormData>
  ): Promise<IWorkflowTemplate> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/`, data).then(
      (response) => response?.data
    );
  }

  async deleteWorkflowTemplate(workspaceSlug: string, projectId: string, workflowId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/`).then(
      (response) => response?.data
    );
  }

  async activateWorkflow(workspaceSlug: string, projectId: string, workflowId: string): Promise<void> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/activate/`,
      {}
    ).then((response) => response?.data);
  }

  async deactivateWorkflow(workspaceSlug: string, projectId: string, workflowId: string): Promise<void> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/deactivate/`,
      {}
    ).then((response) => response?.data);
  }

  // Workflow States
  async getWorkflowStates(workspaceSlug: string, projectId: string, workflowId: string): Promise<IWorkflowState[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/states/`).then(
      (response) => response?.data
    );
  }

  async createWorkflowState(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowStateFormData
  ): Promise<IWorkflowState> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/states/`,
      data
    ).then((response) => response?.data);
  }

  async updateWorkflowState(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    stateId: string,
    data: Partial<IWorkflowStateFormData>
  ): Promise<IWorkflowState> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/states/${stateId}/`,
      data
    ).then((response) => response?.data);
  }

  async deleteWorkflowState(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    stateId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/states/${stateId}/`
    ).then((response) => response?.data);
  }

  // Workflow Transitions
  async getWorkflowTransitions(
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ): Promise<IWorkflowTransition[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/transitions/`).then(
      (response) => response?.data
    );
  }

  async createWorkflowTransition(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowTransitionFormData
  ): Promise<IWorkflowTransition> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/transitions/`,
      data
    ).then((response) => response?.data);
  }

  async updateWorkflowTransition(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string,
    data: Partial<IWorkflowTransitionFormData>
  ): Promise<IWorkflowTransition> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/transitions/${transitionId}/`,
      data
    ).then((response) => response?.data);
  }

  async deleteWorkflowTransition(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/transitions/${transitionId}/`
    ).then((response) => response?.data);
  }

  // Workflow Assignment Rules
  async getWorkflowAssignmentRules(
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ): Promise<IWorkflowAssignmentRule[]> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/assignment-rules/`
    ).then((response) => response?.data);
  }

  async createWorkflowAssignmentRule(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowAssignmentRuleFormData
  ): Promise<IWorkflowAssignmentRule> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/assignment-rules/`,
      data
    ).then((response) => response?.data);
  }

  async updateWorkflowAssignmentRule(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string,
    data: Partial<IWorkflowAssignmentRuleFormData>
  ): Promise<IWorkflowAssignmentRule> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/assignment-rules/${ruleId}/`,
      data
    ).then((response) => response?.data);
  }

  async deleteWorkflowAssignmentRule(
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/assignment-rules/${ruleId}/`
    ).then((response) => response?.data);
  }

  // Workflow Validation
  async validateTransition(
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowValidation
  ): Promise<IWorkflowValidationResponse> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/validate-transition/`,
      data
    ).then((response) => response?.data);
  }

  async executeTransition(workspaceSlug: string, projectId: string, data: IWorkflowValidation): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/execute-transition/`, data).then(
      (response) => response?.data
    );
  }

  // Approval request methods
  async requestApproval(workspaceSlug: string, projectId: string, data: IWorkflowValidation): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/request-approval/`, data).then(
      (response) => response?.data
    );
  }

  async approveTransition(
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ): Promise<void> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/approve-transition/${approvalRequestId}/`,
      data
    ).then((response) => response?.data);
  }

  async rejectTransition(
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ): Promise<void> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/reject-transition/${approvalRequestId}/`,
      data
    ).then((response) => response?.data);
  }

  async applyWorkflowToAllIssues(workspaceSlug: string, projectId: string, workflowId: string): Promise<any> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/${workflowId}/apply-to-all-issues/`,
      {}
    ).then((response) => response?.data);
  }

  // Approval requests
  async getApprovalRequests(
    workspaceSlug: string,
    projectId: string,
    page: number = 1,
    pageSize: number = 10,
    filterStatus: string = "all",
    searchTerm: string = "",
    sortOrder: string = "newest"
  ): Promise<{
    count: number;
    can_approve_count: number;
    page: number;
    page_size: number;
    total_pages: number;
    next: boolean;
    previous: boolean;
    results: any[];
  }> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/workflows/approval-requests/`, {
      params: {
        page,
        page_size: pageSize,
        filter_status: filterStatus,
        search: searchTerm,
        sort: sortOrder,
      },
    }).then((response) => response?.data);
  }
}
