# Python imports
import json
import uuid
from uuid import UUID
import logging
import os


# Module imports
from plane.db.models import (
    IssueMention,
    IssueSubscriber,
    Project,
    User,
    IssueAssignee,
    Issue,
    State,
    EmailNotificationLog,
    Notification,
    IssueComment,
    IssueActivity,
    UserNotificationPreference,
    ProjectMember,
    Workspace,
    ProjectMattermostConfig,
    CustomField,
)
from django.db.models import Subquery
from django.conf import settings

# Third Party imports
from celery import shared_task
from bs4 import BeautifulSoup

# Import Java notification service
from plane.bgtasks.java_notification_task import send_java_notification
# Import Mattermost notification service
from plane.bgtasks.mattermost_notification_task import send_mattermost_notification, create_mattermost_notification_data


# =========== Issue Description Html Parsing and notification Functions ======================


def update_mentions_for_issue(issue, project, new_mentions, removed_mention):
    aggregated_issue_mentions = []
    for mention_id in new_mentions:
        aggregated_issue_mentions.append(
            IssueMention(
                mention_id=mention_id,
                issue=issue,
                project=project,
                workspace_id=project.workspace_id,
            )
        )

    IssueMention.objects.bulk_create(aggregated_issue_mentions, batch_size=100)
    IssueMention.objects.filter(issue=issue, mention__in=removed_mention).delete()


def get_new_mentions(requested_instance, current_instance):
    # requested_data is the newer instance of the current issue
    # current_instance is the older instance of the current issue, saved in the database

    # extract mentions from both the instance of data
    mentions_older = extract_mentions(current_instance)

    mentions_newer = extract_mentions(requested_instance)

    # Getting Set Difference from mentions_newer
    new_mentions = [
        mention for mention in mentions_newer if mention not in mentions_older
    ]

    return new_mentions


# Get Removed Mention
def get_removed_mentions(requested_instance, current_instance):
    # requested_data is the newer instance of the current issue
    # current_instance is the older instance of the current issue, saved in the database

    # extract mentions from both the instance of data
    mentions_older = extract_mentions(current_instance)
    mentions_newer = extract_mentions(requested_instance)

    # Getting Set Difference from mentions_newer
    removed_mentions = [
        mention for mention in mentions_older if mention not in mentions_newer
    ]

    return removed_mentions


# Adds mentions as subscribers
def extract_mentions_as_subscribers(project_id, issue_id, mentions):
    # mentions is an array of User IDs representing the FILTERED set of mentioned users

    bulk_mention_subscribers = []

    for mention_id in mentions:
        # If the particular mention has not already been subscribed to the issue, he must be sent the mentioned notification
        if (
            not IssueSubscriber.objects.filter(
                issue_id=issue_id, subscriber_id=mention_id, project_id=project_id
            ).exists()
            and not IssueAssignee.objects.filter(
                project_id=project_id, issue_id=issue_id, assignee_id=mention_id
            ).exists()
            and not Issue.objects.filter(
                project_id=project_id, pk=issue_id, created_by_id=mention_id
            ).exists()
            and ProjectMember.objects.filter(
                project_id=project_id, member_id=mention_id, is_active=True
            ).exists()
        ):
            project = Project.objects.get(pk=project_id)

            bulk_mention_subscribers.append(
                IssueSubscriber(
                    workspace_id=project.workspace_id,
                    project_id=project_id,
                    issue_id=issue_id,
                    subscriber_id=mention_id,
                )
            )
    return bulk_mention_subscribers


# Parse Issue Description & extracts mentions
def extract_mentions(issue_instance):
    try:
        # issue_instance has to be a dictionary passed, containing the description_html and other set of activity data.
        mentions = []
        # Convert string to dictionary
        data = json.loads(issue_instance)
        html = data.get("description_html")
        soup = BeautifulSoup(html, "html.parser")
        mention_tags = soup.find_all(
            "mention-component", attrs={"entity_name": "user_mention"}
        )

        mentions = [mention_tag["entity_identifier"] for mention_tag in mention_tags]

        return list(set(mentions))
    except Exception:
        return []


