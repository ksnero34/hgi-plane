# Django imports
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import WorkSpaceAdminPermission
from plane.app.serializers import RestNotificationConfigSerializer, RestNotificationLogSerializer
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import RestNotificationConfig, RestNotificationLog


class RestNotificationConfigViewSet(BaseViewSet):
    serializer_class = RestNotificationConfigSerializer
    model = RestNotificationConfig
    permission_classes = [WorkSpaceAdminPermission]

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
        )

    def create(self, request, slug):
        from plane.db.models import Workspace
        
        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, slug, pk=None):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RestNotificationLogViewSet(BaseViewSet):
    serializer_class = RestNotificationLogSerializer
    model = RestNotificationLog
    permission_classes = [WorkSpaceAdminPermission]
    
    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(config__workspace__slug=self.kwargs.get("slug"))
        )

    def create(self, request, *args, **kwargs):
        return Response(
            {"error": "Creating logs is not allowed"}, 
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "Updating logs is not allowed"}, 
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Deleting logs is not allowed"}, 
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )


class RestNotificationTestEndpoint(BaseAPIView):
    permission_classes = [WorkSpaceAdminPermission]

    def post(self, request, slug):
        config_id = request.data.get("config_id")
        if not config_id:
            return Response(
                {"error": "config_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            config = RestNotificationConfig.objects.get(
                id=config_id, 
                workspace__slug=slug
            )
        except RestNotificationConfig.DoesNotExist:
            return Response(
                {"error": "Configuration not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        test_data = {
            "user_id": "test_user",
            "user_email": "test@example.com",
            "title": "Test Notification",
            "message": "This is a test notification",
            "issue_id": "TEST-001",
            "issue_name": "Test Issue",
            "workspace_name": config.workspace.name,
            "project_name": "Test Project"
        }

        from plane.bgtasks.rest_notification_task import send_rest_notification
        
        try:
            send_rest_notification.delay(config.id, test_data)
            return Response(
                {"message": "Test notification sent successfully"}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to send test notification: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )