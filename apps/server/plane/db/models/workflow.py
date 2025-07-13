# Python imports
import uuid

# Django imports
from django.db import models
from django.conf import settings

# Module imports
from .base import BaseModel
from .project import ProjectBaseModel
from .state import State
from .user import User


class WorkflowTemplate(ProjectBaseModel):
    """
    Workflow template that defines the workflow structure for issues in a project
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_workflows",
    )
    
    class Meta:
        verbose_name = "Workflow Template"
        verbose_name_plural = "Workflow Templates"
        db_table = "workflow_templates"
        ordering = ("-created_at",)
        unique_together = [["project", "name"]]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class WorkflowState(ProjectBaseModel):
    """
    Workflow states that define which states are part of a workflow
    """
    workflow = models.ForeignKey(
        WorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="workflow_states",
    )
    state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="workflow_states",
    )
    sequence = models.IntegerField()
    allow_new_issues = models.BooleanField(default=True)
    conditions = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Workflow State"
        verbose_name_plural = "Workflow States"
        db_table = "workflow_states"
        ordering = ("sequence",)
        unique_together = [["workflow", "state"], ["workflow", "sequence"]]

    def __str__(self):
        return f"{self.workflow.name} - {self.state.name}"


class WorkflowTransition(ProjectBaseModel):
    """
    Workflow transitions that define allowed state changes
    """
    workflow = models.ForeignKey(
        WorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="workflow_transitions",
    )
    from_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="outgoing_transitions",
    )
    to_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="incoming_transitions",
    )
    conditions = models.JSONField(default=dict, blank=True)
    actions = models.JSONField(default=dict, blank=True)
    require_reviewer = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = "Workflow Transition"
        verbose_name_plural = "Workflow Transitions"
        db_table = "workflow_transitions"
        ordering = ("-created_at",)
        unique_together = [["workflow", "from_state", "to_state"]]

    def __str__(self):
        return f"{self.workflow.name}: {self.from_state.name} → {self.to_state.name}"


class WorkflowTransitionReviewer(ProjectBaseModel):
    """
    Reviewers required for specific workflow transitions
    """
    transition = models.ForeignKey(
        WorkflowTransition,
        on_delete=models.CASCADE,
        related_name="reviewers",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviewing_transitions",
    )

    class Meta:
        verbose_name = "Workflow Transition Reviewer"
        verbose_name_plural = "Workflow Transition Reviewers"
        db_table = "workflow_transition_reviewers"
        unique_together = [["transition", "reviewer"]]

    def __str__(self):
        return f"{self.transition} - {self.reviewer.display_name}"


class WorkflowAssignmentRule(ProjectBaseModel):
    """
    Rules for automatically assigning workflows to issues based on conditions
    """
    CONDITION_CHOICES = [
        ("label", "Label"),
        ("assignee", "Assignee"),
        ("priority", "Priority"),
        ("custom_field", "Custom Field"),
        ("issue_type", "Issue Type"),
    ]
    
    workflow = models.ForeignKey(
        WorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="assignment_rules",
    )
    condition_field = models.CharField(max_length=100, choices=CONDITION_CHOICES)
    condition_value = models.JSONField()
    priority = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Workflow Assignment Rule"
        verbose_name_plural = "Workflow Assignment Rules"
        db_table = "workflow_assignment_rules"
        ordering = ("-priority", "-created_at")

    def __str__(self):
        return f"{self.workflow.name} - {self.condition_field}: {self.condition_value}"


class WorkflowApprovalRequest(ProjectBaseModel):
    """
    Represents a pending approval request for workflow transitions
    """
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="workflow_approval_requests",
    )
    workflow = models.ForeignKey(
        WorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="approval_requests",
    )
    transition = models.ForeignKey(
        WorkflowTransition,
        on_delete=models.CASCADE,
        related_name="approval_requests",
    )
    from_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="from_approval_requests",
    )
    to_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="to_approval_requests",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_approvals",
    )
    comment = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("expired", "Expired"),
        ],
        default="pending",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="approved_requests",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comment = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Workflow Approval Request"
        verbose_name_plural = "Workflow Approval Requests"
        db_table = "workflow_approval_requests"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} - {self.from_state.name} → {self.to_state.name}"


class WorkflowTransitionLog(ProjectBaseModel):
    """
    Log of workflow transitions for audit purposes
    """
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="workflow_transition_logs",
    )
    workflow = models.ForeignKey(
        WorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="transition_logs",
    )
    transition = models.ForeignKey(
        WorkflowTransition,
        on_delete=models.CASCADE,
        related_name="transition_logs",
        null=True,
        blank=True,
    )
    from_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="from_transition_logs",
    )
    to_state = models.ForeignKey(
        State,
        on_delete=models.CASCADE,
        related_name="to_transition_logs",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviewed_transitions",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="performed_transitions",
    )
    comment = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Workflow Transition Log"
        verbose_name_plural = "Workflow Transition Logs"
        db_table = "workflow_transition_logs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name}: {self.from_state.name} → {self.to_state.name}"