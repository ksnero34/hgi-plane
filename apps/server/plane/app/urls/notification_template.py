# Django imports
from django.urls import path

# Module imports
from plane.app.views.notification_template import (
    NotificationTemplateViewSet,
    NotificationTemplateListEndpoint,
)

urlpatterns = [
    path(
        "notification-templates/",
        NotificationTemplateListEndpoint.as_view(),
        name="notification-templates",
    ),
    path(
        "notification-templates/<uuid:pk>/",
        NotificationTemplateViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="notification-template",
    ),
    path(
        "notification-templates/create-system-templates/",
        NotificationTemplateViewSet.as_view(
            {
                "post": "create_system_templates",
            }
        ),
        name="create-system-templates",
    ),
]