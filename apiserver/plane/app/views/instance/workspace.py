from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from plane.app.permissions import InstanceAdminPermission
from plane.db.models import DefaultWorkspaceConfig, Workspace

# 시리얼라이저 정의
class WorkspaceLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ['id', 'name', 'slug']

class DefaultWorkspaceConfigSerializer(serializers.ModelSerializer):
    workspace_detail = WorkspaceLiteSerializer(source='workspace', read_only=True)
    
    class Meta:
        model = DefaultWorkspaceConfig
        fields = ['id', 'workspace', 'workspace_detail', 'role', 'is_active', 'created_at', 'updated_at']

# 뷰셋 정의
class DefaultWorkspaceConfigViewSet(viewsets.ModelViewSet):
    serializer_class = DefaultWorkspaceConfigSerializer
    permission_classes = [IsAuthenticated, InstanceAdminPermission]

    def get_queryset(self):
        return DefaultWorkspaceConfig.objects.all()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def available_workspaces(self, request):
        """사용 가능한 워크스페이스 목록을 반환합니다."""
        # 이미 기본 워크스페이스로 설정된 워크스페이스 ID 목록
        configured_workspace_ids = DefaultWorkspaceConfig.objects.values_list(
            "workspace_id", flat=True
        )
        
        # 아직 설정되지 않은 워크스페이스 목록
        available_workspaces = Workspace.objects.exclude(
            id__in=configured_workspace_ids
        ).values("id", "name", "slug")
        
        return Response(available_workspaces)