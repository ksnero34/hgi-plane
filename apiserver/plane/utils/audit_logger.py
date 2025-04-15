import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger('audit')

# 프로젝트 멤버 역할 정의
ROLE_CHOICES = {
    20: "Admin",
    15: "Member",
    10: "Viewer",
    8: "Restricted",
    5: "Guest",
}

def get_role_name(role_id):
    # 문자열로 전달된 경우 정수로 변환
    if isinstance(role_id, str):
        try:
            role_id = int(role_id)
        except ValueError:
            return role_id
    return ROLE_CHOICES.get(role_id, str(role_id))

def get_client_ip(request):
    """
    실제 클라이언트 IP 주소를 가져오는 함수
    nginx 프록시 뒤에서 동작할 때는 X-Forwarded-For 또는 X-Real-IP 헤더에서 IP를 가져옴
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For 형식: client, proxy1, proxy2, ...
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR')
    return ip

def log_audit(
    action: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    status: str = "success",
    ip_address: Optional[str] = None,
    request = None,
) -> None:
    """
    감사 로그를 생성하는 함수
    
    Args:
        action: 수행된 작업 (예: login, create_issue, add_member 등)
        user_id: 사용자 ID
        user_email: 사용자 이메일
        resource_type: 리소스 타입 (예: project, issue, member 등)
        resource_id: 리소스 ID
        details: 추가 상세 정보
        status: 작업 상태 (success/failure)
        ip_address: 사용자 IP 주소
        request: HttpRequest 객체 (ip_address가 없을 경우 request에서 IP 주소 추출)
    """
    # 역할을 문자열로 변환
    if details:
        if "role" in details:
            details["role"] = get_role_name(details["role"])
        if "old_role" in details:
            details["old_role"] = get_role_name(details["old_role"])
        if "new_role" in details:
            details["new_role"] = get_role_name(details["new_role"])
    
    # 요청 객체가 전달되었고 IP 주소가 없는 경우, 요청에서 IP 주소 추출
    if request and not ip_address:
        ip_address = get_client_ip(request)

    log_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "user": {
            "id": user_id,
            "email": user_email,
        },
        "resource": {
            "type": resource_type,
            "id": resource_id,
        },
        "details": details or {},
        "status": status,
        "ip_address": ip_address,
    }
    
    # None 값 제거
    log_data = {k: v for k, v in log_data.items() if v is not None}
    log_data["user"] = {k: v for k, v in log_data["user"].items() if v is not None}
    log_data["resource"] = {k: v for k, v in log_data["resource"].items() if v is not None}
    
    # JSON 직렬화 시 ensure_ascii=False로 설정하여 한글이 유니코드로 변환되지 않도록 함
    logger.info(json.dumps(log_data, ensure_ascii=False)) 