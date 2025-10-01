# Python imports
import logging
import os

# Third party imports
from celery import shared_task

# Django imports
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils.html import strip_tags

# Module imports
from plane.db.models import (
    ProjectMember,
    ProjectMemberInvite,
    ProjectMattermostConfig,
    RestNotificationConfig,
    WorkspaceMember,
    WorkspaceMemberInvite,
    User,
    Workspace,
)
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.exception_logger import log_exception
from plane.bgtasks.java_notification_task import send_java_notification
from plane.bgtasks.mattermost_notification_task import send_mattermost_notification
from plane.bgtasks.rest_notification_task import send_rest_notification
from plane.utils.cache import invalidate_cache_directly
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
import jwt
from datetime import datetime


@shared_task
def process_auto_accept_invitation(email_data, workspace_id, inviter_id):
    try:
        workspace = Workspace.objects.get(pk=workspace_id)
        inviter = User.objects.get(pk=inviter_id)

        # 해당 이메일을 가진 사용자가 있는지 확인
        user = User.objects.filter(email=email_data.get("email").strip().lower()).first()
        if user is not None:
            # 이미 워크스페이스 멤버인지 확인
            workspace_member = WorkspaceMember.objects.filter(
                workspace_id=workspace.id, member=user
            ).first()

            if not workspace_member:
                # 멤버가 아닌 경우 바로 추가
                WorkspaceMember.objects.create(
                    workspace_id=workspace.id,
                    member=user,
                    role=email_data.get("role", 5),
                    created_by=inviter,
                )

                inviter_name = inviter.first_name or inviter.display_name or inviter.email
                workspace_url = f"{os.environ.get('WEB_URL', 'http://localhost:3000')}/{workspace.slug}"

                # Java 알림 전송
                java_notification_data = {
                    "user_id": user.email.split('@')[0],
                    "title": "이슈트래커 - Plane 워크스페이스 참가",
                    "message": f"{inviter_name}님이 {workspace.name} 워크스페이스에 참가시켰습니다.",
                    "url": workspace_url,
                }
                send_java_notification.delay(java_notification_data)

                # Mattermost DM 알림 (워크스페이스 내 구성된 프로젝트 중 첫 번째 사용)
                mattermost_config = (
                    ProjectMattermostConfig.objects.filter(
                        project__workspace=workspace, is_enabled=True
                    )
                    .order_by("created_at")
                    .first()
                )
                if mattermost_config:
                    mattermost_data = {
                        "project_id": str(mattermost_config.project_id),
                        "user_id": str(user.id),
                        "title": "Plane 워크스페이스 참가",
                        "message": f"{inviter_name}님이 {workspace.name} 워크스페이스에 참가시켰습니다.",
                        "url": workspace_url,
                    }
                    send_mattermost_notification.delay(mattermost_data)

                # REST 알림 전송 (워크스페이스 단위 설정)
                rest_configs = RestNotificationConfig.objects.filter(
                    workspace=workspace, is_enabled=True
                )
                rest_message = (
                    f"{inviter_name}님이 {workspace.name} 워크스페이스에 참가시켰습니다."
                )
                for config in rest_configs:
                    rest_data = {
                        "user_id": user.email.split("@")[0],
                        "user_email": user.email,
                        "title": "Plane 워크스페이스 참가",
                        "message": rest_message,
                        "workspace_name": workspace.name,
                        "inviter_email": inviter.email,
                        "inviter_name": inviter_name,
                        "invitation_url": workspace_url,
                        "notification_type": "workspace_auto_accept_invitation",
                    }
                    send_rest_notification.delay(str(config.id), rest_data)

                return True
        return False
    except Exception as e:
        logging.getLogger("plane").error(f"Error in auto accept invitation: {str(e)}")
        return False

