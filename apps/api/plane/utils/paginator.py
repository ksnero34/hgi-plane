# Python imports
import math
from collections import defaultdict
from collections.abc import Sequence

# Django imports
from django.db.models import Count, F, Window
from django.db.models.functions import RowNumber

# Third party imports
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

# Module imports


class Cursor:
    # The cursor value
    def __init__(self, value, offset=0, is_prev=False, has_results=None):
        self.value = value
        self.offset = int(offset)
        self.is_prev = bool(is_prev)
        self.has_results = has_results

    # Return the cursor value in string format
    def __str__(self):
        return f"{self.value}:{self.offset}:{int(self.is_prev)}"

    # Return the cursor value
    def __eq__(self, other):
        return all(
            getattr(self, attr) == getattr(other, attr)
            for attr in ("value", "offset", "is_prev", "has_results")
        )

    # Return the representation of the cursor
    def __repr__(self):
        return f"{(type(self).__name__,)}: value={self.value} offset={self.offset}, is_prev={int(self.is_prev)}"  # noqa: E501

    # Return if the cursor is true
    def __bool__(self):
        return bool(self.has_results)

    @classmethod
    def from_string(cls, value):
        """Return the cursor value from string format"""
        try:
            bits = value.split(":")
            if len(bits) != 3:
                raise ValueError("Cursor must be in the format 'value:offset:is_prev'")

            value = float(bits[0]) if "." in bits[0] else int(bits[0])
            return cls(value, int(bits[1]), bool(int(bits[2])))
        except (TypeError, ValueError) as e:
            raise ValueError(f"Invalid cursor format: {e}")


class CursorResult(Sequence):
    def __init__(self, results, next, prev, hits=None, max_hits=None):
        self.results = results
        self.next = next
        self.prev = prev
        self.hits = hits
        self.max_hits = max_hits

    def __len__(self):
        # Return the length of the results
        return len(self.results)

    def __iter__(self):
        # Return the iterator of the results
        return iter(self.results)

    def __getitem__(self, key):
        # Return the results based on the key
        return self.results[key]

    def __repr__(self):
        # Return the representation of the results
        return f"<{type(self).__name__}: results={len(self.results)}>"


MAX_LIMIT = 1000


class BadPaginationError(Exception):
    pass


