from django.conf import settings
from django.http import HttpResponse
from django.db import IntegrityError
from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from plane.utils.audit_logger import log_audit
from plane.app.serializers import ProjectSerializer
from plane.app.services.project_transfer import ProjectTransferService
from plane.db.models import Project, Workspace, Instance, InstanceAdmin


class AdminProjectTransferView(APIView):
    """
    인스턴스 관리자 전용 프로젝트 이동 API
    다른 워크스페이스로 프로젝트 이동
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # 관리자 권한 검증
        instance = Instance.objects.first()
        is_admin = InstanceAdmin.objects.filter(
            instance=instance, user=request.user
        ).exists()
        
        if not is_admin:
            return Response(
                {"error": "관리자 권한이 필요합니다."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # 필수 데이터 검증
        project_id = request.data.get("project_id")
        source_workspace_id = request.data.get("source_workspace_id")
        target_workspace_id = request.data.get("target_workspace_id")
        
        if not all([project_id, source_workspace_id, target_workspace_id]):
            return Response(
                {"error": "project_id, source_workspace_id, target_workspace_id가 모두 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # 프로젝트 이동 서비스 호출
            result = ProjectTransferService.transfer_project(
                project_id=project_id,
                source_workspace_id=source_workspace_id,
                target_workspace_id=target_workspace_id,
                admin_user=request.user
            )
            
            if not result.get("success", False):
                return Response(
                    {"error": result.get("error", "프로젝트 이동 중 오류가 발생했습니다.")},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            project = result.get("project")
            source_workspace = result.get("source_workspace")
            target_workspace = result.get("target_workspace")
            
            # 관리자 작업 로그 기록
            log_audit(
                action="project_transfer",
                user_id=str(request.user.id),
                user_email=request.user.email,
                resource_type="project",
                resource_id=str(project.id),
                details={
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "source_workspace_id": str(source_workspace.id),
                    "source_workspace_name": source_workspace.name,
                    "target_workspace_id": str(target_workspace.id),
                    "target_workspace_name": target_workspace.name,
                },
                ip_address=None,
                request=request
            )
            
            # 성공 응답
            serializer = ProjectSerializer(project)
            return Response(
                {
                    "message": "프로젝트가 성공적으로 이동되었습니다.",
                    "project": serializer.data,
                    "source_workspace": {
                        "id": str(source_workspace.id),
                        "name": source_workspace.name,
                        "slug": source_workspace.slug,
                    },
                    "target_workspace": {
                        "id": str(target_workspace.id),
                        "name": target_workspace.name,
                        "slug": target_workspace.slug,
                    }
                },
                status=status.HTTP_200_OK
            )
            
        except Project.DoesNotExist:
            return Response(
                {"error": "프로젝트를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Workspace.DoesNotExist:
            return Response(
                {"error": "워크스페이스를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )
        except IntegrityError as e:
            return Response(
                {"error": f"데이터베이스 무결성 오류: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"프로젝트 이동 중 오류가 발생했습니다: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 