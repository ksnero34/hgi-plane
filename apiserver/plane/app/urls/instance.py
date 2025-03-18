from django.urls import path
from plane.app.views.instance.base import InstanceMemberViewSet
from plane.app.views.instance.file_settings import FileSettingsViewSet
from plane.app.views.instance.workspace import DefaultWorkspaceConfigViewSet
from plane.app.views import WorkSpaceViewSet

urlpatterns = [
    path(
        "instances/members/",
        InstanceMemberViewSet.as_view({"get": "list"}),
        name="instance-members",
    ),
    path(
        "instances/members/<str:pk>/",
        InstanceMemberViewSet.as_view({"patch": "update"}),
        name="instance-member-detail",
    ),
    path(
        "instances/file-settings/",
        FileSettingsViewSet.as_view({"get": "list", "patch": "update"}),
        name="instance-file-settings",
    ),
    # 기본 워크스페이스 설정 관련 URL
    path(
        "instances/default-workspaces/",
        DefaultWorkspaceConfigViewSet.as_view({"get": "list", "post": "create"}),
        name="instance-default-workspaces",
    ),
    path(
        "instances/default-workspaces/<str:pk>/",
        DefaultWorkspaceConfigViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="instance-default-workspace-detail",
    ),
    # 인스턴스 관리자용 워크스페이스 목록 URL
    path(
        "instances/workspaces/",
        WorkSpaceViewSet.as_view({"get": "list"}),
        name="instance-workspaces",
    ),
]

__all__ = [
    "urlpatterns",
]