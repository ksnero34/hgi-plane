# Python imports
import os
import uuid
from urllib.parse import urlencode

# Django imports
from django.conf import settings
from django.http import HttpResponseRedirect
from django.views import View

# Third party imports
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# Module imports
from plane.app.views import BaseAPIView
from plane.db.models import Workspace
from plane.license.api.permissions import (
    InstanceAdminPermission,
)
from plane.license.api.serializers import (
    InstanceSerializer,
)
from plane.license.models import Instance
from plane.license.utils.instance_value import (
    get_configuration_value,
)
from plane.utils.cache import cache_response, invalidate_cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_control
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.login import user_login
from plane.authentication.utils.host import base_host
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)


class InstanceEndpoint(BaseAPIView):
    def get_permissions(self):
        if self.request.method == "PATCH":
            return [
                InstanceAdminPermission(),
            ]
        return [
            AllowAny(),
        ]

    @cache_response(60 * 60 * 2, user=False)
    @method_decorator(cache_control(private=True, max_age=12))
    def get(self, request):
        instance = Instance.objects.first()

        # get the instance
        if instance is None:
            return Response(
                {"is_activated": False, "is_setup_done": False},
                status=status.HTTP_200_OK,
            )
        # Return instance
        serializer = InstanceSerializer(instance)
        data = serializer.data
        data["is_activated"] = True
        # Get all the configuration
        (
            ENABLE_SIGNUP,
            IS_GOOGLE_ENABLED,
            IS_GITHUB_ENABLED,
            GITHUB_APP_NAME,
            IS_GITLAB_ENABLED,
            IS_OIDC_ENABLED,
            EMAIL_HOST,
            ENABLE_MAGIC_LINK_LOGIN,
            ENABLE_EMAIL_PASSWORD,
            SLACK_CLIENT_ID,
            POSTHOG_API_KEY,
            POSTHOG_HOST,
            UNSPLASH_ACCESS_KEY,
            OPENAI_API_KEY,
            IS_INTERCOM_ENABLED,
            INTERCOM_APP_ID,
        ) = get_configuration_value(
            [
                {
                    "key": "ENABLE_SIGNUP",
                    "default": os.environ.get("ENABLE_SIGNUP", "0"),
                },
                {
                    "key": "IS_GOOGLE_ENABLED",
                    "default": os.environ.get("IS_GOOGLE_ENABLED", "0"),
                },
                {
                    "key": "IS_GITHUB_ENABLED",
                    "default": os.environ.get("IS_GITHUB_ENABLED", "0"),
                },
                {
                    "key": "GITHUB_APP_NAME",
                    "default": os.environ.get("GITHUB_APP_NAME", ""),
                },
                {
                    "key": "IS_GITLAB_ENABLED",
                    "default": os.environ.get("IS_GITLAB_ENABLED", "0"),
                },
                {
                    "key": "IS_OIDC_ENABLED",
                    "default": os.environ.get("IS_OIDC_ENABLED", "0"),
                },
                {
                    "key": "EMAIL_HOST",
                    "default": os.environ.get("EMAIL_HOST", ""),
                },
                {
                    "key": "ENABLE_MAGIC_LINK_LOGIN",
                    "default": os.environ.get("ENABLE_MAGIC_LINK_LOGIN", "1"),
                },
                {
                    "key": "ENABLE_EMAIL_PASSWORD",
                    "default": os.environ.get("ENABLE_EMAIL_PASSWORD", "1"),
                },
                {
                    "key": "SLACK_CLIENT_ID",
                    "default": os.environ.get("SLACK_CLIENT_ID", None),
                },
                {
                    "key": "POSTHOG_API_KEY",
                    "default": os.environ.get("POSTHOG_API_KEY", None),
                },
                {
                    "key": "POSTHOG_HOST",
                    "default": os.environ.get("POSTHOG_HOST", None),
                },
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY", ""),
                },
                {
                    "key": "OPENAI_API_KEY",
                    "default": os.environ.get("OPENAI_API_KEY", ""),
                },
                # Intercom settings
                {
                    "key": "IS_INTERCOM_ENABLED",
                    "default": os.environ.get("IS_INTERCOM_ENABLED", "1"),
                },
                {
                    "key": "INTERCOM_APP_ID",
                    "default": os.environ.get("INTERCOM_APP_ID", ""),
                },
            ]
        )

        data = {}
        # Authentication
        data["enable_signup"] = ENABLE_SIGNUP == "1"
        data["is_google_enabled"] = IS_GOOGLE_ENABLED == "1"
        data["is_github_enabled"] = IS_GITHUB_ENABLED == "1"
        data["is_gitlab_enabled"] = IS_GITLAB_ENABLED == "1"
        data["is_oidc_enabled"] = IS_OIDC_ENABLED == "1"
        data["is_magic_login_enabled"] = ENABLE_MAGIC_LINK_LOGIN == "1"
        data["is_email_password_enabled"] = ENABLE_EMAIL_PASSWORD == "1"
        data["is_oidc_enabled"] = IS_OIDC_ENABLED == "1"

        # Github app name
        data["github_app_name"] = str(GITHUB_APP_NAME)

        # Slack client
        data["slack_client_id"] = SLACK_CLIENT_ID

        # Posthog
        data["posthog_api_key"] = POSTHOG_API_KEY
        data["posthog_host"] = POSTHOG_HOST

        # Unsplash
        data["has_unsplash_configured"] = bool(UNSPLASH_ACCESS_KEY)

        # Open AI settings
        data["has_openai_configured"] = bool(OPENAI_API_KEY)

        # File size settings
        data["file_size_limit"] = float(
            os.environ.get("FILE_SIZE_LIMIT", 5368709120)
        )

        # is smtp configured
        data["is_smtp_configured"] = bool(EMAIL_HOST)

        # Intercom settings
        data["is_intercom_enabled"] = IS_INTERCOM_ENABLED == "1"
        data["intercom_app_id"] = INTERCOM_APP_ID

        # Base URL
        data["admin_base_url"] = settings.ADMIN_BASE_URL
        data["space_base_url"] = settings.SPACE_BASE_URL
        data["app_base_url"] = settings.APP_BASE_URL

        instance_data = serializer.data
        instance_data["workspaces_exist"] = Workspace.objects.count() >= 1

        response_data = {"config": data, "instance": instance_data}
        return Response(response_data, status=status.HTTP_200_OK)

    @invalidate_cache(path="/api/instances/", user=False)
    def patch(self, request):
        # Get the instance
        instance = Instance.objects.first()
        serializer = InstanceSerializer(
            instance, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SignUpScreenVisitedEndpoint(BaseAPIView):
    permission_classes = [
        AllowAny,
    ]

    @invalidate_cache(path="/api/instances/", user=False)
    def post(self, request):
        instance = Instance.objects.first()
        if instance is None:
            return Response(
                {"error": "Instance is not configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.is_signup_screen_visited = True
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OIDCOauthInitiateAdminEndpoint(View):
    def get(self, request):
        print("[OIDC Admin] Initiating OIDC login")
        # Get host and next path
        request.session["host"] = base_host(request=request, is_admin=True)
        next_path = request.GET.get("next_path")
        if next_path:
            request.session["next_path"] = str(next_path)
        
        print(f"[OIDC Admin] Host: {request.session['host']}, Next path: {next_path}")

        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            print("[OIDC Admin] Instance not configured")
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = f"{base_host(request=request, is_admin=True)}?{urlencode(params)}"
            return HttpResponseRedirect(url)

        try:
            state = uuid.uuid4().hex
            provider = OIDCOAuthProvider(request=request, state=state)
            request.session["state"] = state
            auth_url = provider.get_auth_url()
            print(f"[OIDC Admin] Redirecting to auth URL: {auth_url}")
            return HttpResponseRedirect(auth_url)
        except AuthenticationException as e:
            print(f"[OIDC Admin] Authentication error: {str(e)}")
            params = e.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = f"{base_host(request=request, is_admin=True)}?{urlencode(params)}"
            return HttpResponseRedirect(url)


class OIDCCallbackAdminEndpoint(View):
    def get(self, request):
        print("[OIDC Admin Callback] Received callback request")
        # Get state and code from request
        state = request.GET.get("state")
        code = request.GET.get("code")
        next_path = request.session.get("next_path")
        base_host = request.session.get("host", "")

        print(f"[OIDC Admin Callback] State: {state}")
        print(f"[OIDC Admin Callback] Code: {code}")
        print(f"[OIDC Admin Callback] Next path: {next_path}")
        print(f"[OIDC Admin Callback] Base host: {base_host}")

        # Validate state
        session_state = request.session.get("state")
        if not state or not session_state or state != session_state:
            print("[OIDC Admin Callback] Invalid state")
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_STATE"],
                error_message="INVALID_STATE",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = f"{base_host}?{urlencode(params)}"
            return HttpResponseRedirect(url)

        # Clear state from session
        request.session.pop("state", None)

        # Validate code
        if not code:
            print("[OIDC Admin Callback] Invalid code")
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_CODE"],
                error_message="INVALID_CODE",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = f"{base_host}?{urlencode(params)}"
            return HttpResponseRedirect(url)

        try:
            print("[OIDC Admin Callback] Authenticating with provider")
            provider = OIDCOAuthProvider(
                request=request,
                code=code,
            )
            user = provider.authenticate()
            print(f"[OIDC Admin Callback] User authenticated: {user.email}")
            
            # admin 세션 로그인 처리 (is_admin=True로 설정)
            user_login(request=request, user=user, is_admin=True)
            print("[OIDC Admin Callback] Admin login successful")
            
            # admin 대시보드로 리다이렉트
            if next_path:
                url = f"{base_host}{str(next_path)}"
            else:
                # 기본 admin 대시보드 URL로 리다이렉트
                url = f"{base_host}/general"
            
            print(f"[OIDC Admin Callback] Redirecting to: {url}")
            return HttpResponseRedirect(url)
        except AuthenticationException as e:
            print(f"[OIDC Admin Callback] Authentication error: {str(e)}")
            params = e.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = f"{base_host}?{urlencode(params)}"
            return HttpResponseRedirect(url)
