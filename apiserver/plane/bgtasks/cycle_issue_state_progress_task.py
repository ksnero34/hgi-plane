# Django imports
from django.db.models import Sum
from django.utils import timezone
from django.db.models import F
from django.db.models.functions import RowNumber
from django.db.models import Max, Subquery, OuterRef

# Third party imports
from celery import shared_task
from plane.db.models import Cycle, CycleIssueStateProgress, CycleAnalytics


@shared_task
def track_cycle_issue_state_progress():

    active_cycles = Cycle.objects.filter(
        start_date__lte=timezone.now(), end_date__gte=timezone.now()
    ).values_list("id", "project_id", "workspace_id")

    analytics_records = []
    current_date = timezone.now().date()

    for cycle_id, project_id, workspace_id in active_cycles:
        # Subquery to get the latest id for each issue_id
        # Subquery to get the latest created_at for each issue_id
        # latest_created_at = CycleIssueStateProgress.objects.filter(
        #     cycle_id=cycle_id,
        #     type__in=["ADDED", "UPDATED"],
        #     issue_id=OuterRef("issue_id"),
        #     created_at__lte=timezone.now(),
        # ).values('issue_id').annotate(
        #     latest_created=Max('created_at')
        # ).values('latest_created')

        # # Main query to get the latest unique issues
        # cycle_issues = CycleIssueStateProgress.objects.filter(
        #     cycle_id=cycle_id,
        #     type__in=["ADDED", "UPDATED"],
        #     created_at=Subquery(latest_created_at),
        #     issue_id=OuterRef("issue_id")
        # ).order_by("issue_id")

        cycle_issues = CycleIssueStateProgress.objects.filter(
            id=Subquery(
                CycleIssueStateProgress.objects.filter(
                    cycle_id=cycle_id,
                    type__in=["ADDED", "UPDATED"],
                    issue=OuterRef("issue"),
                )
                .order_by("-created_at")
                .values("id")[:1]
            )
        )
        # print()
        for issue in cycle_issues.values():
            print(issue, "issues")

        total_issues = cycle_issues.count()
        total_estimate_points = (
            cycle_issues.aggregate(
                total_estimate_points=Sum("estimate_value")
            )["total_estimate_points"]
            or 0
        )

        state_groups = [
            "backlog",
            "unstarted",
            "started",
            "completed",
            "cancelled",
        ]
        state_data = {
            group: {
                "count": cycle_issues.filter(state_group=group).count(),
                "estimate_points": cycle_issues.filter(
                    state_group=group
                ).aggregate(total_estimate_points=Sum("estimate_value"))[
                    "total_estimate_points"
                ]
                or 0,
            }
            for group in state_groups
        }

        # Prepare analytics record for bulk insert
        analytics_records.append(
            CycleAnalytics(
                cycle_id=cycle_id,
                date=current_date,
                total_issues=total_issues,
                total_estimate_points=total_estimate_points,
                backlog_issues=state_data["backlog"]["count"],
                unstarted_issues=state_data["unstarted"]["count"],
                started_issues=state_data["started"]["count"],
                completed_issues=state_data["completed"]["count"],
                cancelled_issues=state_data["cancelled"]["count"],
                backlog_estimate_points=state_data["backlog"][
                    "estimate_points"
                ],
                unstarted_estimate_points=state_data["unstarted"][
                    "estimate_points"
                ],
                started_estimate_points=state_data["started"][
                    "estimate_points"
                ],
                completed_estimate_points=state_data["completed"][
                    "estimate_points"
                ],
                cancelled_estimate_points=state_data["cancelled"][
                    "estimate_points"
                ],
                project_id=project_id,
                workspace_id=workspace_id,
            )
        )

    # Bulk create the records at once
    if analytics_records:
        CycleAnalytics.objects.bulk_create(analytics_records)