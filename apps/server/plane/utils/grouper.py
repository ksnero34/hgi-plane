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
    group_by_fields: Optional[List] = None,
    per_group_limit: int = 10,
) -> List[Dict[str, Any]]:
    from plane.app.serializers import IssueSerializer
    
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    # issues의 타입에 따라 처리 방식 결정
    if hasattr(issues, 'model') and hasattr(issues, 'query'):
        # QuerySet인 경우
        serializer = IssueSerializer(issues, many=True)
        serialized_data = serializer.data
        is_queryset = True
    elif isinstance(issues, list) and len(issues) > 0:
        if isinstance(issues[0], dict):
            # 이미 직렬화된 딕셔너리들의 리스트인 경우
            serialized_data = issues
            is_queryset = False
        else:
            # Django 모델 인스턴스들의 리스트인 경우
            serializer = IssueSerializer(issues, many=True)
            serialized_data = serializer.data
            is_queryset = False
    else:
        # 빈 리스트이거나 다른 경우
        serialized_data = []
        is_queryset = False
    
    # parent_child 그룹화인 경우 특별 처리
    if group_by == "parent_child" or sub_group_by == "parent_child" or group_by == "top_level_only" or sub_group_by == "top_level_only":
        # issues의 타입에 따라 id와 parent_id 추출 방식 결정
        if is_queryset:
            # QuerySet에서 values() 사용
            issue_values = list(issues.values("id", "parent_id"))
            # 모든 이슈들의 parent 관계를 파악하기 위해 workspace 전체 이슈 데이터 필요
            from plane.db.models import Issue as IssueModel
            all_issues = IssueModel.issue_objects.filter(workspace=issues.first().workspace if issues.exists() else None)
            all_issues_data = list(all_issues.values('id', 'parent_id')) if all_issues.exists() else []
        elif isinstance(issues, list) and len(issues) > 0:
            if isinstance(issues[0], dict):
                # 이미 직렬화된 데이터에서 id와 parent_id 추출
                issue_values = [{"id": item.get("id"), "parent_id": item.get("parent_id")} for item in issues]
                # 직렬화된 데이터의 경우 모든 이슈 정보를 알 수 없으므로 현재 이슈들만 사용
                all_issues_data = issue_values.copy()
            else:
                # Django 모델 인스턴스에서 속성 접근
                issue_values = [{"id": item.id, "parent_id": item.parent_id} for item in issues]
                # 모든 이슈들의 parent 관계를 파악하기 위해 workspace 전체 이슈 데이터 필요
                from plane.db.models import Issue as IssueModel
                workspace = issues[0].workspace if issues else None
                if workspace:
                    all_issues = IssueModel.issue_objects.filter(workspace=workspace)
                    all_issues_data = list(all_issues.values('id', 'parent_id'))
                else:
                    all_issues_data = issue_values.copy()
        else:
            issue_values = []
            all_issues_data = []
        
        # 빠른 lookup을 위한 딕셔너리 생성
        all_issues_dict = {str(issue["id"]): issue for issue in all_issues_data}
        
        # 최상단 부모를 찾는 헬퍼 함수
        def find_root_parent(issue_id, all_issues_dict):
            """재귀적으로 최상단 부모를 찾는 함수"""
            current_id = str(issue_id)
            visited = set()  # 무한 루프 방지
            
            while current_id and current_id not in visited:
                visited.add(current_id)
                
                if current_id not in all_issues_dict:
                    break
                    
                parent_id = all_issues_dict[current_id]["parent_id"]
                
                if parent_id is None:
                    return current_id
                
                current_id = str(parent_id)
            
            return None
        
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
                        parent_child_value = str(root_parent) if root_parent is not None else str(parent_id)
                    
                    # parent_child 그룹 값을 설정 (문자열로 안전하게)
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
            
        # issues의 타입에 따라 필요한 필드들 추출 방식 결정
        if is_queryset:
            # QuerySet에서 values() 사용
            issue_values = list(issues.values(*fields_to_include))
        elif isinstance(issues, list) and len(issues) > 0:
            if isinstance(issues[0], dict):
                # 이미 직렬화된 데이터에서 필요한 필드들 추출
                issue_values = []
                for item in issues:
                    item_dict = {"id": item.get("id")}
                    for field in fields_to_include[1:]:  # "id"는 이미 추가했으므로 제외
                        item_dict[field] = item.get(field)
                    issue_values.append(item_dict)
            else:
                # Django 모델 인스턴스에서 속성 접근
                issue_values = []
                for item in issues:
                    item_dict = {"id": item.id}
                    for field in fields_to_include[1:]:  # "id"는 이미 추가했으므로 제외
                        item_dict[field] = getattr(item, field, None)
                    issue_values.append(item_dict)
        else:
            issue_values = []
        
        # 결과 딕셔너리에 필드 추가
        for i, result in enumerate(serialized_data):
            if i < len(issue_values):
                issue_value = issue_values[i]
                if group_by in FIELD_MAPPER and group_by in issue_value:
                    result[group_by] = issue_value[group_by]
                if sub_group_by in FIELD_MAPPER and sub_group_by in issue_value:
                    result[sub_group_by] = issue_value[sub_group_by]
    
    return serialized_data