class OffsetPaginator:
    """
    The Offset paginator using the offset and limit
    with cursor controls
    http://example.com/api/users/?cursor=10.0.0&per_page=10
    cursor=limit,offset=page,
    """

    def __init__(
        self,
        queryset,
        order_by=None,
        max_limit=MAX_LIMIT,
        max_offset=None,
        on_results=None,
        total_count_queryset=None,
    ):
        # Key tuple and remove `-` if descending order by
        self.key = (
            order_by
            if order_by is None or isinstance(order_by, (list, tuple, set))
            else (order_by[1::] if order_by.startswith("-") else order_by,)
        )
        # Set desc to true when `-` exists in the order by
        self.desc = True if order_by and order_by.startswith("-") else False
        self.queryset = queryset
        self.max_limit = max_limit
        self.max_offset = max_offset
        self.on_results = on_results
        self.total_count_queryset = total_count_queryset

    def get_result(self, limit=1000, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        # Get the min from limit and max limit
        limit = min(limit, self.max_limit)

        # queryset
        queryset = self.queryset
        if self.key:
            queryset = queryset.order_by(
                (
                    F(*self.key).desc(nulls_last=True)
                    if self.desc
                    else F(*self.key).asc(nulls_last=True)
                ),
                "-created_at",
            )
        # The current page
        page = cursor.offset
        # The offset - use limit instead of cursor.value for consistent pagination
        offset = cursor.offset * limit
        stop = offset + limit + 1

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        results = queryset[offset:stop]
        # Duplicate the queryset so it does not evaluate on any python ops
        page_results = queryset[offset:stop].values("id")

        # Only slice from the end if we're going backwards (previous page)
        if cursor.value != limit and cursor.is_prev:
            results = results[-(limit + 1) :]

        total_count = (
            self.total_count_queryset.count()
            if self.total_count_queryset
            else results.count()
        )

        # Check if there are more results available after the current page

        # Adjust cursors based on the results for pagination
        next_cursor = Cursor(limit, page + 1, False, page_results.count() > limit)
        # If the page is greater than 0, then set the previous cursor
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        # Process the results
        results = results[:limit]

        # Process the results
        if self.on_results:
            results = self.on_results(results)

        # Count the queryset
        count = total_count

        # Optionally, calculate the total count and max_hits if needed
        max_hits = math.ceil(count / limit)

        # Return the cursor results
        return CursorResult(
            results=results,
            next=next_cursor,
            prev=prev_cursor,
            hits=count,
            max_hits=max_hits,
        )

    def process_results(self, results):
        raise NotImplementedError


class ParentChildOffsetPaginator(OffsetPaginator):
    """
    parent_child 그룹화를 위한 특별한 paginator
    그룹 단위로 pagination을 처리합니다.
    """

    def __init__(
        self,
        queryset,
        group_by_fields,
        count_filter,
        items_per_group=20,  # 각 그룹당 최대 아이템 수
        parent_id=None,  # 더보기 요청을 위한 parent_id 파라미터 (단일 그룹)
        parent_pages=None,  # 여러 그룹의 페이지 정보 (예: "group1:2,group2:3,None:1")
        *args,
        **kwargs,
    ):
        # parent_child 전용 파라미터들을 별도로 저장
        self.group_by_fields = group_by_fields
        self.count_filter = count_filter
        self.items_per_group = items_per_group
        self.parent_id = parent_id  # 단일 그룹 더보기 (하위 호환성)
        self.parent_pages = parent_pages  # 여러 그룹 페이지 정보
        
        # parent_pages 파싱: "group1:2,group2:3,None:1" -> {"group1": 2, "group2": 3, "None": 1}
        self.group_pages = {}
        if parent_pages:
            try:
                for group_page in parent_pages.split(','):
                    group_id, page = group_page.split(':')
                    self.group_pages[group_id] = int(page)
            except (ValueError, AttributeError):
                # print(f"[ParentChildOffsetPaginator] Invalid parent_pages format: {parent_pages}")
                self.group_pages = {}
        
        # 부모 클래스가 받지 않는 파라미터들 제거
        parent_kwargs = kwargs.copy()
        parent_kwargs.pop('group_by_field_name', None)
        parent_kwargs.pop('group_by_fields', None)
        parent_kwargs.pop('count_filter', None)
        
        super().__init__(queryset, *args, **parent_kwargs)

    def get_result(self, limit=100, cursor=None):
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)
        page = cursor.offset
        
        # 모든 그룹 정보 가져오기
        all_groups = self.group_by_fields
        total_groups = len(all_groups)
        
        # 필터링된 이슈들의 ID 집합 (실제 결과에 포함될 이슈들)
        filtered_issue_ids = set(str(issue_id) for issue_id in self.queryset.values_list('id', flat=True))
        
        # 전체 이슈들의 parent 관계를 파악하기 위해 workspace와 project만으로 필터링된 전체 이슈 데이터 가져오기
        # self.queryset에서 workspace와 project 정보 추출
        sample_issue = self.queryset.first()
        if not sample_issue:
            # 이슈가 없으면 빈 결과 반환
            return CursorResult(
                results=[],
                next=Cursor(limit, page + 1, False, False),
                prev=Cursor(limit, page - 1, True, page > 0),
                hits=0,
                max_hits=1,
            )
        
        # 전체 이슈들을 workspace와 project만으로 필터링해서 가져오기
        from plane.db.models import Issue as IssueModel
        base_queryset = IssueModel.issue_objects.filter(
            workspace_id=sample_issue.workspace_id,
            project_id=sample_issue.project_id
        )
        
        all_issues_data = list(base_queryset.values('id', 'parent_id'))
        all_issues_dict = {str(issue["id"]): issue for issue in all_issues_data}
        
        # print(f"[ParentChildOffsetPaginator] Total issues in project: {len(all_issues_data)}")
        # print(f"[ParentChildOffsetPaginator] Filtered issues count: {len(filtered_issue_ids)}")
        # print(f"[ParentChildOffsetPaginator] Sample filtered IDs: {list(filtered_issue_ids)[:5]}")
        
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
        
        # 각 그룹에 대해 이슈들 찾기
        all_group_issues = []
        group_issue_counts = {}
        group_has_more = {}
        
        for group in all_groups:
            group_id = group.get('id', 'None')
            
            if group_id == 'None':
                # None 그룹: 최상위 이슈들 (parent_id가 None인 이슈들)
                group_issue_ids = [
                    issue_id for issue_id, issue_data in all_issues_dict.items()
                    if issue_data.get('parent_id') is None
                ]
            else:
                # 특정 부모 그룹: 해당 부모의 하위 이슈들만 포함 (부모 자체는 제외)
                group_issue_ids = [
                    issue_id for issue_id, issue_data in all_issues_dict.items()
                    if issue_data.get('parent_id') is not None and 
                    find_root_parent(issue_data.get('parent_id'), all_issues_dict) == group_id and
                    issue_id != group_id  # 부모 이슈 자체는 제외
                ]
            
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: found {len(group_issue_ids)} candidate issues")
            
            # 필터링된 이슈들과 교집합 구하기
            filtered_group_issue_ids = [
                issue_id for issue_id in group_issue_ids 
                if issue_id in filtered_issue_ids
            ]
            
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: {len(filtered_group_issue_ids)} issues after filtering")
            
            # 해당 그룹의 이슈들을 쿼리셋으로 필터링
            if filtered_group_issue_ids:
                group_queryset = self.queryset.filter(id__in=filtered_group_issue_ids)
            else:
                group_queryset = self.queryset.none()
            
            # 정렬 적용
            group_queryset = group_queryset.order_by(
                    (
                        F(*self.key).desc(nulls_last=True)
                        if self.desc
                        else F(*self.key).asc(nulls_last=True)
                    ),
                    "-created_at",
                )
            
            # 그룹 전체 이슈 수 저장 (실제 필터링된 결과 기준)
            group_total_count = group_queryset.count()
            group_issue_counts[group_id] = group_total_count
            
            # 디버깅: 그룹별 이슈 수 로그
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: {group_total_count} total issues (after filtering)")
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: found {len(group_issue_ids)} issue IDs, but {group_total_count} after queryset filtering")
            
            # 그룹별 페이지 정보 확인
            current_page = 1  # 기본값
            if self.group_pages and group_id in self.group_pages:
                # 여러 그룹 더보기: parent_pages에서 해당 그룹의 페이지 정보 사용
                current_page = self.group_pages[group_id]
                # print(f"[ParentChildOffsetPaginator] Group {group_id}: using page {current_page} from parent_pages")
            elif self.parent_id is not None and group_id == self.parent_id:
                # 단일 그룹 더보기: 페이지 2로 설정 (하위 호환성)
                current_page = 2
                # print(f"[ParentChildOffsetPaginator] Group {group_id}: using page 2 from parent_id")
            
            # 페이지에 따른 아이템 수 계산
            items_to_show = self.items_per_group * current_page
            items_to_fetch = items_to_show + 1  # has_more 체크용
            
            group_issues = list(group_queryset[:items_to_fetch])
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: page {current_page}, fetched {len(group_issues)} issues (showing {items_to_show})")
            
            # has_more 체크
            has_more = len(group_issues) > items_to_show
            actual_items = group_issues[:items_to_show]
            
            group_has_more[group_id] = has_more
            
            # print(f"[ParentChildOffsetPaginator] Group {group_id}: has_more = {has_more}")
            
            # 각 이슈에 그룹 정보 추가 (나중에 그룹화할 때 사용)
            for issue in actual_items:
                issue._group_id = group_id
                issue._has_more = has_more
                issue._group_total = group_total_count
                all_group_issues.append(issue)
        
        # 전체 이슈 수 계산
        total_issues = sum(group_issue_counts.values())
        
        # 그룹별 has_more 정보를 전역적으로 저장
        self._group_has_more = group_has_more
        self._group_issue_counts = group_issue_counts
        
        # cursor 설정 (그룹 기반이므로 단순화)
        next_cursor = Cursor(limit, page + 1, False, False)  # 그룹화에서는 단순한 페이지네이션
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        return CursorResult(
            results=all_group_issues,
            next=next_cursor,
            prev=prev_cursor,
            hits=total_issues,
            max_hits=1,  # 그룹화에서는 페이지가 1개
        )

    def process_results(self, results):
        # parent_child 그룹화를 위한 처리
        from plane.app.serializers import IssueSerializer
        
        # print(f"[ParentChildOffsetPaginator] process_results: received {len(results)} results")
        
        # 결과가 이미 직렬화된 딕셔너리인지 확인
        if isinstance(results, list) and len(results) > 0 and isinstance(results[0], dict):
            # 이미 직렬화된 결과
            serialized_data = results
            # 직렬화된 데이터에서 그룹 정보 추출 (Django 모델 속성이 없으므로 parent_child 값 사용)
            grouped_results = {}
            for result in serialized_data:
                parent_child_value = result.get("parent_child", "None")
                if parent_child_value not in grouped_results:
                    grouped_results[parent_child_value] = {
                        "results": [],
                        "total_results": 0,
                        "has_more": False,
                    }
                grouped_results[parent_child_value]["results"].append(result)
            
            # total_results는 각 그룹의 실제 이슈 수로 설정 (별도 계산 필요)
            for group_id in grouped_results:
                grouped_results[group_id]["total_results"] = len(grouped_results[group_id]["results"])
                # print(f"[ParentChildOffsetPaginator] Serialized data - Group {group_id}: {len(grouped_results[group_id]['results'])} results")
                
        else:
            # Django 모델 인스턴스들을 직렬화
            serializer = IssueSerializer(results, many=True)
            serialized_data = serializer.data
            
            # print(f"[ParentChildOffsetPaginator] Serialized {len(results)} Django instances to {len(serialized_data)} data items")
            
            # 그룹화 수행 (Django 모델 인스턴스의 추가 속성 사용)
            grouped_results = {}
            
            for i, result in enumerate(serialized_data):
                # Django 모델 인스턴스에서 그룹 정보 가져오기
                if i < len(results):
                    django_instance = results[i]
                    group_id = getattr(django_instance, '_group_id', 'None')
                    has_more = getattr(django_instance, '_has_more', False)
                    group_total = getattr(django_instance, '_group_total', 0)
                    
                    # print(f"[ParentChildOffsetPaginator] Issue {i}: {result.get('name', 'Unknown')} -> Group {group_id}")
                else:
                    # fallback: parent_child 값 사용
                    group_id = result.get("parent_child", "None")
                    has_more = False
                    group_total = 0
                    # print(f"[ParentChildOffsetPaginator] Issue {i}: {result.get('name', 'Unknown')} -> Group {group_id} (fallback)")
                
                if group_id not in grouped_results:
                    grouped_results[group_id] = {
                        "results": [],
                        "total_results": group_total,
                        "has_more": has_more,
                    }
                
                # parent_child 값을 결과에 추가
                result["parent_child"] = group_id
                grouped_results[group_id]["results"].append(result)
        
        # get_result에서 저장한 그룹별 정보 사용
        if hasattr(self, '_group_has_more') and hasattr(self, '_group_issue_counts'):
            for group_id in grouped_results:
                grouped_results[group_id]["has_more"] = self._group_has_more.get(group_id, False)
                grouped_results[group_id]["total_results"] = self._group_issue_counts.get(group_id, 0)
                # print(f"[ParentChildOffsetPaginator] Final - Group {group_id}: {len(grouped_results[group_id]['results'])} results, total_results: {grouped_results[group_id]['total_results']}, has_more: {grouped_results[group_id]['has_more']}")
        
        # 모든 예상 그룹이 결과에 포함되도록 보장
        # 더보기 요청 시에는 빈 그룹을 생성하지 않고, 기존 그룹만 유지
        for group in self.group_by_fields:
            group_id = group.get('id', 'None')
            if group_id not in grouped_results:
                # 더보기 요청인 경우
                if self.parent_id is not None:
                    # 더보기 요청에서 해당 그룹에 데이터가 없다면 빈 그룹을 생성하지 않음
                    # 대신 기존 상태를 유지하기 위해 전체 이슈 수 정보만 포함한 빈 그룹 생성
                    total_results = self._group_issue_counts.get(group_id, 0) if hasattr(self, '_group_issue_counts') else 0
                    has_more = self._group_has_more.get(group_id, False) if hasattr(self, '_group_has_more') else False
                    
                    # 데이터가 실제로 있는 그룹이어야 빈 그룹 생성 (완전히 비어있는 그룹은 제외)
                    if total_results > 0:
                        grouped_results[group_id] = {
                            "results": [],
                            "total_results": total_results,
                            "has_more": has_more,
                        }
                        # print(f"[ParentChildOffsetPaginator] Empty group with data {group_id}: total_results: {total_results}, has_more: {has_more}")
                else:
                    # 초기 요청인 경우: 빈 그룹도 표시
                    grouped_results[group_id] = {
                        "results": [],
                        "total_results": self._group_issue_counts.get(group_id, 0) if hasattr(self, '_group_issue_counts') else 0,
                        "has_more": self._group_has_more.get(group_id, False) if hasattr(self, '_group_has_more') else False,
                    }
                    # print(f"[ParentChildOffsetPaginator] Initial empty group {group_id}: total_results: {grouped_results[group_id]['total_results']}, has_more: {grouped_results[group_id]['has_more']}")
        
        return grouped_results


