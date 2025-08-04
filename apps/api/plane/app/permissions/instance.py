from rest_framework.permissions import BasePermission
from plane.license.models import Instance, InstanceAdmin

class InstanceAdminPermission(BasePermission):
    """인스턴스 관리자만 접근 가능한 권한"""
    
    def has_permission(self, request, view):
        if request.user.is_anonymous:
            return False
            
        # Instance와 InstanceAdmin을 사용한 권한 체크
        instance = Instance.objects.first()
        return InstanceAdmin.objects.filter(
            instance=instance,
            user=request.user,
            role__gte=15  # Admin role check
        ).exists() 