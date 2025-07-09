from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging

from plane.license.models import FileUploadSettings, Instance, InstanceAdmin
from plane.app.serializers import FileSettingsSerializer
from plane.app.permissions import ROLE
from plane.authentication.session import BaseSessionAuthentication

logger = logging.getLogger(__name__)

class FileSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = FileSettingsSerializer
    model = FileUploadSettings
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def check_instance_admin(self, request):
        """사용자가 인스턴스 관리자인지 확인"""
        instance = Instance.objects.first()
        if not instance:
            logger.error("No instance found")
            return False
        
        # 유저 정보 로깅
        logger.info(f"Checking permissions for user: {request.user.email}")
        logger.info(f"User ID: {request.user.id}")
        logger.info(f"Is superuser: {request.user.is_superuser}")
        
        # 인스턴스 관리자 확인
        is_instance_admin = InstanceAdmin.objects.filter(
            instance=instance,
            user=request.user,
            role=ROLE.ADMIN.value
        ).exists()
        
        logger.info(f"Is instance admin: {is_instance_admin}")
        
        # 모든 인스턴스 관리자 정보 로깅
        all_admins = InstanceAdmin.objects.filter(instance=instance, role=ROLE.ADMIN.value)
        logger.info("All instance admins:")
        for admin in all_admins:
            logger.info(f"- Admin: {admin.user.email} (ID: {admin.user.id}, Role: {admin.role})")

        result = is_instance_admin or request.user.is_superuser
        logger.info(f"Final permission result: {result}")
        return result

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
        logger.info("File settings update requested")
        logger.info(f"Request user: {request.user.email}")
        logger.info(f"Request data: {request.data}")
        
        if not self.check_instance_admin(request):
            logger.warning(f"Permission denied for user: {request.user.email}")
            return Response(
                {"error": "You don't have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )

        instance = Instance.objects.first()
        if not instance:
            logger.error("No instance found during update")
            return Response(
                {"error": "Instance not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        file_settings = FileUploadSettings.objects.first()
        if not file_settings:
            logger.info("Creating new file settings")
            file_settings = FileUploadSettings.objects.create(
                instance=instance,
                max_file_size=5 * 1024 * 1024,
                allowed_extensions=["jpg", "jpeg", "png", "gif", "pdf"]
            )

        serializer = self.serializer_class(file_settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            logger.info("File settings updated successfully")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"Serializer validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 