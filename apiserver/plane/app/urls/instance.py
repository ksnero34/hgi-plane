from django.urls import path
from plane.app.views.instance.base import InstanceMemberViewSet
from plane.app.views.instance.file_settings import FileSettingsViewSet

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
]

__all__ = [
    "urlpatterns",
]