# =========== Comment Parsing and notification Functions ======================
def extract_comment_mentions(comment_value):
    try:
        mentions = []
        soup = BeautifulSoup(comment_value, "html.parser")
        mentions_tags = soup.find_all(
            "mention-component", attrs={"entity_name": "user_mention"}
        )
        for mention_tag in mentions_tags:
            mentions.append(mention_tag["entity_identifier"])
        return list(set(mentions))
    except Exception:
        return []


def get_new_comment_mentions(new_value, old_value):
    mentions_newer = extract_comment_mentions(new_value)
    if old_value is None:
        return mentions_newer

    mentions_older = extract_comment_mentions(old_value)
    # Getting Set Difference from mentions_newer
    new_mentions = [
        mention for mention in mentions_newer if mention not in mentions_older
    ]

    return new_mentions


def create_mention_notification(
    project, notification_comment, issue, actor_id, mention_id, issue_id, activity
):
    return Notification(
        workspace=project.workspace,
        sender="in_app:issue_activities:mentioned",
        triggered_by_id=actor_id,
        receiver_id=mention_id,
        entity_identifier=issue_id,
        entity_name="issue",
        project=project,
        message=notification_comment,
        data={
            "issue": {
                "id": str(issue_id),
                "name": str(issue.name),
                "identifier": str(issue.project.identifier),
                "sequence_id": issue.sequence_id,
                "state_name": issue.state.name,
                "state_group": issue.state.group,
            },
            "issue_activity": {
                "id": str(activity.get("id")),
                "verb": str(activity.get("verb")),
                "field": str(activity.get("field")),
                "actor": str(activity.get("actor_id")),
                "new_value": str(activity.get("new_value")),
                "old_value": str(activity.get("old_value")),
                "old_identifier": (
                    str(activity.get("old_identifier"))
                    if activity.get("old_identifier")
                    else None
                ),
                "new_identifier": (
                    str(activity.get("new_identifier"))
                    if activity.get("new_identifier")
                    else None
                ),
            },
        },
    )


# 알림 처리 함수 수정
def process_notification(notification):
    # 기존 알림 처리 로직
    
    # Java 알림 API가 활성화되어 있는 경우 Java 알림 서비스 호출
    if settings.JAVA_NOTIFICATION_API_ENABLED:
        # 바로가기 URL 생성
        url = ""
        entity_type = notification.entity_name
        entity_id = notification.entity_identifier
        
        # WEB_URL 환경 변수에서 기본 URL 가져오기
        base_url = os.environ.get("WEB_URL", "http://localhost:3000")
        
        try:
            if entity_type == "issue":
                # 이슈 관련 알림 URL
                issue = Issue.objects.get(pk=entity_id)
                url = f"{base_url}/{issue.project.workspace.slug}/projects/{issue.project_id}/issues/{issue.id}"
            elif entity_type == "workspace":
                # 워크스페이스 관련 알림 URL
                workspace = Workspace.objects.get(pk=entity_id)
                url = f"{base_url}/{workspace.slug}"
            elif entity_type == "project":
                # 프로젝트 관련 알림 URL
                project = Project.objects.get(pk=entity_id)
                url = f"{base_url}/{project.workspace.slug}/projects/{project.id}"
        except Exception as e:
            logging.getLogger("plane").warning(f"Error generating URL for notification: {str(e)}")

        # Java 알림 API에 전달할 데이터 구성 (간소화된 버전)
        java_notification_data = {
            "user_id": str(notification.receiver_id),
            "title": "이슈트래커(Plane) 알림",
            "message": notification.message,
            "url": url
        }
        
        # 비동기로 Java 알림 API 호출
        send_java_notification.delay(java_notification_data)
    
    # Mattermost DM 알림 처리
    try:
        if notification.project_id:
            # 프로젝트에 Mattermost 설정이 활성화되어 있는지 확인
            mattermost_config = ProjectMattermostConfig.objects.filter(
                project_id=notification.project_id,
                is_enabled=True
            ).first()
            
            if mattermost_config:
                # 이슈와 프로젝트 정보 가져오기
                issue = None
                project = None
                
                try:
                    if notification.entity_name == "issue":
                        issue = Issue.objects.get(pk=notification.entity_identifier)
                        project = issue.project
                    elif notification.project_id:
                        project = Project.objects.get(pk=notification.project_id)
                except Exception as e:
                    logging.getLogger("plane").warning(f"Error getting issue/project for Mattermost notification: {str(e)}")
                
                # Mattermost 알림 데이터 생성
                mattermost_data = create_mattermost_notification_data(
                    notification, issue=issue, project=project
                )
                
                if mattermost_data:
                    # 비동기로 Mattermost DM 알림 전송
                    send_mattermost_notification.delay(mattermost_data)
    
    except Exception as e:
        logging.getLogger("plane").warning(f"Error processing Mattermost notification: {str(e)}")
    
    return notification