class GroupedOffsetPaginator(OffsetPaginator):
    # Field mappers - list m2m fields here
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
        "parent_id": "parent_child",
    }
    
    # parent_child와 top_level_only 그룹화를 위한 필드 매핑
    GROUP_BY_FIELD_MAPPER = {
        # parent_child와 top_level_only는 issue_on_results에서 처리되므로 parent_id로 매핑하지 않음
    }

    def __init__(
        self,
        queryset,
        group_by_field_name,
        group_by_fields,
        count_filter,
        total_count_queryset=None,
        *args,
        **kwargs,
    ):
        # Initiate the parent class for all the parameters
        super().__init__(queryset, *args, **kwargs)

        # Set the group by field name - parent_child를 parent_id로 매핑
        self.group_by_field_name = self.GROUP_BY_FIELD_MAPPER.get(group_by_field_name, group_by_field_name)
        # Set the group by fields
        self.group_by_fields = group_by_fields
        # Set the count filter - this are extra filters that need to be passed to calculate the counts with the filters
        self.count_filter = count_filter

    def get_result(self, limit=100, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        # Adjust the initial offset and stop based on the cursor and limit
        queryset = self.queryset

        page = cursor.offset
        offset = cursor.offset * cursor.value
        stop = offset + (cursor.value or limit) + 1

        # Check if the offset is greater than the max offset
        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")

        # Check if the offset is less than 0
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        # parent_child 그룹화인 경우 ParentChildOffsetPaginator 사용 권장
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child는 Python 레벨에서만 처리 가능하므로 일반 페이지네이션 사용
            if self.key:
                queryset = queryset.order_by(
                    (
                        F(*self.key).desc(nulls_last=True)
                        if self.desc
                        else F(*self.key).asc(nulls_last=True)
                    ),
                    "-created_at",
                )
            
            results = queryset[offset:stop]
            if cursor.value != limit:
                # negative indexing 에러 방지: results 길이가 충분한지 확인
                results_count = len(results)
                slice_start = max(0, results_count - (limit + 1))
                results = results[slice_start:]

            # Adjust cursors based on the results for pagination
            next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
            prev_cursor = Cursor(limit, page - 1, True, page > 0)

            # Process the results
            results = results[:limit]

            # parent_child 그룹화의 경우 on_results는 BasePaginator.paginate()에서 처리하도록 함
            # Process the results
            # if self.on_results:
            #     results = self.on_results(results)

            # Count the queryset
            count = queryset.count()

            # Optionally, calculate the total count and max_hits if needed
            max_hits = math.ceil(count / limit) if count > 0 else 0
            
            return CursorResult(
                results=results,
                next=next_cursor,
                prev=prev_cursor,
                hits=count,
                max_hits=max_hits,
            )

        # 일반 그룹화 처리
        if self.key:
            queryset = queryset.order_by(
                (
                    F(*self.key).desc(nulls_last=True)
                    if self.desc
                    else F(*self.key).asc(nulls_last=True)
                ),
                "-created_at",
            )

        results = queryset[offset:stop]
        if cursor.value != limit:
            # negative indexing 에러 방지: results 길이가 충분한지 확인
            results_count = len(results)
            slice_start = max(0, results_count - (limit + 1))
            results = results[slice_start:]

        # Adjust cursors based on the results for pagination
        next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
        # If the page is greater than 0, then set the previous cursor
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        # Process the results
        results = results[:limit]

        # Process the results
        if self.on_results:
            results = self.on_results(results)

        # Count the queryset
        count = queryset.count()

        # Optionally, calculate the total count and max_hits if needed
        # This might require adjustments based on specific use cases
        if results:
            if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
                max_hits = math.ceil(count / limit)
            else:
                max_hits = math.ceil(
                    queryset.values(self.group_by_field_name)
                    .annotate(count=Count("id", filter=self.count_filter, distinct=True))
                    .order_by("-count")[0]["count"]
                    / limit
                )
        else:
            max_hits = 0
        return CursorResult(
            results=results,
            next=next_cursor,
            prev=prev_cursor,
            hits=count,
            max_hits=max_hits,
        )

    def __get_total_queryset(self):
        # Get total items for each group
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 Python 레벨에서 처리하므로 빈 쿼리셋 반환
            return []
        return (
            self.queryset.values(self.group_by_field_name)
            .annotate(count=Count("id", filter=self.count_filter, distinct=True))
            .order_by()
        )

    def __get_total_dict(self):
        # Convert the total into dictionary of keys as group name and value as the total
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 Python 레벨에서 처리하므로 빈 딕셔너리 반환
            return {}
        total_group_dict = {}
        for group in self.__get_total_queryset():
            total_group_dict[str(group.get(self.group_by_field_name))] = (
                total_group_dict.get(str(group.get(self.group_by_field_name)), 0)
                + (1 if group.get("count") == 0 else group.get("count"))
            )
        return total_group_dict

    def __get_field_dict(self):
        # Create a field dictionary
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 동적으로 그룹이 생성되므로
            # group_by_fields를 기반으로 딕셔너리 생성
            return {
                str(field.get('id', field) if isinstance(field, dict) else field): {
                    "results": [],
                    "total_results": 0,
                }
                for field in self.group_by_fields
            }
        else:
            total_group_dict = self.__get_total_dict()
            return {
                str(field): {
                    "results": [],
                    "total_results": total_group_dict.get(str(field), 0),
                }
                for field in self.group_by_fields
            }

    def __result_already_added(self, result, group):
        # Check if the result is already added then add it
        for existing_issue in group:
            if existing_issue["id"] == result["id"]:
                return True
        return False

    def __query_multi_grouper(self, results):
        # Grouping for m2m values
        total_group_dict = self.__get_total_dict()

        # Preparing a dict to keep track of group IDs associated with each entity ID
        result_group_mapping = defaultdict(set)
        # Preparing a dict to group result by group ID
        grouped_by_field_name = defaultdict(list)

        # Iterate over results to fill the above dictionaries
        for result in results:
            result_id = result["id"]
            group_id = result[self.group_by_field_name]
            result_group_mapping[str(result_id)].add(str(group_id))

        # Adding group_ids key to each issue and grouping by group_name
        for result in results:
            result_id = result["id"]
            group_ids = list(result_group_mapping[str(result_id)])
            result[self.FIELD_MAPPER.get(self.group_by_field_name)] = (
                [] if "None" in group_ids else group_ids
            )
            # If a result belongs to multiple groups, add it to each group
            for group_id in group_ids:
                if not self.__result_already_added(
                    result, grouped_by_field_name[group_id]
                ):
                    grouped_by_field_name[group_id].append(result)

        # Convert grouped_by_field_name back to a list for each group
        processed_results = {
            str(group_id): {
                "results": issues,
                "total_results": total_group_dict.get(str(group_id)),
            }
            for group_id, issues in grouped_by_field_name.items()
        }

        return processed_results

    def __query_grouper(self, results):
        # Grouping for values that are not m2m
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 Python 레벨에서 동적으로 처리
            processed_results = {}
            for result in results:
                group_value = str(result.get(self.group_by_field_name, "None"))
                if group_value not in processed_results:
                    processed_results[group_value] = {
                        "results": [],
                        "total_results": 0,
                    }
                processed_results[group_value]["results"].append(result)
                processed_results[group_value]["total_results"] += 1
            return processed_results
        elif self.group_by_field_name == "type_id":
            # type_id 그룹화의 경우 ProjectIssueType ID를 IssueType ID로 역변환하여 매칭
            processed_results = self.__get_field_dict()
            
            # ProjectIssueType ID -> IssueType ID 매핑 생성
            from plane.db.models import ProjectIssueType
            project_to_issue_type_map = {}
            
            # 현재 결과에 있는 모든 ProjectIssueType ID들 수집
            project_type_ids = set()
            for result in results:
                type_id = result.get(self.group_by_field_name)
                if type_id and type_id != "None":
                    project_type_ids.add(type_id)
            
            if project_type_ids:
                # ProjectIssueType에서 IssueType으로의 매핑 가져오기
                project_issue_types = ProjectIssueType.objects.filter(
                    id__in=project_type_ids,
                    deleted_at__isnull=True
                ).values('id', 'issue_type_id')
                
                for pit in project_issue_types:
                    project_to_issue_type_map[str(pit['id'])] = str(pit['issue_type_id'])
            
            for result in results:
                project_type_id = str(result.get(self.group_by_field_name, "None"))
                
                # ProjectIssueType ID를 IssueType ID로 변환
                if project_type_id in project_to_issue_type_map:
                    issue_type_id = project_to_issue_type_map[project_type_id]
                else:
                    issue_type_id = project_type_id  # "None"이거나 매핑되지 않은 경우
                
                if issue_type_id in processed_results:
                    processed_results[issue_type_id]["results"].append(result)
            return processed_results
        else:
            import logging
            logger = logging.getLogger("plane.paginator")
            
            processed_results = self.__get_field_dict()
            logger.info(f"GroupedOffsetPaginator: Processing {len(results)} results for field {self.group_by_field_name}")
            logger.info(f"Available groups: {list(processed_results.keys())[:5]}")  # 처음 5개 그룹만 로그
            
            for result in results:
                group_value = str(result.get(self.group_by_field_name))
                logger.debug(f"Result ID {result.get('id')}: group_value = {group_value}")
                if group_value in processed_results:
                    processed_results[str(group_value)]["results"].append(result)
                    logger.debug(f"Added to group {group_value}")
                else:
                    logger.warning(f"Group value {group_value} not found in processed_results")
            
            # 결과 요약 로그
            for key, value in processed_results.items():
                if value["results"]:
                    logger.info(f"Group {key}: {len(value['results'])} results")
            
            return processed_results

    def process_results(self, results):
        # Process results
        if results:
            if self.group_by_field_name in self.FIELD_MAPPER:
                processed_results = self.__query_multi_grouper(results=results)
            else:
                processed_results = self.__query_grouper(results=results)
        else:
            processed_results = {}
        return processed_results


class SubGroupedOffsetPaginator(OffsetPaginator):
    # Field mappers this are the fields that are m2m
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
        "parent_id": "parent_child",
    }
    
    # parent_child와 top_level_only 그룹화를 위한 필드 매핑
    GROUP_BY_FIELD_MAPPER = {
        # parent_child와 top_level_only는 issue_on_results에서 처리되므로 parent_id로 매핑하지 않음
    }

    def __init__(
        self,
        queryset,
        group_by_field_name,
        sub_group_by_field_name,
        group_by_fields,
        sub_group_by_fields,
        count_filter,
        total_count_queryset=None,
        *args,
        **kwargs,
    ):
        # Initiate the parent class for all the parameters
        super().__init__(queryset, *args, **kwargs)

        # Set the group by field name - parent_child를 parent_id로 매핑
        self.group_by_field_name = self.GROUP_BY_FIELD_MAPPER.get(group_by_field_name, group_by_field_name)
        self.group_by_fields = group_by_fields

        # Set the sub group by field name - parent_child를 parent_id로 매핑
        self.sub_group_by_field_name = self.GROUP_BY_FIELD_MAPPER.get(sub_group_by_field_name, sub_group_by_field_name)
        self.sub_group_by_fields = sub_group_by_fields

        # Set the count filter - this are extra filters that need to be passed to calculate the counts with the filters
        self.count_filter = count_filter

    def get_result(self, limit=100, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        # get the minimum value
        limit = min(limit, self.max_limit)

        # Adjust the initial offset and stop based on the cursor and limit
        queryset = self.queryset

        # the current page
        page = cursor.offset

        # the offset
        offset = cursor.offset * cursor.value

        # the stop
        stop = offset + (cursor.value or limit) + 1

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        # parent_child 그룹화인 경우 특별 처리
        if self.group_by_field_name == "parent_child" or self.sub_group_by_field_name == "parent_child":
            # parent_child는 Python 레벨에서만 처리 가능하므로 일반 페이지네이션 사용
            if self.key:
                queryset = queryset.order_by(
                    (
                        F(*self.key).desc(nulls_last=True)
                        if self.desc
                        else F(*self.key).asc(nulls_last=True)
                    ),
                    "-created_at",
                )
            
            results = queryset[offset:stop]
            if cursor.value != limit:
                # negative indexing 에러 방지: results 길이가 충분한지 확인
                results_count = len(results)
                slice_start = max(0, results_count - (limit + 1))
                results = results[slice_start:]

            # Adjust cursors based on the results for pagination
            next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
            prev_cursor = Cursor(limit, page - 1, True, page > 0)

            # Process the results
            results = results[:limit]
        else:
            # Compute the results
            results = {}

            # Create windows for group and sub group field name
            queryset = queryset.annotate(
                row_number=Window(
                    expression=RowNumber(),
                    partition_by=[
                        F(self.group_by_field_name),
                        F(self.sub_group_by_field_name),
                    ],
                    order_by=(
                        (
                            F(*self.key).desc(nulls_last=True)
                            if self.desc
                            else F(*self.key).asc(nulls_last=True)
                        ),
                        "-created_at",
                    ),
                )
            )

            # Filter the results
            results = queryset.filter(row_number__gt=offset, row_number__lt=stop).order_by(
                (
                    F(*self.key).desc(nulls_last=True)
                    if self.desc
                    else F(*self.key).asc(nulls_last=True)
                ),
                F("created_at").desc(),
            )

            # Adjust cursors based on the grouped results for pagination
            next_cursor = Cursor(
                limit, page + 1, False, queryset.filter(row_number__gte=stop).exists()
            )

            # Add previous cursors
            prev_cursor = Cursor(limit, page - 1, True, page > 0)

        # Count the queryset
        count = queryset.count()

        # Optionally, calculate the total count and max_hits if needed
        # This might require adjustments based on specific use cases
        if results:
            if self.group_by_field_name == "parent_child" or self.sub_group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only" or self.sub_group_by_field_name == "top_level_only":
                max_hits = math.ceil(count / limit)
            else:
                max_hits = math.ceil(
                    queryset.values(self.group_by_field_name)
                    .annotate(count=Count("id", filter=self.count_filter, distinct=True))
                    .order_by("-count")[0]["count"]
                    / limit
                )
        else:
            max_hits = 0
        return CursorResult(
            results=results,
            next=next_cursor,
            prev=prev_cursor,
            hits=count,
            max_hits=max_hits,
        )

    def __get_group_total_queryset(self):
        # Get group totals
        return (
            self.queryset.order_by(self.group_by_field_name)
            .values(self.group_by_field_name)
            .annotate(count=Count("id", filter=self.count_filter, distinct=True))
            .distinct()
        )

    def __get_subgroup_total_queryset(self):
        # Get subgroup totals
        return (
            self.queryset.values(self.group_by_field_name, self.sub_group_by_field_name)
            .annotate(count=Count("id", filter=self.count_filter, distinct=True))
            .order_by()
            .values(self.group_by_field_name, self.sub_group_by_field_name, "count")
        )

    def __get_total_dict(self):
        # Use the above to convert to dictionary of 2D objects
        total_group_dict = {}
        total_sub_group_dict = {}
        for group in self.__get_group_total_queryset():
            total_group_dict[str(group.get(self.group_by_field_name))] = (
                total_group_dict.get(str(group.get(self.group_by_field_name)), 0)
                + (1 if group.get("count") == 0 else group.get("count"))
            )

        # Sub group total values
        for item in self.__get_subgroup_total_queryset():
            group = str(item[self.group_by_field_name])
            subgroup = str(item[self.sub_group_by_field_name])
            count = item["count"]

            # Create a dictionary of group and sub group
            if group not in total_sub_group_dict:
                total_sub_group_dict[str(group)] = {}

            # Create a dictionary of sub group
            if subgroup not in total_sub_group_dict[group]:
                total_sub_group_dict[str(group)][str(subgroup)] = {}

            # Create a nested dictionary of group and sub group
            total_sub_group_dict[group][subgroup] = count

        return total_group_dict, total_sub_group_dict

    def __get_field_dict(self):
        # Create a field dictionary for multi-level grouping
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 동적으로 그룹이 생성되므로
            # group_by_fields를 기반으로 딕셔너리 생성
            result = {}
            for field in self.group_by_fields:
                result[str(field.get('id', field) if isinstance(field, dict) else field)] = {
                    "results": {},
                    "total_results": 0,
                }
                # 서브그룹 초기화
                for sub_field in self.sub_group_by_fields:
                    sub_field_key = str(sub_field.get('id', sub_field) if isinstance(sub_field, dict) else sub_field)
                    result[str(field.get('id', field) if isinstance(field, dict) else field)]["results"][sub_field_key] = {
                        "results": [],
                        "total_results": 0,
                    }
            return result
        else:
            total_group_dict, total_sub_group_dict = self.__get_total_dict()
            result = {}
            for field in self.group_by_fields:
                result[str(field)] = {
                    "results": {},
                    "total_results": total_group_dict.get(str(field), 0),
                }
                # 서브그룹 초기화
                for sub_field in self.sub_group_by_fields:
                    sub_field_key = str(sub_field)
                    result[str(field)]["results"][sub_field_key] = {
                        "results": [],
                        "total_results": total_sub_group_dict.get(str(field), {}).get(sub_field_key, 0),
                    }
            return result

    def __query_multi_grouper(self, results):
        # Multi grouper
        processed_results = self.__get_field_dict()
        # Preparing a dict to keep track of group IDs associated with each label ID
        result_group_mapping = defaultdict(set)
        result_sub_group_mapping = defaultdict(set)

        # Iterate over results to fill the above dictionaries
        if self.group_by_field_name in self.FIELD_MAPPER:
            for result in results:
                result_id = result["id"]
                group_id = result[self.group_by_field_name]
                result_group_mapping[str(result_id)].add(str(group_id))
        # Use the same calculation for the sub group
        if self.sub_group_by_field_name in self.FIELD_MAPPER:
            for result in results:
                result_id = result["id"]
                sub_group_id = result[self.sub_group_by_field_name]
                result_sub_group_mapping[str(result_id)].add(str(sub_group_id))

        # Iterate over results
        for result in results:
            # Get the group value
            group_value = str(result.get(self.group_by_field_name))
            # Get the sub group value
            sub_group_value = str(result.get(self.sub_group_by_field_name))
            # Check if the group value is in the processed results
            result_id = result["id"]

            if group_value in processed_results:
                # 서브그룹이 없으면 생성
                if sub_group_value not in processed_results[group_value]["results"]:
                    processed_results[group_value]["results"][sub_group_value] = {
                        "results": [],
                        "total_results": 0,
                    }

                if self.group_by_field_name in self.FIELD_MAPPER:
                    # for multi grouper
                    group_ids = list(result_group_mapping[str(result_id)])
                    result[self.FIELD_MAPPER.get(self.group_by_field_name)] = (
                        [] if "None" in group_ids else group_ids
                    )
                if self.sub_group_by_field_name in self.FIELD_MAPPER:
                    sub_group_ids = list(result_sub_group_mapping[str(result_id)])
                    # for multi groups
                    result[self.FIELD_MAPPER.get(self.sub_group_by_field_name)] = (
                        [] if "None" in sub_group_ids else sub_group_ids
                    )
                # Add result to the appropriate group and sub-group
                processed_results[group_value]["results"][sub_group_value]["results"].append(result)

        return processed_results

    def __query_grouper(self, results):
        # Grouping for values that are not m2m
        if self.group_by_field_name == "parent_child" or self.group_by_field_name == "top_level_only":
            # parent_child와 top_level_only 그룹화는 Python 레벨에서 동적으로 처리
            processed_results = {}
            for result in results:
                group_value = str(result.get(self.group_by_field_name, "None"))
                if group_value not in processed_results:
                    processed_results[group_value] = {
                        "results": [],
                        "total_results": 0,
                    }
                processed_results[group_value]["results"].append(result)
                processed_results[group_value]["total_results"] += 1
            return processed_results
        else:
            processed_results = self.__get_field_dict()
            for result in results:
                group_value = str(result.get(self.group_by_field_name))
                if group_value in processed_results:
                    processed_results[str(group_value)]["results"].append(result)
            return processed_results

    def process_results(self, results):
        if results:
            if (
                self.group_by_field_name in self.FIELD_MAPPER
                or self.sub_group_by_field_name in self.FIELD_MAPPER
            ):
                # if the grouping is done through m2m then
                processed_results = self.__query_multi_grouper(results=results)
            else:
                # group it directly
                processed_results = self.__query_grouper(results=results)
        else:
            processed_results = {}
        return processed_results


class BasePaginator:
    """BasePaginator class can be inherited by any View to return a paginated view"""

    # cursor query parameter name
    cursor_name = "cursor"

    # get the per page parameter from request
    def get_per_page(self, request, default_per_page=1000, max_per_page=1000):
        try:
            per_page = int(request.GET.get("per_page", default_per_page))
        except ValueError:
            raise ParseError(detail="Invalid per_page parameter.")

        max_per_page = max(max_per_page, default_per_page)
        if per_page > max_per_page:
            raise ParseError(
                detail=f"Invalid per_page value. Cannot exceed {max_per_page}."
            )

        return per_page

    def paginate(
        self,
        request,
        on_results=None,
        paginator=None,
        paginator_cls=OffsetPaginator,
        default_per_page=1000,
        max_per_page=1000,
        cursor_cls=Cursor,
        extra_stats=None,
        controller=None,
        group_by_field_name=None,
        group_by_fields=None,
        sub_group_by_field_name=None,
        sub_group_by_fields=None,
        count_filter=None,
        total_count_queryset=None,
        **paginator_kwargs,
    ):
        """Paginate the request"""
        per_page = self.get_per_page(request, default_per_page, max_per_page)
        # Convert the cursor value to integer and float from string
        input_cursor = None
        try:
            input_cursor = cursor_cls.from_string(
                request.GET.get(self.cursor_name, f"{per_page}:0:0")
            )
        except ValueError:
            raise ParseError(detail="Invalid cursor parameter.")

        if not paginator:
            if group_by_field_name:
                paginator_kwargs["group_by_field_name"] = group_by_field_name
                paginator_kwargs["group_by_fields"] = group_by_fields
                paginator_kwargs["count_filter"] = count_filter

                # parent_child 그룹화인 경우 ParentChildOffsetPaginator 사용 (강제)
                if group_by_field_name == "parent_child":
                    paginator_cls = ParentChildOffsetPaginator
                    # per_page 값을 items_per_group으로 전달
                    paginator_kwargs["items_per_group"] = per_page

                if sub_group_by_field_name:
                    paginator_kwargs["sub_group_by_field_name"] = (
                        sub_group_by_field_name
                    )
                    paginator_kwargs["sub_group_by_fields"] = sub_group_by_fields

            paginator_kwargs["total_count_queryset"] = total_count_queryset

            paginator = paginator_cls(**paginator_kwargs)

        try:
            cursor_result = paginator.get_result(limit=per_page, cursor=input_cursor)
        except BadPaginationError:
            raise ParseError(detail="Error in parsing")

        if on_results:
            results = on_results(cursor_result.results)
        else:
            results = cursor_result.results

        if group_by_field_name:
            results = paginator.process_results(results=results)

        # Add Manipulation functions to the response
        if controller is not None:
            results = controller(results)
        else:
            results = results

        # Return the response
        response = Response(
            {
                "grouped_by": group_by_field_name,
                "sub_grouped_by": sub_group_by_field_name,
                "group_by_fields": group_by_fields if group_by_field_name else None,
                "sub_group_by_fields": sub_group_by_fields if sub_group_by_field_name else None,
                "total_count": (cursor_result.hits),
                "next_cursor": str(cursor_result.next),
                "prev_cursor": str(cursor_result.prev),
                "next_page_results": cursor_result.next.has_results,
                "prev_page_results": cursor_result.prev.has_results,
                "count": cursor_result.__len__(),
                "total_pages": cursor_result.max_hits,
                "total_results": cursor_result.hits,
                "extra_stats": extra_stats,
                "results": results,
            }
        )

        return response
