from django.db.models import Case, CharField, Min, Value, When, F, Window, Q
from django.db.models.functions import RowNumber, Coalesce
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

# Custom ordering for priority and state
PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"]
STATE_ORDER = ["backlog", "unstarted", "started", "completed", "cancelled"]


def order_issue_queryset(issue_queryset, order_by_param="-created_at"):
    try:
        # 상위 작업과 하위 작업 그룹화 정렬
        if order_by_param == "parent_child":
            # 먼저 모든 부모 이슈(parent_id가 None인)를 sort_order로 정렬
            # 그 다음 각 부모 이슈의 ID를 기준으로 하위 이슈들이 정렬되도록 함
            # 부모 이슈가 없는 이슈들은 자신의 ID로 그룹화되도록 함
            # annotate를 통해 정렬에 필요한 두 개의 필드 추가:
            # 1. grouping_id: 부모 ID 또는 자신의 ID (그룹화 기준)
            # 2. is_parent: 부모 이슈인지 여부 (같은 그룹 내에서 부모가 먼저 오도록)
            # 3. 그룹 내에서 start_date가 빠른 순으로 정렬
            
            # 상위 작업이 없는 경우는 자신의 ID를 그룹 ID로 사용하고,
            # 하위 작업은 부모의 ID를 그룹 ID로 사용하여 그룹화
            issue_queryset = issue_queryset.annotate(
                grouping_id=Coalesce('parent_id', 'id'),
                # 동일 그룹 내에서 상위 작업이 먼저 오도록 정렬
                is_parent=Case(
                    When(parent_id__isnull=True, then=Value(0)),
                    default=Value(1),
                    output_field=CharField(),
                )
            ).order_by('grouping_id', 'is_parent', 'start_date', 'sort_order')
            order_by_param = 'id'  # 실제 DB 쿼리에서는 id로 정렬
            
        # Priority Ordering
        elif order_by_param == "priority" or order_by_param == "-priority":
            issue_queryset = issue_queryset.annotate(
                priority_order=Case(
                    *[
                        When(priority=p, then=Value(i))
                        for i, p in enumerate(PRIORITY_ORDER)
                    ],
                    output_field=CharField(),
                )
            ).order_by("priority_order")
            order_by_param = (
                "priority_order" if order_by_param.startswith("-") else "-priority_order"
            )
        # State Ordering
        elif order_by_param in ["state__group", "-state__group"]:
            state_order = (
                STATE_ORDER
                if order_by_param in ["state__name", "state__group"]
                else STATE_ORDER[::-1]
            )
            issue_queryset = issue_queryset.annotate(
                state_order=Case(
                    *[
                        When(state__group=state_group, then=Value(i))
                        for i, state_group in enumerate(state_order)
                    ],
                    default=Value(len(state_order)),
                    output_field=CharField(),
                )
            ).order_by("state_order")
            order_by_param = (
                "-state_order" if order_by_param.startswith("-") else "state_order"
            )
        # assignee and label ordering
        elif order_by_param in [
            "labels__name",
            "assignees__first_name",
            "issue_module__module__name",
            "-labels__name",
            "-assignees__first_name",
            "-issue_module__module__name",
        ]:
            issue_queryset = issue_queryset.annotate(
                min_values=Min(
                    order_by_param[1::]
                    if order_by_param.startswith("-")
                    else order_by_param
                )
            ).order_by("-min_values" if order_by_param.startswith("-") else "min_values")
            order_by_param = (
                "-min_values" if order_by_param.startswith("-") else "min_values"
            )
        else:
            issue_queryset = issue_queryset.order_by(order_by_param)
            order_by_param = order_by_param
    except Exception as e:
        logger.error(f"Error in order_issue_queryset: {str(e)}")
        # 오류 발생 시 기본 정렬로 폴백
        issue_queryset = issue_queryset.order_by("-created_at")
        order_by_param = "-created_at"
        
    return issue_queryset, order_by_param
