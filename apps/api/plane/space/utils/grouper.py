# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Q, UUIDField, Value, F, Case, When, JSONField, CharField, Count, Subquery, OuterRef, Func, Max, IntegerField, FloatField, DateTimeField, Exists, BooleanField
from django.db.models.functions import Coalesce, JSONObject, Concat, Cast
from django.db.models import QuerySet

from typing import List, Optional, Dict, Any, Union, Tuple

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


def issue_queryset_grouper(
    queryset: QuerySet[Issue], group_by: Optional[str], sub_group_by: Optional[str]
) -> QuerySet[Issue]:
    FIELD_MAPPER: Dict[str, str] = {
        "state_id": "state",
        "state__group": "state_detail.group",
        "priority": "priority",
        "labels__id": "labels",
        "assignees__id": "assignees",
        "issue_module__module_id": "module",
        "cycle_id": "cycle",
        "target_date": "target_date",
        "project_id": "project",
        "created_by": "created_by",
        "parent_child": "parent_child",
        "type_id": "type",
    }

    GROUP_FILTER_MAPPER: Dict[str, Q] = {
        "assignees__id": Q(issue_assignee__deleted_at__isnull=True),
        "labels__id": Q(label_issue__deleted_at__isnull=True),
        "issue_module__module_id": Q(issue_module__deleted_at__isnull=True),
    }

    # top_level_only 그룹화인 경우 부모가 없는 이슈들만 필터링
    if group_by == "top_level_only" or sub_group_by == "top_level_only":
        queryset = queryset.filter(parent_id__isnull=True)

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
        if FIELD_MAPPER.get(key) != group_by and FIELD_MAPPER.get(key) != sub_group_by
    }

    # group_by와 sub_group_by 필드를 쿼리셋에 직접 추가
    if group_by == "issue_module__module_id":
        default_annotations["issue_module__module_id"] = F("issue_module__module_id")
    elif group_by == "assignees__id":
        default_annotations["assignees__id"] = F("assignees__id")
    elif group_by == "labels__id":
        default_annotations["labels__id"] = F("labels__id")
    elif group_by == "state_id":
        # state_id는 이미 모델에 있는 필드이므로 annotate 하지 않음
        pass
    elif group_by == "parent_child":
        # parent_child 그룹화를 위한 처리 - 최상단 부모 찾기
        # 단계적으로 처리하여 안정성 확보
        default_annotations["parent_child_group"] = Case(
            When(parent_id__isnull=True, then=Value("None")),
            default=Cast(F("parent_id"), CharField()),
            output_field=CharField(),
        )
    elif group_by == "top_level_only":
        # top_level_only 그룹화를 위한 처리 - 최상위 작업항목만
        default_annotations["top_level_only_group"] = Case(
            When(parent_id__isnull=True, then=Value("top_level_only")),
            default=Value(None),
            output_field=CharField(),
        )
    
    # sub_group_by 필드가 issue_module__module_id인 경우 해당 필드를 어노테이션으로 추가
    if sub_group_by == "issue_module__module_id":
        default_annotations["issue_module__module_id"] = F("issue_module__module_id")
    elif sub_group_by == "assignees__id":
        default_annotations["assignees__id"] = F("assignees__id")
    elif sub_group_by == "labels__id":
        default_annotations["labels__id"] = F("labels__id")
    elif sub_group_by == "state_id":
        # state_id는 이미 모델에 있는 필드이므로 annotate 하지 않음
        pass
    elif sub_group_by == "parent_child":
        # parent_child 그룹화를 위한 처리 - 최상단 부모 찾기
        # 단계적으로 처리하여 안정성 확보
        default_annotations["parent_child_group"] = Case(
            When(parent_id__isnull=True, then=Value("None")),
            default=Cast(F("parent_id"), CharField()),
            output_field=CharField(),
        )
    elif sub_group_by == "top_level_only":
        # top_level_only 그룹화를 위한 처리 - 최상위 작업항목만
        default_annotations["top_level_only_group"] = Case(
            When(parent_id__isnull=True, then=Value("top_level_only")),
            default=Value(None),
            output_field=CharField(),
        )

    # 그룹화 필드에 따른 어노테이션 추가
    if group_by:
        if group_by == "parent_child":
            # parent_child 그룹화를 위한 특별 처리는 이미 위에서 처리됨
            pass
        elif group_by == "state_id":
            # state_id는 이미 모델에 있는 필드이므로 annotate 하지 않음
            pass
        elif group_by in annotations_map:
            # annotations_map에 정의된 필드들 처리
            group_field, group_condition = annotations_map[group_by]
            queryset = queryset.annotate(**{group_by: group_field})
        else:
            # 기타 필드들은 F 표현식으로 처리
            queryset = queryset.annotate(**{group_by: F(group_by)})

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue], group_by: Optional[str], sub_group_by: Optional[str]
) -> List[Dict[str, Any]]:
    # 리스트인 경우 처리
    if isinstance(issues, list):
        # Issue 객체 리스트인 경우 딕셔너리로 변환
        if issues and hasattr(issues[0], 'id'):
            # Issue 객체를 딕셔너리로 변환 (state_id 포함)
            result = []
            for issue in issues:
                issue_dict = {
                    'id': str(issue.id),
                    'state_id': str(issue.state_id) if issue.state_id else None,
                    'name': issue.name,
                    'sequence_id': issue.sequence_id,
                    'sort_order': issue.sort_order,
                    'priority': issue.priority,
                    'start_date': issue.start_date,
                    'target_date': issue.target_date,
                    'project_id': str(issue.project_id),
                    'parent_id': str(issue.parent_id) if issue.parent_id else None,
                    'cycle_id': str(issue.cycle_id) if issue.cycle_id else None,
                    'created_by': str(issue.created_by),
                    'estimate_point': issue.estimate_point,
                    'assignee_ids': getattr(issue, 'assignee_ids', []),
                    'label_ids': getattr(issue, 'label_ids', []),
                    'module_ids': getattr(issue, 'module_ids', []),
                    'vote_items': getattr(issue, 'vote_items', []),
                    'reaction_items': getattr(issue, 'reaction_items', []),
                }
                # state__group 추가
                if hasattr(issue, 'state') and issue.state:
                    issue_dict['state__group'] = issue.state.group
                elif hasattr(issue, 'state__group'):
                    issue_dict['state__group'] = issue.state__group
                else:
                    issue_dict['state__group'] = None
                    
                result.append(issue_dict)
            return result
        # 이미 딕셔너리 리스트인 경우 그대로 반환
        return issues
    
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    original_list = ["assignee_ids", "label_ids", "module_ids"]

    required_fields = [
        "id",
        "name",
        "state_id",
        "sort_order",
        "estimate_point",
        "priority",
        "start_date",
        "target_date",
        "sequence_id",
        "project_id",
        "parent_id",
        "cycle_id",
        "created_by",
        "state__group",
    ]

    if group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[group_by])
        original_list.append(group_by)

    if sub_group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[sub_group_by])
        original_list.append(sub_group_by)

    required_fields.extend(original_list)

    issues = issues.annotate(
        vote_items=ArrayAgg(
            Case(
                When(
                    votes__isnull=False,
                    votes__deleted_at__isnull=True,
                    then=JSONObject(
                        vote=F("votes__vote"),
                        actor_details=JSONObject(
                            id=F("votes__actor__id"),
                            first_name=F("votes__actor__first_name"),
                            last_name=F("votes__actor__last_name"),
                            avatar=F("votes__actor__avatar"),
                            avatar_url=Case(
                                When(
                                    votes__actor__avatar_asset__isnull=False,
                                    then=Concat(
                                        Value("/api/assets/v2/static/"),
                                        F("votes__actor__avatar_asset"),
                                        Value("/"),
                                    ),
                                ),
                                default=F("votes__actor__avatar"),
                                output_field=CharField(),
                            ),
                            display_name=F("votes__actor__display_name"),
                        ),
                    ),
                ),
                default=None,
                output_field=JSONField(),
            ),
            filter=Q(votes__isnull=False, votes__deleted_at__isnull=True),
            distinct=True,
        ),
        reaction_items=ArrayAgg(
            Case(
                When(
                    issue_reactions__isnull=False,
                    issue_reactions__deleted_at__isnull=True,
                    then=JSONObject(
                        reaction=F("issue_reactions__reaction"),
                        actor_details=JSONObject(
                            id=F("issue_reactions__actor__id"),
                            first_name=F("issue_reactions__actor__first_name"),
                            last_name=F("issue_reactions__actor__last_name"),
                            avatar=F("issue_reactions__actor__avatar"),
                            avatar_url=Case(
                                When(
                                    issue_reactions__actor__avatar_asset__isnull=False,
                                    then=Concat(
                                        Value("/api/assets/v2/static/"),
                                        F("issue_reactions__actor__avatar_asset"),
                                        Value("/"),
                                    ),
                                ),
                                default=F("issue_reactions__actor__avatar"),
                                output_field=CharField(),
                            ),
                            display_name=F("issue_reactions__actor__display_name"),
                        ),
                    ),
                ),
                default=None,
                output_field=JSONField(),
            ),
            filter=Q(
                issue_reactions__isnull=False, issue_reactions__deleted_at__isnull=True
            ),
            distinct=True,
        ),
    ).values(*required_fields, "vote_items", "reaction_items")

    return issues


