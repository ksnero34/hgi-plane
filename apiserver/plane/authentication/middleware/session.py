import time
import logging
from importlib import import_module

from django.conf import settings
from django.contrib.sessions.backends.base import UpdateError
from django.contrib.sessions.exceptions import SessionInterrupted
from django.utils.cache import patch_vary_headers
from django.utils.deprecation import MiddlewareMixin
from django.utils.http import http_date
from plane.utils.audit_logger import log_audit
from plane.utils.ip_address import get_client_ip

# 보안 로거 설정
security_logger = logging.getLogger('security')

# 세션 보안 설정 (settings.py에 정의되지 않은 경우 기본값)
SESSION_IP_CHECK = getattr(settings, 'SESSION_IP_CHECK', True)
SESSION_USER_AGENT_CHECK = getattr(settings, 'SESSION_USER_AGENT_CHECK', True)

class SessionMiddleware(MiddlewareMixin):
    def __init__(self, get_response):
        super().__init__(get_response)
        engine = import_module(settings.SESSION_ENGINE)
        self.SessionStore = engine.SessionStore

    def process_request(self, request):
        if "instances/file-settings" in request.path or "instances/public" in request.path:
            session_key = request.COOKIES.get(settings.ADMIN_SESSION_COOKIE_NAME) or request.COOKIES.get(settings.SESSION_COOKIE_NAME)
        elif "instances" in request.path:
            session_key = request.COOKIES.get(settings.ADMIN_SESSION_COOKIE_NAME)
        else:
            session_key = request.COOKIES.get(settings.SESSION_COOKIE_NAME)
        
        request.session = self.SessionStore(session_key)
        
        # 인증된 세션에 대해서만 IP 검증
        if SESSION_IP_CHECK and request.session.get('is_authenticated', False):
            # CSRF 토큰 검증
            csrf_cookie = request.COOKIES.get('csrftoken')
            
            # CSRF 토큰이 쿠키에 있으면 IP 체크와 User-Agent 체크 건너뛰기
            if csrf_cookie:
                return
            else:
                stored_ip = request.session.get('ip_address')
                current_ip = get_client_ip(request)
                
                # IP가 없으면 저장
                if not stored_ip:
                    request.session['ip_address'] = current_ip
                    request.session.modified = True
                    request.session.save()
                # IP가 다르면 세션 무효화 
                elif current_ip and stored_ip != current_ip:
                    # 현재 user_id 저장
                    user_id = request.session.get('user_id')
                    
                    # 세션 초기화
                    request.session.flush()
                    
                    # 로그 기록
                    log_audit(
                        action="ip_mismatch",
                        user_id=user_id,
                        user_email=None,
                        resource_type="session",
                        resource_id=None,
                        details={
                            "stored_ip": stored_ip,
                            "current_ip": current_ip,
                            "path": request.path
                        },
                        request=request,
                    )
                    
                    # 새로운 세션 생성
                    request.session = self.SessionStore()
                    request.session['ip_address'] = current_ip
                    request.session['is_authenticated'] = False
                    request.session.modified = True
                    request.session.save()

                # User-Agent 체크
                if SESSION_USER_AGENT_CHECK:
                    stored_user_agent = request.session.get('device_info', {}).get('user_agent')
                    current_user_agent = request.META.get('HTTP_USER_AGENT', '')
                    
                    if stored_user_agent and current_user_agent != stored_user_agent:
                        # 현재 user_id 저장
                        user_id = request.session.get('user_id')
                        
                        # 세션 초기화
                        request.session.flush()
                        
                        # 로그 기록
                        log_audit(
                            action="user_agent_mismatch",
                            user_id=user_id,
                            user_email=None,
                            resource_type="session",
                            resource_id=None,
                            details={
                                "stored_user_agent": stored_user_agent,
                                "current_user_agent": current_user_agent,
                                "path": request.path
                            },
                            request=request,
                        )
                        
                        # 새로운 세션 생성
                        request.session = self.SessionStore()
                        request.session['is_authenticated'] = False
                        request.session.modified = True
                        request.session.save()

    def process_response(self, request, response):
        """
        If request.session was modified, or if the configuration is to save the
        session every time, save the changes and set a session cookie or delete
        the session cookie if the session has been emptied.
        """
        try:
            accessed = request.session.accessed
            modified = request.session.modified
            empty = request.session.is_empty()
        except AttributeError:
            return response
        # First check if we need to delete this cookie.
        # The session should be deleted only if the session is entirely empty.
        is_admin_path = "instances" in request.path and "instances/file-settings" not in request.path
        is_file_settings = "instances/file-settings" in request.path
        
        if is_file_settings:
            cookie_name = (
                settings.ADMIN_SESSION_COOKIE_NAME 
                if request.COOKIES.get(settings.ADMIN_SESSION_COOKIE_NAME) 
                else settings.SESSION_COOKIE_NAME
            )
        else:
            cookie_name = (
                settings.ADMIN_SESSION_COOKIE_NAME
                if is_admin_path
                else settings.SESSION_COOKIE_NAME
            )

        if cookie_name in request.COOKIES and empty:
            response.delete_cookie(
                cookie_name,
                path=settings.SESSION_COOKIE_PATH,
                domain=settings.SESSION_COOKIE_DOMAIN,
                samesite=settings.SESSION_COOKIE_SAMESITE,
            )
            patch_vary_headers(response, ("Cookie",))
        else:
            if accessed:
                patch_vary_headers(response, ("Cookie",))
            if (modified or settings.SESSION_SAVE_EVERY_REQUEST) and not empty:
                if request.session.get_expire_at_browser_close():
                    max_age = None
                    expires = None
                else:
                    # Use different max_age based on whether it's an admin cookie
                    if is_admin_path:
                        max_age = settings.ADMIN_SESSION_COOKIE_AGE
                    else:
                        max_age = request.session.get_expiry_age()

                    expires_time = time.time() + max_age
                    expires = http_date(expires_time)

                # Save the session data and refresh the client cookie.
                if response.status_code < 500:
                    try:
                        request.session.save()
                    except UpdateError:
                        raise SessionInterrupted(
                            "The request's session was deleted before the "
                            "request completed. The user may have logged "
                            "out in a concurrent request, for example."
                        )
                    response.set_cookie(
                        cookie_name,
                        request.session.session_key,
                        max_age=max_age,
                        expires=expires,
                        domain=settings.SESSION_COOKIE_DOMAIN,
                        path=settings.SESSION_COOKIE_PATH,
                        secure=settings.SESSION_COOKIE_SECURE or None,
                        httponly=settings.SESSION_COOKIE_HTTPONLY or None,
                        samesite=settings.SESSION_COOKIE_SAMESITE,
                    )
        return response
