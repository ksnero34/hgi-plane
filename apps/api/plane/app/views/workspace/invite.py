# Python imports
from datetime import datetime

import jwt

# Django imports
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone

# Third party modules
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# Module imports
from plane.app.permissions import WorkSpaceAdminPermission
from plane.app.serializers import (
    WorkSpaceMemberInviteSerializer,
    WorkSpaceMemberSerializer,
)
from plane.app.views.base import BaseAPIView
from plane.bgtasks.event_tracking_task import workspace_invite_event
from plane.bgtasks.workspace_invitation_task import workspace_invitation, process_auto_accept_invitation
from plane.db.models import User, Workspace, WorkspaceMember, WorkspaceMemberInvite
from plane.utils.cache import invalidate_cache, invalidate_cache_directly
from plane.utils.audit_logger import log_audit
from plane.bgtasks.java_notification_task import send_java_notification

from plane.utils.host import base_host
from plane.utils.ip_address import get_client_ip
from .. import BaseViewSet


class WorkspaceInvitationsViewset(BaseViewSet):
    """Endpoint for creating, listing and  deleting workspaces"""

    serializer_class = WorkSpaceMemberInviteSerializer
    model = WorkspaceMemberInvite

    permission_classes = [WorkSpaceAdminPermission]

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "workspace__owner", "created_by")
        )

    def create(self, request, slug):
        emails = request.data.get("emails", [])
        auto_accept = request.data.get("auto_accept", False)

        if not emails:
            return Response(
                {"error": "Emails are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # check for role level of the requesting user
        requesting_user = WorkspaceMember.objects.get(
            workspace__slug=slug, member=request.user, is_active=True
        )

        # Check if any invited user has an higher role
        if len(
            [
                email
                for email in emails
                if int(email.get("role", 5)) > requesting_user.role
            ]
        ):
            return Response(
                {"error": "You cannot invite a user with higher role"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the workspace object
        workspace = Workspace.objects.get(slug=slug)

        # Check if user is already a member of workspace
        workspace_members = WorkspaceMember.objects.filter(
            workspace_id=workspace.id,
            member__email__in=[email.get("email") for email in emails],
            is_active=True,
        ).select_related("member", "workspace", "workspace__owner")

        if workspace_members:
            return Response(
                {
                    "error": "Some users are already member of workspace",
                    "workspace_users": WorkSpaceMemberSerializer(
                        workspace_members, many=True
                    ).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace_invitations = []
        for email in emails:
            try:
                validate_email(email.get("email"))
                # 자동 수락 옵션이 활성화된 경우
                if auto_accept:
                    # worker에서 처리하도록 task 호출
                    process_auto_accept_invitation.delay(
                        email_data=email,
                        workspace_id=workspace.id,
                        inviter_id=request.user.id
                    )
                    continue
                
                # 자동 수락이 아니거나 해당 사용자가 없는 경우 초대장 생성
                workspace_invitations.append(
                    WorkspaceMemberInvite(
                        email=email.get("email").strip().lower(),
                        workspace_id=workspace.id,
                        token=jwt.encode(
                            {"email": email, "timestamp": datetime.now().timestamp()},
                            settings.SECRET_KEY,
                            algorithm="HS256",
                        ),
                        role=email.get("role", 5),
                        created_by=request.user,
                    )
                )
            except ValidationError:
                return Response(
                    {
                        "error": f"Invalid email - {email} provided a valid email address is required to send the invite"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # Create workspace member invite
        workspace_invitations = WorkspaceMemberInvite.objects.bulk_create(
            workspace_invitations, batch_size=10, ignore_conflicts=True
        )

        current_site = base_host(request=request, is_app=True)

        # Send invitations
        for invitation in workspace_invitations:
            workspace_invitation.delay(
                invitation.email,
                workspace.id,
                invitation.token,
                current_site,
                request.user.email,
            )
            
            # 감사 로그 남기기
            log_audit(
                action="invite_member",
                user_id=str(request.user.id),
                user_email=request.user.email,
                resource_type="workspace",
                resource_id=str(workspace.id),
                details={
                    "invited_email": invitation.email,
                    "role": invitation.role,
                    "workspace_slug": workspace.slug,
                    "workspace_name": workspace.name
                },
                request=request
            )

        return Response(
            {"message": "Emails sent successfully"}, status=status.HTTP_200_OK
        )

    def destroy(self, request, slug, pk):
        workspace_member_invite = WorkspaceMemberInvite.objects.get(
            pk=pk, workspace__slug=slug
        )
        
        # 감사 로그 남기기
        log_audit(
            action="delete_invitation",
            user_id=str(request.user.id),
            user_email=request.user.email,
            resource_type="workspace",
            resource_id=str(workspace_member_invite.workspace.id),
            details={
                "invited_email": workspace_member_invite.email,
                "role": workspace_member_invite.role,
                "workspace_slug": workspace_member_invite.workspace.slug,
                "workspace_name": workspace_member_invite.workspace.name
            },
            request=request
        )
        
        workspace_member_invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceJoinEndpoint(BaseAPIView):
    permission_classes = [AllowAny]
    """Invitation response endpoint the user can respond to the invitation"""

    @invalidate_cache(path="/api/workspaces/", user=False)
    @invalidate_cache(path="/api/users/me/workspaces/", multiple=True)
    @invalidate_cache(
        path="/api/workspaces/:slug/members/",
        user=False,
        multiple=True,
        url_params=True,
    )
    @invalidate_cache(path="/api/users/me/settings/", multiple=True)
    def post(self, request, slug, pk):
        workspace_invite = WorkspaceMemberInvite.objects.get(
            pk=pk, workspace__slug=slug
        )

        email = request.data.get("email", "")

        # Check the email
        if email == "" or workspace_invite.email != email:
            return Response(
                {"error": "You do not have permission to join the workspace"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # If already responded then return error
        if workspace_invite.responded_at is None:
            workspace_invite.accepted = request.data.get("accepted", False)
            workspace_invite.responded_at = timezone.now()
            workspace_invite.save()

            if workspace_invite.accepted:
                # Check if the user created account after invitation
                user = User.objects.filter(email=email).first()

                # If the user is present then create the workspace member
                if user is not None:
                    # Check if the user was already a member of workspace then activate the user
                    workspace_member = WorkspaceMember.objects.filter(
                        workspace=workspace_invite.workspace, member=user
                    ).first()
                    if workspace_member is not None:
                        workspace_member.is_active = True
                        workspace_member.role = workspace_invite.role
                        workspace_member.save()
                    else:
                        # Create a Workspace
                        _ = WorkspaceMember.objects.create(
                            workspace=workspace_invite.workspace,
                            member=user,
                            role=workspace_invite.role,
                        )

                    # Set the user last_workspace_id to the accepted workspace
                    user.last_workspace_id = workspace_invite.workspace.id
                    user.save()

                    # 감사 로그 남기기
                    log_audit(
                        action="accept_invitation",
                        user_id=str(user.id),
                        user_email=user.email,
                        resource_type="workspace",
                        resource_id=str(workspace_invite.workspace.id),
                        details={
                            "workspace_slug": workspace_invite.workspace.slug,
                            "workspace_name": workspace_invite.workspace.name,
                            "role": workspace_invite.role,
                            "invited_by": workspace_invite.created_by.email if workspace_invite.created_by else None
                        },
                        request=request
                    )

                    # Delete the invitation
                    workspace_invite.delete()

                # Send event
                workspace_invite_event.delay(
                    user=user.id if user is not None else None,
                    email=email,
                    user_agent=request.META.get("HTTP_USER_AGENT"),
                    ip=get_client_ip(request=request),
                    event_name="MEMBER_ACCEPTED",
                    accepted_from="EMAIL",
                )

                return Response(
                    {"message": "Workspace Invitation Accepted"},
                    status=status.HTTP_200_OK,
                )

            # Workspace invitation rejected
            # 감사 로그 남기기
            log_audit(
                action="reject_invitation",
                user_id=str(user.id) if user else None,
                user_email=email,
                resource_type="workspace",
                resource_id=str(workspace_invite.workspace.id),
                details={
                    "workspace_slug": workspace_invite.workspace.slug,
                    "workspace_name": workspace_invite.workspace.name,
                    "role": workspace_invite.role,
                    "invited_by": workspace_invite.created_by.email if workspace_invite.created_by else None
                },
                request=request
            )
            
            return Response(
                {"message": "Workspace Invitation was not accepted"},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"error": "You have already responded to the invitation request"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def get(self, request, slug, pk):
        workspace_invitation = WorkspaceMemberInvite.objects.get(
            workspace__slug=slug, pk=pk
        )
        serializer = WorkSpaceMemberInviteSerializer(workspace_invitation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserWorkspaceInvitationsViewSet(BaseViewSet):
    serializer_class = WorkSpaceMemberInviteSerializer
    model = WorkspaceMemberInvite

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(email=self.request.user.email)
            .select_related("workspace")
        )

    @invalidate_cache(path="/api/workspaces/", user=False)
    @invalidate_cache(path="/api/users/me/workspaces/", multiple=True)
    def create(self, request):
        invitations = request.data.get("invitations", [])
        workspace_invitations = WorkspaceMemberInvite.objects.filter(
            pk__in=invitations, email=request.user.email
        ).order_by("-created_at")

        # If the user is already a member of workspace and was deactivated then activate the user
        for invitation in workspace_invitations:
            invalidate_cache_directly(
                path=f"/api/workspaces/{invitation.workspace.slug}/members/",
                user=False,
                request=request,
                multiple=True,
            )
            # Update the WorkspaceMember for this specific invitation
            WorkspaceMember.objects.filter(
                workspace_id=invitation.workspace_id, member=request.user
            ).update(is_active=True, role=invitation.role)

        # Bulk create the user for all the workspaces
        WorkspaceMember.objects.bulk_create(
            [
                WorkspaceMember(
                    workspace=invitation.workspace,
                    member=request.user,
                    role=invitation.role,
                    created_by=request.user,
                )
                for invitation in workspace_invitations
            ],
            ignore_conflicts=True,
        )

        # Delete joined workspace invites
        workspace_invitations.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
