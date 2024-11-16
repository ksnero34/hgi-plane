from django.urls import path
from plane.app.views.instance.base import InstanceMemberViewSet

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
]

__all__ = [
    "urlpatterns",
]