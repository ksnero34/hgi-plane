# Django imports
from django.db import IntegrityError, transaction
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action

# Module imports
from .base import BaseAPIView
from plane.api.serializers.workflow import (
    WorkflowTemplateSerializer,
    WorkflowTemplateDetailSerializer,
    WorkflowStateSerializer,
    WorkflowTransitionSerializer,
    WorkflowTransitionReviewerSerializer,
    WorkflowAssignmentRuleSerializer,
    WorkflowTransitionLogSerializer,
    WorkflowValidationSerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import (
    WorkflowTemplate,
    WorkflowState,
    WorkflowTransition,
    WorkflowTransitionReviewer,
    WorkflowAssignmentRule,
    WorkflowTransitionLog,
    Issue,
    State,
)


class WorkflowTemplateAPIEndpoint(BaseAPIView):
    serializer_class = WorkflowTemplateSerializer
    model = WorkflowTemplate
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            WorkflowTemplate.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project", "workspace", "created_by")
            .prefetch_related("workflow_states", "workflow_transitions", "assignment_rules")
            .distinct()
        )

    def post(self, request, slug, project_id):
        try:
            serializer = WorkflowTemplateSerializer(
                data=request.data, context={"project_id": project_id}
            )
            if serializer.is_valid():
                serializer.save(project_id=project_id, created_by=request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "Workflow with the same name already exists in the project"},
                status=status.HTTP_409_CONFLICT,
            )

    def get(self, request, slug, project_id, workflow_id=None):
        if workflow_id:
            workflow = self.get_queryset().get(pk=workflow_id)
            serializer = WorkflowTemplateDetailSerializer(
                workflow,
                fields=self.fields,
                expand=self.expand,
            )
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda workflows: WorkflowTemplateSerializer(
                workflows, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def patch(self, request, slug, project_id, workflow_id):
        workflow = self.get_queryset().get(pk=workflow_id)
        serializer = WorkflowTemplateSerializer(
            workflow, data=request.data, partial=True, context={"project_id": project_id}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, workflow_id):
        workflow = self.get_queryset().get(pk=workflow_id)
        
        # Check if workflow is being used by any issues
        issue_exists = Issue.issue_objects.filter(workflow=workflow).exists()
        if issue_exists:
            return Response(
                {"error": "Cannot delete workflow that is being used by issues"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        workflow.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def activate(self, request, slug, project_id, workflow_id):
        """Activate a workflow"""
        workflow = self.get_queryset().get(pk=workflow_id)
        workflow.is_active = True
        workflow.save()
        return Response({"message": "Workflow activated successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, slug, project_id, workflow_id):
        """Deactivate a workflow"""
        workflow = self.get_queryset().get(pk=workflow_id)
        workflow.is_active = False
        workflow.save()
        return Response({"message": "Workflow deactivated successfully"}, status=status.HTTP_200_OK)

    def post(self, request, slug, project_id, workflow_id=None):
        if workflow_id and request.path.endswith('/apply-to-all-issues/'):
            return self.apply_to_all_issues(request, slug, project_id, workflow_id)
        return super().post(request, slug, project_id)

    def apply_to_all_issues(self, request, slug, project_id, workflow_id):
        """Apply workflow to all issues in the project"""
        try:
            workflow = self.get_queryset().get(pk=workflow_id)
            
            if not workflow.is_active:
                return Response(
                    {"error": "Cannot apply inactive workflow to issues"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            with transaction.atomic():
                issues_updated = Issue.issue_objects.filter(
                    project_id=project_id,
                    workspace__slug=slug,
                    workflow__isnull=True
                ).update(workflow=workflow)
                
                return Response(
                    {
                        "message": f"Workflow applied to {issues_updated} issues successfully",
                        "issues_updated": issues_updated
                    },
                    status=status.HTTP_200_OK
                )
                
        except WorkflowTemplate.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkflowStateAPIEndpoint(BaseAPIView):
    serializer_class = WorkflowStateSerializer
    model = WorkflowState
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            WorkflowState.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("workflow", "state", "project", "workspace")
            .distinct()
        )

    def post(self, request, slug, project_id, workflow_id):
        try:
            serializer = WorkflowStateSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(
                    project_id=project_id,
                    workflow_id=workflow_id,
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "State already exists in this workflow"},
                status=status.HTTP_409_CONFLICT,
            )

    def get(self, request, slug, project_id, workflow_id, workflow_state_id=None):
        if workflow_state_id:
            workflow_state = self.get_queryset().get(pk=workflow_state_id)
            serializer = WorkflowStateSerializer(workflow_state)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return self.paginate(
            request=request,
            queryset=self.get_queryset().order_by("sequence"),
            on_results=lambda workflow_states: WorkflowStateSerializer(
                workflow_states, many=True
            ).data,
        )

    def patch(self, request, slug, project_id, workflow_id, workflow_state_id):
        workflow_state = self.get_queryset().get(pk=workflow_state_id)
        serializer = WorkflowStateSerializer(workflow_state, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, workflow_id, workflow_state_id):
        workflow_state = self.get_queryset().get(pk=workflow_state_id)
        workflow_state.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowTransitionAPIEndpoint(BaseAPIView):
    serializer_class = WorkflowTransitionSerializer
    model = WorkflowTransition
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            WorkflowTransition.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("workflow", "from_state", "to_state", "project", "workspace")
            .prefetch_related("reviewers")
            .distinct()
        )

    def post(self, request, slug, project_id, workflow_id):
        try:
            with transaction.atomic():
                serializer = WorkflowTransitionSerializer(data=request.data)
                if serializer.is_valid():
                    transition = serializer.save(
                        project_id=project_id,
                        workflow_id=workflow_id,
                    )
                    
                    # Add reviewers if provided
                    reviewer_ids = request.data.get("reviewer_ids", [])
                    if reviewer_ids:
                        # Automatically set require_reviewer=True when reviewers are provided
                        transition.require_reviewer = True
                        transition.save()
                        
                        for reviewer_id in reviewer_ids:
                            WorkflowTransitionReviewer.objects.create(
                                transition=transition,
                                reviewer_id=reviewer_id,
                                project_id=project_id,
                            )
                    
                    return Response(
                        WorkflowTransitionSerializer(transition).data,
                        status=status.HTTP_201_CREATED
                    )
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "Transition already exists between these states"},
                status=status.HTTP_409_CONFLICT,
            )

    def get(self, request, slug, project_id, workflow_id, transition_id=None):
        if transition_id:
            transition = self.get_queryset().get(pk=transition_id)
            serializer = WorkflowTransitionSerializer(transition)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda transitions: WorkflowTransitionSerializer(
                transitions, many=True
            ).data,
        )

    def patch(self, request, slug, project_id, workflow_id, transition_id):
        transition = self.get_queryset().get(pk=transition_id)
        serializer = WorkflowTransitionSerializer(transition, data=request.data, partial=True)
        if serializer.is_valid():
            with transaction.atomic():
                transition = serializer.save()
                
                # Update reviewers if provided
                if "reviewer_ids" in request.data:
                    transition.reviewers.all().delete()
                    reviewer_ids = request.data.get("reviewer_ids", [])
                    
                    if reviewer_ids:
                        # Automatically set require_reviewer=True when reviewers are provided
                        transition.require_reviewer = True
                        transition.save()
                        
                        for reviewer_id in reviewer_ids:
                            WorkflowTransitionReviewer.objects.create(
                                transition=transition,
                                reviewer_id=reviewer_id,
                                project_id=project_id,
                            )
                    else:
                        # No reviewers provided, set require_reviewer=False
                        transition.require_reviewer = False
                        transition.save()
                
                return Response(
                    WorkflowTransitionSerializer(transition).data,
                    status=status.HTTP_200_OK
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, workflow_id, transition_id):
        transition = self.get_queryset().get(pk=transition_id)
        transition.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowAssignmentRuleAPIEndpoint(BaseAPIView):
    serializer_class = WorkflowAssignmentRuleSerializer
    model = WorkflowAssignmentRule
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            WorkflowAssignmentRule.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("workflow", "project", "workspace")
            .distinct()
        )

    def post(self, request, slug, project_id, workflow_id):
        serializer = WorkflowAssignmentRuleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                workflow_id=workflow_id,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, slug, project_id, workflow_id, rule_id=None):
        if rule_id:
            rule = self.get_queryset().get(pk=rule_id)
            serializer = WorkflowAssignmentRuleSerializer(rule)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return self.paginate(
            request=request,
            queryset=self.get_queryset().order_by("-priority"),
            on_results=lambda rules: WorkflowAssignmentRuleSerializer(
                rules, many=True
            ).data,
        )

    def patch(self, request, slug, project_id, workflow_id, rule_id):
        rule = self.get_queryset().get(pk=rule_id)
        serializer = WorkflowAssignmentRuleSerializer(rule, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, workflow_id, rule_id):
        rule = self.get_queryset().get(pk=rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowValidationAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id):
        """Validate if a state transition is allowed according to workflow rules"""
        serializer = WorkflowValidationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        issue_id = serializer.validated_data["issue_id"]
        from_state_id = serializer.validated_data["from_state_id"]
        to_state_id = serializer.validated_data["to_state_id"]

        try:
            issue = Issue.issue_objects.get(
                pk=issue_id,
                project_id=project_id,
                workspace__slug=slug
            )
            
            # If issue has no workflow, allow all transitions
            if not issue.workflow:
                return Response({"allowed": True}, status=status.HTTP_200_OK)

            # Check if transition exists in workflow
            transition = WorkflowTransition.objects.filter(
                workflow=issue.workflow,
                from_state_id=from_state_id,
                to_state_id=to_state_id
            ).first()

            if not transition:
                return Response(
                    {
                        "allowed": False,
                        "reason": "Transition not allowed by workflow rules"
                    },
                    status=status.HTTP_200_OK
                )

            # Check if reviewer is required
            requires_reviewer = transition.require_reviewer
            reviewers = list(transition.reviewers.values_list("reviewer_id", flat=True))

            # Debug logging to help identify the issue
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Workflow validation - Issue ID: {issue_id}, "
                       f"From State: {from_state_id}, To State: {to_state_id}, "
                       f"Workflow ID: {issue.workflow.id if issue.workflow else 'None'}, "
                       f"Transition ID: {transition.id}, "
                       f"require_reviewer: {requires_reviewer}, "
                       f"reviewers_count: {len(reviewers)}, "
                       f"reviewers: {reviewers}")

            return Response(
                {
                    "allowed": True,
                    "requires_reviewer": requires_reviewer,
                    "reviewers": reviewers,
                    "transition_id": transition.id
                },
                status=status.HTTP_200_OK
            )

        except Issue.DoesNotExist:
            return Response(
                {"error": "Issue not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkflowExecutionAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id):
        """Execute a workflow state transition with logging"""
        serializer = WorkflowValidationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        issue_id = serializer.validated_data["issue_id"]
        from_state_id = serializer.validated_data["from_state_id"]
        to_state_id = serializer.validated_data["to_state_id"]
        comment = serializer.validated_data.get("comment", "")

        try:
            with transaction.atomic():
                issue = Issue.issue_objects.get(
                    pk=issue_id,
                    project_id=project_id,
                    workspace__slug=slug
                )
                
                from_state = State.objects.get(pk=from_state_id)
                to_state = State.objects.get(pk=to_state_id)

                # Update issue state
                issue.state = to_state
                issue.save()

                # Log the transition if workflow is active
                if issue.workflow:
                    transition = WorkflowTransition.objects.filter(
                        workflow=issue.workflow,
                        from_state=from_state,
                        to_state=to_state
                    ).first()

                    WorkflowTransitionLog.objects.create(
                        issue=issue,
                        workflow=issue.workflow,
                        transition=transition,
                        from_state=from_state,
                        to_state=to_state,
                        actor=request.user,
                        comment=comment,
                        project_id=project_id,
                    )

                return Response(
                    {"message": "State transition executed successfully"},
                    status=status.HTTP_200_OK
                )

        except (Issue.DoesNotExist, State.DoesNotExist):
            return Response(
                {"error": "Issue or state not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkflowApprovalAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id):
        """Request approval for a workflow state transition"""
        serializer = WorkflowValidationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        issue_id = serializer.validated_data["issue_id"]
        from_state_id = serializer.validated_data["from_state_id"]
        to_state_id = serializer.validated_data["to_state_id"]
        comment = serializer.validated_data.get("comment", "")

        try:
            from plane.db.models import WorkflowApprovalRequest
            
            with transaction.atomic():
                issue = Issue.issue_objects.get(
                    pk=issue_id,
                    project_id=project_id,
                    workspace__slug=slug
                )
                
                # Check if issue has a workflow
                if not issue.workflow:
                    return Response(
                        {"error": "Issue has no workflow assigned"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get transition
                transition = WorkflowTransition.objects.filter(
                    workflow=issue.workflow,
                    from_state_id=from_state_id,
                    to_state_id=to_state_id
                ).first()

                if not transition:
                    return Response(
                        {"error": "Transition not allowed by workflow rules"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not transition.require_reviewer:
                    return Response(
                        {"error": "This transition does not require approval"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Check if there's already a pending request
                existing_request = WorkflowApprovalRequest.objects.filter(
                    issue=issue,
                    transition=transition,
                    status="pending"
                ).first()

                if existing_request:
                    return Response(
                        {
                            "message": "Approval request already exists",
                            "approval_request_id": existing_request.id
                        },
                        status=status.HTTP_200_OK
                    )

                # Create approval request
                approval_request = WorkflowApprovalRequest.objects.create(
                    issue=issue,
                    workflow=issue.workflow,
                    transition=transition,
                    from_state_id=from_state_id,
                    to_state_id=to_state_id,
                    requester=request.user,
                    comment=comment,
                    project_id=project_id,
                )

                # Get reviewers
                reviewers = list(transition.reviewers.values_list("reviewer_id", flat=True))

                return Response(
                    {
                        "message": "Approval request created successfully",
                        "approval_request_id": approval_request.id,
                        "reviewers": reviewers
                    },
                    status=status.HTTP_201_CREATED
                )

        except Issue.DoesNotExist:
            return Response(
                {"error": "Issue not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkflowApprovalActionAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id, approval_request_id):
        """Approve a workflow transition request"""
        try:
            from plane.db.models import WorkflowApprovalRequest
            from django.utils import timezone
            
            with transaction.atomic():
                approval_request = WorkflowApprovalRequest.objects.select_for_update().get(
                    pk=approval_request_id,
                    project_id=project_id,
                    status="pending"
                )

                # Check if current user is authorized to approve
                transition = approval_request.transition
                reviewer_ids = list(transition.reviewers.values_list("reviewer_id", flat=True))
                
                if request.user.id not in reviewer_ids:
                    return Response(
                        {"error": "You are not authorized to approve this transition"},
                        status=status.HTTP_403_FORBIDDEN
                    )

                # Get approval data
                approval_comment = request.data.get("comment", "")
                
                # Update approval request
                approval_request.status = "approved"
                approval_request.approved_by = request.user
                approval_request.approved_at = timezone.now()
                approval_request.approval_comment = approval_comment
                approval_request.save()

                # Execute the transition
                issue = approval_request.issue
                from_state = State.objects.get(pk=approval_request.from_state_id)
                to_state = State.objects.get(pk=approval_request.to_state_id)

                # Update issue state
                issue.state = to_state
                issue.save()

                # Log the transition
                from plane.db.models import WorkflowTransitionLog
                WorkflowTransitionLog.objects.create(
                    issue=issue,
                    workflow=approval_request.workflow,
                    transition=transition,
                    from_state=from_state,
                    to_state=to_state,
                    reviewer=request.user,
                    actor=approval_request.requester,
                    comment=f"Approved by {request.user.display_name}. {approval_comment}".strip(),
                    project_id=project_id,
                )

                return Response(
                    {"message": "Transition approved and executed successfully"},
                    status=status.HTTP_200_OK
                )

        except WorkflowApprovalRequest.DoesNotExist:
            return Response(
                {"error": "Approval request not found or already processed"},
                status=status.HTTP_404_NOT_FOUND
            )
        except State.DoesNotExist:
            return Response(
                {"error": "State not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class WorkflowDebugAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id):
        """Debug endpoint to check workflow configuration"""
        try:
            # Get all workflows in project
            workflows = WorkflowTemplate.objects.filter(
                project_id=project_id,
                workspace__slug=slug
            ).prefetch_related('workflow_transitions__reviewers')
            
            debug_info = []
            for workflow in workflows:
                workflow_info = {
                    "workflow_id": workflow.id,
                    "workflow_name": workflow.name,
                    "is_active": workflow.is_active,
                    "transitions": []
                }
                
                for transition in workflow.workflow_transitions.all():
                    transition_info = {
                        "transition_id": transition.id,
                        "from_state_id": transition.from_state_id,
                        "to_state_id": transition.to_state_id,
                        "require_reviewer": transition.require_reviewer,
                        "reviewers_count": transition.reviewers.count(),
                        "reviewers": list(transition.reviewers.values_list("reviewer_id", flat=True))
                    }
                    workflow_info["transitions"].append(transition_info)
                
                debug_info.append(workflow_info)
            
            return Response(debug_info, status=status.HTTP_200_OK)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Debug endpoint error: {str(e)}")
            return Response(
                {"error": f"Debug endpoint error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )