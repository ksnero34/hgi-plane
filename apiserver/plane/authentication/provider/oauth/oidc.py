import os
from datetime import datetime
from urllib.parse import urlencode

import pytz
import requests

from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)

class OIDCOAuthProvider(OauthAdapter):
    provider = "oidc"
    scope = "openid profile email roles"

    def __init__(self, request, code=None, state=None, callback=None):
        # OIDC 설정값 가져오기
        OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER_URL = get_configuration_value([
            {"key": "OIDC_CLIENT_ID"},
            {"key": "OIDC_CLIENT_SECRET"},
            {"key": "OIDC_ISSUER_URL"},
        ])

        if not (OIDC_CLIENT_ID and OIDC_CLIENT_SECRET and OIDC_ISSUER_URL):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        # OIDC 설정 가져오기
        try:
            config_response = requests.get(
                f"{OIDC_ISSUER_URL.rstrip('/')}/.well-known/openid-configuration",
                verify=False  # 개발 환경에서만 사용하세요
            )
            config_response.raise_for_status()
            config = config_response.json()
            
            if not all(key in config for key in ['token_endpoint', 'userinfo_endpoint', 'authorization_endpoint']):
                raise AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                    error_message="필수 OIDC 엔드포인트가 누락되었습니다",
                )
                
        except requests.RequestException as e:
            # print(f"OIDC 설정 요청 오류: {str(e)}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message=f"OIDC 서버 연결 오류: {str(e)}",
            )
        except Exception as e:
            # print(f"OIDC 설정 처리 오류: {str(e)}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message=f"OIDC 설정 처리 오류: {str(e)}",
            )

        self.token_url = config.get("token_endpoint")
        self.userinfo_url = config.get("userinfo_endpoint")
        
        # admin 로그인인지 확인
        self.is_admin = request.path.startswith("/api/instances/admins/")
        
        # 적절한 콜백 URL 설정
        if self.is_admin:
            redirect_uri = f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/api/instances/admins/oidc/callback/"""
        else:
            redirect_uri = f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/auth/oidc/callback/"""
            
        url_params = {
            "client_id": OIDC_CLIENT_ID,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        self.auth_url = config.get("authorization_endpoint") + "?" + urlencode(url_params)
        
        super().__init__(
            request,
            self.provider,
            OIDC_CLIENT_ID,
            self.scope,
            redirect_uri,
            self.auth_url,
            self.token_url,
            self.userinfo_url,
            OIDC_CLIENT_SECRET,
            code,
            callback=callback,
        )

    def set_token_data(self):
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": self.code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        token_response = self.get_user_token(
            data=data, headers={"Accept": "application/json"}
        )
        # print("token_responsessssss", token_response)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        print("[OIDC] User info response:", user_info_response)  # 디버깅용 로그
        
        email = user_info_response.get("email")

        # admin 로그인인 경우 roles 확인
        if self.is_admin:
            # ID 토큰에서 roles 확인
            id_token_claims = self.get_id_token_claims()
            print("[OIDC] ID token claims:", id_token_claims)  # 디버깅용 로그
            
            # ID 토큰이나 userinfo에서 roles 확인
            roles = id_token_claims.get("roles", []) or user_info_response.get("roles", [])
            if not isinstance(roles, list):
                roles = [roles]
            
            print("[OIDC] User roles:", roles)  # 디버깅용 로그
            
            # 관리자 권한 확인
            if "ROLE_CLIENT_ADMIN" not in roles:
                raise AuthenticationException(
                    error_code="UNAUTHORIZED",  # 문자열로 변경
                    error_message="관리자 권한이 없습니다.",
                )

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": user_info_response.get("sub"),
                    "email": email,
                    "avatar": user_info_response.get("picture"),
                    "first_name": user_info_response.get("given_name"),
                    "last_name": user_info_response.get("family_name"),
                    "is_password_autoset": True,
                },
            }
        )

    def get_id_token_claims(self):
        """ID 토큰의 claims를 가져옵니다."""
        if not hasattr(self, 'token_data'):
            self.set_token_data()
        
        id_token = self.token_data.get("id_token")
        if not id_token:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="ID 토큰이 없습니다.",
            )
        
        # ID 토큰 디코딩 (서명 검증은 생략)
        id_token_parts = id_token.split('.')
        if len(id_token_parts) != 3:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="잘못된 ID 토큰 형식입니다.",
            )
        
        import base64
        import json
        
        # Base64 패딩 추가
        payload = id_token_parts[1]
        payload += '=' * ((4 - len(payload) % 4) % 4)
        
        try:
            claims = json.loads(base64.b64decode(payload).decode('utf-8'))
            return claims
        except Exception as e:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message=f"ID 토큰 디코딩 오류: {str(e)}",
            ) 