# Django imports
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
import time

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action

# Background tasks
from plane.bgtasks.issue_activities_task import issue_activity

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
import json
import uuid

# Module imports
from .. import BaseViewSet
from plane.app.serializers import (
    WorkflowTemplateSerializer,
    WorkflowTemplateDetailSerializer,
    WorkflowStateSerializer,
    WorkflowTransitionSerializer,
    WorkflowTransitionReviewerSerializer,
    WorkflowAssignmentRuleSerializer,
    WorkflowTransitionLogSerializer,
    WorkflowValidationSerializer,
)
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    WorkflowTemplate,
    WorkflowState,
    WorkflowTransition,
    WorkflowTransitionReviewer,
    WorkflowAssignmentRule,
    WorkflowApprovalRequest,
    WorkflowTransitionLog,
    Issue,
    State,
    IssueActivity,
)
from plane.utils.cache import invalidate_cache


class WorkflowTemplateViewSet(BaseViewSet):
    serializer_class = WorkflowTemplateSerializer
    model = WorkflowTemplate

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("project", "workspace", "created_by")
            .prefetch_related("workflow_states", "workflow_transitions", "assignment_rules")
            .distinct()
        )

    @invalidate_cache(path="workspaces/:slug/workflows/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
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

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        workflow = self.get_queryset().get(pk=pk)
        serializer = WorkflowTemplateDetailSerializer(workflow)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def list(self, request, slug, project_id):
        workflows = WorkflowTemplateSerializer(self.get_queryset(), many=True).data
        return Response(workflows, status=status.HTTP_200_OK)

    @invalidate_cache(path="workspaces/:slug/workflows/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        workflow = self.get_queryset().get(pk=pk)
        serializer = WorkflowTemplateSerializer(
            workflow, data=request.data, partial=True, context={"project_id": project_id}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @invalidate_cache(path="workspaces/:slug/workflows/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        workflow = self.get_queryset().get(pk=pk)
        
        # Check if workflow is being used by any issues
        issue_exists = Issue.issue_objects.filter(workflow=workflow).exists()
        if issue_exists:
            return Response(
                {"error": "Cannot delete workflow that is being used by issues"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        workflow.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN])
    def activate(self, request, slug, project_id, pk):
        """Activate a workflow"""
        workflow = self.get_queryset().get(pk=pk)
        workflow.is_active = True
        workflow.save()
        return Response({"message": "Workflow activated successfully"}, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def deactivate(self, request, slug, project_id, pk):
        """Deactivate a workflow"""
        workflow = self.get_queryset().get(pk=pk)
        workflow.is_active = False
        workflow.save()
        return Response({"message": "Workflow deactivated successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    @allow_permission([ROLE.ADMIN])
    def apply_to_all_issues(self, request, slug, project_id, pk):
        """Apply this workflow to all issues in the project"""
        workflow = self.get_queryset().get(pk=pk)
        
        # Update all issues in the project to use this workflow
        updated_count = Issue.issue_objects.filter(
            project_id=project_id,
            workspace__slug=slug
        ).update(workflow=workflow)
        
        return Response({
            "message": f"Workflow applied to {updated_count} issues successfully",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)


class WorkflowStateViewSet(BaseViewSet):
    serializer_class = WorkflowStateSerializer
    model = WorkflowState

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("workflow", "state", "project", "workspace")
            .distinct()
        )

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/states/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id, workflow_id):
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

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, workflow_id, pk):
        workflow_state = self.get_queryset().get(pk=pk)
        serializer = WorkflowStateSerializer(workflow_state)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def list(self, request, slug, project_id, workflow_id):
        workflow_states = WorkflowStateSerializer(
            self.get_queryset().order_by("sequence"), many=True
        ).data
        return Response(workflow_states, status=status.HTTP_200_OK)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/states/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, workflow_id, pk):
        workflow_state = self.get_queryset().get(pk=pk)
        serializer = WorkflowStateSerializer(workflow_state, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/states/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, workflow_id, pk):
        workflow_state = self.get_queryset().get(pk=pk)
        workflow_state.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowTransitionViewSet(BaseViewSet):
    serializer_class = WorkflowTransitionSerializer
    model = WorkflowTransition

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("workflow", "from_state", "to_state", "project", "workspace")
            .prefetch_related("reviewers")
            .distinct()
        )

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/transitions/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id, workflow_id):
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
                            try:
                                WorkflowTransitionReviewer.objects.get_or_create(
                                    transition=transition,
                                    reviewer_id=reviewer_id,
                                    defaults={
                                        'project_id': project_id,
                                    }
                                )
                                print(f"Added reviewer {reviewer_id} to transition {transition.id}")
                            except Exception as e:
                                print(f"Error creating reviewer {reviewer_id}: {e}")
                                continue
                    
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

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, workflow_id, pk):
        transition = self.get_queryset().get(pk=pk)
        serializer = WorkflowTransitionSerializer(transition)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def list(self, request, slug, project_id, workflow_id):
        transitions = WorkflowTransitionSerializer(self.get_queryset(), many=True).data
        return Response(transitions, status=status.HTTP_200_OK)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/transitions/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, workflow_id, pk):
        transition = self.get_queryset().get(pk=pk)
        
        # Extract reviewer_ids before serializer processing to avoid it being stripped
        reviewer_ids = request.data.get("reviewer_ids", [])
        has_reviewer_ids = "reviewer_ids" in request.data
        
        print(f"Updating transition {pk} with reviewer_ids: {reviewer_ids}")
        
        serializer = WorkflowTransitionSerializer(transition, data=request.data, partial=True)
        if serializer.is_valid():
            with transaction.atomic():
                transition = serializer.save()
                
                # Update reviewers if provided
                if has_reviewer_ids:
                    print(f"Updating reviewers for transition {transition.id}")
                    
                    # Use raw SQL to force delete all existing reviewers
                    from django.db import connection
                    table_name = WorkflowTransitionReviewer._meta.db_table
                    with connection.cursor() as cursor:
                        cursor.execute(
                            f"DELETE FROM {table_name} WHERE transition_id = %s",
                            [str(transition.id)]
                        )
                        print(f"Force deleted all reviewers from {table_name} for transition {transition.id}")
                    
                    # Now add new reviewers
                    for reviewer_id in reviewer_ids:
                        try:
                            # Try to create directly first
                            reviewer = WorkflowTransitionReviewer(
                                transition=transition,
                                reviewer_id=reviewer_id,
                                project_id=project_id,
                            )
                            reviewer.save()
                            print(f"Created reviewer {reviewer_id} for transition {transition.id}")
                        except Exception as e:
                            print(f"Error creating reviewer {reviewer_id}: {e}")
                            # Try get_or_create as fallback
                            try:
                                obj, created = WorkflowTransitionReviewer.objects.get_or_create(
                                    transition=transition,
                                    reviewer_id=reviewer_id,
                                    defaults={'project_id': project_id}
                                )
                                if created:
                                    print(f"Fallback created reviewer {reviewer_id}")
                                else:
                                    print(f"Fallback found existing reviewer {reviewer_id}")
                            except Exception as e2:
                                print(f"Fallback also failed for reviewer {reviewer_id}: {e2}")
                                continue
                    
                    # Update require_reviewer flag
                    if reviewer_ids:
                        transition.require_reviewer = True
                    else:
                        transition.require_reviewer = False
                    transition.save()
                    print(f"Updated require_reviewer to {transition.require_reviewer}")
                
                return Response(
                    WorkflowTransitionSerializer(transition).data,
                    status=status.HTTP_200_OK
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/transitions/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, workflow_id, pk):
        transition = self.get_queryset().get(pk=pk)
        transition.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowAssignmentRuleViewSet(BaseViewSet):
    serializer_class = WorkflowAssignmentRuleSerializer
    model = WorkflowAssignmentRule

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workflow_id=self.kwargs.get("workflow_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("workflow", "project", "workspace")
            .distinct()
        )

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/assignment-rules/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id, workflow_id):
        serializer = WorkflowAssignmentRuleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                workflow_id=workflow_id,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, workflow_id, pk):
        rule = self.get_queryset().get(pk=pk)
        serializer = WorkflowAssignmentRuleSerializer(rule)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def list(self, request, slug, project_id, workflow_id):
        rules = WorkflowAssignmentRuleSerializer(
            self.get_queryset().order_by("-priority"), many=True
        ).data
        return Response(rules, status=status.HTTP_200_OK)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/assignment-rules/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, workflow_id, pk):
        rule = self.get_queryset().get(pk=pk)
        serializer = WorkflowAssignmentRuleSerializer(rule, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @invalidate_cache(path="workspaces/:slug/workflows/:workflow_id/assignment-rules/", url_params=True, user=False)
    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, workflow_id, pk):
        rule = self.get_queryset().get(pk=pk)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowValidationViewSet(BaseViewSet):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED])
    def validate_transition(self, request, slug, project_id):
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
                # If no specific transition rule exists, allow the transition
                return Response({"allowed": True}, status=status.HTTP_200_OK)

            # Check if reviewer is required
            requires_reviewer = transition.require_reviewer
            reviewers = list(transition.reviewers.values_list("reviewer_id", flat=True))

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

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def execute_transition(self, request, slug, project_id):
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

                # Create issue activity for state change
                current_epoch = time.time()
                IssueActivity.objects.create(
                    issue=issue,
                    actor=request.user,
                    verb="updated",
                    old_value=from_state.name,
                    new_value=to_state.name,
                    field="state",
                    project_id=project_id,
                    workspace_id=issue.workspace_id,
                    comment="updated the state to",
                    old_identifier=from_state.id,
                    new_identifier=to_state.id,
                    epoch=current_epoch,
                )

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

                # Note: No notifications for direct workflow transitions
                # Notifications are only sent for approved transitions

                return Response(
                    {"message": "State transition executed successfully"},
                    status=status.HTTP_200_OK
                )

        except (Issue.DoesNotExist, State.DoesNotExist):
            return Response(
                {"error": "Issue or state not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED])
    def request_approval(self, request, slug, project_id):
        """Request approval for a workflow state transition"""
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
                    # If the same user is requesting again, return the existing request
                    if existing_request.requester == request.user:
                        return Response(
                            {
                                "message": "Approval request already exists",
                                "approval_request_id": existing_request.id
                            },
                            status=status.HTTP_200_OK
                        )
                    else:
                        # Different user is requesting - cancel the existing request and create a new one
                        existing_request.status = "cancelled"
                        existing_request.save()
                        
                        # Continue to create new request

                # Get state objects
                from_state = State.objects.get(pk=from_state_id)
                to_state = State.objects.get(pk=to_state_id)
                
                # Create approval request
                approval_request = WorkflowApprovalRequest.objects.create(
                    issue=issue,
                    workflow=issue.workflow,
                    transition=transition,
                    from_state=from_state,
                    to_state=to_state,
                    requester=request.user,
                    comment=comment,
                    project_id=project_id,
                )

                # Send notifications to reviewers
                reviewers = list(transition.reviewers.values_list("reviewer_id", flat=True))
                
                # 알림 전송 (비동기)
                if reviewers:
                    from plane.bgtasks.notification_task import workflow_approval_request_notifications
                    workflow_approval_request_notifications.delay(
                        approval_request_id=str(approval_request.id),
                        project_id=str(project_id),
                        actor_id=str(request.user.id),
                    )

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
        except State.DoesNotExist:
            return Response(
                {"error": "State not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED])
    def list_approval_requests(self, request, slug, project_id):
        """List all approval requests in the project with pagination"""
        try:
            # Get pagination parameters
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 10))
            
            # Get filter parameters
            filter_status = request.GET.get('filter_status', 'all')  # all, pending, my_review
            search_term = request.GET.get('search', '').strip()
            sort_order = request.GET.get('sort', 'newest')  # newest, oldest, priority
            
            # Validate page_size
            if page_size < 1:
                page_size = 10
            elif page_size > 100:
                page_size = 100
            
            # Get all approval requests in the project (visible to all project members)
            approval_requests_qs = WorkflowApprovalRequest.objects.filter(
                project_id=project_id,
                status__in=["pending", "approved", "rejected", "cancelled"]
            ).select_related(
                "issue", "workflow", "transition", "from_state", "to_state", 
                "requester", "approved_by"
            ).prefetch_related(
                "transition__reviewers__reviewer"
            ).distinct()
            
            # Apply filters
            if filter_status == "pending":
                approval_requests_qs = approval_requests_qs.filter(status="pending")
            elif filter_status == "my_review":
                # Only show requests where current user is a reviewer and status is pending
                approval_requests_qs = approval_requests_qs.filter(
                    transition__reviewers__reviewer=request.user,
                    status="pending"
                )
            
            # Apply search filter
            if search_term:
                from django.db.models import Q
                approval_requests_qs = approval_requests_qs.filter(
                    Q(issue__name__icontains=search_term) |
                    Q(requester__display_name__icontains=search_term) |
                    Q(issue__sequence_id__icontains=search_term)
                )
            
            # Apply sorting
            if sort_order == "oldest":
                approval_requests_qs = approval_requests_qs.order_by("created_at")
            elif sort_order == "priority":
                # Sort by pending status first, then by creation date (newest first)
                approval_requests_qs = approval_requests_qs.extra(
                    select={
                        'is_pending': "CASE WHEN status = 'pending' THEN 0 ELSE 1 END"
                    }
                ).order_by('is_pending', '-created_at')
            else:  # newest (default)
                approval_requests_qs = approval_requests_qs.order_by("-created_at")
            
            # Get total count before pagination
            total_count = approval_requests_qs.count()
            
            # Get count of requests that current user can approve (from filtered results)
            if filter_status == "my_review":
                # If already filtered for my_review, all results are approvable
                can_approve_count = total_count
            else:
                # Count requests where current user is a reviewer and status is pending
                can_approve_count = WorkflowApprovalRequest.objects.filter(
                    project_id=project_id,
                    status="pending",
                    transition__reviewers__reviewer=request.user,
                ).count()
            
            # Apply pagination
            from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
            paginator = Paginator(approval_requests_qs, page_size)
            
            try:
                approval_requests = paginator.page(page)
            except PageNotAnInteger:
                approval_requests = paginator.page(1)
            except EmptyPage:
                approval_requests = paginator.page(paginator.num_pages)

            response_data = []
            for request_obj in approval_requests:
                # Check if current user is a reviewer for this transition
                is_reviewer = request_obj.transition.reviewers.filter(reviewer=request.user).exists()
                can_approve = is_reviewer and request_obj.status == "pending"
                
                # Get all reviewers for this transition
                reviewers = [
                    {
                        "id": reviewer.reviewer.id,
                        "display_name": reviewer.reviewer.display_name,
                        "email": reviewer.reviewer.email
                    }
                    for reviewer in request_obj.transition.reviewers.all()
                ]

                response_data.append({
                    "id": request_obj.id,
                    "issue": {
                        "id": request_obj.issue.id,
                        "name": request_obj.issue.name,
                        "sequence_id": request_obj.issue.sequence_id
                    },
                    "workflow": {
                        "id": request_obj.workflow.id,
                        "name": request_obj.workflow.name
                    },
                    "transition": {
                        "id": request_obj.transition.id,
                        "from_state": {
                            "id": request_obj.from_state.id,
                            "name": request_obj.from_state.name,
                            "color": request_obj.from_state.color
                        },
                        "to_state": {
                            "id": request_obj.to_state.id,
                            "name": request_obj.to_state.name,
                            "color": request_obj.to_state.color
                        }
                    },
                    "requester": {
                        "id": request_obj.requester.id,
                        "display_name": request_obj.requester.display_name,
                        "email": request_obj.requester.email
                    },
                    "reviewers": reviewers,
                    "status": request_obj.status,
                    "comment": request_obj.comment,
                    "approved_by": {
                        "id": request_obj.approved_by.id,
                        "display_name": request_obj.approved_by.display_name,
                        "email": request_obj.approved_by.email
                    } if request_obj.approved_by else None,
                    "approved_at": request_obj.approved_at,
                    "approval_comment": request_obj.approval_comment,
                    "created_at": request_obj.created_at,
                    "is_reviewer": is_reviewer,
                    "can_approve": can_approve
                })

            # Return paginated response
            return Response({
                "count": total_count,
                "can_approve_count": can_approve_count,
                "page": page,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "next": approval_requests.has_next(),
                "previous": approval_requests.has_previous(),
                "results": response_data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Error fetching approval requests: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def approve_transition(self, request, slug, project_id, approval_request_id):
        """Approve a workflow transition request"""
        try:
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

                # 본인이 요청자인 경우 바로 승인하지 않고 승인 요청을 만들도록 처리
                # 하지만 이미 승인 요청이 있는 상태이므로 일반적인 승인 프로세스를 진행
                
                # Get approval data
                approval_comment = request.data.get("comment", "").strip()
                
                # 승인 코멘트가 필수가 되도록 검증 (본인 승인인 경우 기본 메시지 허용)
                if not approval_comment:
                    if request.user.id == approval_request.requester.id:
                        approval_comment = "본인 승인 (자가 검토 완료)"
                    else:
                        return Response(
                            {"error": "승인 사유를 입력해야 합니다."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Update approval request
                approval_request.status = "approved"
                approval_request.approved_by = request.user
                approval_request.approved_at = timezone.now()
                approval_request.approval_comment = approval_comment
                approval_request.save()

                # Execute the transition
                issue = approval_request.issue
                from_state = approval_request.from_state
                to_state = approval_request.to_state

                # Capture basic issue state for notifications (before change)
                # Using minimal data to avoid serialization issues
                current_instance = json.dumps({
                    "id": str(issue.id),
                    "name": issue.name,
                    "state": str(from_state.id),
                    "project": str(issue.project_id),
                    "assignees": [str(a.id) for a in issue.assignees.all()],
                    "labels": [str(l.id) for l in issue.labels.all()],
                }, cls=DjangoJSONEncoder)
                
                # Capture requested changes
                requested_data = json.dumps({"state": str(to_state.id)}, cls=DjangoJSONEncoder)

                # Update issue state
                issue.state = to_state
                issue.save()

                # Create issue activity for state change
                current_epoch = time.time()
                
                # 본인 승인인지 확인하여 메시지 차별화
                if request.user.id == approval_request.requester.id:
                    activity_comment = f"updated the state to (self-approved by {request.user.display_name})"
                else:
                    activity_comment = f"updated the state to (approved by {request.user.display_name})"
                
                if approval_comment:
                    activity_comment += f" - {approval_comment}"
                
                # 워크플로우 승인을 별도 필드로 표시하기 위한 추가 데이터 생성
                workflow_approval_data = {
                    "approver_id": str(request.user.id),
                    "approver_name": request.user.display_name,
                    "approval_comment": approval_comment,
                    "is_self_approval": request.user.id == approval_request.requester.id,
                    "approval_request_id": str(approval_request.id)
                }
                
                # JSON 데이터를 문자열로 직렬화하여 저장
                workflow_approval_json = json.dumps(workflow_approval_data, cls=DjangoJSONEncoder)
                
                IssueActivity.objects.create(
                    issue=issue,
                    actor=approval_request.requester,  # Show as requester's action
                    verb="updated",
                    old_value=from_state.name,
                    new_value=f"{to_state.name}|{workflow_approval_json}",  # 상태명과 JSON 데이터를 구분자로 연결
                    field="state",
                    project_id=project_id,
                    workspace_id=issue.workspace_id,
                    comment=activity_comment,
                    old_identifier=from_state.id,
                    new_identifier=to_state.id,
                    epoch=current_epoch,
                )
                
                # Create separate activity for approval with approver information
                if request.user.id == approval_request.requester.id:
                    approval_activity_comment = f"self-approved the state transition"
                else:
                    approval_activity_comment = f"approved the state transition"
                
                if approval_comment:
                    approval_activity_comment += f": {approval_comment}"
                
                IssueActivity.objects.create(
                    issue=issue,
                    actor=request.user,  # Show as approver's action
                    verb="approved",
                    old_value=from_state.name,
                    new_value=to_state.name,
                    field="workflow_approval",
                    project_id=project_id,
                    workspace_id=issue.workspace_id,
                    comment=approval_activity_comment,
                    old_identifier=from_state.id,
                    new_identifier=to_state.id,
                    epoch=current_epoch,
                )

                # Log the transition
                log_comment = f"Approved by {request.user.display_name}"
                if request.user.id == approval_request.requester.id:
                    log_comment = f"Self-approved by {request.user.display_name}"
                
                if approval_comment:
                    log_comment += f". {approval_comment}"
                
                WorkflowTransitionLog.objects.create(
                    issue=issue,
                    workflow=approval_request.workflow,
                    transition=transition,
                    from_state=from_state,
                    to_state=to_state,
                    reviewer=request.user,
                    actor=approval_request.requester,
                    comment=log_comment.strip(),
                    project_id=project_id,
                )

                # Create direct notification for workflow approval
                from plane.bgtasks.notification_task import notifications
                
                # 알림 메시지도 본인 승인인지에 따라 차별화
                notification_comment = f"updated the state to (approved by {request.user.display_name})"
                if request.user.id == approval_request.requester.id:
                    notification_comment = f"updated the state to (self-approved by {request.user.display_name})"
                
                # Create activity data that matches expected format
                activity_data = [{
                    "id": str(uuid.uuid4()),
                    "issue": str(issue.id),
                    "actor": str(approval_request.requester.id),
                    "verb": "updated",
                    "field": "state",
                    "old_value": from_state.name,
                    "new_value": to_state.name,
                    "old_identifier": str(from_state.id),
                    "new_identifier": str(to_state.id),
                    "comment": notification_comment,
                    "epoch": current_epoch,
                }]
                
                # Call notification task directly with proper data
                notifications.delay(
                    type="issue.activity.updated",
                    issue_id=str(issue.id),
                    project_id=str(project_id),
                    actor_id=str(approval_request.requester.id),
                    subscriber=True,
                    issue_activities_created=json.dumps(activity_data, cls=DjangoJSONEncoder),
                    requested_data=requested_data,
                    current_instance=current_instance,
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

    @action(detail=False, methods=["post"], url_path="reject-transition/(?P<approval_request_id>[^/.]+)")
    def reject_transition(self, request, slug, project_id, approval_request_id):
        """
        Reject a workflow transition request
        """
        try:
            with transaction.atomic():
                # Get the approval request
                approval_request = WorkflowApprovalRequest.objects.select_for_update().get(
                    id=approval_request_id,
                    project_id=project_id,
                    status="pending"
                )
                
                # Check if user is authorized to reject this request
                transition_reviewers = WorkflowTransitionReviewer.objects.filter(
                    transition=approval_request.transition,
                    reviewer=request.user
                )
                
                if not transition_reviewers.exists():
                    return Response(
                        {"error": "You are not authorized to reject this transition"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Get rejection comment
                rejection_comment = request.data.get("comment", "").strip()
                
                # 거부 코멘트는 필수
                if not rejection_comment:
                    return Response(
                        {"error": "거부 사유를 입력해야 합니다."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Update approval request status to rejected
                approval_request.status = "rejected"
                approval_request.approved_by = request.user
                approval_request.approved_at = timezone.now()
                approval_request.approval_comment = rejection_comment
                approval_request.save()
                
                # Get issue and states for logging
                issue = approval_request.issue
                from_state = approval_request.from_state
                to_state = approval_request.to_state
                
                # Create issue activity for rejection
                current_epoch = time.time()
                rejection_activity_comment = f"rejected the state transition from {from_state.name} to {to_state.name}"
                if rejection_comment:
                    rejection_activity_comment += f": {rejection_comment}"
                
                IssueActivity.objects.create(
                    issue=issue,
                    actor=request.user,
                    verb="rejected",
                    old_value=from_state.name,
                    new_value=to_state.name,
                    field="workflow_rejection",
                    project_id=project_id,
                    workspace_id=issue.workspace_id,
                    comment=rejection_activity_comment,
                    old_identifier=from_state.id,
                    new_identifier=to_state.id,
                    epoch=current_epoch,
                )
                
                # Create workflow transition log
                WorkflowTransitionLog.objects.create(
                    issue=issue,
                    workflow=approval_request.transition.workflow,
                    transition=approval_request.transition,
                    from_state=from_state,
                    to_state=to_state,
                    actor=approval_request.requester,
                    reviewer=request.user,
                    comment=rejection_comment,
                    project_id=project_id,
                )
                
                return Response(
                    {"message": "Transition rejected successfully"},
                    status=status.HTTP_200_OK
                )
                
        except WorkflowApprovalRequest.DoesNotExist:
            return Response(
                {"error": "Approval request not found or already processed"},
                status=status.HTTP_404_NOT_FOUND
            )