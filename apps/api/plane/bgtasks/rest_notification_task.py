# Python imports
import json
import logging
import requests
from typing import Dict, Any

# Django imports
from django.conf import settings

# Third party imports
from celery import shared_task

# Module imports
from plane.db.models import RestNotificationConfig, RestNotificationLog


logger = logging.getLogger(__name__)


@shared_task
def send_rest_notification(config_id, notification_data: Dict[str, Any], notification_id=None):
    """
    REST API 기반 알림 전송 태스크
    
    Args:
        config_id: REST 알림 설정 ID
        notification_data: 알림 데이터 (user_id, user_email, title, message 등)
        notification_id: 알림 ID (선택사항)
    """
    try:
        # config_id를 문자열로 변환 (UUID 처리)
        config_id_str = str(config_id)
        config = RestNotificationConfig.objects.get(id=config_id_str, is_enabled=True)
    except RestNotificationConfig.DoesNotExist:
        logger.error(f"REST notification config not found or disabled: {config_id}")
        return False
    except Exception as e:
        logger.error(f"Error getting REST notification config: {str(e)}", exc_info=True)
        return False

    try:
        # REST 알림은 notification_id 없이도 동작해야 함 - config만으로 충분
        log_entry = RestNotificationLog.objects.create(
            config=config,
            notification=None,  # REST 알림은 notification FK 불필요
            request_data=notification_data
        )
    except Exception as e:
        logger.error(f"Error creating REST notification log entry: {str(e)}", exc_info=True)
        return False

    try:
        # JSON 템플릿에 데이터 매핑
        request_payload = _build_request_payload(config.json_template, notification_data)
        
        # 헤더 설정
        headers = config.headers.copy() if config.headers else {}
        headers.setdefault('Content-Type', 'application/json')
        
        # REST API 호출
        logger.info(f"Sending REST request to {config.endpoint_url}")
        
        response = requests.request(
            method=config.method,
            url=config.endpoint_url,
            headers=headers,
            json=request_payload,
            timeout=config.timeout
        )
        
        # 응답 로깅
        log_entry.status_code = response.status_code
        log_entry.response_data = {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'body': response.text[:1000]  # 처음 1000자만 저장
        }
        log_entry.request_data = request_payload
        
        # 성공 여부 판단 (200-299 상태 코드)
        if 200 <= response.status_code < 300:
            log_entry.success = True
            logger.info(f"REST notification sent successfully: {config.name}")
        else:
            log_entry.success = False
            log_entry.error_message = f"HTTP {response.status_code}: {response.text[:500]}"
            logger.error(f"REST notification failed: {config.name} - {log_entry.error_message}")
        
        log_entry.save()
        return log_entry.success
        
    except requests.exceptions.RequestException as e:
        log_entry.success = False
        log_entry.error_message = str(e)
        log_entry.save()
        
        logger.error(f"REST notification request failed: {config.name} - {str(e)}", exc_info=True)
        
        # 재시도 로직
        if log_entry.attempt_count < config.retry_count:
            log_entry.attempt_count += 1
            log_entry.save()
            
            # 재시도 지연 시간 (exponential backoff)
            delay = min(60 * (2 ** log_entry.attempt_count), 300)  # 최대 5분
            send_rest_notification.apply_async(
                args=[config_id, notification_data, notification_id],
                countdown=delay
            )
            
        return False
        
    except Exception as e:
        log_entry.success = False
        log_entry.error_message = f"Unexpected error: {str(e)}"
        log_entry.save()
        
        logger.error(f"Unexpected error in REST notification: {config.name} - {str(e)}", exc_info=True)
        return False


def _build_request_payload(template: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    JSON 템플릿에 실제 데이터를 매핑하여 요청 페이로드 생성
    
    Args:
        template: JSON 템플릿 (치환할 변수들이 포함된 템플릿)
        data: 실제 데이터
    
    Returns:
        Dict: 치환된 요청 페이로드
    """
    def replace_variables(obj):
        if isinstance(obj, dict):
            return {key: replace_variables(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [replace_variables(item) for item in obj]
        elif isinstance(obj, str):
            # 변수 치환 (예: {{user_id}} -> 실제 user_id 값)
            for key, value in data.items():
                obj = obj.replace(f"{{{{{key}}}}}", str(value))
            return obj
        else:
            return obj
    
    return replace_variables(template)


@shared_task
def send_rest_notification_batch(notification_batches):
    """
    여러 알림을 배치로 전송
    
    Args:
        notification_batches: 알림 배치 목록
    """
    results = []
    
    for batch in notification_batches:
        config_id = batch.get('config_id')
        notifications = batch.get('notifications', [])
        
        for notification in notifications:
            result = send_rest_notification.delay(
                config_id,
                notification['data'],
                notification.get('id')
            )
            results.append(result)
    
    return results