from collections import defaultdict

# Django imports
from django.db.models import Count, Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.views.base import BaseAPIView
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import (
    Cycle,
    Issue,
    Module,
    Project,
    ProjectMember,
)


STATE_GROUP_KEYS = ["backlog", "unstarted", "started", "completed", "cancelled"]


class ProjectOverviewEndpoint(BaseAPIView):
    """
    Provides aggregated information required for the project overview screen.
    """

    use_read_replica = True

    def _get_project(self, slug: str, project_id: str):
        return (
            Project.objects.filter(workspace__slug=slug, id=project_id, deleted_at__isnull=True)
            .select_related("workspace")
            .first()
        )

    def _get_state_distribution(self, slug: str, project_id: str):
        """
        Returns a dictionary keyed by state group with the number of work items in each group.
        """
        issues = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        raw_distribution = (
            issues.values("state__group")
            .filter(~Q(state__group=None))
            .annotate(count=Count("state__group"))
        )

        distribution = defaultdict(int, {state: 0 for state in STATE_GROUP_KEYS})
        for item in raw_distribution:
            state_group = item.get("state__group")
            if state_group in STATE_GROUP_KEYS:
                distribution[state_group] = item.get("count", 0)

        return {state: distribution[state] for state in STATE_GROUP_KEYS}

    def _get_members_count(self, slug: str, project_id: str) -> int:
        return ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            is_active=True,
            member__is_bot=False,
            deleted_at__isnull=True,
        ).count()

    def _get_cycles_count(self, slug: str, project_id: str) -> int:
        return (
            Cycle.objects.filter(
                workspace__slug=slug, project_id=project_id, deleted_at__isnull=True, archived_at__isnull=True
            ).count()
        )

    def _get_modules_count(self, slug: str, project_id: str) -> int:
        return (
            Module.objects.filter(
                workspace__slug=slug, project_id=project_id, deleted_at__isnull=True, archived_at__isnull=True
            ).count()
        )

    @allow_permission(
        [ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST],
        level="PROJECT",
    )
    def get(self, request, slug: str, project_id: str):
        project = self._get_project(slug, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        state_distribution = self._get_state_distribution(slug, project_id)
        total_issues = sum(state_distribution.values())
        open_issues = (
            state_distribution["backlog"] + state_distribution["unstarted"] + state_distribution["started"]
        )

        response_payload = {
            "project_id": str(project.id),
            "state_distribution": state_distribution,
            "open_issues": open_issues,
            "completed_issues": state_distribution["completed"],
            "cancelled_issues": state_distribution["cancelled"],
            "total_issues": total_issues,
            "cycles": self._get_cycles_count(slug, project_id),
            "modules": self._get_modules_count(slug, project_id),
            "members": self._get_members_count(slug, project_id),
        }

        return Response(response_payload, status=status.HTTP_200_OK)
