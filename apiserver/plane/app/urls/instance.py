from django.urls import path
from plane.app.views.instance.base import InstanceMemberViewSet, InstanceMemberPublicViewSet
from plane.app.views.instance.file_settings import FileSettingsViewSet
from plane.app.views.instance.workspace import DefaultWorkspaceConfigViewSet
from plane.app.views import WorkSpaceViewSet

urlpatterns = [
    # 인스턴스 멤버 관리 URL
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
    
    # 파일 설정 관련 URL
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
    # 사용 가능한 워크스페이스 경로를 id 경로보다 먼저 정의해야 함
    path(
        "instances/default-workspaces/available/",
        DefaultWorkspaceConfigViewSet.as_view({"get": "available_workspaces"}),
        name="instance-available-workspaces",
    ),
    path(
        "instances/default-workspaces/<str:pk>/",
        DefaultWorkspaceConfigViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="instance-default-workspace-detail",
    ),
    
    # 인스턴스 관리자용 워크스페이스 관리 URL
    path(
        "instances/workspaces/",
        WorkSpaceViewSet.as_view({"get": "list", "post": "create"}),
        name="instance-workspaces",
    ),
    # public 멤버 목록 조회 URL
    path(
        "instances/public/members/",
        InstanceMemberPublicViewSet.as_view({"get": "list"}),
        name="instance-public-members",
    ),
]

__all__ = [
    "urlpatterns",
]