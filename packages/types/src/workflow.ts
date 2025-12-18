export type IWorkflowTemplate = {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string;
  created_by_detail?: {
    id: string;
    display_name: string;
    avatar?: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  updated_at: string;
  total_states?: number;
  total_transitions?: number;
  workflow_states?: IWorkflowState[];
  workflow_transitions?: IWorkflowTransition[];
  assignment_rules?: IWorkflowAssignmentRule[];
};

export type IWorkflowState = {
  id: string;
  workflow: string;
  state: string;
  state_detail?: {
    id: string;
    name: string;
    color: string;
    group: string;
  };
  sequence: number;
  allow_new_issues: boolean;
  conditions?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type IWorkflowTransition = {
  id: string;
  workflow: string;
  from_state: string;
  from_state_detail?: {
    id: string;
    name: string;
    color: string;
    group: string;
  };
  to_state: string;
  to_state_detail?: {
    id: string;
    name: string;
    color: string;
    group: string;
  };
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  require_reviewer: boolean;
  reviewers?: IWorkflowTransitionReviewer[];
  created_at: string;
  updated_at: string;
};

export type IWorkflowTransitionReviewer = {
  id: string;
  transition: string;
  reviewer: string;
  reviewer_detail?: {
    id: string;
    display_name: string;
    avatar?: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
};

export type IWorkflowAssignmentRule = {
  id: string;
  workflow: string;
  condition_field: "label" | "assignee" | "priority" | "custom_field" | "issue_type";
  condition_value: any;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IWorkflowTransitionLog = {
  id: string;
  issue: string;
  workflow: string;
  transition?: string;
  from_state: string;
  from_state_detail?: {
    id: string;
    name: string;
    color: string;
    group: string;
  };
  to_state: string;
  to_state_detail?: {
    id: string;
    name: string;
    color: string;
    group: string;
  };
  reviewer?: string;
  reviewer_detail?: {
    id: string;
    display_name: string;
    avatar?: string;
    first_name: string;
    last_name: string;
  };
  actor: string;
  actor_detail?: {
    id: string;
    display_name: string;
    avatar?: string;
    first_name: string;
    last_name: string;
  };
  comment?: string;
  metadata?: Record<string, any>;
  created_at: string;
};

export type IWorkflowValidation = {
  from_state_id: string;
  to_state_id: string;
  issue_id: string;
  comment?: string;
};

export type IWorkflowValidationResponse = {
  allowed: boolean;
  reason?: string;
  requires_reviewer?: boolean;
  reviewers?: string[];
  transition_id?: string;
};

// Form types for creating/updating workflows
export type IWorkflowTemplateFormData = {
  name: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
};

export type IWorkflowStateFormData = {
  state: string;
  sequence: number;
  allow_new_issues?: boolean;
  conditions?: Record<string, any>;
};

export type IWorkflowTransitionFormData = {
  from_state: string;
  to_state: string;
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  require_reviewer?: boolean;
  reviewer_ids?: string[];
};

export type IWorkflowAssignmentRuleFormData = {
  condition_field: "label" | "assignee" | "priority" | "custom_field" | "issue_type";
  condition_value: any;
  priority?: number;
  is_active?: boolean;
};
