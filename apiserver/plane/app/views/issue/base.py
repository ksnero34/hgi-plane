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
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page

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
)
from plane.bgtasks.issue_activities_task import issue_activity
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
from plane.utils.user_timezone_converter import user_timezone_converter
from plane.bgtasks.recent_visited_task import recent_visited_task
from plane.utils.global_paginator import paginate
from plane.bgtasks.webhook_task import model_activity


class IssueListEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def get(self, request, slug, project_id):
        issue_ids = request.GET.get("issues", False)

        if not issue_ids:
            return Response(
                {"error": "Issues are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        issue_ids = [issue_id for issue_id in issue_ids.split(",") if issue_id != ""]

        queryset = (
            Issue.issue_objects.filter(
                workspace__slug=slug, project_id=project_id, pk__in=issue_ids
            )
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

        filters = issue_filters(request.query_params, "GET")

        order_by_param = request.GET.get("order_by", "-created_at")
        issue_queryset = queryset.filter(**filters)
        # Issue queryset
        issue_queryset, _ = order_issue_queryset(
            issue_queryset=issue_queryset, order_by_param=order_by_param
        )

        # Group by
        group_by = request.GET.get("group_by", False)
        sub_group_by = request.GET.get("sub_group_by", False)

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

        if self.fields or self.expand:
            issues = IssueSerializer(
                queryset, many=True, fields=self.fields, expand=self.expand
            ).data
        else:
            issues = issue_queryset.values(
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
        
        # 기본 필터 적용 (날짜 필터 제외)
        filters = {k: v for k, v in issue_filters(request.query_params, "GET").items() 
                  if not k.startswith('start_date') and not k.startswith('target_date')}
        
        # 기본 queryset 가져오기
        issue_queryset = self.get_queryset()
        
        # RESTRICTED 사용자는 자신에게 할당된 이슈만 볼 수 있음
        if user_role and user_role.role == ROLE.RESTRICTED.value:
            issue_queryset = issue_queryset.filter(assignees__id=request.user.id)
            # print("Restricted User - Filtering by assignee:", request.user.id)

        # 기본 필터와 extra 필터 적용
        issue_queryset = issue_queryset.filter(**filters, **extra_filters)
        
        # print("Applied Filters:", filters)
        # print("Extra Filters:", extra_filters)
        # print("Total Issues:", issue_queryset.count())

        # 정렬 파라미터 설정
        order_by_param = request.GET.get("order_by", "-created_at")
        # print("Order By:", order_by_param)

        # 캘린더 뷰인 경우 Q 객체로 필터링
        if request.GET.get('layout') == 'calendar':
            start_date_from = request.GET.get('start_date_from')
            start_date_to = request.GET.get('start_date_to')
            target_date_from = request.GET.get('target_date_from')
            target_date_to = request.GET.get('target_date_to')

            # print("Calendar View Parameters:", {
            #     'start_date_from': start_date_from,
            #     'start_date_to': start_date_to,
            #     'target_date_from': target_date_from,
            #     'target_date_to': target_date_to
            # })

            if start_date_from and start_date_to and target_date_from and target_date_to:
                # 캘린더 날짜 필터 적용
                calendar_filter = (
                    Q(start_date__range=(start_date_from, start_date_to)) |
                    Q(target_date__range=(target_date_from, target_date_to)) |
                    Q(
                        Q(start_date__isnull=False) & 
                        Q(target_date__isnull=False) & 
                        Q(start_date__lte=target_date_to) & 
                        Q(target_date__gte=start_date_from)
                    )
                )
                issue_queryset = issue_queryset.filter(calendar_filter)
                
                # print("Calendar Filter Query:", str(calendar_filter))
                # print("Total Issues After Calendar Filter:", issue_queryset.count())

        # print("Total Issues Before Grouping:", issue_queryset.count())

        # Group by
        group_by = request.GET.get("group_by", False)
        sub_group_by = request.GET.get("sub_group_by", False)

        # print("Grouping Parameters:", {
        #     'group_by': group_by,
        #     'sub_group_by': sub_group_by
        # })

        # issue queryset
        issue_queryset = issue_queryset_grouper(
            queryset=issue_queryset, group_by=group_by, sub_group_by=sub_group_by
        )

        # print("Final Query:", str(issue_queryset.query))
        # print("End Debug Logs\n")

        # 정렬 적용
        if order_by_param and not group_by:
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
                    return self.paginate(
                        request=request,
                        order_by=order_by_param,
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
                return self.paginate(
                    request=request,
                    order_by=order_by_param,
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
            return self.paginate(
                order_by=order_by_param,
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
                origin=request.META.get("HTTP_ORIGIN"),
            )
            issue = (
                issue_queryset_grouper(
                    queryset=self.get_queryset().filter(pk=serializer.data["id"]),
                    group_by=None,
                    sub_group_by=None,
                )
                .values(
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
                .first()
            )
            datetime_fields = ["created_at", "updated_at"]
            issue = user_timezone_converter(
                issue, datetime_fields, request.user.user_timezone
            )
            # Send the model activity
            model_activity.delay(
                model_name="issue",
                model_id=str(serializer.data["id"]),
                requested_data=request.data,
                current_instance=None,
                actor_id=request.user.id,
                slug=slug,
                origin=request.META.get("HTTP_ORIGIN"),
            )
            return Response(issue, status=status.HTTP_201_CREATED)
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
                status=status.HTTP_400_BAD_REQUEST,
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
            IssueSerializer(issue).data, cls=DjangoJSONEncoder
        )

        requested_data = json.dumps(self.request.data, cls=DjangoJSONEncoder)
        serializer = IssueCreateSerializer(issue, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            issue_activity.delay(
                type="issue.activity.updated",
                requested_data=requested_data,
                actor_id=str(request.user.id),
                issue_id=str(pk),
                project_id=str(project_id),
                current_instance=current_instance,
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=request.META.get("HTTP_ORIGIN"),
            )
            model_activity.delay(
                model_name="issue",
                model_id=str(serializer.data.get("id", None)),
                requested_data=request.data,
                current_instance=current_instance,
                actor_id=request.user.id,
                slug=slug,
                origin=request.META.get("HTTP_ORIGIN"),
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=Issue)
    def destroy(self, request, slug, project_id, pk=None):
        issue = Issue.objects.get(workspace__slug=slug, project_id=project_id, pk=pk)

        issue.delete()
        issue_activity.delay(
            type="issue.activity.deleted",
            requested_data=json.dumps({"issue_id": str(pk)}),
            actor_id=str(request.user.id),
            issue_id=str(pk),
            project_id=str(project_id),
            current_instance={},
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=request.META.get("HTTP_ORIGIN"),
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
        paginated_data = results.values(*fields)

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
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
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
        start = new_start or current_start
        target = new_target or current_target

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
