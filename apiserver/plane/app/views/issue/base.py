# Python imports
import json

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import (
    Exists,
    F,
    Func,
    OuterRef,
    Prefetch,
    Q,
    UUIDField,
    Value,
    Subquery,
    Case,
    CharField,
    IntegerField,
    When,
    Count,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page
from django.core.files.uploadedfile import UploadedFile

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import (
    allow_permission, 
    ROLE,
)
from plane.app.serializers import (
    IssueCreateSerializer,
    IssueDetailSerializer,
    IssueUserPropertySerializer,
    IssueSerializer,
)
from plane.bgtasks.issue_activities_task import issue_activity
from plane.bgtasks.import_task import issue_import_task
from plane.db.models import (
    Issue,
    FileAsset,
    IssueLink,
    IssueUserProperty,
    IssueReaction,
    IssueSubscriber,
    Project,
    ProjectMember,
    CycleIssue,
    UserRecentVisit,
    ModuleIssue,
    Workspace,
    CustomFieldValue,
    CustomField,
)
from plane.utils.grouper import (
    issue_group_values,
    issue_on_results,
    issue_queryset_grouper,
)
from plane.utils.issue_filters import issue_filters
from plane.utils.order_queryset import order_issue_queryset
from plane.utils.paginator import GroupedOffsetPaginator, SubGroupedOffsetPaginator
from .. import BaseAPIView, BaseViewSet
from plane.utils.timezone_converter import user_timezone_converter
from plane.bgtasks.recent_visited_task import recent_visited_task
from plane.utils.global_paginator import paginate
from plane.bgtasks.webhook_task import model_activity
from plane.bgtasks.issue_description_version_task import issue_description_version_task
from plane.utils.audit_logger import log_audit
from plane.utils.host import base_host
from plane.utils.ip_address import get_client_ip

class IssueListEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def get(self, request, slug, project_id):
        issue_ids = request.GET.get("issues", False)

        if issue_ids:
            issues = (
                Issue.issue_objects.filter(
                    workspace__slug=slug, project_id=project_id, pk__in=issue_ids.split(",")
                )
                .prefetch_related(
                    Prefetch(
                        "custom_field_values",
                        queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                    )
                )
                .annotate(
                    sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                    .order_by()
                    .annotate(count=Func(F("id"), function="Count"))
                    .values("count")
                )
                .annotate(
                    link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                    .order_by()
                    .annotate(count=Func(F("id"), function="Count"))
                    .values("count")
                )
                .annotate(
                    attachment_count=FileAsset.objects.filter(
                        issue_id=OuterRef("id"),
                        entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                    )
                    .order_by()
                    .annotate(count=Func(F("id"), function="Count"))
                    .values("count")
                )
                .annotate(
                    cycle_id=Subquery(
                        CycleIssue.objects.filter(
                            issue=OuterRef("id"), deleted_at__isnull=True
                        ).values("cycle_id")[:1]
                    )
                )
                .annotate(
                    module_ids=Coalesce(
                        ArrayAgg(
                            "issue_module__module_id",
                            distinct=True,
                            filter=~Q(issue_module__module_id__isnull=True),
                        ),
                        Value([], output_field=ArrayField(UUIDField())),
                    )
                )
                .annotate(
                    label_ids=Coalesce(
                        ArrayAgg(
                            "labels__id",
                            distinct=True,
                            filter=~Q(labels__id__isnull=True),
                        ),
                        Value([], output_field=ArrayField(UUIDField())),
                    )
                )
                .annotate(
                    assignee_ids=Coalesce(
                        ArrayAgg(
                            "assignees__id",
                            distinct=True,
                            filter=~Q(assignees__id__isnull=True),
                        ),
                        Value([], output_field=ArrayField(UUIDField())),
                    )
                )
            )

            recent_visited_task.delay(
                slug=slug,
                project_id=project_id,
                entity_name="project",
                entity_identifier=project_id,
                user_id=request.user.id,
            )

            # 항상 IssueSerializer를 사용하여 커스텀 필드 값들을 포함
            issues = IssueSerializer(issues, many=True).data
            return Response(issues, status=status.HTTP_200_OK)

        filters = issue_filters(request.query_params, "GET")
        
        # 커스텀 필드 필터 처리
        custom_field_filters = filters.pop('custom_field_filters', None)
        # print(f"[DEBUG] IssueListEndpoint - custom_field_filters: {custom_field_filters}")
        # print(f"[DEBUG] IssueListEndpoint - remaining filters: {filters}")

        # Custom ordering for priority and state
        priority_order = ["urgent", "high", "medium", "low", "none"]
        state_order = ["backlog", "unstarted", "started", "completed", "cancelled"]

        order_by_param = request.GET.get("order_by", "-created_at")

        issue_queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(project_id=project_id)
            .filter(**filters)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .prefetch_related(
                Prefetch(
                    "custom_field_values",
                    queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                )
            )
            .annotate(cycle_id=Subquery(CycleIssue.objects.filter(issue=OuterRef("id")).values("cycle_id")[:1]))
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                module_ids=Coalesce(
                    ArrayAgg(
                        "issue_module__module_id",
                        distinct=True,
                        filter=~Q(issue_module__module_id__isnull=True),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                )
            )
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=~Q(labels__id__isnull=True),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                )
            )
            .annotate(
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=~Q(assignees__id__isnull=True),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                )
            )
        )
        
        # 커스텀 필드 필터 적용
        if custom_field_filters:
            # print(f"[DEBUG] IssueListEndpoint - Applying custom field filters: {custom_field_filters}")
            
            for custom_filter in custom_field_filters:
                field_id = custom_filter['field_id']
                values = custom_filter['values']
                # print(f"[DEBUG] IssueListEndpoint - Filtering by field_id: {field_id}, values: {values}")
                
                # 커스텀 필드 타입 확인
                try:
                    custom_field = CustomField.objects.get(id=field_id)
                    field_type = custom_field.field_type
                    # print(f"[DEBUG] IssueListEndpoint - Field type: {field_type}")
                except CustomField.DoesNotExist:
                    # print(f"[DEBUG] IssueListEndpoint - Custom field {field_id} not found")
                    continue
                
                # 여러 값에 대한 OR 조건 생성
                q_objects = Q()
                for value in values:
                    if field_type == "select":
                        # select 필드: 문자열 포함 검색 (가장 확실한 방법)
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        
                        # print(f"[DEBUG] IssueListEndpoint - Searching for contains: {value}")
                    elif field_type == "multiselect":
                        # multiselect 필드: JSON 배열에 포함된 경우 확인
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__contains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                    elif field_type == "project_member":
                        # project_member 필드: 단일 멤버 ID로 필터링
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        # print(f"[DEBUG] IssueListEndpoint - Searching for project member: {value}")
                    elif field_type == "project_members":
                        # project_members 필드: 다중 멤버 ID로 필터링 (JSON 배열)
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__contains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        # print(f"[DEBUG] IssueListEndpoint - Searching for project members: {value}")
                    elif field_type == "date":
                        # date 필드: 날짜 범위 처리
                        if ';' in value:
                            # "1_weeks;after;fromnow" 또는 "2025-05-29;after" 형태 처리
                            parts = value.split(';')
                            
                            if len(parts) >= 2:
                                date_part = parts[0]
                                condition = parts[1]
                                
                                # fromnow 처리 (상대적 날짜)
                                if len(parts) >= 3 and parts[2] == "fromnow":
                                    from datetime import datetime, timedelta
                                    import re
                                    
                                    # "1_weeks", "2_days" 등 파싱
                                    match = re.match(r'(\d+)_(\w+)', date_part)
                                    if match:
                                        amount = int(match.group(1))
                                        unit = match.group(2)
                                        
                                        # 현재 날짜 기준으로 계산
                                        now = datetime.now().date()
                                        if unit.startswith('day'):
                                            target_date = now + timedelta(days=amount)
                                        elif unit.startswith('week'):
                                            target_date = now + timedelta(weeks=amount)
                                        elif unit.startswith('month'):
                                            target_date = now + timedelta(days=amount * 30)  # 근사치
                                        elif unit.startswith('year'):
                                            target_date = now + timedelta(days=amount * 365)  # 근사치
                                        else:
                                            target_date = now
                                        
                                        date_str = target_date.strftime('%Y-%m-%d')
                                        # print(f"[DEBUG] IssueListEndpoint - Calculated date from {date_part}: {date_str}")
                                    else:
                                        date_str = date_part
                                else:
                                    date_str = date_part
                                
                                if condition == "after":
                                    # 해당 날짜 이후의 모든 날짜 찾기
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__gte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                elif condition == "before":
                                    # 해당 날짜 이전의 모든 날짜 찾기
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__lte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                elif condition == "within":
                                    # 현재 날짜부터 해당 날짜까지의 범위
                                    from datetime import datetime
                                    now = datetime.now().date()
                                    now_str = now.strftime('%Y-%m-%d')
                                    
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__gte=f'"{now_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    ) & Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__lte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                    # print(f"[DEBUG] IssueListEndpoint - Date filter: {date_str} {condition}")
                        else:
                            # 정확한 날짜 매칭
                            import json
                            json_value = json.dumps(value, ensure_ascii=False)
                            q_objects |= Q(
                                custom_field_values__custom_field_id=field_id,
                                custom_field_values__value=json_value,
                                custom_field_values__deleted_at__isnull=True
                            )
                
                issue_queryset = issue_queryset.filter(q_objects)
                # print(f"[DEBUG] IssueListEndpoint - After filtering, queryset count: {issue_queryset.count()}")
        else:
            # print(f"[DEBUG] IssueListEndpoint - No custom field filters to apply")
            pass
        
        issue_queryset = issue_queryset.distinct()

        # Order queryset based on priority
        if order_by_param == "priority" or order_by_param == "-priority":
            priority_order = (
                priority_order if order_by_param == "priority" else priority_order[::-1]
            )
            issue_queryset = issue_queryset.annotate(
                priority_order=Case(
                    *[
                        When(priority=p, then=Value(i))
                        for i, p in enumerate(priority_order)
                    ],
                    output_field=CharField(),
                )
            ).order_by("priority_order")

        elif order_by_param in [
            "state__name",
            "state__group",
            "-state__name",
            "-state__group",
        ]:
            state_order = (
                state_order
                if order_by_param in ["state__name", "state__group"]
                else state_order[::-1]
            )
            issue_queryset = issue_queryset.annotate(
                state_order=Case(
                    *[
                        When(state__group=state_group, then=Value(i))
                        for i, state_group in enumerate(state_order)
                    ],
                    default=Value(len(state_order)),
                    output_field=IntegerField(),
                )
            ).order_by("state_order")
        else:
            issue_queryset = issue_queryset.order_by(order_by_param)

        recent_visited_task.delay(
            slug=slug,
            project_id=project_id,
            entity_name="project",
            entity_identifier=project_id,
            user_id=request.user.id,
        )

        # 항상 IssueSerializer를 사용하여 커스텀 필드 값들을 포함
        issues = IssueSerializer(issue_queryset, many=True).data
        return Response(issues, status=status.HTTP_200_OK)