@shared_task
def workspace_invitation(email, workspace_id, token, current_site, inviter):
    try:
        user = User.objects.get(email=inviter)

        workspace = Workspace.objects.get(pk=workspace_id)
        workspace_member_invite = WorkspaceMemberInvite.objects.get(
            token=token, email=email
        )

        inviter_name = user.first_name or user.display_name or user.email

        # 이미 가입된 사용자인 경우 자동 참가 알림
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            # 자동 참가 알림
            java_notification_data = {
                "user_id": email.split('@')[0],
                "title": "이슈트래커 - Plane 워크스페이스 참가",
                "message": f"{inviter_name}님이 {workspace.name} 워크스페이스에 초대하였습니다.",
                "url": f"{current_site}/{workspace.slug}"
            }
        else:
            # 초대 알림
            java_notification_data = {
                "user_id": email.split('@')[0],
                "title": "이슈트래커 - Plane 초대",
                "message": f"{inviter_name}님이 {workspace.name} 워크스페이스로 초대했습니다.",
                "url": f"{current_site}/workspace-invitations/?invitation_id={workspace_member_invite.id}&email={email}&slug={workspace.slug}"
            }

        # Java 알림 전송
        send_java_notification.delay(java_notification_data)
        logging.getLogger("plane").info(f"Java notification sent for workspace invitation: {email}")

        invitation_url = java_notification_data["url"]

        # Mattermost 알림 (이미 Plane 사용자에게만 전송)
        if existing_user:
            mattermost_config = (
                ProjectMattermostConfig.objects.filter(
                    project__workspace=workspace, is_enabled=True
                )
                .order_by("created_at")
                .first()
            )
            if mattermost_config:
                mattermost_data = {
                    "project_id": str(mattermost_config.project_id),
                    "user_id": str(existing_user.id),
                    "title": "Plane 워크스페이스 초대",
                    "message": java_notification_data["message"],
                    "url": invitation_url,
                }
                send_mattermost_notification.delay(mattermost_data)

        # REST 알림 전송 (워크스페이스 수준 설정)
        rest_configs = RestNotificationConfig.objects.filter(
            workspace=workspace, is_enabled=True
        )
        rest_data_template = {
            "user_id": email.split("@")[0],
            "user_email": email,
            "title": "Plane 워크스페이스 초대",
            "message": java_notification_data["message"],
            "workspace_name": workspace.name,
            "inviter_email": user.email,
            "inviter_name": inviter_name,
            "invitation_url": invitation_url,
            "notification_type": "workspace_invitation",
            "is_existing_user": bool(existing_user),
        }
        if existing_user:
            rest_data_template["target_user_id"] = str(existing_user.id)

        for config in rest_configs:
            send_rest_notification.delay(str(config.id), rest_data_template)

        # Relative link
        relative_link = f"/workspace-invitations/?invitation_id={workspace_member_invite.id}&email={email}&slug={workspace.slug}"  # noqa: E501

        # The complete url including the domain
        abs_url = str(current_site) + relative_link

        (
            EMAIL_HOST,
            EMAIL_HOST_USER,
            EMAIL_HOST_PASSWORD,
            EMAIL_PORT,
            EMAIL_USE_TLS,
            EMAIL_USE_SSL,
            EMAIL_FROM,
        ) = get_email_configuration()

        # Subject of the email
        subject = f"{user.first_name or user.display_name or user.email} has invited you to join them in {workspace.name} on Plane"  # noqa: E501

        context = {
            "email": email,
            "first_name": user.first_name or user.display_name or user.email,
            "workspace_name": workspace.name,
            "abs_url": abs_url,
        }

        html_content = render_to_string(
            "emails/invitations/workspace_invitation.html", context
        )

        text_content = strip_tags(html_content)

        workspace_member_invite.message = text_content
        workspace_member_invite.save()

        connection = get_connection(
            host=EMAIL_HOST,
            port=int(EMAIL_PORT),
            username=EMAIL_HOST_USER,
            password=EMAIL_HOST_PASSWORD,
            use_tls=EMAIL_USE_TLS == "1",
            use_ssl=EMAIL_USE_SSL == "1",
        )

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=EMAIL_FROM,
            to=[email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logging.getLogger("plane.worker").info("Email sent successfully")
        return
    except (Workspace.DoesNotExist, WorkspaceMemberInvite.DoesNotExist):
        return
    except Exception as e:
        log_exception(e)
        return
