from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from plane.license.models import FileUploadSettings
from plane.app.serializers import FileSettingsSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.authentication.session import BaseSessionAuthentication

class FileSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = FileSettingsSerializer
    model = FileUploadSettings
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """모든 사용자가 file settings를 조회할 수 있도록 허용"""
        print("CSRF Token:", request.headers.get('X-CSRFToken'))
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

    @allow_permission([ROLE.ADMIN])
    def update(self, request, *args, **kwargs):
        """admin만 file settings를 수정할 수 있도록 제한"""
        instance = FileUploadSettings.objects.first()
        serializer = self.serializer_class(instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 