# Django imports
from rest_framework import viewsets, status
from rest_framework.response import Response

# Module imports
from plane.app.serializers import IssueTypeSerializer, ProjectIssueTypeSerializer
from plane.db.models import IssueType, ProjectIssueType


class IssueTypeViewSet(viewsets.ModelViewSet):
    serializer_class = IssueTypeSerializer
    model = IssueType

    def get_queryset(self):
        return self.model.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
        ).order_by("name")


class ProjectIssueTypeViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectIssueTypeSerializer
    model = ProjectIssueType

    def get_queryset(self):
        return self.model.objects.filter(
            project_id=self.kwargs.get("project_id"),
            workspace__slug=self.kwargs.get("slug"),
        ).order_by("issue_type__name")

    def create(self, request, *args, **kwargs):
        from plane.db.models import Workspace, Project
        
        workspace = Workspace.objects.get(slug=self.kwargs.get("slug"))
        project = Project.objects.get(id=self.kwargs.get("project_id"))
        
        # Create the IssueType first
        issue_type_data = {
            "name": request.data.get("name"),
            "description": request.data.get("description", ""),
            "logo_props": request.data.get("logo_props", {}),
            "workspace": workspace,
        }
        
        issue_type = IssueType.objects.create(**issue_type_data)
        
        # Create the ProjectIssueType
        project_issue_type = ProjectIssueType.objects.create(
            project=project,
            issue_type=issue_type,
            workspace=workspace,
        )
        
        serializer = self.get_serializer(project_issue_type)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Update the IssueType
        issue_type = instance.issue_type
        if "name" in request.data:
            issue_type.name = request.data.get("name")
        if "description" in request.data:
            issue_type.description = request.data.get("description", "")
        if "logo_props" in request.data:
            issue_type.logo_props = request.data.get("logo_props", {})
        
        issue_type.save()
        
        # Refresh the instance
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        issue_type = instance.issue_type
        
        # Delete the ProjectIssueType first
        instance.delete()
        
        # Delete the IssueType if it's not used in other projects
        if not ProjectIssueType.objects.filter(issue_type=issue_type).exists():
            issue_type.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
