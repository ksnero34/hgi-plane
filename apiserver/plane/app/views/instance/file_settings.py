from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from plane.app.permissions import InstanceAdminPermission
from plane.license.models import Instance, FileUploadSettings
from plane.app.serializers import FileSettingsSerializer

class FileSettingsViewSet(ViewSet):
    """파일 업로드 설정을 관리하기 위한 ViewSet"""
    permission_classes = [IsAuthenticated, InstanceAdminPermission]
    serializer_class = FileSettingsSerializer

    def list(self, request):
        """파일 업로드 설정 조회"""
        instance = Instance.objects.first()
        settings = FileUploadSettings.objects.filter(instance=instance).first()
        
        if not settings:
            settings = FileUploadSettings.objects.create(
                instance=instance,
                allowed_extensions=["jpg", "png", "pdf", "doc", "docx"],
                max_file_size=5 * 1024 * 1024  # 5MB
            )
        
        serializer = self.serializer_class(settings)
        return Response(serializer.data)

    def update(self, request):
        """파일 업로드 설정 업데이트"""
        instance = Instance.objects.first()
        settings = FileUploadSettings.objects.filter(instance=instance).first()
        
        serializer = self.serializer_class(
            settings,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 