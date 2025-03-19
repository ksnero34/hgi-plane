from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
import logging
from plane.app.permissions import ROLE
from plane.db.models import DefaultWorkspaceConfig, Workspace, WorkspaceMember
from plane.license.models import Instance, InstanceAdmin
from django.db.models import Count, OuterRef, Subquery, Func, F

# 로거 설정
logger = logging.getLogger(__name__)

# 시리얼라이저 정의
class WorkspaceLiteSerializer(serializers.ModelSerializer):
    logo_url = serializers.CharField(source='logo', read_only=True)
    total_members = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Workspace
        fields = ['id', 'name', 'slug', 'logo_url', 'total_members']
    
    def get_total_members(self, obj):
        # total_members 필드가 이미 annotate로 추가되어 있다면 그것을 사용
        if hasattr(obj, 'total_members'):
            return obj.total_members
        # 그렇지 않으면 0 반환 (실제로는 추가 쿼리가 필요할 수 있음)
        return 0

class DefaultWorkspaceConfigSerializer(serializers.ModelSerializer):
    workspace_detail = WorkspaceLiteSerializer(source='workspace', read_only=True)
    
    class Meta:
        model = DefaultWorkspaceConfig
        fields = ['id', 'workspace', 'workspace_detail', 'role', 'is_active', 'created_at', 'updated_at']