class IssueViewSet(BaseViewSet):
    def get_serializer_class(self):
        return (
            IssueCreateSerializer
            if self.action in ["create", "update", "partial_update"]
            else IssueSerializer
        )

    model = Issue
    webhook_event = "issue"

    search_fields = ["name"]

    filterset_fields = ["state__name", "assignees__id", "workspace__id"]

    def get_queryset(self):
        return (
            Issue.issue_objects.filter(project_id=self.kwargs.get("project_id"))
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .prefetch_related(
                Prefetch(
                    "custom_field_values",
                    queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                )
            )
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(
                        issue=OuterRef("id"), deleted_at__isnull=True
                    ).values("cycle_id")[:1]
                )
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
        ).distinct()

    @method_decorator(gzip_page)
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def list(self, request, slug, project_id):
        # print("\n[IssueViewSet.list] Debug Logs:")
        # print("Request Parameters:", {
        #     'query_params': dict(request.query_params),
        #     'GET': dict(request.GET),
        #     'layout': request.GET.get('layout'),
        #     'target_date': request.GET.get('target_date'),
        #     'group_by': request.GET.get('group_by'),
        #     'sub_group_by': request.GET.get('sub_group_by')
        # })

        # 사용자 역할 확인
        user_role = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            is_active=True,
        ).first()

        # print("User Role:", user_role.role if user_role else None)

        extra_filters = {}
        if request.GET.get("updated_at__gt", None) is not None:
            extra_filters = {"updated_at__gt": request.GET.get("updated_at__gt")}

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        
        # 모든 필터 적용 (날짜 필터 포함)
        filters = issue_filters(request.query_params, "GET")
        
        # 커스텀 필드 필터 처리
        custom_field_filters = filters.pop('custom_field_filters', None)
        # print(f"[DEBUG] IssueViewSet - custom_field_filters: {custom_field_filters}")
        # print(f"[DEBUG] IssueViewSet - remaining filters: {filters}")
        
        # print("적용된 필터:", filters)
        
        # 기본 queryset 가져오기
        issue_queryset = self.get_queryset()
        
        # RESTRICTED 사용자는 자신에게 할당된 이슈만 볼 수 있음
        if user_role and user_role.role == ROLE.RESTRICTED.value:
            issue_queryset = issue_queryset.filter(assignees__id=request.user.id)
            # print("Restricted User - Filtering by assignee:", request.user.id)

        # 기본 필터와 extra 필터 적용
        issue_queryset = issue_queryset.filter(**filters, **extra_filters)
        
        # 커스텀 필드 필터 적용
        if custom_field_filters:
            # print(f"[DEBUG] IssueViewSet - Applying custom field filters: {custom_field_filters}")
            
            for custom_filter in custom_field_filters:
                field_id = custom_filter['field_id']
                values = custom_filter['values']
                # print(f"[DEBUG] IssueViewSet - Filtering by field_id: {field_id}, values: {values}")
                
                # 커스텀 필드 타입 확인
                try:
                    custom_field = CustomField.objects.get(id=field_id)
                    field_type = custom_field.field_type
                    # print(f"[DEBUG] IssueViewSet - Field type: {field_type}")
                except CustomField.DoesNotExist:
                    # print(f"[DEBUG] IssueViewSet - Custom field {field_id} not found")
                    continue
                
                # 여러 값에 대한 OR 조건 생성
                q_objects = Q()
                for value in values:
                    if field_type == "select":
                        # select 필드: 문자열 포함 검색 (가장 확실한 방법)
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        
                        # print(f"[DEBUG] IssueViewSet - Searching for contains: {value}")
                    elif field_type == "multiselect":
                        # multiselect 필드: JSON 배열에 포함된 경우 확인
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__contains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                    elif field_type == "project_member":
                        # project_member 필드: 단일 멤버 ID로 필터링
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        # print(f"[DEBUG] IssueViewSet - Searching for project member: {value}")
                    elif field_type == "project_members":
                        # project_members 필드: 다중 멤버 ID로 필터링 (JSON 배열)
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__contains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                        # print(f"[DEBUG] IssueViewSet - Searching for project members: {value}")
                    elif field_type == "date":
                        # date 필드: 날짜 범위 처리
                        if ';' in value:
                            # "1_weeks;after;fromnow" 또는 "2025-05-29;after" 형태 처리
                            parts = value.split(';')
                            
                            if len(parts) >= 2:
                                date_part = parts[0]
                                condition = parts[1]
                                
                                # fromnow 처리 (상대적 날짜)
                                if len(parts) >= 3 and parts[2] == "fromnow":
                                    from datetime import datetime, timedelta
                                    import re
                                    
                                    # "1_weeks", "2_days" 등 파싱
                                    match = re.match(r'(\d+)_(\w+)', date_part)
                                    if match:
                                        amount = int(match.group(1))
                                        unit = match.group(2)
                                        
                                        # 현재 날짜 기준으로 계산
                                        now = datetime.now().date()
                                        if unit.startswith('day'):
                                            target_date = now + timedelta(days=amount)
                                        elif unit.startswith('week'):
                                            target_date = now + timedelta(weeks=amount)
                                        elif unit.startswith('month'):
                                            target_date = now + timedelta(days=amount * 30)  # 근사치
                                        elif unit.startswith('year'):
                                            target_date = now + timedelta(days=amount * 365)  # 근사치
                                        else:
                                            target_date = now
                                        
                                        date_str = target_date.strftime('%Y-%m-%d')
                                        # print(f"[DEBUG] IssueViewSet - Calculated date from {date_part}: {date_str}")
                                    else:
                                        date_str = date_part
                                else:
                                    date_str = date_part
                                
                                if condition == "after":
                                    # 해당 날짜 이후의 모든 날짜 찾기
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__gte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                elif condition == "before":
                                    # 해당 날짜 이전의 모든 날짜 찾기
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__lte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                elif condition == "within":
                                    # 현재 날짜부터 해당 날짜까지의 범위
                                    from datetime import datetime
                                    now = datetime.now().date()
                                    now_str = now.strftime('%Y-%m-%d')
                                    
                                    q_objects |= Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__gte=f'"{now_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    ) & Q(
                                        custom_field_values__custom_field_id=field_id,
                                        custom_field_values__value__lte=f'"{date_str}"',
                                        custom_field_values__deleted_at__isnull=True
                                    )
                                    # print(f"[DEBUG] IssueViewSet - Date filter: {date_str} {condition}")
                        else:
                            # 정확한 날짜 매칭
                            import json
                            json_value = json.dumps(value, ensure_ascii=False)
                            q_objects |= Q(
                                custom_field_values__custom_field_id=field_id,
                                custom_field_values__value=json_value,
                                custom_field_values__deleted_at__isnull=True
                            )
                
                issue_queryset = issue_queryset.filter(q_objects)
                # print(f"[DEBUG] IssueViewSet - After filtering, queryset count: {issue_queryset.count()}")
                
                # 실제 실행되는 SQL 쿼리 확인
                from django.db import connection
                # print(f"[DEBUG] IssueViewSet - SQL Query: {issue_queryset.query}")
                # print(f"[DEBUG] IssueViewSet - Last SQL queries: {connection.queries[-3:]}")
        
        # print("Applied Filters:", filters)
        # print("Extra Filters:", extra_filters)
        # print("Total Issues:", issue_queryset.count())

        # 정렬 파라미터 설정
        order_by_param = request.GET.get("order_by", "-created_at")

        # Group by
        group_by = request.GET.get("group_by", False)
        sub_group_by = request.GET.get("sub_group_by", False)

        # issue queryset
        issue_queryset = issue_queryset_grouper(
            queryset=issue_queryset, group_by=group_by, sub_group_by=sub_group_by
        )

        # print("Final Query:", str(issue_queryset.query))
        # print("End Debug Logs\n")

        # 정렬 적용
        if order_by_param and not group_by:
            # parent_child 정렬 옵션은 특별한 처리가 필요하므로 order_issue_queryset 함수 사용
            if order_by_param == "parent_child":
                issue_queryset, _ = order_issue_queryset(
                    issue_queryset=issue_queryset, order_by_param=order_by_param
                )
            else:
                issue_queryset = issue_queryset.order_by(order_by_param)

        recent_visited_task.delay(
            slug=slug,
            project_id=project_id,
            entity_name="project",
            entity_identifier=project_id,
            user_id=request.user.id,
        )
        if (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                member=request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
        ):
            issue_queryset = issue_queryset.filter(created_by=request.user)

        if group_by:
            if sub_group_by:
                if group_by == sub_group_by:
                    return Response(
                        {
                            "error": "Group by and sub group by cannot have same parameters"
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                else:
                    # parent_child 정렬 옵션은 pagination에서 직접 사용할 수 없으므로
                    # paginate 메서드 호출 전에 안전한 기본값('id')으로 변경
                    pagination_order_by = "id" if order_by_param == "parent_child" else order_by_param
                    
                    return self.paginate(
                        request=request,
                        order_by=pagination_order_by,
                        queryset=issue_queryset,
                        on_results=lambda issues: issue_on_results(
                            group_by=group_by, issues=issues, sub_group_by=sub_group_by
                        ),
                        paginator_cls=SubGroupedOffsetPaginator,
                        group_by_fields=issue_group_values(
                            field=group_by,
                            slug=slug,
                            project_id=project_id,
                            filters=filters,
                        ),
                        sub_group_by_fields=issue_group_values(
                            field=sub_group_by,
                            slug=slug,
                            project_id=project_id,
                            filters=filters,
                        ),
                        group_by_field_name=group_by,
                        sub_group_by_field_name=sub_group_by,
                        count_filter=Q(
                            Q(issue_intake__status=1)
                            | Q(issue_intake__status=-1)
                            | Q(issue_intake__status=2)
                            | Q(issue_intake__isnull=True),
                            archived_at__isnull=True,
                            is_draft=False,
                        ),
                    )
            else:
                # Group paginate
                # parent_child 정렬 옵션은 pagination에서 직접 사용할 수 없으므로
                # paginate 메서드 호출 전에 안전한 기본값('id')으로 변경
                pagination_order_by = "id" if order_by_param == "parent_child" else order_by_param
                
                return self.paginate(
                    request=request,
                    order_by=pagination_order_by,
                    queryset=issue_queryset,
                    on_results=lambda issues: issue_on_results(
                        group_by=group_by, issues=issues, sub_group_by=sub_group_by
                    ),
                    paginator_cls=GroupedOffsetPaginator,
                    group_by_fields=issue_group_values(
                        field=group_by,
                        slug=slug,
                        project_id=project_id,
                        filters=filters,
                    ),
                    group_by_field_name=group_by,
                    count_filter=Q(
                        Q(issue_intake__status=1)
                        | Q(issue_intake__status=-1)
                        | Q(issue_intake__status=2)
                        | Q(issue_intake__isnull=True),
                        archived_at__isnull=True,
                        is_draft=False,
                    ),
                )
        else:
            # parent_child 정렬 옵션은 pagination에서 직접 사용할 수 없으므로
            # paginate 메서드 호출 전에 안전한 기본값('id')으로 변경
            pagination_order_by = "id" if order_by_param == "parent_child" else order_by_param
            
            return self.paginate(
                order_by=pagination_order_by,
                request=request,
                queryset=issue_queryset,
                on_results=lambda issues: issue_on_results(
                    group_by=group_by, issues=issues, sub_group_by=sub_group_by
                ),
            )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id)

        serializer = IssueCreateSerializer(
            data=request.data,
            context={
                "project_id": project_id,
                "workspace_id": project.workspace_id,
                "default_assignee_id": project.default_assignee_id,
            },
        )

        if serializer.is_valid():
            serializer.save()

            # 감사 로그 추가
            log_audit(
                action="create_issue",
                user_id=str(request.user.id),
                user_email=request.user.email,
                resource_type="issue",
                resource_id=str(serializer.data.get("id", None)),
                details={
                    "project_id": str(project_id),
                    "title": request.data.get("name"),
                    "description_html": request.data.get("description_html"),
                    "priority": request.data.get("priority"),
                    "state": request.data.get("state"),
                    "assignees": request.data.get("assignee_ids", []),
                    "labels": request.data.get("label_ids", []),
                },
                ip_address=get_client_ip(request),
            )

            # Track the issue
            issue_activity.delay(
                type="issue.activity.created",
                requested_data=json.dumps(self.request.data, cls=DjangoJSONEncoder),
                actor_id=str(request.user.id),
                issue_id=str(serializer.data.get("id", None)),
                project_id=str(project_id),
                current_instance=None,
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=base_host(request=request, is_app=True),
            )
            
            # 커스텀 필드 값이 포함된 응답을 위해 이슈를 다시 조회하여 시리얼라이즈
            issue_instance = Issue.objects.get(pk=serializer.data["id"])
            issue_response = IssueSerializer(issue_instance).data
            
            # Send the model activity
            model_activity.delay(
                model_name="issue",
                model_id=str(serializer.data["id"]),
                requested_data=request.data,
                current_instance=None,
                actor_id=request.user.id,
                slug=slug,
                origin=base_host(request=request, is_app=True),
            )
            # updated issue description version
            issue_description_version_task.delay(
                updated_issue=json.dumps(request.data, cls=DjangoJSONEncoder),
                issue_id=str(serializer.data["id"]),
                user_id=request.user.id,
                is_creating=True,
            )
            return Response(issue_response, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(
        allowed_roles=[
            ROLE.ADMIN,
            ROLE.MEMBER,
            ROLE.VIEWER, 
            ROLE.RESTRICTED,
            ROLE.GUEST,
        ],
        creator=True,
        model=Issue,
    )
    def retrieve(self, request, slug, project_id, pk=None):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        
        # 사용자 역할 확인
        user_role = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            is_active=True,
        ).first()

        issue = (
            Issue.objects.filter(project_id=self.kwargs.get("project_id"))
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(issue=OuterRef("id")).values("cycle_id")[
                        :1
                    ]
                )
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .filter(pk=pk)
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(
                            ~Q(labels__id__isnull=True)
                            & Q(label_issue__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=Q(
                            ~Q(assignees__id__isnull=True)
                            & Q(assignees__member_project__is_active=True)
                            & Q(issue_assignee__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    ArrayAgg(
                        "issue_module__module_id",
                        distinct=True,
                        filter=Q(
                            ~Q(issue_module__module_id__isnull=True)
                            & Q(issue_module__module__archived_at__isnull=True)
                            & Q(issue_module__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .prefetch_related(
                Prefetch(
                    "issue_reactions",
                    queryset=IssueReaction.objects.select_related("issue", "actor"),
                )
            )
            .prefetch_related(
                Prefetch(
                    "issue_link",
                    queryset=IssueLink.objects.select_related("created_by"),
                )
            )
            .annotate(
                is_subscribed=Exists(
                    IssueSubscriber.objects.filter(
                        workspace__slug=slug,
                        project_id=project_id,
                        issue_id=OuterRef("pk"),
                        subscriber=request.user,
                    )
                )
            )
        ).first()
        
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # RESTRICTED 사용자는 자신에게 할당된 이슈만 볼 수 있음
        if user_role and user_role.role == ROLE.RESTRICTED.value:
            if request.user.id not in issue.assignee_ids:
                return Response(
                    {"error": "You can only view issues assigned to you"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        # GUEST 권한 체크 (기존 로직 유지)
        """
        if the role is guest and guest_view_all_features is false and owned by is not
        the requesting user then dont show the issue
        """

        if (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                member=request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
            and not issue.created_by == request.user
        ):
            return Response(
                {"error": "You are not allowed to view this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )

        recent_visited_task.delay(
            slug=slug,
            entity_name="issue",
            entity_identifier=pk,
            user_id=request.user.id,
            project_id=project_id,
        )

        serializer = IssueDetailSerializer(issue, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED], 
        creator=True, 
        model=Issue
    )
    def partial_update(self, request, slug, project_id, pk=None):
        issue = (
            self.get_queryset()
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(
                            ~Q(labels__id__isnull=True)
                            & Q(label_issue__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=Q(
                            ~Q(assignees__id__isnull=True)
                            & Q(assignees__member_project__is_active=True)
                            & Q(issue_assignee__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    ArrayAgg(
                        "issue_module__module_id",
                        distinct=True,
                        filter=Q(
                            ~Q(issue_module__module_id__isnull=True)
                            & Q(issue_module__module__archived_at__isnull=True)
                            & Q(issue_module__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .filter(pk=pk)
            .first()
        )

        if not issue:
            return Response(
                {"error": "Issue not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # VIEWER와 RESTRICTED 역할 체크
        user_role = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            is_active=True,
        ).first()

        if user_role and user_role.role in [ROLE.VIEWER.value, ROLE.RESTRICTED.value]:
            # 자신에게 할당된 이슈인지 확인
            if request.user.id not in issue.assignee_ids:
                return Response(
                    {"error": "You can only update issues assigned to you"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        current_instance = json.dumps(
            IssueDetailSerializer(issue).data, cls=DjangoJSONEncoder
        )

        requested_data = json.dumps(self.request.data, cls=DjangoJSONEncoder)
        serializer = IssueCreateSerializer(
            issue, data=request.data, partial=True, context={"project_id": project_id}
        )
        if serializer.is_valid():
            serializer.save()
            
            # JSON 문자열을 딕셔너리로 파싱
            current_instance_dict = json.loads(current_instance)
            
            # 변경된 필드만 추출
            changes = {}
            for field, value in request.data.items():
                if field in current_instance_dict:
                    old_value = current_instance_dict[field]
                    # 문자열 비교 시 유니코드 정규화
                    if isinstance(old_value, str) and isinstance(value, str):
                        old_value = old_value.encode('utf-8').decode('utf-8')
                        value = value.encode('utf-8').decode('utf-8')
                    if str(old_value) != str(value):
                        changes[field] = {
                            "old": old_value,
                            "new": value
                        }
            
            # 내용의 경우 worker에서 수행됨
            
            # 감사 로그 추가
            if changes:  # 변경사항이 있을 때만 로그 기록
                log_audit(
                    action="update_issue",
                    user_id=str(request.user.id),
                    user_email=request.user.email,
                    resource_type="issue",
                    resource_id=str(pk),
                    details={
                        "project_id": str(project_id),
                        "changes": changes
                    },
                    request=request,
                )

            issue_activity.delay(
                type="issue.activity.updated",
                requested_data=requested_data,
                actor_id=str(request.user.id),
                issue_id=str(pk),
                project_id=str(project_id),
                current_instance=current_instance,
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=base_host(request=request, is_app=True),
            )
            model_activity.delay(
                model_name="issue",
                model_id=str(serializer.data.get("id", None)),
                requested_data=request.data,
                current_instance=current_instance,
                actor_id=request.user.id,
                slug=slug,
                origin=base_host(request=request, is_app=True),
            )
            # updated issue description version
            issue_description_version_task.delay(
                updated_issue=current_instance,
                issue_id=str(serializer.data.get("id", None)),
                user_id=request.user.id,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=Issue)
    def destroy(self, request, slug, project_id, pk=None):
        issue = Issue.objects.get(workspace__slug=slug, project_id=project_id, pk=pk)

        # 감사 로그 추가
        log_audit(
            action="delete_issue",
            user_id=str(request.user.id),
            user_email=request.user.email,
            resource_type="issue",
            resource_id=str(pk),
            details={
                "project_id": str(project_id),
                "issue_data": json.dumps(IssueSerializer(issue).data, cls=DjangoJSONEncoder),
            },
            request=request,
        )

        issue.delete()
        # delete the issue from recent visits
        UserRecentVisit.objects.filter(
            project_id=project_id,
            workspace__slug=slug,
            entity_identifier=pk,
            entity_name="issue",
        ).delete(soft=False)
        issue_activity.delay(
            type="issue.activity.deleted",
            requested_data=json.dumps({"issue_id": str(pk)}),
            actor_id=str(request.user.id),
            issue_id=str(pk),
            project_id=str(project_id),
            current_instance={},
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
            subscriber=False,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueUserDisplayPropertyEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def patch(self, request, slug, project_id):
        issue_property = IssueUserProperty.objects.get(
            user=request.user, project_id=project_id
        )

        issue_property.filters = request.data.get("filters", issue_property.filters)
        issue_property.display_filters = request.data.get(
            "display_filters", issue_property.display_filters
        )
        issue_property.display_properties = request.data.get(
            "display_properties", issue_property.display_properties
        )
        issue_property.save()
        serializer = IssueUserPropertySerializer(issue_property)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission(
        [
            ROLE.ADMIN,
            ROLE.MEMBER,
            ROLE.VIEWER, 
            ROLE.RESTRICTED,
            ROLE.GUEST,
        ]
    )
    def get(self, request, slug, project_id):
        issue_property, _ = IssueUserProperty.objects.get_or_create(
            user=request.user, project_id=project_id
        )
        serializer = IssueUserPropertySerializer(issue_property)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BulkDeleteIssuesEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id):
        issue_ids = request.data.get("issue_ids", [])

        if not len(issue_ids):
            return Response(
                {"error": "Issue IDs are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        issues = Issue.issue_objects.filter(
            workspace__slug=slug, project_id=project_id, pk__in=issue_ids
        )

        total_issues = len(issues)

        issues.delete()

        return Response(
            {"message": f"{total_issues} issues were deleted"},
            status=status.HTTP_200_OK,
        )


class DeletedIssuesListViewSet(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def get(self, request, slug, project_id):
        filters = {}
        if request.GET.get("updated_at__gt", None) is not None:
            filters = {"updated_at__gt": request.GET.get("updated_at__gt")}
        deleted_issues = (
            Issue.all_objects.filter(workspace__slug=slug, project_id=project_id)
            .filter(Q(archived_at__isnull=False) | Q(deleted_at__isnull=False))
            .filter(**filters)
            .values_list("id", flat=True)
        )

        return Response(deleted_issues, status=status.HTTP_200_OK)


class IssuePaginatedViewSet(BaseViewSet):
    def get_queryset(self):
        workspace_slug = self.kwargs.get("slug")
        project_id = self.kwargs.get("project_id")

        issue_queryset = Issue.issue_objects.filter(
            workspace__slug=workspace_slug, project_id=project_id
        )

        return (
            issue_queryset.select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .prefetch_related(
                Prefetch(
                    "custom_field_values",
                    queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                )
            )
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(
                        issue=OuterRef("id"), deleted_at__isnull=True
                    ).values("cycle_id")[:1]
                )
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
        ).distinct()

    def process_paginated_result(self, fields, results, timezone):
        # IssueSerializer를 사용하여 커스텀 필드 값 포함
        serializer = IssueSerializer(results, many=True)
        paginated_data = serializer.data

        # converting the datetime fields in paginated data
        datetime_fields = ["created_at", "updated_at"]
        paginated_data = user_timezone_converter(
            paginated_data, datetime_fields, timezone
        )

        return paginated_data

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def list(self, request, slug, project_id):
        cursor = request.GET.get("cursor", None)
        is_description_required = request.GET.get("description", "false")
        updated_at = request.GET.get("updated_at__gt", None)

        # required fields
        required_fields = [
            "id",
            "name",
            "state_id",
            "state__group",
            "sort_order",
            "completed_at",
            "estimate_point",
            "priority",
            "start_date",
            "target_date",
            "sequence_id",
            "project_id",
            "parent_id",
            "cycle_id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_draft",
            "archived_at",
            "module_ids",
            "label_ids",
            "assignee_ids",
            "link_count",
            "attachment_count",
            "sub_issues_count",
        ]

        if str(is_description_required).lower() == "true":
            required_fields.append("description_html")

        # querying issues
        base_queryset = Issue.issue_objects.filter(
            workspace__slug=slug, project_id=project_id
        )

        base_queryset = base_queryset.order_by("updated_at")
        queryset = self.get_queryset().order_by("updated_at")

        # validation for guest user
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        project_member = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=5,
            is_active=True,
        )
        if project_member.exists() and not project.guest_view_all_features:
            base_queryset = base_queryset.filter(created_by=request.user)
            queryset = queryset.filter(created_by=request.user)

        # filtering issues by greater then updated_at given by the user
        if updated_at:
            base_queryset = base_queryset.filter(updated_at__gt=updated_at)
            queryset = queryset.filter(updated_at__gt=updated_at)

        queryset = queryset.annotate(
            label_ids=Coalesce(
                ArrayAgg(
                    "labels__id",
                    distinct=True,
                    filter=Q(
                        ~Q(labels__id__isnull=True)
                        & Q(label_issue__deleted_at__isnull=True)
                    ),
                ),
                Value([], output_field=ArrayField(UUIDField())),
            ),
            assignee_ids=Coalesce(
                ArrayAgg(
                    "assignees__id",
                    distinct=True,
                    filter=Q(
                        ~Q(assignees__id__isnull=True)
                        & Q(assignees__member_project__is_active=True)
                        & Q(issue_assignee__deleted_at__isnull=True)
                    ),
                ),
                Value([], output_field=ArrayField(UUIDField())),
            ),
            module_ids=Coalesce(
                ArrayAgg(
                    "issue_module__module_id",
                    distinct=True,
                    filter=Q(
                        ~Q(issue_module__module_id__isnull=True)
                        & Q(issue_module__module__archived_at__isnull=True)
                        & Q(issue_module__deleted_at__isnull=True)
                    ),
                ),
                Value([], output_field=ArrayField(UUIDField())),
            ),
        )

        paginated_data = paginate(
            base_queryset=base_queryset,
            queryset=queryset,
            cursor=cursor,
            on_result=lambda results: self.process_paginated_result(
                required_fields, results, request.user.user_timezone
            ),
        )

        return Response(paginated_data, status=status.HTTP_200_OK)


class IssueDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def get(self, request, slug, project_id):
        filters = issue_filters(request.query_params, "GET")
        issue = (
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(
                        issue=OuterRef("id"), deleted_at__isnull=True
                    ).values("cycle_id")[:1]
                )
            )
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(
                            ~Q(labels__id__isnull=True)
                            & Q(label_issue__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=Q(
                            ~Q(assignees__id__isnull=True)
                            & Q(assignees__member_project__is_active=True)
                            & Q(issue_assignee__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    ArrayAgg(
                        "issue_module__module_id",
                        distinct=True,
                        filter=Q(
                            ~Q(issue_module__module_id__isnull=True)
                            & Q(issue_module__module__archived_at__isnull=True)
                            & Q(issue_module__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
        )
        issue = issue.filter(**filters)
        order_by_param = request.GET.get("order_by", "-created_at")
        # Issue queryset
        issue, order_by_param = order_issue_queryset(
            issue_queryset=issue, order_by_param=order_by_param
        )
        return self.paginate(
            request=request,
            order_by=order_by_param,
            queryset=(issue),
            on_results=lambda issue: IssueSerializer(
                issue, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class IssueBulkUpdateDateEndpoint(BaseAPIView):
    def validate_dates(self, current_start, current_target, new_start, new_target):
        """
        Validate that start date is before target date.
        """
        from datetime import datetime

        start = new_start or current_start
        target = new_target or current_target

        # Convert string dates to datetime objects if they're strings
        if isinstance(start, str):
            start = datetime.strptime(start, "%Y-%m-%d").date()
        if isinstance(target, str):
            target = datetime.strptime(target, "%Y-%m-%d").date()

        if start and target and start > target:
            return False
        return True

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        updates = request.data.get("updates", [])

        issue_ids = [update["id"] for update in updates]
        epoch = int(timezone.now().timestamp())

        # Fetch all relevant issues in a single query
        issues = list(Issue.objects.filter(id__in=issue_ids))
        issues_dict = {str(issue.id): issue for issue in issues}
        issues_to_update = []

        for update in updates:
            issue_id = update["id"]
            issue = issues_dict.get(issue_id)

            if not issue:
                continue

            start_date = update.get("start_date")
            target_date = update.get("target_date")
            validate_dates = self.validate_dates(
                issue.start_date, issue.target_date, start_date, target_date
            )
            if not validate_dates:
                return Response(
                    {"message": "Start date cannot exceed target date"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if start_date:
                issue_activity.delay(
                    type="issue.activity.updated",
                    requested_data=json.dumps({"start_date": update.get("start_date")}),
                    current_instance=json.dumps({"start_date": str(issue.start_date)}),
                    issue_id=str(issue_id),
                    actor_id=str(request.user.id),
                    project_id=str(project_id),
                    epoch=epoch,
                )
                issue.start_date = start_date
                issues_to_update.append(issue)

            if target_date:
                issue_activity.delay(
                    type="issue.activity.updated",
                    requested_data=json.dumps(
                        {"target_date": update.get("target_date")}
                    ),
                    current_instance=json.dumps(
                        {"target_date": str(issue.target_date)}
                    ),
                    issue_id=str(issue_id),
                    actor_id=str(request.user.id),
                    project_id=str(project_id),
                    epoch=epoch,
                )
                issue.target_date = target_date
                issues_to_update.append(issue)

        # Bulk update issues
        Issue.objects.bulk_update(issues_to_update, ["start_date", "target_date"])

        return Response(
            {"message": "Issues updated successfully"}, status=status.HTTP_200_OK
        )


class IssueMetaEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], level="PROJECT")
    def get(self, request, slug, project_id, issue_id):
        issue = Issue.issue_objects.only("sequence_id", "project__identifier").get(
            id=issue_id, project_id=project_id, workspace__slug=slug
        )
        return Response(
            {
                "sequence_id": issue.sequence_id,
                "project_identifier": issue.project.identifier,
            },
            status=status.HTTP_200_OK,
        )


class IssueDetailIdentifierEndpoint(BaseAPIView):
    def strict_str_to_int(self, s):
        if not s.isdigit() and not (s.startswith("-") and s[1:].isdigit()):
            raise ValueError("Invalid integer string")
        return int(s)

    def get(self, request, slug, project_identifier, issue_identifier):
        # Check if the issue identifier is a valid integer
        try:
            issue_identifier = self.strict_str_to_int(issue_identifier)
        except ValueError:
            return Response(
                {"error": "Invalid issue identifier"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch the project
        project = Project.objects.get(
            identifier__iexact=project_identifier, workspace__slug=slug
        )

        # Check if the user is a member of the project
        if not ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project.id,
            member=request.user,
            is_active=True,
        ).exists():
            return Response(
                {"error": "You are not allowed to view this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Fetch the issue
        issue = (
            Issue.issue_objects.filter(project_id=project.id)
            .filter(workspace__slug=slug)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(issue=OuterRef("id")).values("cycle_id")[
                        :1
                    ]
                )
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .filter(sequence_id=issue_identifier)
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(
                            ~Q(labels__id__isnull=True)
                            & Q(label_issue__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=Q(
                            ~Q(assignees__id__isnull=True)
                            & Q(assignees__member_project__is_active=True)
                            & Q(issue_assignee__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    ArrayAgg(
                        "issue_module__module_id",
                        distinct=True,
                        filter=Q(
                            ~Q(issue_module__module_id__isnull=True)
                            & Q(issue_module__module__archived_at__isnull=True)
                            & Q(issue_module__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .prefetch_related(
                Prefetch(
                    "issue_reactions",
                    queryset=IssueReaction.objects.select_related("issue", "actor"),
                )
            )
            .prefetch_related(
                Prefetch(
                    "issue_link",
                    queryset=IssueLink.objects.select_related("created_by"),
                )
            )
            .annotate(
                is_subscribed=Exists(
                    IssueSubscriber.objects.filter(
                        workspace__slug=slug,
                        project_id=project.id,
                        issue__sequence_id=issue_identifier,
                        subscriber=request.user,
                    )
                )
            )
        ).first()

        # Check if the issue exists
        if not issue:
            return Response(
                {"error": "The required object does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        """
        if the role is guest and guest_view_all_features is false and owned by is not
        the requesting user then dont show the issue
        """

        if (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project.id,
                member=request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
            and not issue.created_by == request.user
        ):
            return Response(
                {"error": "You are not allowed to view this issue"},
                status=status.HTTP_403_FORBIDDEN,
            )

        recent_visited_task.delay(
            slug=slug,
            entity_name="issue",
            entity_identifier=str(issue.id),
            user_id=str(request.user.id),
            project_id=str(project.id),
        )

        # Serialize the issue
        serializer = IssueDetailSerializer(issue, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ImportIssuesEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        try:
            if 'file' not in request.FILES:
                return Response({
                    'error': 'No file uploaded'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            file: UploadedFile = request.FILES['file']
            
            # 지원하는 파일 형식 체크
            if not (file.name.endswith('.csv') or file.name.endswith('.xlsx')):
                return Response({
                    'error': 'Only CSV and XLSX files are supported'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 파일 크기 제한 체크 (예: 100MB)
            if file.size > 100 * 1024 * 1024:
                return Response({
                    'error': 'File size too large. Maximum size is 100MB'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # workspace 조회
            workspace = Workspace.objects.get(slug=slug)
            
            # 파일 내용 읽기
            if file.name.endswith('.csv'):
                file_content = file.read().decode('utf-8')
                file_type = 'csv'
            else:  # xlsx
                file_content = file.read()
                file_type = 'xlsx'

            # UUID를 문자열로 명시적 변환
            workspace_id = str(workspace.id)
            project_id = str(project_id)
            user_id = str(request.user.id)
            
            # 동기적으로 임포트 작업 실행
            result = issue_import_task(
                workspace_id=workspace_id,
                project_id=project_id,
                file_content=file_content,
                file_type=file_type,
                user_id=user_id
            )
            
            if result.get('success'):
                return Response({
                    'message': 'Import completed successfully',
                    'imported_count': result.get('imported_count', 0),
                    'updated_count': result.get('updated_count', 0)
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': result.get('error', 'Import failed')
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
