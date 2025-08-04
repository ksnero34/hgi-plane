from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.license.api.permissions import InstanceAdminPermission
from plane.db.models import Project, Workspace
from plane.app.serializers import ProjectListSerializer
from plane.license.services.project_transfer import ProjectTransferService

class InstanceAdminProjectEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    
    def get(self, request, slug):
        try:
            workspace = Workspace.objects.get(slug=slug)
            projects = Project.objects.filter(workspace=workspace).select_related(
                "workspace", "default_assignee", "project_lead"
            ).prefetch_related(
                "project_projectmember",
                "project_projectmember__member",
            )
            
            serializer = ProjectListSerializer(projects, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Workspace.DoesNotExist:
            return Response(
                {"error": "워크스페이스를 찾을 수 없습니다"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, slug):
        """프로젝트를 다른 워크스페이스로 이동"""
        try:
            # 필수 데이터 검증
            project_id = request.data.get("project_id")
            target_workspace_id = request.data.get("target_workspace_id")
            
            if not all([project_id, target_workspace_id]):
                return Response(
                    {"error": "project_id와 target_workspace_id가 필요합니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 현재 워크스페이스 확인
            source_workspace = Workspace.objects.get(slug=slug)
                
            # 프로젝트 이동 서비스 호출
            result = ProjectTransferService.transfer_project(
                project_id=project_id,
                source_workspace_id=str(source_workspace.id),
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
            
            return Response(
                {
                    "message": "프로젝트가 성공적으로 이동되었습니다.",
                    "project": ProjectListSerializer(project).data,
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
            
        except Workspace.DoesNotExist:
            return Response(
                {"error": "워크스페이스를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Project.DoesNotExist:
            return Response(
                {"error": "프로젝트를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"프로젝트 이동 중 오류가 발생했습니다: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 