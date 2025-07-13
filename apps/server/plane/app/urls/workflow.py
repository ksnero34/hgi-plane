from django.urls import path


from plane.app.views import (
    WorkflowTemplateViewSet,
    WorkflowStateViewSet,
    WorkflowTransitionViewSet,
    WorkflowAssignmentRuleViewSet,
    WorkflowValidationViewSet,
)


urlpatterns = [
    # Workflow Templates
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/",
        WorkflowTemplateViewSet.as_view(
            {
                "get": "list",
                "post": "create",
            }
        ),
        name="workflows",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:pk>/",
        WorkflowTemplateViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="workflow",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:pk>/activate/",
        WorkflowTemplateViewSet.as_view({"post": "activate"}),
        name="workflow-activate",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:pk>/deactivate/",
        WorkflowTemplateViewSet.as_view({"post": "deactivate"}),
        name="workflow-deactivate",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:pk>/apply-to-all-issues/",
        WorkflowTemplateViewSet.as_view({"post": "apply_to_all_issues"}),
        name="workflow-apply-to-all-issues",
    ),
    
    # Workflow States
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/states/",
        WorkflowStateViewSet.as_view(
            {
                "get": "list",
                "post": "create",
            }
        ),
        name="workflow-states",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/states/<uuid:pk>/",
        WorkflowStateViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="workflow-state",
    ),
    
    # Workflow Transitions
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/transitions/",
        WorkflowTransitionViewSet.as_view(
            {
                "get": "list",
                "post": "create",
            }
        ),
        name="workflow-transitions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/transitions/<uuid:pk>/",
        WorkflowTransitionViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="workflow-transition",
    ),
    
    # Workflow Assignment Rules
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/assignment-rules/",
        WorkflowAssignmentRuleViewSet.as_view(
            {
                "get": "list",
                "post": "create",
            }
        ),
        name="workflow-assignment-rules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/<uuid:workflow_id>/assignment-rules/<uuid:pk>/",
        WorkflowAssignmentRuleViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="workflow-assignment-rule",
    ),
    
    # Workflow Validation
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/validate-transition/",
        WorkflowValidationViewSet.as_view({"post": "validate_transition"}),
        name="workflow-validate-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/execute-transition/",
        WorkflowValidationViewSet.as_view({"post": "execute_transition"}),
        name="workflow-execute-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/request-approval/",
        WorkflowValidationViewSet.as_view({"post": "request_approval"}),
        name="workflow-request-approval",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/approve-transition/<uuid:approval_request_id>/",
        WorkflowValidationViewSet.as_view({"post": "approve_transition"}),
        name="workflow-approve-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/approval-requests/",
        WorkflowValidationViewSet.as_view({"get": "list_approval_requests"}),
        name="workflow-approval-requests",
    ),
]