from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from plane.license.models import FileUploadSettings, Instance, InstanceAdmin
from plane.app.serializers import FileSettingsSerializer
from plane.app.permissions import ROLE
from plane.authentication.session import BaseSessionAuthentication

class FileSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = FileSettingsSerializer
    model = FileUploadSettings
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def check_instance_admin(self, request):
        """사용자가 인스턴스 관리자인지 확인"""
        instance = Instance.objects.first()
        if not instance:
            return False
        return InstanceAdmin.objects.filter(
            instance=instance,
            user=request.user,
            role=20  # ROLE.ADMIN의 실제 값
        ).exists()

    def list(self, request):
        """모든 사용자가 file settings를 조회할 수 있도록 허용"""
        instance = FileUploadSettings.objects.first()
        if not instance:
            return Response(
                {
                    "max_file_size": 5 * 1024 * 1024,  # 기본값 5MB
                    "allowed_extensions": ["jpg", "jpeg", "png", "gif", "pdf"]
                },
                status=status.HTTP_200_OK
            )
        
        serializer = self.serializer_class(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        """admin만 file settings를 수정할 수 있도록 제한"""
        if not self.check_instance_admin(request):
            return Response(
                {"error": "You don't have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )

        instance = Instance.objects.first()
        if not instance:
            return Response(
                {"error": "Instance not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        file_settings = FileUploadSettings.objects.first()
        if not file_settings:
            # 새로운 FileUploadSettings 생성
            file_settings = FileUploadSettings.objects.create(
                instance=instance,
                max_file_size=5 * 1024 * 1024,  # 기본값 5MB
                allowed_extensions=["jpg", "jpeg", "png", "gif", "pdf"]
            )

        serializer = self.serializer_class(file_settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 