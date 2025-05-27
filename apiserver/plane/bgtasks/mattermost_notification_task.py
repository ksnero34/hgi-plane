# Python imports
import logging
import requests
import json
import os

# Third party imports
from celery import shared_task

# Django imports
from django.conf import settings

# Module imports
from plane.utils.exception_logger import log_exception
from plane.db.models import User, Issue, Project, ProjectMattermostConfig


def get_mattermost_user_id(email, mattermost_config):
    """
    이메일을 통해 Mattermost 사용자 ID를 가져오는 함수
    """
    try:
        if not mattermost_config.bot_token:
            logging.getLogger("plane").warning("Mattermost bot token not configured")
            return None
        
        if not mattermost_config.server_url:
            logging.getLogger("plane").warning("Mattermost server URL not configured")
            return None
        
        # 이메일 유효성 검사
        if not email or '@' not in email:
            logging.getLogger("plane").warning(f"Invalid email format: {email}")
            return None
        
        # Mattermost 서버 URL 정리 (끝의 / 제거)
        base_url = mattermost_config.server_url.rstrip('/')
        
        # Mattermost API를 통해 사용자 정보 가져오기
        api_url = f"{base_url}/api/v4/users/email/{email}"
        headers = {
            "Authorization": f"Bearer {mattermost_config.bot_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get('id')
            if user_id:
                logging.getLogger("plane").info(f"Found Mattermost user for email: {email}")
                return user_id
            else:
                logging.getLogger("plane").warning(f"No user ID in response for email: {email}")
                return None
        elif response.status_code == 404:
            logging.getLogger("plane").info(f"Mattermost user not found for email: {email}")
            return None
        elif response.status_code == 401:
            logging.getLogger("plane").error(f"Unauthorized: Invalid bot token for Mattermost server")
            return None
        elif response.status_code == 403:
            logging.getLogger("plane").error(f"Forbidden: Bot doesn't have permission to access user data")
            return None
        else:
            logging.getLogger("plane").warning(f"Failed to get Mattermost user for {email}: {response.status_code} - {response.text}")
            return None
    
    except requests.exceptions.Timeout:
        logging.getLogger("plane").error(f"Timeout while getting Mattermost user for {email}")
        return None
    except requests.exceptions.ConnectionError:
        logging.getLogger("plane").error(f"Connection error while accessing Mattermost server: {mattermost_config.server_url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.getLogger("plane").error(f"Request error while getting Mattermost user for {email}: {str(e)}")
        return None
    except Exception as e:
        logging.getLogger("plane").error(f"Unexpected error getting Mattermost user ID for {email}: {str(e)}")
        return None


def create_dm_channel(bot_user_id, target_user_id, mattermost_config):
    """
    봇과 대상 사용자 간의 DM 채널을 생성하는 함수
    """
    try:
        if not mattermost_config.server_url:
            logging.getLogger("plane").warning("Mattermost server URL not configured")
            return None
        
        if not bot_user_id or not target_user_id:
            logging.getLogger("plane").warning(f"Invalid user IDs - bot: {bot_user_id}, target: {target_user_id}")
            return None
        
        # Mattermost 서버 URL 정리 (끝의 / 제거)
        base_url = mattermost_config.server_url.rstrip('/')
        
        # DM 채널 생성 API 호출
        api_url = f"{base_url}/api/v4/channels/direct"
        headers = {
            "Authorization": f"Bearer {mattermost_config.bot_token}",
            "Content-Type": "application/json"
        }
        
        payload = [bot_user_id, target_user_id]
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        
        if response.status_code in [200, 201]:
            channel_data = response.json()
            channel_id = channel_data.get('id')
            if channel_id:
                logging.getLogger("plane").info(f"DM channel created/found: {channel_id}")
                return channel_id
            else:
                logging.getLogger("plane").warning("No channel ID in response")
                return None
        elif response.status_code == 401:
            logging.getLogger("plane").error("Unauthorized: Invalid bot token for creating DM channel")
            return None
        elif response.status_code == 403:
            logging.getLogger("plane").error("Forbidden: Bot doesn't have permission to create DM channels")
            return None
        elif response.status_code == 400:
            logging.getLogger("plane").error(f"Bad request while creating DM channel: {response.text}")
            return None
        else:
            logging.getLogger("plane").warning(f"Failed to create DM channel: {response.status_code} - {response.text}")
            return None
    
    except requests.exceptions.Timeout:
        logging.getLogger("plane").error("Timeout while creating DM channel")
        return None
    except requests.exceptions.ConnectionError:
        logging.getLogger("plane").error(f"Connection error while creating DM channel: {mattermost_config.server_url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.getLogger("plane").error(f"Request error while creating DM channel: {str(e)}")
        return None
    except Exception as e:
        logging.getLogger("plane").error(f"Unexpected error creating DM channel: {str(e)}")
        return None


def get_bot_user_id(mattermost_config):
    """
    봇의 사용자 ID를 가져오는 함수
    """
    try:
        if not mattermost_config.server_url:
            logging.getLogger("plane").warning("Mattermost server URL not configured")
            return None
        
        if not mattermost_config.bot_token:
            logging.getLogger("plane").warning("Mattermost bot token not configured")
            return None
        
        # Mattermost 서버 URL 정리 (끝의 / 제거)
        base_url = mattermost_config.server_url.rstrip('/')
        
        # 봇 사용자 정보 가져오기
        api_url = f"{base_url}/api/v4/users/me"
        headers = {
            "Authorization": f"Bearer {mattermost_config.bot_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            bot_data = response.json()
            bot_id = bot_data.get('id')
            if bot_id:
                logging.getLogger("plane").info(f"Bot user ID retrieved: {bot_id}")
                return bot_id
            else:
                logging.getLogger("plane").warning("No bot ID in response")
                return None
        elif response.status_code == 401:
            logging.getLogger("plane").error("Unauthorized: Invalid bot token")
            return None
        elif response.status_code == 403:
            logging.getLogger("plane").error("Forbidden: Bot token doesn't have required permissions")
            return None
        else:
            logging.getLogger("plane").warning(f"Failed to get bot user info: {response.status_code} - {response.text}")
            return None
    
    except requests.exceptions.Timeout:
        logging.getLogger("plane").error("Timeout while getting bot user info")
        return None
    except requests.exceptions.ConnectionError:
        logging.getLogger("plane").error(f"Connection error while accessing Mattermost server: {mattermost_config.server_url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.getLogger("plane").error(f"Request error while getting bot user info: {str(e)}")
        return None
    except Exception as e:
        logging.getLogger("plane").error(f"Unexpected error getting bot user ID: {str(e)}")
        return None


def send_dm_message(channel_id, message, mattermost_config):
    """
    DM 채널에 메시지를 보내는 함수
    """
    try:
        if not mattermost_config.server_url:
            logging.getLogger("plane").warning("Mattermost server URL not configured")
            return False
        
        if not channel_id:
            logging.getLogger("plane").warning("Channel ID is missing")
            return False
        
        if not message:
            logging.getLogger("plane").warning("Message content is empty")
            return False
        
        # Mattermost 서버 URL 정리 (끝의 / 제거)
        base_url = mattermost_config.server_url.rstrip('/')
        
        # 메시지 전송 API 호출
        api_url = f"{base_url}/api/v4/posts"
        headers = {
            "Authorization": f"Bearer {mattermost_config.bot_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "channel_id": channel_id,
            "message": message
        }
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        
        if response.status_code == 201:
            logging.getLogger("plane").info("Mattermost DM sent successfully")
            return True
        elif response.status_code == 401:
            logging.getLogger("plane").error("Unauthorized: Invalid bot token for sending message")
            return False
        elif response.status_code == 403:
            logging.getLogger("plane").error("Forbidden: Bot doesn't have permission to send messages")
            return False
        elif response.status_code == 400:
            logging.getLogger("plane").error(f"Bad request while sending message: {response.text}")
            return False
        else:
            logging.getLogger("plane").error(f"Failed to send DM: {response.status_code} - {response.text}")
            return False
    
    except requests.exceptions.Timeout:
        logging.getLogger("plane").error("Timeout while sending DM message")
        return False
    except requests.exceptions.ConnectionError:
        logging.getLogger("plane").error(f"Connection error while sending DM: {mattermost_config.server_url}")
        return False
    except requests.exceptions.RequestException as e:
        logging.getLogger("plane").error(f"Request error while sending DM: {str(e)}")
        return False
    except Exception as e:
        logging.getLogger("plane").error(f"Unexpected error sending DM: {str(e)}")
        return False


@shared_task
def send_mattermost_notification(notification_data):
    """
    Mattermost DM 알림을 보내는 Celery 태스크
    
    notification_data: 알림 데이터 (딕셔너리)
    {
        "project_id": "프로젝트 ID",
        "user_id": "사용자 ID",
        "title": "알림 제목",
        "message": "알림 내용",
        "url": "바로가기 URL",
        "issue_data": {
            "id": "이슈 ID",
            "name": "이슈 제목",
            "identifier": "이슈 식별자",
            "state_name": "상태명",
            "priority": "우선순위"
        }
    }
    """
    try:
        # 입력 데이터 유효성 검사
        if not notification_data:
            logging.getLogger("plane").warning("Empty notification data received")
            return False
        
        project_id = notification_data.get("project_id")
        if not project_id:
            logging.getLogger("plane").warning("Project ID is missing in notification data")
            return False
        
        user_id = notification_data.get("user_id")
        if not user_id:
            logging.getLogger("plane").warning("User ID is missing in notification data")
            return False
        
        # 프로젝트의 Mattermost 설정 가져오기
        try:
            mattermost_config = ProjectMattermostConfig.objects.get(
                project_id=project_id,
                is_enabled=True
            )
        except ProjectMattermostConfig.DoesNotExist:
            # Mattermost 설정이 없거나 비활성화된 경우 알림을 보내지 않음 (정상적인 상황)
            logging.getLogger("plane").debug(f"Mattermost not configured or disabled for project {project_id}")
            return False
        except Exception as e:
            logging.getLogger("plane").error(f"Error getting Mattermost config for project {project_id}: {str(e)}")
            return False
        
        # 필수 설정 확인
        if not mattermost_config.bot_token:
            logging.getLogger("plane").warning(f"Mattermost bot token not configured for project {project_id}")
            return False
        
        if not mattermost_config.server_url:
            logging.getLogger("plane").warning(f"Mattermost server URL not configured for project {project_id}")
            return False
        
        # 사용자 정보 가져오기
        try:
            user = User.objects.get(pk=user_id)
            user_email = user.email
            
            if not user_email:
                logging.getLogger("plane").warning(f"User {user_id} has no email address")
                return False
                
        except User.DoesNotExist:
            logging.getLogger("plane").warning(f"User not found: {user_id}")
            return False
        except Exception as e:
            logging.getLogger("plane").error(f"Error getting user {user_id}: {str(e)}")
            return False
        
        # Mattermost에서 사용자 ID 찾기
        mattermost_user_id = get_mattermost_user_id(user_email, mattermost_config)
        if not mattermost_user_id:
            # 이미 get_mattermost_user_id에서 로깅됨
            return False
        
        # 봇 사용자 ID 가져오기
        bot_user_id = get_bot_user_id(mattermost_config)
        if not bot_user_id:
            # 이미 get_bot_user_id에서 로깅됨
            return False
        
        # 자기 자신에게 DM을 보내려는 경우 방지
        if bot_user_id == mattermost_user_id:
            logging.getLogger("plane").warning(f"Attempting to send DM to bot itself for user {user_email}")
            return False
        
        # DM 채널 생성
        dm_channel_id = create_dm_channel(bot_user_id, mattermost_user_id, mattermost_config)
        if not dm_channel_id:
            # 이미 create_dm_channel에서 로깅됨
            return False
        
        # 메시지 데이터 준비
        try:
            # 이슈 정보 가져오기
            issue_data = notification_data.get("issue_data", {})
            issue_name = issue_data.get("name", "Unknown Issue")
            issue_identifier = issue_data.get("identifier", "")
            issue_state = issue_data.get("state_name", "")
            issue_priority = issue_data.get("priority", "")
            
            # 메시지 구성
            title = notification_data.get("title", "Plane 알림")
            message_text = notification_data.get("message", "")
            url = notification_data.get("url", "")
            
            # 메시지 내용이 비어있는 경우 기본 메시지 사용
            if not message_text:
                message_text = "새로운 알림이 있습니다."
            
            # 우선순위 이모지
            priority_emoji = {
                "urgent": "🔴",
                "high": "🟠", 
                "medium": "🟡",
                "low": "🟢",
                "none": "⚪"
            }
            priority_display = f"{priority_emoji.get(issue_priority.lower(), '⚪')} {issue_priority}" if issue_priority else ""
            
            # DM 메시지 구성
            dm_message = f"🔔 **{title}**\n\n"
            dm_message += f"{message_text}\n\n"
            
            if issue_identifier and issue_name:
                dm_message += f"**이슈:** {issue_identifier} {issue_name}\n"
            
            if issue_state:
                dm_message += f"**상태:** {issue_state}\n"
            
            if priority_display:
                dm_message += f"**우선순위:** {priority_display}\n"
            
            if url:
                dm_message += f"\n[이슈 보기]({url})"
            
        except Exception as e:
            logging.getLogger("plane").error(f"Error preparing message data: {str(e)}")
            return False
        
        # DM 전송
        success = send_dm_message(dm_channel_id, dm_message, mattermost_config)
        
        if success:
            logging.getLogger("plane").info(f"Mattermost DM sent successfully to {user_email} for project {project_id}")
            return True
        else:
            logging.getLogger("plane").warning(f"Failed to send Mattermost DM to {user_email} for project {project_id}")
            return False
    
    except Exception as e:
        log_exception(e)
        logging.getLogger("plane").error(f"Unexpected error in send_mattermost_notification: {str(e)}")
        return False


def create_mattermost_notification_data(notification, issue=None, project=None):
    """
    Notification 객체에서 Mattermost 알림 데이터를 생성하는 헬퍼 함수
    """
    try:
        # 기본 URL 생성
        base_url = os.environ.get("WEB_URL", "http://localhost:3000")
        url = ""
        
        if issue and project:
            url = f"{base_url}/{project.workspace.slug}/projects/{project.id}/issues/{issue.id}"
        
        # 이슈 데이터 구성
        issue_data = {}
        if issue:
            issue_data = {
                "id": str(issue.id),
                "name": issue.name,
                "identifier": f"{issue.project.identifier}-{issue.sequence_id}",
                "state_name": issue.state.name if issue.state else "",
                "priority": getattr(issue, 'priority', '') or ""
            }
        
        return {
            "project_id": str(notification.project_id) if notification.project_id else "",
            "user_id": str(notification.receiver_id),
            "title": "Plane 알림",
            "message": notification.message,
            "url": url,
            "issue_data": issue_data
        }
    
    except Exception as e:
        logging.getLogger("plane").error(f"Error creating Mattermost notification data: {str(e)}")
        return None 