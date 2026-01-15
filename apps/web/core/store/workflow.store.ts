import { action, computed, makeObservable, observable, runInAction } from "mobx";
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
// services
import { WorkflowService } from "@/services/workflow.service";

export interface IWorkflowStore {
  // observables
  workflowTemplates: Record<string, IWorkflowTemplate[]>;
  workflowStates: Record<string, IWorkflowState[]>;
  workflowTransitions: Record<string, IWorkflowTransition[]>;
  workflowAssignmentRules: Record<string, IWorkflowAssignmentRule[]>;

  // computed
  getWorkflowTemplates: (projectId: string) => IWorkflowTemplate[];
  getWorkflowStates: (workflowId: string) => IWorkflowState[];
  getWorkflowTransitions: (workflowId: string) => IWorkflowTransition[];
  getWorkflowAssignmentRules: (workflowId: string) => IWorkflowAssignmentRule[];
  getActiveWorkflows: (projectId: string) => IWorkflowTemplate[];
  getDefaultWorkflow: (projectId: string) => IWorkflowTemplate | undefined;

  // actions
  fetchWorkflowTemplates: (workspaceSlug: string, projectId: string) => Promise<IWorkflowTemplate[]>;
  createWorkflowTemplate: (
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowTemplateFormData
  ) => Promise<IWorkflowTemplate>;
  updateWorkflowTemplate: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: Partial<IWorkflowTemplateFormData>
  ) => Promise<IWorkflowTemplate>;
  deleteWorkflowTemplate: (workspaceSlug: string, projectId: string, workflowId: string) => Promise<void>;
  activateWorkflow: (workspaceSlug: string, projectId: string, workflowId: string) => Promise<void>;
  deactivateWorkflow: (workspaceSlug: string, projectId: string, workflowId: string) => Promise<void>;

  fetchWorkflowStates: (workspaceSlug: string, projectId: string, workflowId: string) => Promise<IWorkflowState[]>;
  createWorkflowState: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowStateFormData
  ) => Promise<IWorkflowState>;
  updateWorkflowState: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    stateId: string,
    data: Partial<IWorkflowStateFormData>
  ) => Promise<IWorkflowState>;
  deleteWorkflowState: (workspaceSlug: string, projectId: string, workflowId: string, stateId: string) => Promise<void>;

  fetchWorkflowTransitions: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ) => Promise<IWorkflowTransition[]>;
  createWorkflowTransition: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowTransitionFormData
  ) => Promise<IWorkflowTransition>;
  updateWorkflowTransition: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string,
    data: Partial<IWorkflowTransitionFormData>
  ) => Promise<IWorkflowTransition>;
  deleteWorkflowTransition: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string
  ) => Promise<void>;

  fetchWorkflowAssignmentRules: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ) => Promise<IWorkflowAssignmentRule[]>;
  createWorkflowAssignmentRule: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowAssignmentRuleFormData
  ) => Promise<IWorkflowAssignmentRule>;
  updateWorkflowAssignmentRule: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string,
    data: Partial<IWorkflowAssignmentRuleFormData>
  ) => Promise<IWorkflowAssignmentRule>;
  deleteWorkflowAssignmentRule: (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string
  ) => Promise<void>;

  validateTransition: (
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowValidation
  ) => Promise<IWorkflowValidationResponse>;
  executeTransition: (workspaceSlug: string, projectId: string, data: IWorkflowValidation) => Promise<void>;
  requestApproval: (workspaceSlug: string, projectId: string, data: IWorkflowValidation) => Promise<any>;
  approveTransition: (
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ) => Promise<void>;
  rejectTransition: (
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ) => Promise<void>;
  applyWorkflowToAllIssues: (workspaceSlug: string, projectId: string, workflowId: string) => Promise<any>;
  getApprovalRequests: (
    workspaceSlug: string,
    projectId: string,
    page?: number,
    pageSize?: number,
    filterStatus?: string,
    searchTerm?: string,
    sortOrder?: string
  ) => Promise<{
    count: number;
    can_approve_count: number;
    page: number;
    page_size: number;
    total_pages: number;
    next: boolean;
    previous: boolean;
    results: any[];
  }>;
  fetchPendingApprovals: (workspaceSlug: string, projectId: string) => Promise<void>;
}

