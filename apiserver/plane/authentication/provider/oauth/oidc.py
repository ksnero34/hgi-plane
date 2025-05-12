import os
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse
import logging
import ssl
import http.client
import subprocess

import pytz
import requests
import jwt
import filetype

from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)
from plane.license.models import Instance, InstanceAdmin
from django.conf import settings
from plane.db.models import User
from plane.utils.ip_address import get_client_ip

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
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message=f"OIDC 서버 연결 오류: {str(e)}",
            )
        except Exception as e:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message=f"OIDC 설정 처리 오류: {str(e)}",
            )

        self.token_url = config.get("token_endpoint")
        self.userinfo_url = config.get("userinfo_endpoint")
        
        # admin 로그인인지 확인
        self.is_admin = request.session.get('is_admin_login', False)
        
        # 적절한 콜백 URL 설정 - 하나의 URL만 설정
        # X-Forwarded-Proto 헤더 확인
        forwarded_proto = request.META.get('HTTP_X_FORWARDED_PROTO', '')
        is_secure = request.is_secure() or forwarded_proto == 'https'
        base_url = f"""{"https" if is_secure else "http"}://{request.get_host()}"""
        if self.is_admin:
            redirect_uri = f"{base_url}/api/instances/admins/oidc/callback/"
        else:
            redirect_uri = f"{base_url}/auth/oidc/callback/"
            
        url_params = {
            "client_id": OIDC_CLIENT_ID,
            "scope": self.scope,
            "redirect_uri": redirect_uri,  # 단일 redirect_uri 사용
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
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        
        # ID 토큰에서 클레임 가져오기
        id_token_claims = self.get_id_token_claims()
        
        # 이메일 가져오기
        email = user_info_response.get("email")
        if not email and id_token_claims:
            email = id_token_claims.get("email")

        # 표시 이름 가져오기 - 우선 순위: userinfo의 name -> id_token의 name -> sub
        display_name = None
        
        # 로그에서 확인한 바로는 user_info_response에 'name'이 있음
        if "name" in user_info_response:
            display_name = user_info_response.get("name")
            # print(f"[OIDC] userinfo에서 name 찾음: {display_name}")
        # id_token에서도 확인
        elif id_token_claims and "name" in id_token_claims:
            display_name = id_token_claims.get("name")
            # print(f"[OIDC] id_token에서 name 찾음: {display_name}")
        # 없으면 sub 사용
        else:
            display_name = user_info_response.get("sub")
            # print(f"[OIDC] name 없음, sub 사용: {display_name}")
            
        # print(f"[OIDC] 최종 display_name: {display_name}")

        # avatar URL 검증 - curl 기반으로 이미지 다운로드
        avatar_url = user_info_response.get("picture")
        if not avatar_url and id_token_claims:
            avatar_url = id_token_claims.get("picture")
            
        valid_avatar_url = None
        if avatar_url:
            try:
                # 이미지 다운로드를 위한 curl 명령어 실행
                cmd = [
                    "curl", "-s", "--location",
                    "--header", "User-Agent: Mozilla/5.0",
                    "--header", "Referer: https://plane.hwgeneralins.com",
                    "--header", "Cookie: ",  # 필요한 경우 쿠키 추가
                    "--insecure",  # SSL 인증서 검증 무시
                    avatar_url
                ]
                
                # subprocess로 curl 실행
                image_bytes = subprocess.check_output(cmd)
                
                # 이미지 유형 확인
                kind = filetype.guess(image_bytes)
                if kind and kind.mime.startswith('image/'):
                    valid_avatar_url = avatar_url
                    # logging.warning(f"[OIDC] 유효한 이미지 파일 확인됨: {kind.mime}")
                else:
                    logging.warning(f"[OIDC] 유효하지 않은 파일 형식 또는 빈 응답")
            except subprocess.CalledProcessError as e:
                logging.warning(f"[OIDC] 아바타 URL curl 호출 실패: {e}")
                valid_avatar_url = None
            except Exception as e:
                logging.warning(f"[OIDC] 아바타 URL 검증 중 오류 발생: {str(e)}")
                valid_avatar_url = None

        # admin 로그인인 경우 roles 확인
        if self.is_admin:
            # ID 토큰이나 userinfo에서 roles 확인
            roles = id_token_claims.get("roles", []) or user_info_response.get("roles", [])
            if not isinstance(roles, list):
                roles = [roles]
            
            # print("[OIDC] User roles:", roles)  # 디버깅용 로그
            
            # 관리자 권한 확인
            if "ROLE_CLIENT_ADMIN" not in roles:
                raise AuthenticationException(
                    error_code="UNAUTHORIZED",
                    error_message="관리자 권한이 없습니다.",
                )

            # 인스턴스 관리자 토큰 생성
            instance = Instance.objects.first()
            if instance:
                # 현재 시간을 UTC로 설정
                current_time = datetime.now(pytz.UTC)
                
                # JWT 토큰 생성 (7일 유효)
                token_data = {
                    "user_email": email,
                    "exp": int((current_time + timedelta(days=7)).timestamp()),  # Unix timestamp로 변환
                    "iat": int(current_time.timestamp()),  # Unix timestamp로 변환
                }
                admin_token = jwt.encode(
                    token_data,
                    settings.SECRET_KEY,
                    algorithm="HS256"
                )
                
                # 사용자 정보 업데이트
                user = User.objects.filter(email=email).first()
                if user:
                    user.is_active = True
                    user.last_active = current_time
                    user.last_login_time = current_time
                    user.last_login_ip = get_client_ip(self.request)
                    user.last_login_uagent = self.request.META.get("HTTP_USER_AGENT")
                    user.token_updated_at = current_time
                    user.save()
                
                # 인스턴스 관리자 생성 또는 업데이트
                instance_admin, created = InstanceAdmin.objects.update_or_create(
                    instance=instance,
                    user=user,
                    defaults={
                        "role": 20,  # ROLE.ADMIN.value
                        "auth_token": admin_token
                    }
                )
                
                # print(f"[OIDC] Instance admin {'created' if created else 'updated'} for user: {email}")

        # 사용자 데이터 설정
        user_data = {
            "email": email,
            "user": {
                "provider_id": user_info_response.get("sub"),
                "email": email,
                "avatar": valid_avatar_url,
                "first_name": user_info_response.get("given_name", ""),
                "last_name": user_info_response.get("family_name", ""),
                "is_password_autoset": True,
                "display_name": display_name,
            },
        }
        
        # 기존 사용자가 있는지 확인하고 정보 업데이트 (필요시 활성화)
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            # valid_avatar_url이 None이면 기존 아바타 URL 검증
            if not valid_avatar_url and existing_user.avatar:
                try:
                    # 이미지 다운로드를 위한 curl 명령어 실행
                    cmd = [
                        "curl", "-s", "--location",
                        "--header", "User-Agent: Mozilla/5.0",
                        "--header", "Referer: https://plane.hwgeneralins.com",
                        "--header", "Cookie: ",  # 필요한 경우 쿠키 추가
                        "--insecure",  # SSL 인증서 검증 무시
                        existing_user.avatar
                    ]
                    
                    # subprocess로 curl 실행
                    image_bytes = subprocess.check_output(cmd)
                    
                    # 이미지 유형 확인
                    kind = filetype.guess(image_bytes)
                    if not kind or not kind.mime.startswith('image/'):
                        logging.warning(f"[OIDC] 기존 아바타 이미지 유형이 아님")
                        existing_user.avatar = ""
                except (subprocess.CalledProcessError, Exception) as e:
                    # curl 실행 실패시 빈 문자열로 설정
                    logging.warning(f"[OIDC] 기존 아바타 URL 검증 중 오류 발생: {str(e)}")
                    existing_user.avatar = ""
            # 새로운 유효한 아바타 URL이 있는 경우에만 업데이트
            elif valid_avatar_url:
                 existing_user.avatar = valid_avatar_url
            
            existing_user.save()
            
            # user_data에 업데이트된 사용자 정보 반영
            user_data["user"].update({
                "id": existing_user.id,
                "avatar": existing_user.avatar,
                "avatar_url": existing_user.avatar_url,
            })
            
        super().set_user_data(user_data)

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