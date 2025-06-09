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
        group_field, group_condition = annotations_map.get(group_by, (group_by, Q()))
        if group_by == "parent_child":
            # parent_child 그룹화를 위한 특별 처리는 이미 위에서 처리됨
            pass
        else:
            queryset = queryset.annotate(**{group_by: group_field})

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue], group_by: Optional[str], sub_group_by: Optional[str]
) -> List[Dict[str, Any]]:
    from plane.space.serializer import IssuePublicSerializer
    
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

    # IssuePublicSerializer를 사용하여 커스텀 필드 값들을 포함한 데이터 반환
    serializer = IssuePublicSerializer(issues, many=True)
    serialized_data = serializer.data
    
    # parent_child 또는 top_level_only 그룹화인 경우 특별 처리
    if group_by == "parent_child" or sub_group_by == "parent_child" or group_by == "top_level_only" or sub_group_by == "top_level_only":
        # 모든 이슈의 parent_id를 가져와서 최상단 부모를 찾기
        issue_values = list(issues.values("id", "parent_id"))
        
        # 최상단 부모를 찾는 헬퍼 함수
        def find_root_parent(issue_id, all_issues_dict):
            """재귀적으로 최상단 부모를 찾는 함수"""
            current_id = str(issue_id)
            visited = set()  # 무한 루프 방지
            
            # print(f"[DEBUG] find_root_parent 시작 - issue_id: {issue_id}")
            
            while current_id and current_id not in visited:
                visited.add(current_id)
                
                if current_id not in all_issues_dict:
                    # print(f"[DEBUG] {current_id}가 all_issues_dict에 없음")
                    break
                    
                parent_id = all_issues_dict[current_id]["parent_id"]
                # print(f"[DEBUG] {current_id}의 parent_id: {parent_id}")
                
                if parent_id is None:
                    # 현재 이슈가 최상단 부모
                    # print(f"[DEBUG] 최상단 부모 찾음: {current_id}")
                    return current_id
                
                # 부모로 이동
                current_id = str(parent_id)
                # print(f"[DEBUG] 부모로 이동: {current_id}")
            
            # 최상단 부모를 찾지 못한 경우
            # print(f"[DEBUG] 최상단 부모를 찾지 못함 - visited: {visited}")
            return None
        
        # 빠른 lookup을 위한 딕셔너리 생성
        all_issues_dict = {str(issue["id"]): issue for issue in issue_values}
        
        for i, result in enumerate(serialized_data):
            if i < len(issue_values):
                issue_value = issue_values[i]
                issue_id = str(issue_value["id"])
                parent_id = issue_value.get("parent_id")
                
                # parent_child 그룹화 처리
                if group_by == "parent_child" or sub_group_by == "parent_child":
                    # 최상단 부모 찾기
                    if parent_id is None:
                        # 부모가 없으면 최상단 이슈
                        parent_child_value = "None"
                    else:
                        # 부모가 있으면 최상단 부모 찾기
                        root_parent = find_root_parent(issue_id, all_issues_dict)
                        parent_child_value = root_parent if root_parent is not None else str(parent_id)
                    
                    # parent_child 그룹 값을 설정 (리스트가 아닌 단순 값으로)
                    if group_by == "parent_child":
                        result["parent_child"] = parent_child_value
                    if sub_group_by == "parent_child":
                        result["sub_parent_child"] = parent_child_value
                
                # top_level_only 그룹화 처리
                if group_by == "top_level_only" or sub_group_by == "top_level_only":
                    # 최상위 작업항목만 표시 (parent_id가 null인 것만)
                    top_level_value = "top_level_only" if parent_id is None else None
                    
                    if group_by == "top_level_only":
                        result["top_level_only"] = top_level_value
                    if sub_group_by == "top_level_only":
                        result["sub_top_level_only"] = top_level_value
    
    return serialized_data

    # return issues


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
        
        # 모든 이슈를 가져와서 실제로 그룹화될 최상위 부모들을 찾기
        all_issues = IssueModel.issue_objects.filter(workspace__slug=slug)
        if project_id:
            all_issues = all_issues.filter(project_id=project_id)
        
        # 이슈들의 id와 parent_id 정보 가져오기
        issues_data = list(all_issues.values('id', 'parent_id'))
        
        # 빠른 lookup을 위한 딕셔너리 생성
        all_issues_dict = {str(issue["id"]): issue for issue in issues_data}
        
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
        
        # 실제로 하위 이슈들이 그룹화될 최상위 부모들 찾기
        root_parents = set()
        for issue in issues_data:
            if issue["parent_id"] is not None:  # 부모가 있는 이슈들만
                root_parent = find_root_parent(issue["id"], all_issues_dict)
                if root_parent:
                    root_parents.add(root_parent)
        
        # 최상위 부모들을 그룹으로 반환
        result = list(root_parents)
        
        # "None" 그룹 추가 (부모가 없는 이슈들)
        result.append("None")
        
        return result

    if field == "top_level_only":
        # 최상위 작업항목만 그룹화
        return ["top_level_only"]

    return []