export class WorkflowStore implements IWorkflowStore {
  // observables
  workflowTemplates: Record<string, IWorkflowTemplate[]> = {};
  workflowStates: Record<string, IWorkflowState[]> = {};
  workflowTransitions: Record<string, IWorkflowTransition[]> = {};
  pendingApprovalsLoading: Record<string, boolean> = {}; // projectId -> boolean
  workflowAssignmentRules: Record<string, IWorkflowAssignmentRule[]> = {};
  pendingApprovalIssueIds: Record<string, boolean> = {}; // issueId -> true if pending

  // services
  workflowService;

  constructor() {
    makeObservable(this, {
      // observables
      workflowTemplates: observable,
      workflowStates: observable,
      workflowTransitions: observable,
      workflowAssignmentRules: observable,
      pendingApprovalIssueIds: observable,

      // computed
      getWorkflowTemplates: computed,
      getWorkflowStates: computed,
      getWorkflowTransitions: computed,
      getWorkflowAssignmentRules: computed,
      getActiveWorkflows: computed,
      getDefaultWorkflow: computed,

      // actions
      fetchWorkflowTemplates: action,
      createWorkflowTemplate: action,
      updateWorkflowTemplate: action,
      deleteWorkflowTemplate: action,
      activateWorkflow: action,
      deactivateWorkflow: action,

      fetchWorkflowStates: action,
      createWorkflowState: action,
      updateWorkflowState: action,
      deleteWorkflowState: action,

      fetchWorkflowTransitions: action,
      createWorkflowTransition: action,
      updateWorkflowTransition: action,
      deleteWorkflowTransition: action,

      fetchWorkflowAssignmentRules: action,
      createWorkflowAssignmentRule: action,
      updateWorkflowAssignmentRule: action,
      deleteWorkflowAssignmentRule: action,

      validateTransition: action,
      executeTransition: action,
      requestApproval: action,
      approveTransition: action,
      rejectTransition: action,
      applyWorkflowToAllIssues: action,
      getApprovalRequests: action,
      fetchPendingApprovals: action,
    });

    this.workflowService = new WorkflowService();
  }

  // computed
  get getWorkflowTemplates() {
    return (projectId: string) => this.workflowTemplates[projectId] || [];
  }

  get getWorkflowStates() {
    return (workflowId: string) => this.workflowStates[workflowId] || [];
  }

  get getWorkflowTransitions() {
    return (workflowId: string) => this.workflowTransitions[workflowId] || [];
  }

  get getWorkflowAssignmentRules() {
    return (workflowId: string) => this.workflowAssignmentRules[workflowId] || [];
  }

  get getActiveWorkflows() {
    return (projectId: string) => (this.workflowTemplates[projectId] || []).filter((workflow) => workflow.is_active);
  }

  get getDefaultWorkflow() {
    return (projectId: string) => (this.workflowTemplates[projectId] || []).find((workflow) => workflow.is_default);
  }

  // workflow template actions
  fetchWorkflowTemplates = async (workspaceSlug: string, projectId: string): Promise<IWorkflowTemplate[]> => {
    try {
      const workflows = await this.workflowService.getWorkflowTemplates(workspaceSlug, projectId);
      runInAction(() => {
        this.workflowTemplates[projectId] = workflows;
      });
      return workflows;
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      throw error;
    }
  };

  createWorkflowTemplate = async (
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowTemplateFormData
  ): Promise<IWorkflowTemplate> => {
    try {
      const workflow = await this.workflowService.createWorkflowTemplate(workspaceSlug, projectId, data);
      runInAction(() => {
        if (!this.workflowTemplates[projectId]) {
          this.workflowTemplates[projectId] = [];
        }
        this.workflowTemplates[projectId].push(workflow);
      });
      return workflow;
    } catch (error) {
      console.error("Error creating workflow template:", error);
      throw error;
    }
  };