@shared_task
def notifications(
    type,
    issue_id,
    project_id,
    actor_id,
    subscriber,
    issue_activities_created,
    requested_data,
    current_instance,
):
    try:
        # 디버깅을 위한 출력
        # print("\n=== Notification Debug Info ===")
        # print(f"Type: {type}")
        # print(f"Actor ID: {actor_id}")
        # print(f"Issue Activities: {json.dumps(issue_activities_created, indent=2)}")
        # print(f"Requested Data: {json.dumps(requested_data, indent=2)}")
        # print(f"Current Instance: {json.dumps(current_instance, indent=2)}")
        # print("============================\n")

        issue_activities_created = (
            json.loads(issue_activities_created)
            if issue_activities_created is not None
            else None
        )

        # 이슈 정보 가져오기
        issue = Issue.objects.filter(pk=issue_id).first()
        project = Project.objects.get(pk=project_id)

        # 프로젝트 멤버 목록 가져오기
        project_members = ProjectMember.objects.filter(
            project_id=project_id, is_active=True
        ).values_list("member_id", flat=True)

        # print(f"\nProject Members: {list(project_members)}")

        # 이슈 담당자 목록 가져오기
        issue_assignees = IssueAssignee.objects.filter(
            issue_id=issue_id,
            project_id=project_id,
            assignee__in=Subquery(project_members),
        ).values_list("assignee", flat=True)

        # print(f"\nCurrent Assignees: {list(issue_assignees)}")

        # 멘션 관련 변수 초기화
        new_mentions = []
        comment_mentions = []
        mention_subscribers = []
        comment_mention_subscribers = []

        # 이슈 설명에서 새로운 멘션 추출
        if requested_data and type == "issue.activity.bulk_notify" :
            new_mentions = get_new_mentions(requested_data, current_instance)
            removed_mention = get_removed_mentions(requested_data, current_instance)
            
            # print(f"\nNew mentions from description: {new_mentions}")
            # print(f"Removed mentions from description: {removed_mention}")
            
            # 새로운 멘션을 구독자로 추가
            mention_subscribers = extract_mentions_as_subscribers(
                project_id, issue_id, new_mentions
            )
            
            # 본문 멘션에 대한 알림 생성
            actor = User.objects.get(pk=actor_id)
            for mention_id in new_mentions:
                if mention_id != actor_id:
                    try:
                        notification = Notification(
                            workspace=project.workspace,
                            sender="in_app:issue_activities:mentioned",
                            triggered_by_id=actor_id,
                            receiver_id=mention_id,
                            entity_identifier=issue_id,
                            entity_name="issue",
                            project=project,
                            message=f"{actor.display_name}님이 '{issue.name}' 이슈에서 당신을 멘션했습니다.",
                        )
                        # 알림 처리 함수 호출
                        process_notification(notification)
                        # 알림을 bulk_notifications 배열에 추가
                        bulk_notifications.append(notification)
                    except Exception as e:
                        print(f"Error creating mention notification: {e}")

        # 댓글에서 멘션 추출 (댓글 활동이 있는 경우)
        for activity in issue_activities_created:
            if activity.get("field") == "comment":
                comment_value = activity.get("new_value", "")
                if comment_value:
                    comment_mentions.extend(extract_comment_mentions(comment_value))
                    
                    # 댓글의 멘션을 구독자로 추가
                    comment_mention_subscribers.extend(
                        extract_mentions_as_subscribers(
                            project_id, issue_id, comment_mentions
                        )
                    )

        # 이슈 구독자 목록 가져오기 (멘션된 사용자와 액터 제외)
        issue_subscribers = list(
            IssueSubscriber.objects.filter(
                project_id=project_id,
                issue_id=issue_id,
                subscriber__in=Subquery(project_members),
            )
            .exclude(
                subscriber_id__in=list(new_mentions + comment_mentions + [actor_id])
            )
            .values_list("subscriber", flat=True)
        )

        # 이슈 생성자 추가
        if issue.created_by_id and issue.created_by_id != actor_id:
            issue_subscribers.append(issue.created_by_id)

        # 중복 제거
        issue_subscribers = list(set(issue_subscribers))

        # 구독자 추가 (요청된 경우)
        if subscriber:
            try:
                _ = IssueSubscriber.objects.get_or_create(
                    project_id=project_id, issue_id=issue_id, subscriber_id=actor_id
                )
            except Exception:
                pass

        # 알림 수신자 목록 생성 (담당자 + 구독자)
        notification_receivers = list(set(list(issue_assignees) + issue_subscribers))

        # 이메일 로그 리스트 초기화
        bulk_email_logs = []
        bulk_notifications = []

        # 각 활동별로 알림 생성
        for issue_activity in issue_activities_created:
            field = issue_activity.get("field")
            new_value = issue_activity.get("new_value", "")
            old_value = issue_activity.get("old_value", "")
            verb = issue_activity.get("verb", "")

            # print(f"\n--- Processing Activity ---")
            # print(f"Field: {field}")
            # print(f"Verb: {verb}")
            # print(f"New Value: {new_value}")
            # print(f"Old Value: {old_value}")

            if field == "assignees":
                new_assignees = new_value.split(",") if new_value else []
                old_assignees = old_value.split(",") if old_value else []
                
                # print(f"New Assignees: {new_assignees}")
                # print(f"Old Assignees: {old_assignees}")

            # 각 수신자별로 알림 생성
            for receiver in notification_receivers:
                if str(receiver) == actor_id:
                    # print(f"Skipping actor: {actor_id}")
                    continue

                send_email = False
                if field == "assignees":
                    # 새로운 이슈 생성 시 담당자 할당인 경우
                    if type == "issue.activity.created":
                        # new_identifier에는 실제 UUID가 있으므로 이를 사용
                        new_assignee_id = issue_activity.get("new_identifier")
                        if str(receiver) == str(new_assignee_id):
                            # print(f"New issue assignee notification for: {receiver}")
                            send_email = True
                            sender = "in_app:issue_activities:assigned"
                            message = f"새 이슈 '{issue.name}'에 담당자로 할당되었습니다."
                        elif receiver in issue_subscribers:
                            # print(f"New issue notification for subscriber: {receiver}")
                            send_email = True
                            sender = "in_app:issue_activities:created"
                            message = f"새 이슈 '{issue.name}'이(가) 생성되었습니다."
                        else:
                            continue
                    # 기존 이슈의 담당자 변경인 경우
                    else:
                        # new_identifier에는 실제 UUID가 있으므로 이를 사용
                        new_assignee_id = issue_activity.get("new_identifier")
                        old_assignee_id = issue_activity.get("old_identifier")
                        
                        # print(f"New Assignee ID: {new_assignee_id}")
                        # print(f"Old Assignee ID: {old_assignee_id}")
                        
                        # 새로 할당된 담당자인 경우
                        if str(receiver) == str(new_assignee_id):
                            # print(f"New assignee notification for: {receiver}")
                            send_email = True
                            sender = "in_app:issue_activities:assigned"
                            message = f"이슈 '{issue.name}'에 담당자로 할당되었습니다."
                        # 기존 담당자가 제거된 경우
                        elif str(receiver) == str(old_assignee_id):
                            # print(f"Removed assignee notification for: {receiver}")
                            send_email = True
                            sender = "in_app:issue_activities:property_change"
                            message = f"이슈 '{issue.name}'의 담당자에서 제외되었습니다."
                        # 기존 담당자이면서 계속 유지되는 경우 (다른 담당자가 추가/제거됨)
                        elif str(receiver) in [str(a) for a in issue_assignees] and str(receiver) not in [str(new_assignee_id), str(old_assignee_id)]:
                            # print(f"Assignee change notification for existing assignee: {receiver}")
                            send_email = True
                            sender = "in_app:issue_activities:property_change"
                            message = f"이슈 '{issue.name}'의 담당자가 변경되었습니다."
                        else:
                            continue
                elif field == "state":
                    if State.objects.filter(
                        project_id=project_id,
                        pk=issue_activity.get("new_identifier"),
                        group="completed",
                    ).exists():
                        sender = "in_app:issue_activities:completed"
                        message = f"이슈 '{issue.name}'이(가) 완료되었습니다."
                    else:
                        sender = "in_app:issue_activities:state_change"
                        message = f"이슈 '{issue.name}'의 상태가 변경되었습니다."
                elif field == "comment":
                    # 댓글 알림은 작성자를 제외한 모든 담당자와 구독자에게 전송
                    if receiver in issue_assignees or receiver in issue_subscribers:
                        # print(f"Comment notification for receiver: {receiver}")
                        sender = "in_app:issue_activities:comment"
                        send_email = True
                        message = f"이슈 '{issue.name}'에 새 댓글이 있습니다."
                    else:
                        continue  # 알림을 보내지 않음
                elif field == "description":
                    # 내용 변경 시에는 알림을 보내지 않음
                    continue
                elif field == "name":
                    sender = "in_app:issue_activities:name_change"
                    message = f"이슈 '{issue.name}'의 제목이 변경되었습니다."
                elif field == "priority":
                    sender = "in_app:issue_activities:priority_change"
                    message = f"이슈 '{issue.name}'의 우선순위가 변경되었습니다."
                elif field == "labels":
                    sender = "in_app:issue_activities:labels_change"
                    message = f"이슈 '{issue.name}'의 라벨이 변경되었습니다."
                elif field == "custom_field":
                    # 커스텀 필드 변경 알림 - 실제 필드명 사용
                    try:
                        # 커스텀 필드 ID에서 필드 이름 가져오기
                        custom_field_id = issue_activity.get("old_identifier") or issue_activity.get("new_identifier")
                        custom_field_name = "커스텀 필드"  # 기본값
                        
                        if custom_field_id:
                            try:
                                custom_field = CustomField.objects.get(
                                    id=custom_field_id,
                                    project_id=project_id,
                                    deleted_at__isnull=True
                                )
                                custom_field_name = custom_field.name
                            except CustomField.DoesNotExist:
                                pass
                        
                        sender = "in_app:issue_activities:custom_field_change"
                        message = f"이슈 '{issue.name}'의 '{custom_field_name}' 필드가 변경되었습니다."
                        send_email = True
                        
                        # 알림 데이터에 커스텀 필드 이름 추가
                        issue_activity["custom_field_name"] = custom_field_name
                        
                    except Exception:
                        # 오류 시 기본 메시지 사용
                        sender = "in_app:issue_activities:custom_field_change"
                        message = f"이슈 '{issue.name}'의 커스텀 필드가 변경되었습니다."
                        send_email = True
                elif field == "start_date":
                    sender = "in_app:issue_activities:start_date_change"
                    message = f"이슈 '{issue.name}'의 시작일이 변경되었습니다."
                elif field == "target_date":
                    sender = "in_app:issue_activities:target_date_change"
                    message = f"이슈 '{issue.name}'의 마감일이 변경되었습니다."
                elif field.startswith("estimate_"):  # 모든 추정 필드 타입을 처리 (estimate_point, estimate_time 등)
                    # 추정 값 변경 알림
                    if type == "issue.activity.created":
                        # 이슈 생성 시 추정값 설정
                        if receiver in issue_subscribers:
                            sender = "in_app:issue_activities:estimate_change"
                            message = f"이슈 '{issue.name}'의 추정 소요자원 값이 설정되었습니다."
                        else:
                            continue
                    else:
                        # 추정값 업데이트
                        sender = "in_app:issue_activities:estimate_change"
                        message = f"이슈 '{issue.name}'의 추정 소요자원 값이 변경되었습니다."
                else:
                    # 이슈 생성 시 구독자에게만 알림
                    if receiver in issue_subscribers:
                        if type == "issue.activity.created":
                            sender = "in_app:issue_activities:subscribed"
                            message = f"이슈 '{issue.name}'이(가) 생성되었습니다."
                        elif type == "issue.activity.updated":
                            sender = "in_app:issue_activities:updated"
                            message = f"이슈 '{issue.name}'이(가) 업데이트되었습니다."
                        else:
                            continue
                        send_email = True
                    else:
                        continue

                # If activity is of issue comment fetch the comment
                issue_comment = (
                    IssueComment.objects.filter(
                        id=issue_activity.get("issue_comment"),
                        issue_id=issue_id,
                        project_id=project_id,
                        workspace_id=project.workspace_id,
                    ).first()
                    if issue_activity.get("issue_comment")
                    else None
                )

                # Create in app notification
                notification = Notification(
                    workspace=project.workspace,
                    sender=sender,
                    triggered_by_id=actor_id,
                    receiver_id=receiver,
                    entity_identifier=issue_id,
                    entity_name="issue",
                    project=project,
                    title=issue_activity.get("comment"),
                    message=message,
                    data={
                        "issue": {
                            "id": str(issue_id),
                            "name": str(issue.name),
                            "identifier": str(issue.project.identifier),
                            "sequence_id": issue.sequence_id,
                            "state_name": issue.state.name,
                            "state_group": issue.state.group,
                        },
                        "issue_activity": {
                            "id": str(issue_activity.get("id")),
                            "verb": str(issue_activity.get("verb")),
                            "field": str(issue_activity.get("field")),
                            "actor": str(issue_activity.get("actor_id")),
                            "new_value": str(issue_activity.get("new_value")),
                            "old_value": str(issue_activity.get("old_value")),
                            "issue_comment": str(
                                issue_comment.comment_stripped
                                if issue_comment is not None
                                else ""
                            ),
                            "old_identifier": (
                                str(issue_activity.get("old_identifier"))
                                if issue_activity.get("old_identifier")
                                else None
                            ),
                            "new_identifier": (
                                str(issue_activity.get("new_identifier"))
                                if issue_activity.get("new_identifier")
                                else None
                            ),
                            "custom_field_name": (
                                str(issue_activity.get("custom_field_name"))
                                if issue_activity.get("custom_field_name")
                                else None
                            ),
                        },
                    },
                )
                # 알림 처리 함수 호출
                process_notification(notification)
                # 알림을 bulk_notifications 배열에 추가
                bulk_notifications.append(notification)
                # Create email notification
                if send_email:
                    bulk_email_logs.append(
                        EmailNotificationLog(
                            triggered_by_id=actor_id,
                            receiver_id=receiver,
                            entity_identifier=issue_id,
                            entity_name="issue",
                            data={
                                "issue": {
                                    "id": str(issue_id),
                                    "name": str(issue.name),
                                    "identifier": str(issue.project.identifier),
                                    "project_id": str(issue.project.id),
                                    "workspace_slug": str(
                                        issue.project.workspace.slug
                                    ),
                                    "sequence_id": issue.sequence_id,
                                    "state_name": issue.state.name,
                                    "state_group": issue.state.group,
                                },
                                "issue_activity": {
                                    "id": str(issue_activity.get("id")),
                                    "verb": str(issue_activity.get("verb")),
                                    "field": str(issue_activity.get("field")),
                                    "actor": str(issue_activity.get("actor_id")),
                                    "new_value": str(
                                        issue_activity.get("new_value")
                                    ),
                                    "old_value": str(
                                        issue_activity.get("old_value")
                                    ),
                                    "issue_comment": str(
                                        issue_comment.comment_stripped
                                        if issue_comment is not None
                                        else ""
                                    ),
                                    "old_identifier": (
                                        str(issue_activity.get("old_identifier"))
                                        if issue_activity.get("old_identifier")
                                        else None
                                    ),
                                    "new_identifier": (
                                        str(issue_activity.get("new_identifier"))
                                        if issue_activity.get("new_identifier")
                                        else None
                                    ),
                                    "activity_time": issue_activity.get(
                                        "created_at"
                                    ),
                                    "custom_field_name": (
                                        str(issue_activity.get("custom_field_name"))
                                        if issue_activity.get("custom_field_name")
                                        else None
                                    ),
                                },
                            },
                        )
                    )

        # ----------------------------------------------------------------------------------------------------------------- #

        # Add Mentioned as Issue Subscribers
        IssueSubscriber.objects.bulk_create(
            mention_subscribers + comment_mention_subscribers,
            batch_size=100,
            ignore_conflicts=True,
        )

        last_activity = (
            IssueActivity.objects.filter(issue_id=issue_id)
            .order_by("-created_at")
            .first()
        )

        actor = User.objects.get(pk=actor_id)

        for mention_id in comment_mentions:
            if mention_id != actor_id:
                preference = UserNotificationPreference.objects.get(
                    user_id=mention_id
                )
                for issue_activity in issue_activities_created:
                    notification = create_mention_notification(
                        project=project,
                        issue=issue,
                        notification_comment=f"{actor.display_name}님이 '{issue.name}' 이슈에서 당신을 멘션했습니다.",
                        actor_id=actor_id,
                        mention_id=mention_id,
                        issue_id=issue_id,
                        activity=issue_activity,
                    )

                    # 알림 처리 함수 호출
                    process_notification(notification)
                    # 알림을 bulk_notifications 배열에 추가
                    bulk_notifications.append(notification)

        for mention_id in new_mentions:
            if mention_id != actor_id:
                preference = UserNotificationPreference.objects.get(
                    user_id=mention_id
                )
                if (
                    last_activity is not None
                    and last_activity.field == "description"
                    and actor_id == str(last_activity.actor_id)
                ):
                    notification = create_mention_notification(
                        project=project,
                        issue=issue,
                        notification_comment=f"{actor.display_name}님이 '{issue.name}' 이슈에서 당신을 멘션했습니다.",
                        actor_id=actor_id,
                        mention_id=mention_id,
                        issue_id=issue_id,
                        activity=last_activity,
                    )
                    # 알림 처리 함수 호출
                    process_notification(notification)
                    # 알림을 bulk_notifications 배열에 추가
                    bulk_notifications.append(notification)
                else:
                    for issue_activity in issue_activities_created:
                        notification = create_mention_notification(
                            project=project,
                            issue=issue,
                            notification_comment=f"{actor.display_name}님이 '{issue.name}' 이슈에서 당신을 멘션했습니다.",
                            actor_id=actor_id,
                            mention_id=mention_id,
                            issue_id=issue_id,
                            activity=issue_activity,
                        )
                        # 알림 처리 함수 호출
                        process_notification(notification)
                        # 알림을 bulk_notifications 배열에 추가
                        bulk_notifications.append(notification)

        # save new mentions for the particular issue and remove the mentions that has been deleted from the description
        update_mentions_for_issue(
            issue=issue,
            project=project,
            new_mentions=new_mentions,
            removed_mention=removed_mention,
        )
        # Bulk create notifications
        Notification.objects.bulk_create(bulk_notifications, batch_size=100)
        EmailNotificationLog.objects.bulk_create(
            bulk_email_logs, batch_size=100, ignore_conflicts=True
        )
        return
    except Exception as e:
        print(e)
        return
