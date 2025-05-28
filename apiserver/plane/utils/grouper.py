# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Q, UUIDField, Value, QuerySet
from django.db.models.functions import Coalesce

# Module imports
from plane.db.models import (
    Cycle,
    Issue,
    Label,
    Module,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
)
from typing import Optional, Dict, Tuple, Any, Union, List


def issue_queryset_grouper(
    queryset: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> QuerySet[Issue]:
    FIELD_MAPPER: Dict[str, str] = {
        "label_ids": "labels__id",
        "assignee_ids": "assignees__id",
        "module_ids": "issue_module__module_id",
    }

    GROUP_FILTER_MAPPER: Dict[str, Q] = {
        "assignees__id": Q(issue_assignee__deleted_at__isnull=True),
        "labels__id": Q(label_issue__deleted_at__isnull=True),
        "issue_module__module_id": Q(issue_module__deleted_at__isnull=True),
    }

    for group_key in [group_by, sub_group_by]:
        if group_key in GROUP_FILTER_MAPPER:
            queryset = queryset.filter(GROUP_FILTER_MAPPER[group_key])

    annotations_map: Dict[str, Tuple[str, Q]] = {
        "assignee_ids": (
            "assignees__id",
            ~Q(assignees__id__isnull=True) & Q(issue_assignee__deleted_at__isnull=True),
        ),
        "label_ids": (
            "labels__id",
            ~Q(labels__id__isnull=True) & Q(label_issue__deleted_at__isnull=True),
        ),
        "module_ids": (
            "issue_module__module_id",
            (
                ~Q(issue_module__module_id__isnull=True)
                & Q(issue_module__module__archived_at__isnull=True)
                & Q(issue_module__deleted_at__isnull=True)
            ),
        ),
    }

    default_annotations: Dict[str, Any] = {
        key: Coalesce(
            ArrayAgg(field, distinct=True, filter=condition),
            Value([], output_field=ArrayField(UUIDField())),
        )
        for key, (field, condition) in annotations_map.items()
        if FIELD_MAPPER.get(key) != group_by or FIELD_MAPPER.get(key) != sub_group_by
    }

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> List[Dict[str, Any]]:
    # IssueSerializer를 사용하여 커스텀 필드 값들을 포함
    from plane.app.serializers import IssueSerializer
    
    # 커스텀 필드 값들을 포함하여 시리얼라이즈
    serialized_issues = IssueSerializer(issues, many=True).data
    
    return serialized_issues


def issue_group_values(
    field: str,
    slug: str,
    project_id: Optional[str] = None,
    filters: Dict[str, Any] = {},
) -> List[Union[str, Any]]:
    if field == "state_id":
        queryset = State.objects.filter(
            is_triage=False, workspace__slug=slug
        ).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    if field == "labels__id":
        queryset = Label.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "assignees__id":
        if project_id:
            return list(
                ProjectMember.objects.filter(
                    workspace__slug=slug, project_id=project_id, is_active=True
                ).values_list("member_id", flat=True)
            )
        return list(
            WorkspaceMember.objects.filter(
                workspace__slug=slug, is_active=True
            ).values_list("member_id", flat=True)
        )

    if field == "issue_module__module_id":
        queryset = Module.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "cycle_id":
        queryset = Cycle.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "project_id":
        queryset = Project.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        return list(queryset)

    if field == "priority":
        return ["low", "medium", "high", "urgent", "none"]

    if field == "state__group":
        return ["backlog", "unstarted", "started", "completed", "cancelled"]

    if field == "target_date":
        queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("target_date", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    if field == "start_date":
        queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("start_date", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    if field == "created_by":
        queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("created_by", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    return []