  updateWorkflowTemplate = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: Partial<IWorkflowTemplateFormData>
  ): Promise<IWorkflowTemplate> => {
    try {
      const workflow = await this.workflowService.updateWorkflowTemplate(workspaceSlug, projectId, workflowId, data);
      runInAction(() => {
        if (this.workflowTemplates[projectId]) {
          const index = this.workflowTemplates[projectId].findIndex((w) => w.id === workflowId);
          if (index !== -1) {
            this.workflowTemplates[projectId][index] = workflow;
          }
        }
      });
      return workflow;
    } catch (error) {
      console.error("Error updating workflow template:", error);
      throw error;
    }
  };

  deleteWorkflowTemplate = async (workspaceSlug: string, projectId: string, workflowId: string): Promise<void> => {
    try {
      await this.workflowService.deleteWorkflowTemplate(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        if (this.workflowTemplates[projectId]) {
          this.workflowTemplates[projectId] = this.workflowTemplates[projectId].filter((w) => w.id !== workflowId);
        }
      });
    } catch (error) {
      console.error("Error deleting workflow template:", error);
      throw error;
    }
  };

  activateWorkflow = async (workspaceSlug: string, projectId: string, workflowId: string): Promise<void> => {
    try {
      await this.workflowService.activateWorkflow(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        if (this.workflowTemplates[projectId]) {
          const workflow = this.workflowTemplates[projectId].find((w) => w.id === workflowId);
          if (workflow) {
            workflow.is_active = true;
          }
        }
      });
    } catch (error) {
      console.error("Error activating workflow:", error);
      throw error;
    }
  };

  deactivateWorkflow = async (workspaceSlug: string, projectId: string, workflowId: string): Promise<void> => {
    try {
      await this.workflowService.deactivateWorkflow(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        if (this.workflowTemplates[projectId]) {
          const workflow = this.workflowTemplates[projectId].find((w) => w.id === workflowId);
          if (workflow) {
            workflow.is_active = false;
          }
        }
      });
    } catch (error) {
      console.error("Error deactivating workflow:", error);
      throw error;
    }
  };

  // workflow state actions
  fetchWorkflowStates = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ): Promise<IWorkflowState[]> => {
    try {
      const states = await this.workflowService.getWorkflowStates(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        this.workflowStates[workflowId] = states;
      });
      return states;
    } catch (error) {
      console.error("Error fetching workflow states:", error);
      throw error;
    }
  };

  createWorkflowState = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowStateFormData
  ): Promise<IWorkflowState> => {
    try {
      const state = await this.workflowService.createWorkflowState(workspaceSlug, projectId, workflowId, data);
      runInAction(() => {
        if (!this.workflowStates[workflowId]) {
          this.workflowStates[workflowId] = [];
        }
        this.workflowStates[workflowId].push(state);
      });
      return state;
    } catch (error) {
      console.error("Error creating workflow state:", error);
      throw error;
    }
  };

  updateWorkflowState = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    stateId: string,
    data: Partial<IWorkflowStateFormData>
  ): Promise<IWorkflowState> => {
    try {
      const state = await this.workflowService.updateWorkflowState(workspaceSlug, projectId, workflowId, stateId, data);
      runInAction(() => {
        if (this.workflowStates[workflowId]) {
          const index = this.workflowStates[workflowId].findIndex((s) => s.id === stateId);
          if (index !== -1) {
            this.workflowStates[workflowId][index] = state;
          }
        }
      });
      return state;
    } catch (error) {
      console.error("Error updating workflow state:", error);
      throw error;
    }
  };

  deleteWorkflowState = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    stateId: string
  ): Promise<void> => {
    try {
      await this.workflowService.deleteWorkflowState(workspaceSlug, projectId, workflowId, stateId);
      runInAction(() => {
        if (this.workflowStates[workflowId]) {
          this.workflowStates[workflowId] = this.workflowStates[workflowId].filter((s) => s.id !== stateId);
        }
      });
    } catch (error) {
      console.error("Error deleting workflow state:", error);
      throw error;
    }
  };

  // workflow transition actions
  fetchWorkflowTransitions = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ): Promise<IWorkflowTransition[]> => {
    try {
      const transitions = await this.workflowService.getWorkflowTransitions(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        this.workflowTransitions[workflowId] = transitions;
      });
      return transitions;
    } catch (error) {
      console.error("Error fetching workflow transitions:", error);
      throw error;
    }
  };

  createWorkflowTransition = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowTransitionFormData
  ): Promise<IWorkflowTransition> => {
    try {
      const transition = await this.workflowService.createWorkflowTransition(
        workspaceSlug,
        projectId,
        workflowId,
        data
      );
      runInAction(() => {
        if (!this.workflowTransitions[workflowId]) {
          this.workflowTransitions[workflowId] = [];
        }
        this.workflowTransitions[workflowId].push(transition);
      });
      return transition;
    } catch (error) {
      console.error("Error creating workflow transition:", error);
      throw error;
    }
  };

  updateWorkflowTransition = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string,
    data: Partial<IWorkflowTransitionFormData>
  ): Promise<IWorkflowTransition> => {
    try {
      const transition = await this.workflowService.updateWorkflowTransition(
        workspaceSlug,
        projectId,
        workflowId,
        transitionId,
        data
      );
      runInAction(() => {
        if (this.workflowTransitions[workflowId]) {
          const index = this.workflowTransitions[workflowId].findIndex((t) => t.id === transitionId);
          if (index !== -1) {
            this.workflowTransitions[workflowId][index] = transition;
          }
        }
      });
      return transition;
    } catch (error) {
      console.error("Error updating workflow transition:", error);
      throw error;
    }
  };

  deleteWorkflowTransition = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    transitionId: string
  ): Promise<void> => {
    try {
      await this.workflowService.deleteWorkflowTransition(workspaceSlug, projectId, workflowId, transitionId);
      runInAction(() => {
        if (this.workflowTransitions[workflowId]) {
          this.workflowTransitions[workflowId] = this.workflowTransitions[workflowId].filter(
            (t) => t.id !== transitionId
          );
        }
      });
    } catch (error) {
      console.error("Error deleting workflow transition:", error);
      throw error;
    }
  };

  // workflow assignment rule actions
  fetchWorkflowAssignmentRules = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string
  ): Promise<IWorkflowAssignmentRule[]> => {
    try {
      const rules = await this.workflowService.getWorkflowAssignmentRules(workspaceSlug, projectId, workflowId);
      runInAction(() => {
        this.workflowAssignmentRules[workflowId] = rules;
      });
      return rules;
    } catch (error) {
      console.error("Error fetching workflow assignment rules:", error);
      throw error;
    }
  };

  createWorkflowAssignmentRule = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    data: IWorkflowAssignmentRuleFormData
  ): Promise<IWorkflowAssignmentRule> => {
    try {
      const rule = await this.workflowService.createWorkflowAssignmentRule(workspaceSlug, projectId, workflowId, data);
      runInAction(() => {
        if (!this.workflowAssignmentRules[workflowId]) {
          this.workflowAssignmentRules[workflowId] = [];
        }
        this.workflowAssignmentRules[workflowId].push(rule);
      });
      return rule;
    } catch (error) {
      console.error("Error creating workflow assignment rule:", error);
      throw error;
    }
  };

  updateWorkflowAssignmentRule = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string,
    data: Partial<IWorkflowAssignmentRuleFormData>
  ): Promise<IWorkflowAssignmentRule> => {
    try {
      const rule = await this.workflowService.updateWorkflowAssignmentRule(
        workspaceSlug,
        projectId,
        workflowId,
        ruleId,
        data
      );
      runInAction(() => {
        if (this.workflowAssignmentRules[workflowId]) {
          const index = this.workflowAssignmentRules[workflowId].findIndex((r) => r.id === ruleId);
          if (index !== -1) {
            this.workflowAssignmentRules[workflowId][index] = rule;
          }
        }
      });
      return rule;
    } catch (error) {
      console.error("Error updating workflow assignment rule:", error);
      throw error;
    }
  };

  deleteWorkflowAssignmentRule = async (
    workspaceSlug: string,
    projectId: string,
    workflowId: string,
    ruleId: string
  ): Promise<void> => {
    try {
      await this.workflowService.deleteWorkflowAssignmentRule(workspaceSlug, projectId, workflowId, ruleId);
      runInAction(() => {
        if (this.workflowAssignmentRules[workflowId]) {
          this.workflowAssignmentRules[workflowId] = this.workflowAssignmentRules[workflowId].filter(
            (r) => r.id !== ruleId
          );
        }
      });
    } catch (error) {
      console.error("Error deleting workflow assignment rule:", error);
      throw error;
    }
  };

  // workflow validation actions
  validateTransition = async (
    workspaceSlug: string,
    projectId: string,
    data: IWorkflowValidation
  ): Promise<IWorkflowValidationResponse> => {
    try {
      return await this.workflowService.validateTransition(workspaceSlug, projectId, data);
    } catch (error) {
      console.error("Error validating transition:", error);
      throw error;
    }
  };

  executeTransition = async (workspaceSlug: string, projectId: string, data: IWorkflowValidation): Promise<void> => {
    try {
      await this.workflowService.executeTransition(workspaceSlug, projectId, data);
    } catch (error) {
      console.error("Error executing transition:", error);
      throw error;
    }
  };

  // Approval request methods
  requestApproval = async (workspaceSlug: string, projectId: string, data: IWorkflowValidation): Promise<any> => {
    try {
      return await this.workflowService.requestApproval(workspaceSlug, projectId, data);
    } catch (error) {
      console.error("Error requesting approval:", error);
      throw error;
    }
  };

  approveTransition = async (
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ): Promise<void> => {
    try {
      await this.workflowService.approveTransition(workspaceSlug, projectId, approvalRequestId, data);
    } catch (error) {
      console.error("Error approving transition:", error);
      throw error;
    }
  };

  rejectTransition = async (
    workspaceSlug: string,
    projectId: string,
    approvalRequestId: string,
    data: { comment?: string }
  ): Promise<void> => {
    try {
      await this.workflowService.rejectTransition(workspaceSlug, projectId, approvalRequestId, data);
    } catch (error) {
      console.error("Error rejecting transition:", error);
      throw error;
    }
  };

  applyWorkflowToAllIssues = async (workspaceSlug: string, projectId: string, workflowId: string): Promise<any> => {
    try {
      return await this.workflowService.applyWorkflowToAllIssues(workspaceSlug, projectId, workflowId);
    } catch (error) {
      console.error("Error applying workflow to all issues:", error);
      throw error;
    }
  };

  getApprovalRequests = async (
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
  }> => {
    try {
      return await this.workflowService.getApprovalRequests(
        workspaceSlug,
        projectId,
        page,
        pageSize,
        filterStatus,
        searchTerm,
        sortOrder
      );
    } catch (error) {
      console.error("Error fetching approval requests:", error);
      throw error;
    }
  };
  // Fetch all pending approvals for a project to efficiently check status
  fetchPendingApprovals = async (workspaceSlug: string, projectId: string): Promise<void> => {
    if (this.pendingApprovalsLoading[projectId]) return;

    try {
      this.pendingApprovalsLoading[projectId] = true;
      // Fetch pending requests with a large page size to cover most cases
      // In a real generic implementation, we might need to handle pagination or use a specific lightweight endpoint
      const response = await this.workflowService.getApprovalRequests(
        workspaceSlug,
        projectId,
        1,
        100, // page size
        "pending"
      );
      
      runInAction(() => {
        // Let's iterate and set
        response.results.forEach((request: any) => {
          if (request.status === "pending" && request.issue?.id) {
            this.pendingApprovalIssueIds[request.issue.id] = true;
          }
        });
        this.pendingApprovalsLoading[projectId] = false;
      });
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      runInAction(() => { 
        this.pendingApprovalsLoading[projectId] = false;
      });
    }
  };
}