def _handle_parent_child_grouping(
    issues: QuerySet[Issue], 
    group_by_fields: Optional[List], 
    per_group_limit: int = 10
) -> Dict[str, Any]:
    """
    parent_child 그룹화를 위한 특별한 처리 함수
    그룹별로 제한된 수의 이슈만 반환하여 pagination 효과 구현
    """
    from plane.app.serializers import IssueSerializer
    from plane.db.models import Issue as IssueModel
    
    # 모든 그룹 정보 가져오기
    if not group_by_fields:
        group_by_fields = []
    
    # 그룹별 결과를 저장할 딕셔너리
    grouped_results = {}
    
    # 필터링된 이슈들의 ID 집합 (실제 결과에 포함될 이슈들)
    filtered_issue_ids = set(str(issue_id) for issue_id in issues.values_list('id', flat=True))
    
    # workspace와 project 정보를 추출하여 전체 이슈 쿼리 생성
    sample_issue = issues.first()
    if not sample_issue:
        # 이슈가 없으면 빈 결과 반환
        for group in group_by_fields:
            group_id = str(group.get("id", "None")) if isinstance(group, dict) else str(group)
            grouped_results[group_id] = {
                "results": [],
                "total_results": 0,
                "has_more": False
            }
        return grouped_results
    
    # 전체 이슈들을 workspace와 project만으로 필터링해서 가져오기
    base_queryset = IssueModel.issue_objects.filter(
        workspace_id=sample_issue.workspace_id,
        project_id=sample_issue.project_id
    )
    
    # print(f"[_handle_parent_child_grouping] filtered_issue_ids count: {len(filtered_issue_ids)}")
    # print(f"[_handle_parent_child_grouping] Sample filtered IDs: {list(filtered_issue_ids)[:5]}")
    
    # 각 그룹에 대해 처리
    for group in group_by_fields:
        group_id = str(group.get("id", "None")) if isinstance(group, dict) else str(group)
        
        if group_id == "None":
            # None 그룹 처리: 최상위 이슈들 중 필터링된 것들
            # 전체 이슈들에서 그룹 구성을 위한 정보 가져오기
            all_issues_values = list(base_queryset.values('id', 'parent_id'))
            all_issues_dict = {str(issue["id"]): issue for issue in all_issues_values}
            
            # 최상위 이슈들 중 필터링된 것들 찾기
            group_issue_ids = []
            for issue_id in filtered_issue_ids:
                if issue_id not in all_issues_dict:
                    continue
                    
                issue_data = all_issues_dict[issue_id]
                parent_id = issue_data.get("parent_id")
                
                if parent_id is None:
                    # 최상위 이슈
                    group_issue_ids.append(issue_id)
            
            # print(f"[_handle_parent_child_grouping] Group None: found {len(group_issue_ids)} top-level issues")
            
        else:
            # 특정 부모 그룹 처리
            # 전체 이슈들에서 그룹 구성을 위한 정보 가져오기
            all_issues_values = list(base_queryset.values('id', 'parent_id'))
            all_issues_dict = {str(issue["id"]): issue for issue in all_issues_values}
            
            # 최상단 부모를 찾는 헬퍼 함수
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
            
            # 이 그룹에 속하면서 필터링 조건도 만족하는 이슈 ID들 찾기
            group_issue_ids = []
            for issue_id in filtered_issue_ids:
                if issue_id not in all_issues_dict:
                    continue
                    
                issue_data = all_issues_dict[issue_id]
                parent_id = issue_data.get("parent_id")
                
                if parent_id is None:
                    # 최상단 이슈인 경우, 자기 자신이 그룹 ID와 같은지 확인
                    if issue_id == group_id:
                        group_issue_ids.append(issue_id)
                        # print(f"[_handle_parent_child_grouping] Group {group_id}: found top-level issue {issue_id}")
                else:
                    # 하위 이슈인 경우, 최상단 부모가 그룹 ID와 같은지 확인
                    root_parent = find_root_parent(issue_id, all_issues_dict)
                    if root_parent == group_id:
                        group_issue_ids.append(issue_id)
                        # print(f"[_handle_parent_child_grouping] Group {group_id}: found child issue {issue_id} with root parent {root_parent}")
            
            # print(f"[_handle_parent_child_grouping] Group {group_id}: found {len(group_issue_ids)} issues total")
            
            # 찾은 이슈 ID들로 queryset 필터링
            if group_issue_ids:
                group_issues = issues.filter(id__in=group_issue_ids)
            else:
                # 빈 쿼리셋 생성
                group_issues = issues.none()
        
        # 그룹당 제한된 수의 이슈만 가져오기
        limited_issues = list(group_issues[:per_group_limit + 1])  # +1 for checking if more exist
        
        # 더 많은 이슈가 있는지 확인
        has_more = len(limited_issues) > per_group_limit
        if has_more:
            limited_issues = limited_issues[:per_group_limit]
        
        # 이슈들을 직렬화
        serializer = IssueSerializer(limited_issues, many=True)
        serialized_issues = serializer.data
        
        # parent_child 값을 각 이슈에 추가 (문자열로 안전하게)
        for issue_data in serialized_issues:
            issue_data["parent_child"] = str(group_id)
        
        # 그룹 결과 저장
        grouped_results[group_id] = {
            "results": serialized_issues,
            "total_results": group_issues.count(),
            "has_more": has_more
        }
    
    return grouped_results


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
        
        # 모든 이슈들을 가져와서 그룹화될 부모들을 찾기 (필터링 없이)
        all_issues = IssueModel.issue_objects.filter(workspace__slug=slug)
        if project_id:
            all_issues = all_issues.filter(project_id=project_id)
        
        # 모든 이슈들의 id와 parent_id 정보 가져오기
        all_issues_data = list(all_issues.values('id', 'parent_id', 'name', 'sequence_id'))
        
        # 빠른 lookup을 위한 딕셔너리 생성
        all_issues_dict = {str(issue["id"]): issue for issue in all_issues_data}
        
        # 최상단 부모를 찾는 헬퍼 함수
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
        
        # 모든 이슈들에서 실제로 그룹화될 최상위 부모들 찾기
        group_parent_ids = set()
        
        for issue in all_issues_data:
            issue_id = str(issue["id"])
            parent_id = issue.get("parent_id")
            
            if parent_id is None:
                # 부모가 없는 이슈는 자기 자신이 그룹의 대표
                group_parent_ids.add(issue_id)
            else:
                # 부모가 있는 이슈는 최상위 부모를 찾아서 그룹에 추가
                root_parent = find_root_parent(issue_id, all_issues_dict)
                if root_parent:
                    group_parent_ids.add(root_parent)
        
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
        
        # 모든 최상위 이슈들을 위한 "None" 그룹 추가
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
