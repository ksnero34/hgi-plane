# Python imports
import logging
import subprocess
import json
import os

# Third party imports
from celery import shared_task

# Django imports
from django.conf import settings

# Module imports
from plane.utils.exception_logger import log_exception
from plane.db.models import User

@shared_task
def send_java_notification(notification_data):
    """
    자바 알림 API를 호출하는 Celery 태스크
    
    notification_data: 알림 데이터 (딕셔너리) - 간소화된 버전
    {
        "user_id": "사용자 ID",
        "title": "알림 제목",
        "message": "알림 내용",
        "url": "바로가기 URL"
    }
    """
    try:
        # 자바 API 호출에 필요한 설정 가져오기
        java_api_path = getattr(settings, "JAVA_NOTIFICATION_API_PATH", None)
        
        if not java_api_path:
            logging.getLogger("plane").warning("JAVA_NOTIFICATION_API_PATH is not configured")
            return False
        
        # user_id에서 사용자 이메일 가져오기
        user_id = notification_data.get("user_id")
        try:
            user = User.objects.get(pk=user_id)
            # 이메일에서 도메인을 제외한 사용자 아이디만 추출
            email_username = user.email.split('@')[0] if '@' in user.email else user.email
            # 알림 데이터의 user_id 업데이트
            notification_data["user_id"] = email_username
        except User.DoesNotExist:
            logging.getLogger("plane").warning(f"User with ID {user_id} not found")
        except Exception as e:
            logging.getLogger("plane").warning(f"Error extracting email username: {str(e)}")
            
        # 알림 데이터를 JSON 형식으로 변환
        notification_json = json.dumps(notification_data, ensure_ascii=False)
        
        logging.getLogger("plane").info(f"Sending notification data: {notification_json}")
        
        # 자바 프로그램 실행 명령어 구성
        java_command = [
            "java",
            "-jar",
            java_api_path,
            "--notification",
            notification_json  # 따옴표 없이 전달
        ]
        
        logging.getLogger("plane").info(f"Executing command: {' '.join(java_command)}")
        print(f"Executing command: {' '.join(java_command)}")
        
        # 현재 환경 변수 가져오기
        env = os.environ.copy()
        
        # 자바 명령어 실행
        process = subprocess.Popen(
            java_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,  # shell=False로 설정하여 쉘 해석을 방지
            env=env  # 환경 변수 설정
        )
        
        # 결과 및 오류 획득
        stdout, stderr = process.communicate()
        
        # 로그 기록
        if stdout:
            logging.getLogger("plane").info(f"Java notification API response: {stdout}")
        
        # 오류 확인
        if stderr:
            logging.getLogger("plane").error(f"Java notification API error: {stderr}")
            return False
            
        # 응답 코드 확인
        if process.returncode == 0:
            logging.getLogger("plane").info("Java notification sent successfully")
            return True
        else:
            logging.getLogger("plane").error(f"Java notification failed with code {process.returncode}")
            return False
    
    except Exception as e:
        log_exception(e)
        logging.getLogger("plane").error(f"Error sending Java notification: {str(e)}")
        return False 