def issue_group_values(
    field: str,
    slug: str,
    project_id: Optional[str] = None,
    filters: Dict[str, Any] = {},
) -> List[Union[str, Any]]:
    # Issue 모델을 함수 시작 부분에서 임포트
    from plane.db.models import Issue as IssueModel
    
    if field == "state_id":
        queryset = State.objects.filter(
            is_triage=False, workspace__slug=slug
        ).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)
    if field == "labels__id":
        queryset = Label.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        else:
            return list(queryset) + ["None"]
    if field == "assignees__id":
        if project_id:
            return ProjectMember.objects.filter(
                workspace__slug=slug, project_id=project_id, is_active=True
            ).values_list("member_id", flat=True)
        else:
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
        else:
            return list(queryset) + ["None"]
    if field == "cycle_id":
        queryset = Cycle.objects.filter(workspace__slug=slug).values_list(
            "id", flat=True
        )
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        else:
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
            IssueModel.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("target_date", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)
    if field == "start_date":
        queryset = (
            IssueModel.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("start_date", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "created_by":
        queryset = (
            IssueModel.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("created_by", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "parent_child":
        # 부모-자식 관계 그룹화를 위한 그룹 값들
        
        # 필터링된 이슈들을 가져와서 실제로 그룹화될 부모들을 찾기
        filtered_issues = IssueModel.issue_objects.filter(workspace__slug=slug)
        if project_id:
            filtered_issues = filtered_issues.filter(project_id=project_id)
        
        # 필터 적용
        if filters:
            filtered_issues = filtered_issues.filter(**filters)
        
        # 필터링된 이슈들의 id와 parent_id 정보 가져오기
        filtered_issues_data = list(filtered_issues.values('id', 'parent_id'))
        
        # 모든 이슈들의 parent 관계를 파악하기 위해 전체 이슈 데이터도 필요
        all_issues = IssueModel.issue_objects.filter(workspace__slug=slug)
        if project_id:
            all_issues = all_issues.filter(project_id=project_id)
        all_issues_data = list(all_issues.values('id', 'parent_id'))
        
        # 빠른 lookup을 위한 딕셔너리 생성
        all_issues_dict = {str(issue["id"]): issue for issue in all_issues_data}
        
        # 최상단 부모를 찾는 헬퍼 함수 (issue_on_results와 동일)
        def find_root_parent(issue_id, all_issues_dict):
            current_id = str(issue_id)
            visited = set()
            
            while current_id and current_id not in visited:
                visited.add(current_id)
                
                if current_id not in all_issues_dict:
                    break
                    
                parent_id = all_issues_dict[current_id]["parent_id"]
                
                if parent_id is None:
                    return current_id
                
                current_id = str(parent_id)
            
            return None
        
        # 필터링된 이슈들에서 실제로 그룹화될 최상위 부모들 찾기
        # 이는 issue_on_results에서 사용되는 로직과 동일해야 함
        group_parent_ids = set()
        for issue in filtered_issues_data:
            if issue["parent_id"] is not None:  # 부모가 있는 이슈들만
                root_parent = find_root_parent(issue["id"], all_issues_dict)
                if root_parent:
                    group_parent_ids.add(root_parent)
            # 부모가 없는 이슈들은 "None" 그룹에 속함
        
        # 최상위 부모들의 상세 정보를 가져와서 그룹으로 반환
        result = []
        
        if group_parent_ids:
            # parent 이슈들의 상세 정보를 한 번에 가져오기 (전체 workspace에서)
            parent_issues = IssueModel.issue_objects.filter(
                id__in=group_parent_ids,
                workspace__slug=slug
            ).select_related('project').values(
                'id', 'name', 'project__identifier', 'sequence_id'
            )
            
            # 각 부모 이슈에 대해 딕셔너리 형태로 추가
            for parent in parent_issues:
                result.append({
                    'id': str(parent['id']),
                    'name': parent['name'],
                    'project_identifier': parent['project__identifier'],
                    'sequence_id': parent['sequence_id'],
                    'display_name': f"{parent['project__identifier']}-{parent['sequence_id']} {parent['name']}"
                })
        
        # "None" 그룹 추가 (부모가 없는 이슈들)
        result.append({
            'id': 'None',
            'name': '최상단 작업항목',
            'project_identifier': '',
            'sequence_id': 0,
            'display_name': '최상단 작업항목'
        })
        
        return result

    if field == "top_level_only":
        # 최상위 작업항목만 그룹화
        return ["top_level_only"]

    if field == "type_id":
        from plane.db.models import IssueType
        
        queryset = IssueType.objects.filter(
            workspace__slug=slug,
            is_active=True
        )
        
        if project_id:
            # 프로젝트별 이슈 타입 필터링이 필요하다면 여기에 추가
            pass
            
        result = list(queryset.values_list("id", flat=True).order_by("name"))
        # None 그룹 추가 (타입이 설정되지 않은 이슈들을 위해)
        result.append("None")
        return result

    return []
