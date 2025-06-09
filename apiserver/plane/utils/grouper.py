# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Q, UUIDField, Value, QuerySet, F, Case, When, CharField, Count, Subquery, OuterRef, Func, Max, IntegerField, FloatField, DateTimeField, Exists, BooleanField
from django.db.models.functions import Coalesce, Cast

# Module imports
from plane.db.models import (
    Cycle,
    Issue,
    IssueAssignee,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
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

    # Subquery를 사용하여 필터링에 영향받지 않는 독립적인 어노테이션 정의
    
    default_annotations: Dict[str, Any] = {
        "assignee_ids": Coalesce(
            Subquery(
                IssueAssignee.objects.filter(
                    issue=OuterRef("id"),
                    deleted_at__isnull=True,
                    assignee__member_project__is_active=True
                ).values("issue").annotate(
                    ids=ArrayAgg("assignee_id", distinct=True)
                ).values("ids")[:1]
            ),
            Value([], output_field=ArrayField(UUIDField())),
        ),
        "label_ids": Coalesce(
            Subquery(
                IssueLabel.objects.filter(
                    issue=OuterRef("id"),
                    deleted_at__isnull=True
                ).values("issue").annotate(
                    ids=ArrayAgg("label_id", distinct=True)
                ).values("ids")[:1]
            ),
            Value([], output_field=ArrayField(UUIDField())),
        ),
        "module_ids": Coalesce(
            Subquery(
                ModuleIssue.objects.filter(
                    issue=OuterRef("id"),
                    deleted_at__isnull=True,
                    module__archived_at__isnull=True
                ).values("issue").annotate(
                    ids=ArrayAgg("module_id", distinct=True)
                ).values("ids")[:1]
            ),
            Value([], output_field=ArrayField(UUIDField())),
        ),
    }

    # parent_child 그룹화인 경우 특별 처리
    if group_by == "parent_child" or sub_group_by == "parent_child" or group_by == "top_level_only" or sub_group_by == "top_level_only":
        # 이 경우에는 Django 어노테이션 대신 Python 레벨에서 처리
        # 일단 기본 어노테이션만 추가하고, 실제 그룹화는 issue_on_results에서 처리
        pass
    else:
        # group_by와 sub_group_by 필드를 쿼리셋에 직접 추가
        # many-to-many 필드들은 이미 Django ORM에서 자동으로 처리됨
        # 단, 해당 필드가 결과에 포함되도록 명시적으로 annotate
        if group_by == "issue_module__module_id":
            default_annotations["issue_module__module_id"] = F("issue_module__module_id")
        elif group_by == "assignees__id":
            default_annotations["assignees__id"] = F("assignees__id")
        elif group_by == "labels__id":
            default_annotations["labels__id"] = F("labels__id")
        
        # sub_group_by 필드가 issue_module__module_id인 경우 해당 필드를 어노테이션으로 추가
        if sub_group_by == "issue_module__module_id":
            default_annotations["issue_module__module_id"] = F("issue_module__module_id")
        elif sub_group_by == "assignees__id":
            default_annotations["assignees__id"] = F("assignees__id")
        elif sub_group_by == "labels__id":
            default_annotations["labels__id"] = F("labels__id")

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> List[Dict[str, Any]]:
    from plane.app.serializers import IssueSerializer
    
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    # IssueSerializer를 사용하여 커스텀 필드 값들을 포함한 데이터 반환
    serializer = IssueSerializer(issues, many=True)
    serialized_data = serializer.data
    
    # parent_child 그룹화인 경우 특별 처리
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
    
    # many-to-many 필드로 그룹화하는 경우, 해당 필드를 결과에 추가
    # 이는 paginator에서 group_by_field_name을 찾을 수 있도록 하기 위함
    elif group_by in FIELD_MAPPER or sub_group_by in FIELD_MAPPER:
        # 필요한 필드들을 포함하여 values() 호출
        fields_to_include = ["id"]
        if group_by in FIELD_MAPPER:
            fields_to_include.append(group_by)
        if sub_group_by in FIELD_MAPPER:
            fields_to_include.append(sub_group_by)
            
        # values()를 사용하여 필요한 필드들 가져오기
        issue_values = list(issues.values(*fields_to_include))
        
        # 결과 딕셔너리에 필드 추가
        for i, result in enumerate(serialized_data):
            if i < len(issue_values):
                issue_value = issue_values[i]
                if group_by in FIELD_MAPPER and group_by in issue_value:
                    result[group_by] = issue_value[group_by]
                if sub_group_by in FIELD_MAPPER and sub_group_by in issue_value:
                    result[sub_group_by] = issue_value[sub_group_by]
    
    return serialized_data


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
            IssueModel.issue_objects.filter(workspace__slug=slug)
            .filter(**filters)
            .values_list("target_date", flat=True)
            .distinct()
        )
        if project_id:
            return list(queryset.filter(project_id=project_id))
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
