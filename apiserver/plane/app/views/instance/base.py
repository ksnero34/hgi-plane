from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from plane.app.serializers import UserSerializer
from plane.app.permissions import InstanceAdminPermission
from plane.db.models import User
from plane.license.models import Instance, InstanceAdmin

class InstanceMemberViewSet(ViewSet):
    """인스턴스 멤버 관리를 위한 ViewSet"""
    permission_classes = [IsAuthenticated, InstanceAdminPermission]
    serializer_class = UserSerializer

    def list(self, request):
        """모든 인스턴스 멤버 조회"""
        users = User.objects.filter(is_active=True).order_by("-date_joined")
        serializer = self.serializer_class(users, many=True)
        return Response(serializer.data)

    def update(self, request, pk=None):
        """멤버 권한 업데이트"""
        try:
            if str(request.user.id) == str(pk):
                return Response(
                    {"error": "You cannot modify your own permissions"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.get(pk=pk)
            instance = Instance.objects.first()
            
            # is_admin 파라미터로 변경
            is_admin = request.data.get("is_admin", False)
            
            if is_admin:
                # 관리자로 설정
                InstanceAdmin.objects.get_or_create(
                    instance=instance,
                    user=user,
                    defaults={"role": 20}  # Admin role
                )
            else:
                # 관리자 권한 제거
                InstanceAdmin.objects.filter(
                    instance=instance,
                    user=user
                ).delete()
            
            serializer = self.serializer_class(user)
            return Response(serializer.data)
            
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )