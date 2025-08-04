# Third Party imports
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectBasePermission
from plane.db.models import Project, ProjectMattermostConfig
from plane.app.serializers import ProjectMattermostConfigSerializer


class ProjectMattermostConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectMattermostConfigSerializer
    permission_classes = [IsAuthenticated, ProjectBasePermission]
    lookup_field = "project_id"

    @property
    def workspace_slug(self):
        return self.kwargs.get("slug")

    @property
    def project_id(self):
        return self.kwargs.get("project_id")

    def get_queryset(self):
        return ProjectMattermostConfig.objects.filter(
            project__workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id")
        )

    def get_object(self):
        # GET 요청에서만 get_or_create 사용
        if self.request.method == 'GET':
            project_id = self.kwargs.get("project_id")
            workspace_slug = self.kwargs.get("slug")
            
            try:
                project = Project.objects.get(
                    workspace__slug=workspace_slug,
                    id=project_id
                )
            except Project.DoesNotExist:
                from rest_framework.exceptions import NotFound
                raise NotFound("프로젝트를 찾을 수 없습니다.")

            obj, created = ProjectMattermostConfig.objects.get_or_create(
                project=project,
                defaults={
                    'created_by': self.request.user,
                    'updated_by': self.request.user
                }
            )
            return obj
        else:
            # POST/PUT/PATCH 요청에서는 기존 객체만 반환
            return super().get_object()

    def create(self, request, *args, **kwargs):
        project_id = self.kwargs.get("project_id")
        workspace_slug = self.kwargs.get("slug")
        
        try:
            project = Project.objects.get(
                workspace__slug=workspace_slug,
                id=project_id
            )
        except Project.DoesNotExist:
            return Response(
                {"error": "프로젝트를 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # 기존 설정이 있는지 확인
        existing_config = ProjectMattermostConfig.objects.filter(project=project).first()
        
        if existing_config:
            # 기존 설정이 있으면 업데이트
            serializer = self.get_serializer(existing_config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save(updated_by=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # 새로운 설정 생성
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(
                project=project,
                created_by=request.user,
                updated_by=request.user
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user) 