# 뷰셋 정의
class DefaultWorkspaceConfigViewSet(viewsets.ModelViewSet):
    serializer_class = DefaultWorkspaceConfigSerializer
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
            role__gte=15  # Admin role check (15 이상이면 관리자 권한)
        ).exists()
        
        logger.info(f"Is instance admin: {is_instance_admin}")
        
        # 모든 인스턴스 관리자 정보 로깅
        all_admins = InstanceAdmin.objects.filter(instance=instance, role__gte=15)
        logger.info("All instance admins:")
        for admin in all_admins:
            logger.info(f"- Admin: {admin.user.email} (ID: {admin.user.id}, Role: {admin.role})")

        result = is_instance_admin or request.user.is_superuser
        logger.info(f"Final permission result: {result}")
        return result

    def get_queryset(self):
        return DefaultWorkspaceConfig.objects.all()
    
    def list(self, request, *args, **kwargs):
        """
        모든 워크스페이스 정보와 기본 워크스페이스 설정 상태를 반환합니다.
        """
        try:
            # 인스턴스 관리자 권한 확인
            if not self.check_instance_admin(request):
                logger.warning(f"Permission denied for user: {request.user.email}")
                return Response(
                    {"error": "You don't have permission to perform this action."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 워크스페이스별로 가장 최근 설정 가져오기
            latest_configs = {}
            for config in DefaultWorkspaceConfig.objects.select_related('workspace').all():
                workspace_id = str(config.workspace_id)  # UUID를 문자열로 변환
                if workspace_id not in latest_configs or config.created_at > latest_configs[workspace_id].created_at:
                    latest_configs[workspace_id] = config
            
            # 모든 워크스페이스 가져오기
            member_count = (
                WorkspaceMember.objects.filter(
                    workspace=OuterRef('id'),
                    member__is_bot=False,
                    is_active=True
                )
                .order_by()
                .annotate(count=Func(F('id'), function='Count'))
                .values('count')
            )
            
            workspaces = Workspace.objects.annotate(
                total_members=Subquery(member_count)
            )
            
            # 응답 데이터 구성
            results = []
            for workspace in workspaces:
                workspace_id = str(workspace.id)  # UUID를 문자열로 변환
                config = latest_configs.get(workspace_id)
                
                results.append({
                    "id": workspace_id,
                    "name": workspace.name,
                    "slug": workspace.slug,
                    "logo_url": workspace.logo,
                    "total_members": workspace.total_members or 0,
                    "is_default": bool(config),
                    "role": config.role if config else None,
                    "config_id": str(config.id) if config else None
                })
            
            # 페이지네이션 형식으로 응답
            response_data = {
                "results": results,
                "next_cursor": None,
                "next_page_results": False,
                "prev_cursor": None
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in list view: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        """
        워크스페이스 설정을 생성합니다.
        """
        try:
            # 인스턴스 관리자 권한 확인
            if not self.check_instance_admin(request):
                logger.warning(f"Permission denied for user: {request.user.email}")
                return Response(
                    {"error": "You don't have permission to perform this action."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"요청 데이터: {request.data}")
            
            if 'workspace_id' in request.data:
                # workspace_id를 workspace로 변환
                request.data['workspace'] = request.data.pop('workspace_id')
            
            # 워크스페이스 ID 가져오기
            workspace_id = request.data.get('workspace')
            if not workspace_id:
                return Response(
                    {"error": "워크스페이스 ID는 필수 항목입니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 이미 존재하는 설정 확인
            existing_config = DefaultWorkspaceConfig.objects.filter(workspace_id=workspace_id).first()
            if existing_config:
                # 이미 존재하는 설정이 있으면 해당 설정 반환
                logger.info(f"워크스페이스({workspace_id})에 대한 설정이 이미 존재합니다. 기존 설정을 반환합니다.")
                serializer = self.get_serializer(existing_config)
                return Response(
                    serializer.data,
                    status=status.HTTP_200_OK
                )
                
            # 시리얼라이저 생성 및 유효성 검사
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # 생성 수행
            self.perform_create(serializer)
            
            # 응답 반환
            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
                headers=headers
            )
        except Exception as e:
            logger.error(f"워크스페이스 설정 생성 중 오류: {str(e)}")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        serializer.save(is_active=True)

    def update(self, request, *args, **kwargs):
        """
        워크스페이스 설정을 업데이트합니다.
        """
        try:
            # 인스턴스 관리자 권한 확인
            if not self.check_instance_admin(request):
                logger.warning(f"Permission denied for user: {request.user.email}")
                return Response(
                    {"error": "You don't have permission to perform this action."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"워크스페이스 설정 업데이트 중 오류: {str(e)}")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=["get"])
    def available_workspaces(self, request):
        """사용 가능한 워크스페이스 목록을 반환합니다."""
        try:
            # 인스턴스 관리자 권한 확인
            if not self.check_instance_admin(request):
                logger.warning(f"Permission denied for user: {request.user.email}")
                return Response(
                    {"error": "You don't have permission to perform this action."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 이미 기본 워크스페이스로 설정된 워크스페이스 ID 목록
            configured_workspace_ids = DefaultWorkspaceConfig.objects.values_list(
                "workspace_id", flat=True
            )
            
            # 아직 설정되지 않은 워크스페이스 쿼리셋
            member_count = (
                WorkspaceMember.objects.filter(
                    workspace=OuterRef('id'), 
                    member__is_bot=False, 
                    is_active=True
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            
            # 워크스페이스 쿼리 실행 (total_members 포함)
            available_workspaces = Workspace.objects.exclude(
                id__in=configured_workspace_ids
            ).annotate(
                total_members=Subquery(member_count)
            ).values(
                "id", "name", "slug", "logo", "total_members"
            )
            
            # 결과를 API 응답 형식에 맞게 변환 (logo -> logo_url)
            results = []
            for workspace in available_workspaces:
                results.append({
                    "id": workspace["id"],
                    "name": workspace["name"],
                    "slug": workspace["slug"],
                    "logo_url": workspace["logo"],
                    "total_members": workspace["total_members"]
                })
            
            # 페이지네이션 형식으로 결과 반환
            response_data = {
                "results": results,
                "next_cursor": None,
                "next_page_results": False,
                "prev_cursor": None
            }
            
            print(f"Available workspaces response format: {response_data}")
            
            # 명시적으로 JSON 직렬화가 가능한 형식으로 반환
            return Response(
                response_data,
                status=status.HTTP_200_OK,
                content_type="application/json"
            )
        except Exception as e:
            print(f"Error in available_workspaces: {str(e)}")
            # 오류 발생 시에도 페이지네이션 형식으로 빈 리스트 반환
            response_data = {
                "results": [],
                "next_cursor": None,
                "next_page_results": False,
                "prev_cursor": None
            }
            return Response(
                response_data,
                status=status.HTTP_200_OK,
                content_type="application/json"
            )

    @action(detail=False, methods=["post"])
    def cleanup_duplicate_configs(self, request):
        """
        중복된 워크스페이스 설정을 정리합니다.
        """
        try:
            # 인스턴스 관리자 권한 확인
            if not self.check_instance_admin(request):
                logger.warning(f"Permission denied for user: {request.user.email}")
                return Response(
                    {"error": "You don't have permission to perform this action."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # 워크스페이스별 설정 그룹화
            workspace_configs = {}
            for config in DefaultWorkspaceConfig.objects.all():
                if config.workspace_id not in workspace_configs:
                    workspace_configs[config.workspace_id] = []
                workspace_configs[config.workspace_id].append(config)
            
            # 중복 설정 정리
            cleaned_count = 0
            for workspace_id, configs in workspace_configs.items():
                # 설정이 2개 이상인 경우 최신 설정을 제외한 나머지 삭제
                if len(configs) > 1:
                    # 생성일 기준 정렬
                    sorted_configs = sorted(configs, key=lambda x: x.created_at, reverse=True)
                    # 최신 설정을 제외한 나머지 삭제
                    for config in sorted_configs[1:]:
                        config.delete()
                        cleaned_count += 1
            
            return Response(
                {
                    "message": f"{cleaned_count}개의 중복 설정이 정리되었습니다.",
                    "cleaned_count": cleaned_count
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"중복 설정 정리 중 오류: {str(e)}")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )