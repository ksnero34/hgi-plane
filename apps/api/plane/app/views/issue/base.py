# Python imports
import json
import logging
from collections import defaultdict
import traceback
from uuid import UUID
from datetime import datetime

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
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.db import models

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import (
    IssueCreateSerializer,
    IssueDetailSerializer,
    IssueUserPropertySerializer,
    IssueSerializer,
    IssueCreateSerializer,
    IssueDetailSerializer,
    IssueUserPropertySerializer,
    IssueSerializer,
    IssueListDetailSerializer,
    IssueActivitySerializer,
)
from plane.bgtasks.issue_activities_task import issue_activity
from plane.bgtasks.notification_task import workflow_approval_request_notifications
from plane.bgtasks.import_task import issue_import_task
from plane.db.models import (
    WorkflowApprovalRequest,
    WorkflowTransition,
    CycleIssue,
    CustomField,
    CustomFieldValue,
    FileAsset,
    IntakeIssue,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueLabel,
    IssueLink,
    IssueRelation,
    IssueReaction,
    IssueSubscriber,
    IssueType,
    IssueUserProperty,
    ModuleIssue,
    Project,
    ProjectMember,
    State,
    User,
    UserRecentVisit,
    Workspace,
)
from plane.utils.grouper import (
    issue_group_values,
    issue_on_results,
    issue_queryset_grouper,
)
from plane.utils.issue_filters import issue_filters
from plane.utils.order_queryset import order_issue_queryset
from plane.utils.filters.filterset import IssueFilterSet
from plane.utils.paginator import GroupedOffsetPaginator, SubGroupedOffsetPaginator, ParentChildOffsetPaginator
from .. import BaseAPIView, BaseViewSet
from plane.utils.timezone_converter import user_timezone_converter
from plane.bgtasks.recent_visited_task import recent_visited_task
from plane.utils.global_paginator import paginate
from plane.bgtasks.webhook_task import model_activity
from plane.bgtasks.issue_description_version_task import issue_description_version_task
from plane.utils.audit_logger import log_audit
from plane.utils.host import base_host
from plane.utils.ip_address import get_client_ip

logger = logging.getLogger(__name__)

class IssueListEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def get(self, request, slug, project_id):
        issue_ids = request.GET.get("issues", False)

        if issue_ids:
            # 새 버전의 빈 값 체크 추가
            issue_ids = [issue_id for issue_id in issue_ids.split(",") if issue_id != ""]
            
            if not issue_ids:
                return Response(
                    {"error": "Issues are required"}, status=status.HTTP_400_BAD_REQUEST
                )

            issues = (
                Issue.issue_objects.filter(
                    workspace__slug=slug, project_id=project_id, pk__in=issue_ids
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
            ).distinct()

            filters = issue_filters(request.query_params, "GET")
            
            # search_q_filter 처리 (제목 + 설명 검색)
            search_q_filter = filters.pop('search_q_filter', None)
            if search_q_filter:
                issues = issues.filter(search_q_filter)
            
            order_by_param = request.GET.get("order_by", "-created_at")
            
            # Issue queryset
            issues, order_by_param = order_issue_queryset(
                issue_queryset=issues, order_by_param=order_by_param
            )

            # Group by
            group_by = request.GET.get("group_by", False)
            sub_group_by = request.GET.get("sub_group_by", False)

            # issue queryset
            issues = issue_queryset_grouper(
                queryset=issues, group_by=group_by, sub_group_by=sub_group_by
            )

            recent_visited_task.delay(
                slug=slug,
                project_id=project_id,
                entity_name="project",
                entity_identifier=project_id,
                user_id=request.user.id,
            )

            if self.fields or self.expand:
                issues = IssueSerializer(
                    issues, many=True, fields=self.fields, expand=self.expand
                ).data
            else:
                issues = issues.values(
                    "id",
                    "name",
                    "state_id",
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
                    "module_ids",
                    "label_ids",
                    "assignee_ids",
                    "sub_issues_count",
                    "created_at",
                    "updated_at",
                    "created_by",
                    "updated_by",
                    "attachment_count",
                    "link_count",
                    "is_draft",
                    "archived_at",
                    "deleted_at",
                )
                datetime_fields = ["created_at", "updated_at"]
                issues = user_timezone_converter(
                    issues, datetime_fields, request.user.user_timezone
                )
            return Response(issues, status=status.HTTP_200_OK)

        filters = issue_filters(request.query_params, "GET")

        # search_q_filter 처리 (제목 + 설명 검색)
        search_q_filter = filters.pop('search_q_filter', None)

        # 커스텀 필드 필터 처리
        custom_field_filters = filters.pop('custom_field_filters', None)

        # Rich filters 처리 (새로운 필터 시스템)
        rich_filters_param = request.GET.get("filters")

        # Custom ordering for priority and state
        priority_order = ["urgent", "high", "medium", "low", "none"]
        state_order = ["backlog", "unstarted", "started", "completed", "cancelled"]

        order_by_param = request.GET.get("order_by", "-created_at")

        issue_queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .filter(project_id=project_id)
            .filter(**filters)
        )

        # search_q_filter 적용 (제목 + 설명 검색)
        if search_q_filter:
            issue_queryset = issue_queryset.filter(search_q_filter)

        # Rich filters 적용
        if rich_filters_param:
            try:
                rich_filters = json.loads(rich_filters_param) if isinstance(rich_filters_param, str) else rich_filters_param
                if rich_filters:
                    # rich_filters를 평탄화 ({"and": [{...}, {...}]} -> {...})
                    flattened_filters = {}
                    if isinstance(rich_filters, dict) and "and" in rich_filters:
                        for filter_obj in rich_filters["and"]:
                            if isinstance(filter_obj, dict):
                                flattened_filters.update(filter_obj)
                    elif isinstance(rich_filters, dict):
                        flattened_filters = rich_filters

                    # my_issues_only 처리 (rich_filters에서)
                    my_issues_only_from_rich = flattened_filters.pop("my_issues_only__exact", None)
                    if my_issues_only_from_rich in [True, "true", "True"]:
                        issue_queryset = issue_queryset.filter(
                            assignees__id=request.user.id,
                            issue_assignee__deleted_at__isnull=True
                        ).distinct()

                    # IssueFilterSet을 사용하여 나머지 rich_filters 적용
                    if flattened_filters:
                        filterset = IssueFilterSet(data=flattened_filters, queryset=issue_queryset, request=request)
                        issue_queryset = filterset.qs
            except (json.JSONDecodeError, TypeError) as e:
                logger.error(f"Error parsing rich_filters: {e}")
        
        issue_queryset = (
            issue_queryset
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
            for custom_filter in custom_field_filters:
                field_id = custom_filter['field_id']
                values = custom_filter['values']
                
                # 커스텀 필드 타입 확인
                try:
                    custom_field = CustomField.objects.get(id=field_id)
                    field_type = custom_field.field_type
                except CustomField.DoesNotExist:
                    continue
                
                # 여러 값에 대한 OR 조건 생성
                q_objects = Q()
                for value in values:
                    if field_type == "text":
                        # text 필드: 텍스트 포함 검색
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                    elif field_type == "select":
                        # select 필드: 문자열 포함 검색
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
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
                    elif field_type == "project_members":
                        # project_members 필드: 다중 멤버 ID로 필터링 (JSON 배열)
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__contains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
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
                        else:
                            # 정확한 날짜 매칭
                            json_value = json.dumps(value, ensure_ascii=False)
                            q_objects |= Q(
                                custom_field_values__custom_field_id=field_id,
                                custom_field_values__value=json_value,
                                custom_field_values__deleted_at__isnull=True
                            )
                
                issue_queryset = issue_queryset.filter(q_objects)
        
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
                    output_field=IntegerField(),
                )
            ).order_by("priority_order")

        elif order_by_param == "state__name" or order_by_param == "-state__name":
            state_order = (
                state_order if order_by_param == "state__name" else state_order[::-1]
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

        # search_q_filter 처리 (제목 + 설명 검색)
        search_q_filter = filters.pop('search_q_filter', None)

        # 커스텀 필드 필터 처리
        custom_field_filters = filters.pop('custom_field_filters', None)
        # print(f"[DEBUG] IssueViewSet - custom_field_filters: {custom_field_filters}")
        # print(f"[DEBUG] IssueViewSet - remaining filters: {filters}")

        # Rich filters 처리 (새로운 필터 시스템)
        rich_filters_param = request.GET.get("filters")

        # print("적용된 필터:", filters)

        # 기본 queryset 가져오기
        issue_queryset = self.get_queryset()

        # RESTRICTED 사용자는 자신에게 할당된 이슈만 볼 수 있음
        if user_role and user_role.role == ROLE.RESTRICTED.value:
            issue_queryset = issue_queryset.filter(assignees__id=request.user.id)
            # print("Restricted User - Filtering by assignee:", request.user.id)

        # my_issues_only 옵션 처리
        my_issues_only = request.GET.get("my_issues_only", "false")
        if my_issues_only == "true":
            # 현재 사용자가 담당자로 지정된 이슈만 필터링 (삭제되지 않은 관계만)
            issue_queryset = issue_queryset.filter(
                assignees__id=request.user.id,
                issue_assignee__deleted_at__isnull=True
            ).distinct()

        # 기본 필터와 extra 필터 적용
        issue_queryset = issue_queryset.filter(**filters, **extra_filters)

        # Rich filters 적용
        if rich_filters_param:
            try:
                rich_filters = json.loads(rich_filters_param) if isinstance(rich_filters_param, str) else rich_filters_param
                if rich_filters:
                    # rich_filters를 평탄화 ({"and": [{...}, {...}]} -> {...})
                    flattened_filters = {}
                    if isinstance(rich_filters, dict) and "and" in rich_filters:
                        for filter_obj in rich_filters["and"]:
                            if isinstance(filter_obj, dict):
                                flattened_filters.update(filter_obj)
                    elif isinstance(rich_filters, dict):
                        flattened_filters = rich_filters

                    # my_issues_only 처리 (rich_filters에서)
                    my_issues_only_from_rich = flattened_filters.pop("my_issues_only__exact", None)
                    if my_issues_only_from_rich in [True, "true", "True"]:
                        issue_queryset = issue_queryset.filter(
                            assignees__id=request.user.id,
                            issue_assignee__deleted_at__isnull=True
                        ).distinct()

                    # IssueFilterSet을 사용하여 나머지 rich_filters 적용
                    if flattened_filters:
                        filterset = IssueFilterSet(data=flattened_filters, queryset=issue_queryset, request=request)
                        issue_queryset = filterset.qs
            except (json.JSONDecodeError, TypeError) as e:
                logger.error(f"Error parsing rich_filters: {e}")
        
        # search_q_filter 적용 (제목 + 설명 검색)
        if search_q_filter:
            issue_queryset = issue_queryset.filter(search_q_filter)
        
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
                    if field_type == "text":
                        # text 필드: 텍스트 포함 검색
                        q_objects |= Q(
                            custom_field_values__custom_field_id=field_id,
                            custom_field_values__value__icontains=value,
                            custom_field_values__deleted_at__isnull=True
                        )
                    elif field_type == "select":
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
        
        # parent_id가 있는 경우 특별 처리 (더보기 요청)
        parent_id = request.GET.get("parent_id", None)
        # 여러 그룹의 더보기를 지원하기 위해 parent_pages 파라미터 추가
        parent_pages = request.GET.get("parent_pages", None)
        
        if parent_id is not None or parent_pages is not None:
            # parent_child 그룹화인 경우에는 group_by를 유지하고 필터링은 paginator에서 처리
            if not group_by:
                group_by = "parent_child"
            
            # parent_child 그룹화가 아닌 경우에만 parent_id 필터 적용
            if group_by != "parent_child":
                if parent_id == "None":
                    issue_queryset = issue_queryset.filter(parent_id__isnull=True)
                else:
                    # 특정 부모 ID의 하위 이슈들
                    issue_queryset = issue_queryset.filter(parent_id=parent_id)

        # issue queryset
        issue_queryset = issue_queryset_grouper(
            queryset=issue_queryset, group_by=group_by, sub_group_by=sub_group_by
        )

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
                            order_by=order_by_param,
                        ),
                        sub_group_by_fields=issue_group_values(
                            field=sub_group_by,
                            slug=slug,
                            project_id=project_id,
                            filters=filters,
                            order_by=order_by_param,
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
                        max_per_page=10000,
                    )
            else:
                # Group paginate
                # parent_child 그룹화는 ParentChildOffsetPaginator 사용
                if group_by == "parent_child":
                    # per_page 값을 가져와서 items_per_group으로 사용
                    try:
                        per_page = int(request.GET.get("per_page", 100))
                    except ValueError:
                        per_page = 100
                    
                    # parent_child 정렬 옵션은 pagination에서 직접 사용할 수 없으므로
                    # paginate 메서드 호출 전에 안전한 기본값('id')으로 변경
                    pagination_order_by = "id" if order_by_param == "parent_child" else order_by_param
                    
                    return self.paginate(
                        request=request,
                        order_by=pagination_order_by,
                        queryset=issue_queryset,
                        on_results=None,  # ParentChildOffsetPaginator가 직렬화를 담당
                        paginator_cls=ParentChildOffsetPaginator,
                        group_by_field_name=group_by,
                        group_by_fields=issue_group_values(
                            field=group_by,
                            slug=slug,
                            project_id=project_id,
                            filters=filters,
                            order_by=order_by_param,
                        ),
                        count_filter=Q(
                            Q(issue_intake__status=1)
                            | Q(issue_intake__status=-1)
                            | Q(issue_intake__status=2)
                            | Q(issue_intake__isnull=True),
                            archived_at__isnull=True,
                            is_draft=False,
                        ),
                        parent_id=parent_id,  # 더보기 요청을 위한 parent_id 전달
                        parent_pages=parent_pages,  # 여러 그룹 더보기를 위한 parent_pages 전달
                        items_per_group=per_page,  # per_page 값을 items_per_group으로 전달
                        max_per_page=10000,
                    )
                else:
                    # 일반 그룹화는 GroupedOffsetPaginator 사용
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
                            order_by=order_by_param,
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
                        max_per_page=10000,
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
                max_per_page=10000,
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
            .prefetch_related(
                Prefetch(
                    "custom_field_values",
                    queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                )
            )
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
                    Subquery(
                        IssueAssignee.objects.filter(
                            issue_id=OuterRef("pk"),
                            assignee__member_project__is_active=True,
                        )
                        .values("issue_id")
                        .annotate(arr=ArrayAgg("assignee_id", distinct=True))
                        .values("arr")
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                module_ids=Coalesce(
                    Subquery(
                        ModuleIssue.objects.filter(
                            issue_id=OuterRef("pk"),
                            module__archived_at__isnull=True,
                        )
                        .values("issue_id")
                        .annotate(arr=ArrayAgg("module_id", distinct=True))
                        .values("arr")
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

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED], creator=True, model=Issue)
    def partial_update(self, request, slug, project_id, pk=None):
        queryset = self.get_queryset()
        queryset = self.apply_annotations(queryset)

        skip_activity = request.data.pop("skip_activity", False)
        is_description_update = request.data.get("description_html") is not None

        issue = (
            self.get_queryset().annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(~Q(labels__id__isnull=True) & Q(label_issue__deleted_at__isnull=True)),
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
            return Response({"error": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        current_instance = json.dumps(IssueDetailSerializer(issue).data, cls=DjangoJSONEncoder)

        requested_data = json.dumps(self.request.data, cls=DjangoJSONEncoder)
        serializer = IssueCreateSerializer(issue, data=request.data, partial=True, context={"project_id": project_id})
        if serializer.is_valid():
            serializer.save()
            # Check if the update is a migration description update
            is_migration_description_update = skip_activity and is_description_update
            # Log all the updates
            if not is_migration_description_update:
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
        issue_property = IssueUserProperty.objects.get(user=request.user, project_id=project_id)

        issue_property.rich_filters = request.data.get("rich_filters", issue_property.rich_filters)
        issue_property.filters = request.data.get("filters", issue_property.filters)
        issue_property.display_filters = request.data.get("display_filters", issue_property.display_filters)
        issue_property.display_properties = request.data.get("display_properties", issue_property.display_properties)
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
        issue_property, _ = IssueUserProperty.objects.get_or_create(user=request.user, project_id=project_id)
        serializer = IssueUserPropertySerializer(issue_property)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BulkDeleteIssuesEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id):
        issue_ids = request.data.get("issue_ids", [])

        if not len(issue_ids):
            return Response({"error": "Issue IDs are required"}, status=status.HTTP_400_BAD_REQUEST)

        issues = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, pk__in=issue_ids)

        total_issues = len(issues)

        # First, delete all related cycle issues
        CycleIssue.objects.filter(issue_id__in=issue_ids).delete()

        # Then, delete all related module issues
        ModuleIssue.objects.filter(issue_id__in=issue_ids).delete()

        # Finally, delete the issues themselves
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

        issue_queryset = Issue.issue_objects.filter(workspace__slug=workspace_slug, project_id=project_id)

        return (
            issue_queryset.select_related("state")
            .annotate(cycle_id=Subquery(CycleIssue.objects.filter(issue=OuterRef("id")).values("cycle_id")[:1]))
            .annotate(
                link_count=Subquery(
                    IssueLink.objects.filter(issue=OuterRef("id"))
                    .values("issue")
                    .annotate(count=Count("id"))
                    .values("count")
                )
            )
            .annotate(
                attachment_count=Subquery(
                    FileAsset.objects.filter(
                        issue_id=OuterRef("id"),
                        entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                    )
                    .values("issue_id")
                    .annotate(count=Count("id"))
                    .values("count")
                )
            )
            .annotate(
                sub_issues_count=Subquery(
                    Issue.issue_objects.filter(parent=OuterRef("id"))
                    .values("parent")
                    .annotate(count=Count("id"))
                    .values("count")
                )
            )
        )

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
        base_queryset = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)

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
                Subquery(
                    IssueLabel.objects.filter(issue_id=OuterRef("pk"))
                    .values("issue_id")
                    .annotate(arr=ArrayAgg("label_id", distinct=True))
                    .values("arr")
                ),
                Value([], output_field=ArrayField(UUIDField())),
            ),
            assignee_ids=Coalesce(
                Subquery(
                    IssueAssignee.objects.filter(
                        issue_id=OuterRef("pk"),
                        assignee__member_project__is_active=True,
                    )
                    .values("issue_id")
                    .annotate(arr=ArrayAgg("assignee_id", distinct=True))
                    .values("arr")
                ),
                Value([], output_field=ArrayField(UUIDField())),
            ),
            module_ids=Coalesce(
                Subquery(
                    ModuleIssue.objects.filter(
                        issue_id=OuterRef("pk"),
                        module__archived_at__isnull=True,
                    )
                    .values("issue_id")
                    .annotate(arr=ArrayAgg("module_id", distinct=True))
                    .values("arr")
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

        # check for the project member role, if the role is 5 then check for the guest_view_all_features
        #  if it is true then show all the issues else show only the issues created by the user
        permission_subquery = (
            Issue.issue_objects.filter(
                workspace__slug=slug, project_id=project_id, id=OuterRef("id")
            )
            .filter(
                Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role__gt=ROLE.GUEST.value,
                )
                | Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role=ROLE.GUEST.value,
                    project__guest_view_all_features=True,
                )
                | Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role=ROLE.GUEST.value,
                    project__guest_view_all_features=False,
                    created_by=self.request.user,
                )
            )
            .values("id")
        )
        # Main issue query
        issue = (
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
            .filter(Exists(permission_subquery))
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .prefetch_related(
                Prefetch(
                    "custom_field_values",
                    queryset=CustomFieldValue.objects.filter(deleted_at__isnull=True).select_related("custom_field"),
                )
            )
            .prefetch_related(
                Prefetch(
                    "issue_assignee",
                    queryset=IssueAssignee.objects.all(),
                )
            )
            .prefetch_related(
                Prefetch(
                    "label_issue",
                    queryset=IssueLabel.objects.all(),
                )
            )
            .prefetch_related(
                Prefetch(
                    "issue_module",
                    queryset=ModuleIssue.objects.all(),
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
            .prefetch_related(
                Prefetch(
                    "issue_assignee",
                    queryset=IssueAssignee.objects.all(),
                )
            )
            .prefetch_related(
                Prefetch(
                    "label_issue",
                    queryset=IssueLabel.objects.all(),
                )
            )
            .prefetch_related(
                Prefetch(
                    "issue_module",
                    queryset=ModuleIssue.objects.all(),
                )
            )
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def get(self, request, slug, project_id):
        filters = issue_filters(request.query_params, "GET")

        # check for the project member role, if the role is 5 then check for the guest_view_all_features
        #  if it is true then show all the issues else show only the issues created by the user
        permission_subquery = (
            Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id, id=OuterRef("id"))
            .filter(
                Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role__gt=ROLE.GUEST.value,
                )
                | Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role=ROLE.GUEST.value,
                    project__guest_view_all_features=True,
                )
                | Q(
                    project__project_projectmember__member=self.request.user,
                    project__project_projectmember__is_active=True,
                    project__project_projectmember__role=ROLE.GUEST.value,
                    project__guest_view_all_features=False,
                    created_by=self.request.user,
                )
            )
            .values("id")
        )
        # Main issue query
        issue = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id).filter(
            Exists(permission_subquery)
        )

        # Add additional prefetch based on expand parameter
        if self.expand:
            if "issue_relation" in self.expand:
                issue = issue.prefetch_related(
                    Prefetch(
                        "issue_relation",
                        queryset=IssueRelation.objects.select_related("related_issue"),
                    )
                )
            if "issue_related" in self.expand:
                issue = issue.prefetch_related(
                    Prefetch(
                        "issue_related",
                        queryset=IssueRelation.objects.select_related("issue"),
                    )
                )

        # Apply filtering from filterset
        issue = self.filter_queryset(issue)

        # Apply legacy filters
        issue = issue.filter(**filters)

        # Total count queryset
        total_issue_queryset = copy.deepcopy(issue)

        # Applying annotations to the issue queryset
        issue = self.apply_annotations(issue)

        order_by_param = request.GET.get("order_by", "-created_at")

        # Issue queryset
        issue, order_by_param = order_issue_queryset(issue_queryset=issue, order_by_param=order_by_param)
        return self.paginate(
            request=request,
            order_by=order_by_param,
            queryset=issue,
            total_count_queryset=total_issue_queryset,
            on_results=lambda issue: IssueListDetailSerializer(
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
            validate_dates = self.validate_dates(issue.start_date, issue.target_date, start_date, target_date)
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
                    requested_data=json.dumps({"target_date": update.get("target_date")}),
                    current_instance=json.dumps({"target_date": str(issue.target_date)}),
                    issue_id=str(issue_id),
                    actor_id=str(request.user.id),
                    project_id=str(project_id),
                    epoch=epoch,
                )
                issue.target_date = target_date
                issues_to_update.append(issue)

        # Bulk update issues
        Issue.objects.bulk_update(issues_to_update, ["start_date", "target_date"])

        return Response({"message": "Issues updated successfully"}, status=status.HTTP_200_OK)


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
        project = Project.objects.get(identifier__iexact=project_identifier, workspace__slug=slug)

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
            Issue.objects.filter(project_id=project.id)
            .filter(workspace__slug=slug)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
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
            .filter(sequence_id=issue_identifier)
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(~Q(labels__id__isnull=True) & Q(label_issue__deleted_at__isnull=True)),
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
            .annotate(
                is_intake=Exists(
                    IntakeIssue.objects.filter(
                        issue=OuterRef("id"),
                        status__in=[-2, 0],
                        workspace__slug=slug,
                        project_id=project.id,
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


class AssignDefaultIssueTypeEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id):
        try:
            issue_type_id = request.data.get("issue_type_id")
            
            if not issue_type_id:
                return Response(
                    {"error": "issue_type_id is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 워크스페이스 조회
            workspace = Workspace.objects.get(slug=slug)
            
            # 이슈 타입 존재 확인
            issue_type = IssueType.objects.filter(
                workspace=workspace,
                id=issue_type_id
            ).first()
            
            if not issue_type:
                return Response(
                    {"error": "Issue type not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 프로젝트의 type_id가 null인 이슈들을 업데이트
            updated_count = Issue.objects.filter(
                project_id=project_id,
                workspace=workspace,
                type_id__isnull=True
            ).update(type_id=issue_type.id)
            
            return Response({
                "success": True,
                "updated_count": updated_count
            }, status=status.HTTP_200_OK)
            
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class BulkOperationsEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED])
    def post(self, request, slug, project_id):
        # Import all required models at the beginning
        from plane.db.models import (
            WorkflowTemplate, WorkflowTransition, State, 
            IssueComment, ProjectIssueType, IssueType, WorkflowApprovalRequest
        )
        
        issue_ids = request.data.get("issue_ids", [])
        properties = request.data.get("properties", {})

        if not issue_ids:
            return Response(
                {"error": "Issue IDs are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # 사용자 역할 확인
        user_role = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            is_active=True,
        ).first()

        issues_qs = Issue.objects.filter(
            workspace__slug=slug, project_id=project_id, pk__in=issue_ids
        ).select_related('workspace', 'project') # workspace, project 미리 로드

        if not issues_qs.exists():
            return Response(
                {"error": "No valid issues found"}, status=status.HTTP_404_NOT_FOUND
            )
        
        # Annotate assignee_ids directly to the main queryset if possible, or fetch separately
        # For simplicity, fetching separately here, but optimizing might be needed for very large issue_ids lists
        # However, the original code also fetched assignees somewhat separately or within loops.

        editable_issues = []
        non_editable_issues = []
        
        # Pre-fetch current assignees for all issues to establish a baseline "old_values"
        # This is crucial for accurate activity logging.
        issue_to_current_assignees_map = defaultdict(list)
        # Optimize by fetching all relevant IssueAssignee objects at once
        current_assignee_relations = IssueAssignee.objects.filter(
            issue_id__in=[issue.id for issue in issues_qs], 
            deleted_at__isnull=True
        ).values('issue_id', 'assignee_id')

        for rel in current_assignee_relations:
            issue_to_current_assignees_map[rel['issue_id']].append(rel['assignee_id'])

        for issue in issues_qs:
            # Populate current assignee_ids for permission check (if not already annotated)
            # This example assumes issue.assignee_ids might not be up-to-date or present
            # For the permission check, we need the *actual current* assignees if role is VIEWER/RESTRICTED
            # The map above gives us this.
            
            # Simplified permission check logic - assuming assignees were pre-fetched or annotated correctly
            # For this example, let's use the map we just built for the permission check as well.
            current_assignees_for_perm_check = issue_to_current_assignees_map.get(issue.id, [])

            if user_role and user_role.role in [ROLE.ADMIN.value, ROLE.MEMBER.value]:
                editable_issues.append(issue)
            elif user_role and user_role.role in [ROLE.VIEWER.value, ROLE.RESTRICTED.value]:
                # request.user.id (UUID) needs to be compared with UUIDs
                if request.user.id in current_assignees_for_perm_check:
                    editable_issues.append(issue)
                else:
                    non_editable_issues.append(issue)
            else:
                non_editable_issues.append(issue)

        if not editable_issues:
            return Response(
                {"error": "You can only update issues assigned to you or you have no permission."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            with transaction.atomic():
                epoch = int(timezone.now().timestamp())
                
                # 각 이슈별로 변경사항을 추적
                # issue_changes[issue_id] = {
                #    'issue_obj': issue, # The issue model instance
                #    'regular_old_values': {}, 'regular_new_values': {}, 'has_regular_changes': False,
                #    'custom_field_changes': [], # list of {field_name, old_value, new_value, field_obj}
                #    'assignee_added': [], 'assignee_removed': [] # lists of user_id
                # }
                all_issue_activity_details = defaultdict(lambda: {
                    'regular_old_values': {}, 'regular_new_values': {}, 'has_regular_changes': False,
                    'custom_field_changes': [],
                    'assignee_added': [], 'assignee_removed': []
                })

                # 0. Populate issue_obj for all_issue_activity_details
                for issue in editable_issues:
                    all_issue_activity_details[issue.id]['issue_obj'] = issue

                # Initialize state_change_requests at the beginning
                state_change_requests = {}  # Will store issues that need approval

                # 1. Handle regular issue properties (assignees and custom_fields are handled separately)
                regular_properties_to_update = {
                    k: v for k, v in properties.items() 
                    if k not in ["custom_field_values", "assignee_ids", "type_id", "state_id"] and hasattr(Issue, k)
                }
                
                # Handle state_id separately with workflow validation
                if "state_id" in properties:
                    new_state_id = properties["state_id"]
                    
                    # Get the active workflow for the project
                    active_workflow = WorkflowTemplate.objects.filter(
                        project_id=project_id,
                        is_active=True,
                        deleted_at__isnull=True
                    ).first()
                    
                    if active_workflow:
                        # Check each issue's workflow transition
                        for issue in editable_issues:
                            current_state_id = issue.state_id
                            
                            # Check if transition is allowed
                            transition = WorkflowTransition.objects.filter(
                                workflow=active_workflow,
                                from_state_id=current_state_id,
                                to_state_id=new_state_id,
                                deleted_at__isnull=True
                            ).first()
                            
                            if transition:
                                if transition.require_reviewer:
                                    # This transition requires approval, add to requests
                                    state_change_requests[issue.id] = {
                                        'issue': issue,
                                        'from_state': current_state_id,
                                        'to_state': new_state_id,
                                        'transition': transition
                                    }
                                else:
                                    # Direct transition allowed
                                    Issue.objects.filter(id=issue.id).update(state_id=new_state_id)
                                    
                                    # Track state change for activity log
                                    details = all_issue_activity_details[issue.id]
                                    details['regular_old_values']['state_id'] = current_state_id
                                    details['regular_new_values']['state_id'] = new_state_id
                                    details['has_regular_changes'] = True
                            else:
                                # No valid transition found, skip this issue's state change
                                pass
                    else:
                        # No workflow, allow direct state change
                        regular_properties_to_update["state_id"] = new_state_id
                
                # Handle type_id separately with validation
                if "type_id" in properties:
                    type_id_value = properties["type_id"]
                    
                    try:
                        # First, try to find as ProjectIssueType
                        project_issue_type = ProjectIssueType.objects.filter(
                            id=type_id_value,
                            project_id=project_id,
                            deleted_at__isnull=True
                        ).first()
                        
                        if project_issue_type:
                            # Use the actual IssueType ID
                            regular_properties_to_update["type_id"] = project_issue_type.issue_type_id
                        else:
                            # Try to find as direct IssueType ID (for backward compatibility)
                            issue_type = IssueType.objects.filter(
                                id=type_id_value,
                                workspace__slug=slug,
                                deleted_at__isnull=True
                            ).first()
                            
                            if issue_type:
                                # Verify this IssueType is available in the project
                                project_issue_type_exists = ProjectIssueType.objects.filter(
                                    issue_type_id=type_id_value,
                                    project_id=project_id,
                                    deleted_at__isnull=True
                                ).exists()
                                
                                if project_issue_type_exists:
                                    regular_properties_to_update["type_id"] = type_id_value
                                else:
                                    return Response(
                                        {"error": f"Issue type {type_id_value} is not available in this project"},
                                        status=status.HTTP_400_BAD_REQUEST
                                    )
                            else:
                                return Response(
                                    {"error": f"Invalid issue type ID: {type_id_value}"},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                    except Exception as e:
                        return Response(
                            {"error": f"Error validating issue type: {str(e)}"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # print(f"[DEBUG] regular_properties_to_update: {regular_properties_to_update}") # DEBUG
                
                if regular_properties_to_update:
                    editable_issue_ids_list = [issue.id for issue in editable_issues]
                    
                    # Store old values for activity logging BEFORE the update
                    for issue_in_list in Issue.objects.filter(id__in=editable_issue_ids_list):
                        details = all_issue_activity_details[issue_in_list.id]
                        details['issue_obj'] = issue_in_list # Ensure we have the freshest object
                        for field_key, new_val in regular_properties_to_update.items():
                            old_val = getattr(issue_in_list, field_key)
                            # print(f"[DEBUG] Issue {issue_in_list.id}, Field {field_key}: Old={old_val}, New={new_val}") # DEBUG
                            if old_val != new_val:
                                details['regular_old_values'][field_key] = old_val
                                details['regular_new_values'][field_key] = new_val
                                details['has_regular_changes'] = True
                                # print(f"[DEBUG] Issue {issue_in_list.id}: Regular change detected for {field_key}") # DEBUG
                            else:
                                # print(f"[DEBUG] Issue {issue_in_list.id}: No change for {field_key}") # DEBUG
                                pass
                    
                    # Perform bulk update
                    Issue.objects.filter(id__in=editable_issue_ids_list).update(**regular_properties_to_update)

                # 2. Handle custom field values
                custom_field_values_payload = properties.get("custom_field_values", [])
                if custom_field_values_payload:
                    field_ids_from_payload = [cf['custom_field_id'] for cf in custom_field_values_payload]
                    custom_fields_map = {
                        str(cf.id): cf for cf in CustomField.objects.filter(
                            id__in=field_ids_from_payload,
                            project_id=project_id,
                            deleted_at__isnull=True
                        )
                    }
                    
                    # Pre-fetch existing CustomFieldValue for all editable issues and relevant fields
                    existing_custom_field_values_qs = CustomFieldValue.objects.filter(
                        issue_id__in=[issue.id for issue in editable_issues],
                        custom_field_id__in=custom_fields_map.keys(),
                        deleted_at__isnull=True
                    ).select_related('custom_field')

                    existing_cfv_map = defaultdict(dict)
                    for cfv in existing_custom_field_values_qs:
                        existing_cfv_map[cfv.issue_id][str(cfv.custom_field_id)] = cfv

                    custom_field_values_to_update = []
                    custom_field_values_to_create = []

                    for issue_obj_loop in editable_issues: # Use fresh objects if updated above, or original from editable_issues
                        issue_id_loop = issue_obj_loop.id
                        details = all_issue_activity_details[issue_id_loop]
                        # Ensure issue_obj is the one from the list, potentially updated by regular props
                        issue_for_cf = Issue.objects.get(id=issue_id_loop) if regular_properties_to_update else issue_obj_loop
                        details['issue_obj'] = issue_for_cf


                        for cf_payload_item in custom_field_values_payload:
                            field_id_str = cf_payload_item['custom_field_id']
                            new_value_for_cf = cf_payload_item['value']
                            
                            if field_id_str not in custom_fields_map:
                                continue # Skip if custom field is invalid or not found
                                
                            custom_field_obj = custom_fields_map[field_id_str]
                            
                            # Validate (assuming self.validate_custom_field_value exists and is correct)
                            self.validate_custom_field_value(custom_field_obj, new_value_for_cf)
                            
                            existing_cfv_instance = existing_cfv_map[issue_id_loop].get(field_id_str)
                            
                            original_value_for_log = None

                            if existing_cfv_instance:
                                original_value_for_log = existing_cfv_instance.value
                                if existing_cfv_instance.value != new_value_for_cf:
                                    existing_cfv_instance.value = new_value_for_cf
                                    existing_cfv_instance.updated_by = request.user
                                    custom_field_values_to_update.append(existing_cfv_instance)
                                    details['custom_field_changes'].append({
                                        'field_name': custom_field_obj.name, 'field_id': custom_field_obj.id,
                                        'field_type': custom_field_obj.field_type,
                                        'old_value': original_value_for_log, 'new_value': new_value_for_cf
                                    })
                            else: # Create new CustomFieldValue
                                custom_field_values_to_create.append(
                                    CustomFieldValue(
                                        custom_field=custom_field_obj,
                                        issue=issue_for_cf, # Use the correct issue object
                                        value=new_value_for_cf,
                                        project_id=project_id,
                                        workspace_id=issue_for_cf.workspace_id,
                                        created_by=request.user,
                                        updated_by=request.user
                                    )
                                )
                                details['custom_field_changes'].append({
                                    'field_name': custom_field_obj.name, 'field_id': custom_field_obj.id,
                                    'field_type': custom_field_obj.field_type,
                                    'old_value': None, 'new_value': new_value_for_cf
                                })
                    
                    if custom_field_values_to_update:
                        CustomFieldValue.objects.bulk_update(custom_field_values_to_update, ['value', 'updated_by'])
                    if custom_field_values_to_create:
                        CustomFieldValue.objects.bulk_create(custom_field_values_to_create)

                # 3. Handle assignee changes
                if "assignee_ids" in properties:
                    requested_new_assignee_ids = properties.get("assignee_ids", [])
                    
                    # Ensure all requested_new_assignee_ids are valid UUIDs if not empty, or handle empty list
                    valid_requested_assignee_id_set = set()
                    if requested_new_assignee_ids: # if empty, it means unassign all
                        try:
                            valid_requested_assignee_id_set = set(UUID(str(uid)) for uid in requested_new_assignee_ids)
                        except ValueError:
                            raise ValidationError("Invalid UUID format in assignee_ids.")

                    # Check if these users are valid project members
                    valid_project_member_ids = set(
                        ProjectMember.objects.filter(
                            project_id=project_id,
                            member_id__in=list(valid_requested_assignee_id_set), # Convert set to list for __in
                            is_active=True
                        ).values_list('member_id', flat=True)
                    )
                    
                    # Filter requested assignees to only those who are valid project members
                    # This means if a non-member UUID was passed, it's silently ignored.
                    # If strictness is needed, compare len(valid_project_member_ids) vs len(valid_requested_assignee_id_set)
                    final_new_assignee_set = valid_project_member_ids

                    for issue_obj_loop in editable_issues:
                        issue_id_loop = issue_obj_loop.id
                        details = all_issue_activity_details[issue_id_loop]
                        # Ensure issue_obj is up-to-date
                        issue_for_assignee = Issue.objects.get(id=issue_id_loop) if (regular_properties_to_update or custom_field_values_payload) else issue_obj_loop
                        details['issue_obj'] = issue_for_assignee

                        old_assignee_set = set(issue_to_current_assignees_map.get(issue_id_loop, []))
                        # print(f"[DEBUG] Issue {issue_id_loop}: Old Assignees Set: {old_assignee_set}") # DEBUG
                        # print(f"[DEBUG] Issue {issue_id_loop}: Final New Assignees Set: {final_new_assignee_set}") # DEBUG
                        
                        assignees_to_add_ids = list(final_new_assignee_set - old_assignee_set)
                        assignees_to_remove_ids = list(old_assignee_set - final_new_assignee_set)
                        # print(f"[DEBUG] Issue {issue_id_loop}: Assignees to Add: {assignees_to_add_ids}") # DEBUG
                        # print(f"[DEBUG] Issue {issue_id_loop}: Assignees to Remove: {assignees_to_remove_ids}") # DEBUG

                        if assignees_to_add_ids or assignees_to_remove_ids:
                            # Perform DB operations
                            if assignees_to_remove_ids:
                                IssueAssignee.objects.filter(
                                    issue_id=issue_id_loop, 
                                    assignee_id__in=assignees_to_remove_ids
                                ).delete() # Or soft delete

                            assignees_to_create_instances = []
                            if assignees_to_add_ids:
                                for user_id_to_add in assignees_to_add_ids:
                                    assignees_to_create_instances.append(
                                        IssueAssignee(
                                            issue_id=issue_id_loop,
                                            assignee_id=user_id_to_add,
                                            project_id=project_id,
                                            workspace_id=issue_for_assignee.workspace_id,
                                            created_by=request.user,
                                            updated_by=request.user
                                        )
                                    )
                                if assignees_to_create_instances:
                                    IssueAssignee.objects.bulk_create(assignees_to_create_instances)
                            
                            details['assignee_added'] = assignees_to_add_ids
                            details['assignee_removed'] = assignees_to_remove_ids
                
                # 4. Create activity logs (SYNCHRONOUSLY) and prepare for consolidated notification
                all_involved_user_ids_for_names = set()
                # Populate user IDs from assignees and specific custom field types
                for issue_id_log_prep, details_log_prep in all_issue_activity_details.items():
                    all_involved_user_ids_for_names.update(details_log_prep['assignee_added'])
                    all_involved_user_ids_for_names.update(details_log_prep['assignee_removed'])
                    for cf_change_prep in details_log_prep['custom_field_changes']:
                        if cf_change_prep['field_type'] in ["project_member", "project_members"]:
                            if cf_change_prep['old_value']:
                                old_val_list_prep = [cf_change_prep['old_value']] if cf_change_prep['field_type'] == "project_member" else (json.loads(cf_change_prep['old_value']) if isinstance(cf_change_prep['old_value'], str) else cf_change_prep['old_value'])
                                all_involved_user_ids_for_names.update(UUID(str(uid)) for uid in old_val_list_prep if uid and str(uid) != "None") # Check for "None" string
                            if cf_change_prep['new_value']:
                                new_val_list_prep = [cf_change_prep['new_value']] if cf_change_prep['field_type'] == "project_member" else (json.loads(cf_change_prep['new_value']) if isinstance(cf_change_prep['new_value'], str) else cf_change_prep['new_value'])
                                all_involved_user_ids_for_names.update(UUID(str(uid)) for uid in new_val_list_prep if uid and str(uid) != "None") # Check for "None" string
                
                # Fetch display names for all involved users once
                user_display_name_map = {
                    user.id: user.display_name 
                    for user in User.objects.filter(id__in=list(all_involved_user_ids_for_names))
                }
                
                # Pre-fetch states and parent issues for all relevant changes to minimize DB hits in loop
                all_involved_state_ids = set()
                all_involved_parent_ids = set()
                for _issue_id, details in all_issue_activity_details.items():
                    if details['has_regular_changes']:
                        if 'state_id' in details['regular_old_values'] and details['regular_old_values']['state_id']:
                            all_involved_state_ids.add(UUID(str(details['regular_old_values']['state_id'])))
                        if 'state_id' in details['regular_new_values'] and details['regular_new_values']['state_id']:
                            all_involved_state_ids.add(UUID(str(details['regular_new_values']['state_id'])))
                        if 'parent_id' in details['regular_old_values'] and details['regular_old_values']['parent_id']:
                            all_involved_parent_ids.add(UUID(str(details['regular_old_values']['parent_id'])))
                        if 'parent_id' in details['regular_new_values'] and details['regular_new_values']['parent_id']:
                            all_involved_parent_ids.add(UUID(str(details['regular_new_values']['parent_id'])))

                states_map = {s.id: s for s in State.objects.filter(id__in=list(all_involved_state_ids))}
                parents_map = {p.id: p for p in Issue.objects.select_related('project').filter(id__in=list(all_involved_parent_ids))}

                # 알림을 위해 생성된 활동 로그들을 저장할 리스트
                created_activities_for_notification = []

                for issue_id_log, details_log in all_issue_activity_details.items():
                    issue_for_log = details_log['issue_obj']
                    activity_created_for_this_issue = False

                    # Log regular property changes
                    if details_log['has_regular_changes']:
                        for field, new_val_log in details_log['regular_new_values'].items():
                            old_val_log = details_log['regular_old_values'].get(field)
                            
                            activity_field_name = field
                            activity_old_value_str = str(old_val_log) if old_val_log is not None else "없음"
                            activity_new_value_str = str(new_val_log) if new_val_log is not None else "없음"
                            _old_id = None
                            _new_id = None
                            comment_str = f"필드 '{field}'가 변경되었습니다: {activity_old_value_str} → {activity_new_value_str}"

                            if field == "state_id":
                                activity_field_name = "state"
                                old_state_obj = states_map.get(UUID(str(old_val_log))) if old_val_log else None
                                new_state_obj = states_map.get(UUID(str(new_val_log))) if new_val_log else None
                                activity_old_value_str = old_state_obj.name if old_state_obj else "없음"
                                activity_new_value_str = new_state_obj.name if new_state_obj else "없음"
                                _old_id = old_state_obj.id if old_state_obj else None
                                _new_id = new_state_obj.id if new_state_obj else None
                                comment_str = f"상태를 '{activity_old_value_str}'에서 '{activity_new_value_str}'(으)로 변경했습니다."
                            elif field == "parent_id":
                                activity_field_name = "parent"
                                old_parent_obj = parents_map.get(UUID(str(old_val_log))) if old_val_log else None
                                new_parent_obj = parents_map.get(UUID(str(new_val_log))) if new_val_log else None
                                activity_old_value_str = f"{old_parent_obj.project.identifier}-{old_parent_obj.sequence_id}" if old_parent_obj else "없음"
                                activity_new_value_str = f"{new_parent_obj.project.identifier}-{new_parent_obj.sequence_id}" if new_parent_obj else "없음"
                                _old_id = old_parent_obj.id if old_parent_obj else None
                                _new_id = new_parent_obj.id if new_parent_obj else None
                                comment_str = f"부모 이슈를 '{activity_old_value_str}'에서 '{activity_new_value_str}'(으)로 변경했습니다."
                            
                            # print(f"[DEBUG] Issue {issue_id_log}: Logging regular change for Field {activity_field_name}: Old='{activity_old_value_str}', New='{activity_new_value_str}'") # DEBUG
                            created_activity = IssueActivity.objects.create(
                                issue_id=issue_id_log, actor_id=request.user.id, project_id=project_id,
                                workspace_id=issue_for_log.workspace_id,
                                comment=comment_str,
                                field=activity_field_name, old_value=activity_old_value_str,
                                new_value=activity_new_value_str, 
                                old_identifier=_old_id, new_identifier=_new_id,
                                verb="updated", epoch=epoch
                            )
                            created_activities_for_notification.append(created_activity)
                            # 확인용 print: DB 저장 직후 값 확인
                            # print(f"[DEBUG] DB Check (Updated): ID={created_activity.id}, Verb='{created_activity.verb}', Comment='{created_activity.comment}'")
                            activity_created_for_this_issue = True
                    
                    # Log custom field changes
                    if details_log['custom_field_changes']:
                        # print(f"[DEBUG] Issue {issue_id_log}: Logging custom field changes: {details_log['custom_field_changes']}") # DEBUG
                        pass
                    for cf_change in details_log['custom_field_changes']:
                        # ... (기존 custom_field_changes 로직과 유사하게, _old_identifier, _new_identifier, old_cf_val_str, new_cf_val_str 등을 계산)
                        old_cf_val = cf_change['old_value']
                        new_cf_val = cf_change['new_value']
                        field_name_cf = cf_change['field_name']
                        field_type_cf = cf_change['field_type']
                        
                        old_cf_val_str, new_cf_val_str = "", ""
                        _old_identifier_cf, _new_identifier_cf = None, None

                        if field_type_cf in ["project_member", "project_members"]:
                            def get_names_cf(val_list_or_single, is_list_type):
                                if val_list_or_single is None: return "없음"
                                # Ensure val_list_or_single is a list of UUIDs for processing
                                uids_to_map_cf = []
                                if is_list_type:
                                    if isinstance(val_list_or_single, str):
                                        try: uids_to_map_cf = json.loads(val_list_or_single)
                                        except: uids_to_map_cf = []
                                    elif isinstance(val_list_or_single, list):
                                        uids_to_map_cf = val_list_or_single
                                else: # project_member
                                    if val_list_or_single: # not None
                                        uids_to_map_cf = [val_list_or_single]
                                
                                # Filter out None or "None" strings before converting to UUID
                                valid_uids_cf = [uid for uid in uids_to_map_cf if uid and str(uid).lower() != 'none']
                                names_cf = [user_display_name_map.get(UUID(str(uid)), str(uid)) for uid in valid_uids_cf]
                                return ", ".join(names_cf) if names_cf else "없음"

                            old_cf_val_str = get_names_cf(old_cf_val, field_type_cf == "project_members")
                            new_cf_val_str = get_names_cf(new_cf_val, field_type_cf == "project_members")
                            
                            if field_type_cf == "project_member":
                                _old_identifier_cf = UUID(str(old_cf_val)) if old_cf_val and str(old_cf_val).lower() != 'none' else None
                                _new_identifier_cf = UUID(str(new_cf_val)) if new_cf_val and str(new_cf_val).lower() != 'none' else None
                        else:
                            old_cf_val_str = str(old_cf_val) if old_cf_val is not None else "없음"
                            new_cf_val_str = str(new_cf_val) if new_cf_val is not None else "없음"

                        created_activity = IssueActivity.objects.create(
                            issue_id=issue_id_log, actor_id=request.user.id, project_id=project_id,
                            workspace_id=issue_for_log.workspace_id,
                            comment=f"커스텀 필드 '{field_name_cf}'가 변경되었습니다: {old_cf_val_str} → {new_cf_val_str}",
                            field=f"custom_field_{field_name_cf}",
                            old_value=old_cf_val_str, new_value=new_cf_val_str,
                            old_identifier=_old_identifier_cf, new_identifier=_new_identifier_cf,
                            verb="updated", epoch=epoch
                        )
                        created_activities_for_notification.append(created_activity)
                        # 확인용 print: DB 저장 직후 값 확인
                        # print(f"[DEBUG] DB Check (Updated): ID={created_activity.id}, Verb='{created_activity.verb}', Comment='{created_activity.comment}'")
                        activity_created_for_this_issue = True

                    # Log assignee changes
                    if details_log['assignee_added'] or details_log['assignee_removed']:
                        # DEBUG PRINT ADDED HERE
                        # print(f"[DEBUG] Issue {issue_id_log}: Just BEFORE creating assignee logs: Added={details_log['assignee_added']}, Removed={details_log['assignee_removed']}")
                        # print(f"[DEBUG] Issue {issue_id_log}: Logging assignee changes. Added: {details_log['assignee_added']}, Removed: {details_log['assignee_removed']}") # DEBUG
                        pass

                    for added_id in details_log['assignee_added']:
                        user_name = user_display_name_map.get(added_id, f"사용자({str(added_id)[:8]})") # fallback name
                        activity_comment = f"담당자로 '{user_name}' 님을 지정했습니다."
                        # print(f"[DEBUG] Creating ASSIGNED activity: issue={issue_id_log}, user_name={user_name}, added_id={added_id}, comment=\"{activity_comment}\"")
                        created_activity = IssueActivity.objects.create(
                            issue_id=issue_id_log, actor_id=request.user.id, project_id=project_id,
                            workspace_id=issue_for_log.workspace_id,
                            comment=activity_comment,
                            field="assignees", old_value="없음", new_value=user_name, 
                            old_identifier=None, new_identifier=added_id,
                            verb="assigned", epoch=epoch
                        )
                        created_activities_for_notification.append(created_activity)
                        # 확인용 print: DB 저장 직후 값 확인
                        # print(f"[DEBUG] DB Check (Assigned): ID={created_activity.id}, Verb='{created_activity.verb}', Comment='{created_activity.comment}'")
                        activity_created_for_this_issue = True

                    for removed_id in details_log['assignee_removed']:
                        user_name = user_display_name_map.get(removed_id, f"사용자({str(removed_id)[:8]})") # fallback name
                        activity_comment = f"담당자에서 '{user_name}' 님을 제외했습니다."
                        # print(f"[DEBUG] Creating UNASSIGNED activity: issue={issue_id_log}, user_name={user_name}, removed_id={removed_id}, comment=\"{activity_comment}\"")
                        created_activity = IssueActivity.objects.create(
                            issue_id=issue_id_log, actor_id=request.user.id, project_id=project_id,
                            workspace_id=issue_for_log.workspace_id,
                            comment=activity_comment,
                            field="assignees", old_value=user_name, new_value="없음",
                            old_identifier=removed_id, new_identifier=None,
                            verb="unassigned", epoch=epoch
                        )
                        created_activities_for_notification.append(created_activity)
                        # 확인용 print: DB 저장 직후 값 확인
                        # print(f"[DEBUG] DB Check (Unassigned): ID={created_activity.id}, Verb='{created_activity.verb}', Comment='{created_activity.comment}'")
                        activity_created_for_this_issue = True
                    
                    # Consolidated ASYNC Notification (IF any activity was created for this issue)
                    if activity_created_for_this_issue:
                        serialized_activities_for_notification = json.dumps(
                            IssueActivitySerializer(created_activities_for_notification, many=True).data,
                            cls=DjangoJSONEncoder
                        )
                        
                        issue_activity.delay(
                            type="issue.activity.bulk_notify", # 새로운 타입 사용
                            requested_data=serialized_activities_for_notification, # 직렬화된 활동 로그 리스트 전달
                            current_instance=None, # 더 이상 필요 없음
                            issue_id=str(issue_id_log), 
                            actor_id=str(request.user.id), 
                            project_id=str(project_id),
                            epoch=epoch, 
                            notification=True, 
                            create_activity_record=False # 활동은 이미 동기적으로 생성됨
                        )
                        created_activities_for_notification = [] # 다음 이슈를 위해 리스트 초기화
                    
                    # Create approval request comments for state changes that require review
                    if state_change_requests:
                        # Get state names for better comment messages
                        state_ids = set()
                        for req in state_change_requests.values():
                            state_ids.add(req['from_state'])
                            state_ids.add(req['to_state'])
                        
                        states = {str(s.id): s for s in State.objects.filter(id__in=state_ids)}
                        
                        for issue_id, request_info in state_change_requests.items():
                            try:
                                issue = request_info['issue']
                                transition = request_info['transition']
                                from_state = states.get(str(request_info['from_state']))
                                to_state = states.get(str(request_info['to_state']))
                                
                                from_state_name = from_state.name if from_state else "Unknown"
                                to_state_name = to_state.name if to_state else "Unknown"
                                
                                # Check if there's already a pending request
                                existing_request = WorkflowApprovalRequest.objects.filter(
                                    issue=issue,
                                    transition=transition,
                                    requester=request.user,
                                    status="pending"
                                ).exists()

                                if existing_request:
                                    continue

                                # Create actual workflow approval request
                                approval_request = WorkflowApprovalRequest.objects.create(
                                    issue=issue,
                                    workflow=transition.workflow,
                                    transition=transition,
                                    from_state_id=request_info['from_state'],
                                    to_state_id=request_info['to_state'],
                                    requester=request.user,
                                    project_id=project_id,
                                    workspace_id=issue.workspace_id,
                                    comment=f"일괄 변경 작업으로 인한 상태 변경 요청: {from_state_name} → {to_state_name}",
                                    status="pending",
                                    created_by=request.user,
                                    updated_by=request.user
                                )
                                
                                # Send notifications to reviewers after transaction commit
                                # Use default argument to bind approval_request.id immediately to avoid closure loop variable issue
                                transaction.on_commit(
                                    lambda approval_request_id=str(approval_request.id): workflow_approval_request_notifications.delay(
                                        approval_request_id=approval_request_id,
                                        project_id=str(project_id),
                                        actor_id=str(request.user.id)
                                    )
                                )
                                
                                # Create activity log for the approval request
                                IssueActivity.objects.create(
                                    issue_id=issue_id,
                                    actor_id=request.user.id,
                                    project_id=project_id,
                                    workspace_id=issue.workspace_id,
                                    comment=f"상태 변경 승인 요청: {from_state_name} → {to_state_name}",
                                    field="workflow_approval",
                                    old_value=from_state_name,
                                    new_value=to_state_name,
                                    verb="requested_approval",
                                    epoch=epoch
                                )
                                
                            except Exception as comment_error:
                                print(f"Error creating approval request for issue {issue_id}: {str(comment_error)}")
                                import traceback
                                traceback.print_exc()

        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionError as e: # Should be caught by decorator, but as a fallback
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        # Removed IntegrityError and general Exception for brevity in this example, but they should be there.
        # Ensure proper rollback for other DB errors if not using transaction.atomic for the whole block.
        except Exception as e:
            tb_str = traceback.format_exc()
            print(f"Bulk update failed unexpectedly: {str(e)}\\nTraceback:\\n{tb_str}")
            # 에러 발생 시점의 주요 변수 로깅 (예시)
            # logger.error(f"Properties: {properties}")
            # logger.error(f"Issue IDs: {issue_ids}")
            # if 'issue_id_loop' in locals():
            #     logger.error(f"Current issue_id_loop: {issue_id_loop}")
            # if 'details' in locals():
            #    logger.error(f"Current details: {details}")
            return Response(
                {"error": "An unexpected internal server error occurred."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


        response_data = {
            "message": "Issues updated successfully",
            "updated_issues": len(editable_issues),
            "total_issues": issues_qs.count(), # Use count() on original queryset
        }
        
        if non_editable_issues:
            response_data["warning"] = f"{len(non_editable_issues)} issues were skipped due to insufficient permissions"
            response_data["skipped_issues"] = len(non_editable_issues)
        
        if state_change_requests:
            response_data["approval_requests"] = len(state_change_requests)
            response_data["approval_message"] = f"{len(state_change_requests)}개 이슈의 상태 변경이 승인 대기 중입니다"

        return Response(response_data, status=status.HTTP_200_OK)

    def validate_custom_field_value(self, field, value):
        """커스텀 필드 값 유효성 검사"""
        if field.is_required and value is None:
            raise ValidationError(f"필드 '{field.name}'는 필수입니다.")

        if value is not None:
            if field.field_type == "text":
                if not isinstance(value, str):
                    raise ValidationError("문자열이어야 합니다.")
            elif field.field_type == "number":
                try:
                    float(value)
                except (TypeError, ValueError):
                    raise ValidationError("숫자여야 합니다.")
            elif field.field_type == "date":
                try:
                    datetime.strptime(value, "%Y-%m-%d")
                except (TypeError, ValueError):
                    raise ValidationError("YYYY-MM-DD 형식이어야 합니다.")
            elif field.field_type in ["select", "multiselect"]:
                options = field.options or []
                if field.field_type == "select":
                    if value not in options:
                        raise ValidationError("유효하지 않은 선택값입니다.")
                else:  # multiselect
                    if not isinstance(value, list):
                        raise ValidationError("리스트 형태여야 합니다.")
                    if not all(v in options for v in value):
                        raise ValidationError("유효하지 않은 선택값이 포함되어 있습니다.")
            elif field.field_type in ["project_member", "project_members"]:
                if field.field_type == "project_member":
                    if not ProjectMember.objects.filter(
                        project_id=field.project_id,
                        member_id=value,
                        is_active=True
                    ).exists():
                        raise ValidationError("유효하지 않은 프로젝트 멤버입니다.")
                else:  # project_members
                    if not isinstance(value, list):
                        raise ValidationError("리스트 형태여야 합니다.")
                    
                    valid_members = ProjectMember.objects.filter(
                        project_id=field.project_id,
                        member_id__in=value,
                        is_active=True
                    ).count()
                    
                    if valid_members != len(value):
                        raise ValidationError("유효하지 않은 프로젝트 멤버가 포함되어 있습니다.")
