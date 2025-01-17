import uuid
from urllib.parse import urlencode, urljoin

from django.http import HttpResponseRedirect
from django.views import View

from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.authentication.utils.login import user_login
from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.utils.user_auth_workflow import post_user_auth_workflow
from plane.license.models import Instance
from plane.authentication.utils.host import base_host
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)

class OIDCOauthInitiateEndpoint(View):
    def get(self, request):
        # Get host and next path
        request.session["host"] = base_host(request=request, is_app=True)
        request.session["is_admin_login"] = False  # admin이 아님을 명시
        next_path = request.GET.get("next_path")
        if next_path:
            request.session["next_path"] = str(next_path)

        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = urljoin(
                base_host(request=request, is_app=True),
                "?" + urlencode(params),
            )
            return HttpResponseRedirect(url)

        try:
            state = uuid.uuid4().hex
            provider = OIDCOAuthProvider(request=request, state=state)
            request.session["state"] = state
            auth_url = provider.get_auth_url()
            return HttpResponseRedirect(auth_url)
        except AuthenticationException as e:
            params = e.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = urljoin(
                base_host(request=request, is_app=True),
                "?" + urlencode(params),
            )
            return HttpResponseRedirect(url)

class OIDCCallbackEndpoint(View):
    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        base_host = request.session.get("host")
        next_path = request.session.get("next_path")

        if state != request.session.get("state", ""):
            # print("state is not present")
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = urljoin(
                base_host,
                "?" + urlencode(params),
            )
            return HttpResponseRedirect(url)

        if not code:
            # print("code is not present")
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )
            params = exc.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = urljoin(
                base_host,
                "?" + urlencode(params),
            )
            return HttpResponseRedirect(url)

        try:
            provider = OIDCOAuthProvider(
                request=request,
                code=code,
                callback=post_user_auth_workflow,
            )
            # print("provider", provider)
            user = provider.authenticate()
            # Login the user and record his device info
            user_login(request=request, user=user, is_app=True)
            # Get the redirection path
            if next_path:
                path = next_path
            else:
                path = get_redirection_path(user=user)
            # redirect to referer path
            url = urljoin(base_host, path)
            return HttpResponseRedirect(url)
        except AuthenticationException as e:
            params = e.get_error_dict()
            if next_path:
                params["next_path"] = str(next_path)
            url = urljoin(
                base_host,
                "?" + urlencode(params),
            )
            return HttpResponseRedirect(url)
 