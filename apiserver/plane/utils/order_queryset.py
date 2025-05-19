from django.db.models import Case, CharField, Min, Value, When, F, Window, Q, ExpressionWrapper, BooleanField
from django.db.models.functions import RowNumber, Coalesce, Cast, Extract
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
            # Window 함수를 사용하여 계층 구조를 만들고 정렬
            issue_queryset = issue_queryset.annotate(
                # 날짜 우선순위 계산
                date_priority=Case(
                    # 날짜 없음 - 최상위
                    When(start_date__isnull=True, target_date__isnull=True, then=Value(0)),
                    # end date만 있음
                    When(start_date__isnull=True, target_date__isnull=False, then=Value(1)),
                    # start date 있음
                    default=Value(2),
                    output_field=CharField(),
                ),
                # 계층 구조를 위한 path 생성
                path=Window(
                    expression=RowNumber(),
                    partition_by=F('parent_id'),
                    order_by=[
                        F('date_priority').asc(),
                        F('target_date').asc(nulls_last=True),
                        F('start_date').asc(nulls_last=True),
                        F('sort_order').asc(nulls_last=True),
                        F('created_at').asc()
                    ]
                ),
                # 최상위 부모 구분
                is_root=Case(
                    When(parent_id__isnull=True, then=Value(0)),
                    default=Value(1),
                    output_field=CharField(),
                )
            ).order_by(
                'is_root',  # 최상위 부모 먼저
                Coalesce('parent_id', 'id'),  # 부모 ID로 그룹화
                'date_priority',  # 날짜 우선순위
                'target_date',  # target_date 정렬
                'start_date',  # start_date 정렬
                'path',  # 각 그룹 내에서 정렬된 순서
                'sort_order',
                'created_at'
            )
            order_by_param = 'id'
            
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
