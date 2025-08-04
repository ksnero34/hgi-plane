from django.urls import path

from plane.api.views.workflow import (
    WorkflowTemplateAPIEndpoint,
    WorkflowStateAPIEndpoint,
    WorkflowTransitionAPIEndpoint,
    WorkflowAssignmentRuleAPIEndpoint,
    WorkflowValidationAPIEndpoint,
    WorkflowExecutionAPIEndpoint,
    WorkflowApprovalAPIEndpoint,
    WorkflowApprovalActionAPIEndpoint,
    WorkflowDebugAPIEndpoint,
)

urlpatterns = [
    # Workflow Templates
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/",
        WorkflowTemplateAPIEndpoint.as_view(),
        name="workflows",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/",
        WorkflowTemplateAPIEndpoint.as_view(),
        name="workflow",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/activate/",
        WorkflowTemplateAPIEndpoint.as_view(),
        name="workflow-activate",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/deactivate/",
        WorkflowTemplateAPIEndpoint.as_view(),
        name="workflow-deactivate",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/apply-to-all-issues/",
        WorkflowTemplateAPIEndpoint.as_view(),
        name="workflow-apply-to-all-issues",
    ),
    
    # Workflow States
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/states/",
        WorkflowStateAPIEndpoint.as_view(),
        name="workflow-states",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/states/<uuid:workflow_state_id>/",
        WorkflowStateAPIEndpoint.as_view(),
        name="workflow-state",
    ),
    
    # Workflow Transitions
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/transitions/",
        WorkflowTransitionAPIEndpoint.as_view(),
        name="workflow-transitions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/transitions/<uuid:transition_id>/",
        WorkflowTransitionAPIEndpoint.as_view(),
        name="workflow-transition",
    ),
    
    # Workflow Assignment Rules
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/assignment-rules/",
        WorkflowAssignmentRuleAPIEndpoint.as_view(),
        name="workflow-assignment-rules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/assignment-rules/<uuid:rule_id>/",
        WorkflowAssignmentRuleAPIEndpoint.as_view(),
        name="workflow-assignment-rule",
    ),
    
    # Workflow Validation and Execution
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/validate-transition/",
        WorkflowValidationAPIEndpoint.as_view(),
        name="workflow-validate-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/execute-transition/",
        WorkflowExecutionAPIEndpoint.as_view(),
        name="workflow-execute-transition",
    ),
    
    # Workflow Approval
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/request-approval/",
        WorkflowApprovalAPIEndpoint.as_view(),
        name="workflow-request-approval",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/approve-transition/<uuid:approval_request_id>/",
        WorkflowApprovalActionAPIEndpoint.as_view(),
        name="workflow-approve-transition",
    ),
    
    # Debug endpoint
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/debug/",
        WorkflowDebugAPIEndpoint.as_view(),
        name="workflow-debug",
    ),
]