# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from .state import StateLiteSerializer
from .user import UserLiteSerializer
from plane.db.models import (
    WorkflowTemplate,
    WorkflowState,
    WorkflowTransition,
    WorkflowTransitionReviewer,
    WorkflowAssignmentRule,
    WorkflowTransitionLog,
)


class WorkflowTemplateSerializer(BaseSerializer):
    created_by_detail = UserLiteSerializer(source="created_by", read_only=True)
    total_states = serializers.SerializerMethodField()
    total_transitions = serializers.SerializerMethodField()
    
    class Meta:
        model = WorkflowTemplate
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "is_default",
            "created_by",
            "created_by_detail",
            "created_at",
            "updated_at",
            "total_states",
            "total_transitions",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
            "workspace",
            "project",
            "total_states",
            "total_transitions",
        ]

    def get_total_states(self, obj):
        return obj.workflow_states.count()

    def get_total_transitions(self, obj):
        return obj.workflow_transitions.count()

    def validate(self, data):
        # If the default is being provided then make all other workflows default False
        if data.get("is_default", False):
            WorkflowTemplate.objects.filter(
                project_id=self.context.get("project_id")
            ).update(is_default=False)
        return data


class WorkflowStateSerializer(BaseSerializer):
    state_detail = StateLiteSerializer(source="state", read_only=True)
    
    class Meta:
        model = WorkflowState
        fields = [
            "id",
            "workflow",
            "state",
            "state_detail",
            "sequence",
            "allow_new_issues",
            "conditions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workflow",
            "created_at",
            "updated_at",
            "workspace",
            "project",
        ]


class WorkflowTransitionReviewerSerializer(BaseSerializer):
    reviewer_detail = UserLiteSerializer(source="reviewer", read_only=True)
    
    class Meta:
        model = WorkflowTransitionReviewer
        fields = [
            "id",
            "transition",
            "reviewer",
            "reviewer_detail",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "workspace",
            "project",
        ]


class WorkflowTransitionSerializer(BaseSerializer):
    from_state_detail = StateLiteSerializer(source="from_state", read_only=True)
    to_state_detail = StateLiteSerializer(source="to_state", read_only=True)
    reviewers = WorkflowTransitionReviewerSerializer(many=True, read_only=True)
    
    class Meta:
        model = WorkflowTransition
        fields = [
            "id",
            "workflow",
            "from_state",
            "from_state_detail",
            "to_state",
            "to_state_detail",
            "conditions",
            "actions",
            "require_reviewer",
            "reviewers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workflow",
            "created_at",
            "updated_at",
            "workspace",
            "project",
        ]


class WorkflowAssignmentRuleSerializer(BaseSerializer):
    class Meta:
        model = WorkflowAssignmentRule
        fields = [
            "id",
            "workflow",
            "condition_field",
            "condition_value",
            "priority",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "workspace",
            "project",
        ]


class WorkflowTransitionLogSerializer(BaseSerializer):
    from_state_detail = StateLiteSerializer(source="from_state", read_only=True)
    to_state_detail = StateLiteSerializer(source="to_state", read_only=True)
    reviewer_detail = UserLiteSerializer(source="reviewer", read_only=True)
    actor_detail = UserLiteSerializer(source="actor", read_only=True)
    
    class Meta:
        model = WorkflowTransitionLog
        fields = [
            "id",
            "issue",
            "workflow",
            "transition",
            "from_state",
            "from_state_detail",
            "to_state",
            "to_state_detail",
            "reviewer",
            "reviewer_detail",
            "actor",
            "actor_detail",
            "comment",
            "metadata",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "workspace",
            "project",
        ]


# Detailed serializers for workflow management
class WorkflowTemplateDetailSerializer(WorkflowTemplateSerializer):
    workflow_states = WorkflowStateSerializer(many=True, read_only=True)
    workflow_transitions = WorkflowTransitionSerializer(many=True, read_only=True)
    assignment_rules = WorkflowAssignmentRuleSerializer(many=True, read_only=True)
    
    class Meta(WorkflowTemplateSerializer.Meta):
        fields = WorkflowTemplateSerializer.Meta.fields + [
            "workflow_states",
            "workflow_transitions", 
            "assignment_rules",
        ]


class WorkflowValidationSerializer(BaseSerializer):
    """Serializer for validating workflow state transitions"""
    from_state_id = serializers.UUIDField()
    to_state_id = serializers.UUIDField()
    issue_id = serializers.UUIDField()
    comment = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = WorkflowTransitionLog
        fields = [
            "from_state_id",
            "to_state_id", 
            "issue_id",
            "comment",
        ]