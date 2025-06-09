import csv
import io
import json
import pandas as pd
from datetime import datetime
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Max
from plane.db.models import (
    Issue, State, Project, Label, 
    IssueAssignee, IssueLabel, CycleIssue, ModuleIssue,
    IssueActivity,
    Module,
    User,
    Cycle,
    CustomField,
    CustomFieldValue
)
from plane.utils.exception_logger import log_exception
from plane.app.serializers import IssueSerializer, IssueCreateSerializer
from plane.bgtasks.issue_activities_task import issue_activity
import codecs
from django.db.models import Q
from django.contrib.auth import get_user_model
from uuid import UUID
from django.db import connection
from plane.utils.html_processor import strip_tags

def parse_date(date_str):
    """날짜 문자열을 파싱하는 함수"""
    if pd.isna(date_str) or not date_str:
        return None
        
    # 문자열이 아닌 경우 문자열로 변환
    date_str = str(date_str).strip()
    if date_str == "":
        return None
        
    try:
        # YYYY-MM-DD 형식 처리 (기본 형식)
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        try:
            # YYYY-MM-DD HH:MM:SS 형식 처리
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").date()
        except ValueError:
            try:
                # 이전 형식 지원: "Tue, 04 Mar 2025" 형식 처리
                return datetime.strptime(date_str, "%a, %d %b %Y").date()
            except ValueError:
                try:
                    # 이전 형식 지원: "04 Mar 2025" 형식 처리
                    return datetime.strptime(date_str, "%d %b %Y").date()
                except ValueError:
                    #print(f"Warning: Could not parse date '{date_str}'. Skipping date field.")
                    return None

def get_or_create_state(project, state_name, default_state):
    if not state_name:
        return default_state
    try:
        # 상태 이름으로 먼저 검색
        state = State.objects.filter(
            name=state_name.strip(),
            project=project
        ).first()
        
        if state:
            return state
            
        # 없으면 새로 생성
        return State.objects.create(
            name=state_name.strip(),
            project=project,
            group="backlog"  # 기본 그룹
        )
    except Exception as e:
        #print(f"Error creating state: {str(e)}")
        return default_state

def clean_id_field(id_str):
    """ID 필드에서 BOM 문자와 공백을 제거하고 nan 값을 처리합니다."""
    if pd.isna(id_str) or id_str is None:  # pandas의 nan 값과 None 체크
        return ""
    # BOM 문자 제거
    id_str = str(id_str).replace('\ufeff', '')
    return id_str.strip()

def safe_str(value):
    """안전하게 문자열로 변환하는 함수"""
    if pd.isna(value) or value is None:  # pandas의 nan 값과 None 체크
        return ""
    return str(value).strip()

def normalize_priority(priority_str):
    """Priority 값을 정규화하는 함수 (대소문자 구분 없이)"""
    if not priority_str:
        return "none"
    
    priority_str = priority_str.strip().lower()
    
    # 유효한 priority 값들
    valid_priorities = ["urgent", "high", "medium", "low", "none"]
    
    if priority_str in valid_priorities:
        return priority_str
    
    # 일반적인 변형들 처리
    priority_mapping = {
        "critical": "urgent",
        "높음": "high",
        "보통": "medium", 
        "낮음": "low",
        "없음": "none"
    }
    
    return priority_mapping.get(priority_str, "none")

def find_user_by_email(email, project):
    """이메일로 사용자를 안전하게 찾는 함수"""
    if not email or not email.strip():
        return None
    
    email = email.strip()
    
    try:
        # 1. 먼저 프로젝트 멤버에서 찾기
        member = project.project_projectmember.filter(
            member__email__iexact=email,
            is_active=True
        ).first()
        
        if member:
            return member.member
        
        # 2. 프로젝트 멤버가 아닌 경우 워크스페이스 멤버에서 찾기
        workspace_member = project.workspace.workspace_member.filter(
            member__email__iexact=email,
            is_active=True
        ).first()
        
        if workspace_member:
            # 워크스페이스 멤버이지만 프로젝트 멤버가 아닌 경우 로그 남기고 None 반환
            print(f"Warning: User {email} is workspace member but not project member. Skipping assignment.")
            return None
        
        # 3. 전체 사용자에서 찾기 (시스템에 존재하는지 확인)
        user = User.objects.filter(email__iexact=email).first()
        if user:
            print(f"Warning: User {email} exists but is not a member of this workspace/project. Skipping assignment.")
            return None
        
        # 4. 사용자가 존재하지 않는 경우
        print(f"Warning: User with email {email} not found in system. Skipping assignment.")
        return None
        
    except Exception as e:
        print(f"Error finding user by email {email}: {str(e)}")
        return None

def process_description(description_text):
    """
    description_text로부터 HTML과 JSON 형태의 description 생성
    """
    if not description_text or description_text.strip() == "":
        return {
            "description": dict(),  # 빈 JSON 객체
            "description_html": "<p></p>",  # 기본 빈 HTML
            "description_stripped": ""  # 빈 텍스트
        }
    
    # 간단한 HTML 생성 (텍스트가 있을 경우)
    html = f"<p>{description_text}</p>"
    
    # 간단한 JSON 객체 생성
    description_json = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": description_text
                    }
                ]
            }
        ]
    }
    
    return {
        "description": description_json,
        "description_html": html,
        "description_stripped": description_text.strip()
    }

def process_custom_field_value(field, value_str):
    """커스텀 필드 값을 필드 타입에 맞게 처리하는 함수"""
    if not value_str or value_str.strip() == "":
        return None
    
    value_str = value_str.strip()
    field_type = field.field_type
    
    try:
        if field_type == "text":
            # 텍스트 필드: 문자열 그대로 반환
            return value_str
            
        elif field_type == "select":
            # 선택 필드: 옵션 중 하나여야 함
            if value_str in field.options:
                return value_str
            else:
                print(f"Warning: Invalid option '{value_str}' for select field '{field.name}'. Skipping.")
                return None
                
        elif field_type == "multiselect":
            # 다중선택 필드: 쉼표로 구분된 값들을 리스트로 변환
            values = [v.strip() for v in value_str.split(",") if v.strip()]
            valid_values = [v for v in values if v in field.options]
            if valid_values:
                return valid_values
            else:
                print(f"Warning: No valid options found in '{value_str}' for multiselect field '{field.name}'. Skipping.")
                return None
                
        elif field_type == "date":
            # 날짜 필드: 날짜 형식으로 파싱
            parsed_date = parse_date(value_str)
            if parsed_date:
                return parsed_date.strftime("%Y-%m-%d")
            else:
                print(f"Warning: Invalid date format '{value_str}' for date field '{field.name}'. Skipping.")
                return None
                
        elif field_type == "project_member":
            # 프로젝트 멤버 필드: 이메일로 사용자 찾기
            user = find_user_by_email(value_str, field.project)
            if user:
                return str(user.id)
            else:
                print(f"Warning: User '{value_str}' not found for project member field '{field.name}'. Skipping.")
                return None
                
        elif field_type == "project_members":
            # 프로젝트 멤버(다중) 필드: 쉼표로 구분된 이메일들을 사용자 ID 리스트로 변환
            emails = [email.strip() for email in value_str.split(",") if email.strip()]
            user_ids = []
            for email in emails:
                user = find_user_by_email(email, field.project)
                if user:
                    user_ids.append(str(user.id))
                else:
                    print(f"Warning: User '{email}' not found for project members field '{field.name}'. Skipping this user.")
            
            if user_ids:
                return user_ids
            else:
                print(f"Warning: No valid users found in '{value_str}' for project members field '{field.name}'. Skipping.")
                return None
        else:
            # 기타 필드 타입은 문자열로 처리 (기존 text 타입 포함)
            return value_str
            
    except Exception as e:
        print(f"Error processing custom field value '{value_str}' for field '{field.name}': {str(e)}")
        return None

def process_custom_fields(row, project, creator_user):
    """행에서 커스텀 필드 값들을 처리하는 함수"""
    custom_field_values = []
    
    # 프로젝트의 모든 커스텀 필드 가져오기
    custom_fields = CustomField.objects.filter(
        project=project,
        deleted_at__isnull=True
    )
    
    # 각 커스텀 필드에 대해 값 확인
    for field in custom_fields:
        # 행에서 필드 이름으로 값 찾기
        field_value_str = safe_str(row.get(field.name, ""))
        
        if field_value_str:
            # 필드 타입에 맞게 값 처리
            processed_value = process_custom_field_value(field, field_value_str)
            
            if processed_value is not None:
                custom_field_values.append({
                    "custom_field_id": str(field.id),
                    "value": processed_value,
                    "field_name": field.name,
                    "field_type": field.field_type
                })
    
    return custom_field_values

@shared_task
def issue_import_task(workspace_id, project_id, file_content, file_type, user_id):
    try:
        with transaction.atomic():
            #print(f"Starting issue import for project {project_id}")
            
            # 파일 타입에 따라 데이터 읽기
            if file_type == 'csv':
                # 바이트를 문자열로 디코딩
                if isinstance(file_content, bytes):
                    try:
                        # UTF-8 with BOM으로 시도
                        file_content = file_content.decode('utf-8-sig')
                    except UnicodeDecodeError:
                        # 일반 UTF-8로 시도
                        file_content = file_content.decode('utf-8')
                
                df = pd.read_csv(io.StringIO(file_content))
                reader = df.to_dict('records')
            else:  # xlsx
                excel_file = io.BytesIO(file_content)
                df = pd.read_excel(excel_file)
                reader = df.to_dict('records')
            
            project = Project.objects.get(id=project_id)
            default_state = State.objects.filter(project=project, default=True).first()
            
            # 기존 이슈들을 한 번에 조회 (sequence_id로 검색)
            existing_issues = {}
            id_mapping = {}  # id_mapping 초기화
            
            # 엑셀 파일의 모든 ID 수집
            all_sequence_ids = set()
            for row in reader:
                issue_id = clean_id_field(row.get("ID", ""))
                if issue_id:
                    try:
                        sequence_id = int(issue_id.split('-')[1])
                        all_sequence_ids.add(sequence_id)
                    except (IndexError, ValueError):
                        #print(f"Warning: Invalid issue ID format: {issue_id}")
                        continue
                
                # 부모 이슈 ID도 수집
                parent_id = clean_id_field(row.get("Parent Issue", ""))
                if parent_id:
                    try:
                        parent_sequence_id = int(parent_id.split('-')[1])
                        all_sequence_ids.add(parent_sequence_id)
                    except (IndexError, ValueError):
                        #print(f"Warning: Invalid parent issue ID format: {parent_id}")
                        continue
            
            #print(f"Found {len(all_sequence_ids)} unique sequence IDs in the file")
            #print(f"Sequence IDs found: {list(all_sequence_ids)}")
            
            # 모든 관련 이슈 조회 (엑셀 파일의 ID와 부모 ID 모두 포함)
            for issue in Issue.objects.filter(
                sequence_id__in=list(all_sequence_ids),
                project=project
            ):
                existing_issues[issue.sequence_id] = issue
                id_mapping[issue.sequence_id] = issue
                #print(f"Found existing issue - ID: {issue.id}, Sequence ID: {issue.sequence_id}, Name: {issue.name}")
            
            #print(f"Found {len(existing_issues)} existing issues with matching IDs")
            
            parent_relations = []
            imported_count = 0
            updated_count = 0
            
            for row in reader:
                try:
                    # ID 필드에서 BOM 제거
                    issue_id = clean_id_field(row.get("ID", ""))
                    #print(f"Processing issue with ID: {issue_id}")
                    #print(f"Issue data from file: {row}")
                    
                    # sequence_id 추출 (ID가 없는 경우 자동 생성)
                    sequence_id = None
                    if issue_id:
                        try:
                            sequence_id = int(issue_id.split('-')[1])
                        except (IndexError, ValueError):
                            #print(f"Warning: Invalid issue ID format: {issue_id}")
                            continue
                    else:
                        # ID가 없는 경우, 현재 프로젝트의 최대 sequence_id + 1을 사용
                        max_sequence = Issue.objects.filter(project=project).aggregate(max_sequence=Max('sequence_id'))['max_sequence']
                        sequence_id = (max_sequence or 0) + 1
                        #print(f"Generated new sequence_id: {sequence_id}")
                    
                    #print(f"Looking for existing issue with sequence_id: {sequence_id}")
                    
                    # 날짜 필드 처리
                    start_date = parse_date(safe_str(row.get("Start Date")))
                    target_date = parse_date(safe_str(row.get("Target Date")))
                    
                    # 상태 처리
                    state = get_or_create_state(
                        project=project,
                        state_name=safe_str(row.get("State")),
                        default_state=default_state
                    )
                    
                    # 설명 필드 처리
                    description_text = safe_str(row.get("Description", ""))
                    description_data = process_description(description_text)
                    
                    # Creator 필드 처리 (이메일로)
                    creator_email = safe_str(row.get("Created By", ""))
                    creator_user = None
                    if creator_email:
                        creator_user = find_user_by_email(creator_email, project)
                        if not creator_user:
                            print(f"Warning: Created By email {creator_email} not found or not a project member. Using import user as creator.")
                    
                    # Creator가 없거나 찾을 수 없는 경우 import를 실행한 사용자를 사용
                    if not creator_user:
                        creator_user = User.objects.get(id=UUID(user_id))
                    
                    # 커스텀 필드 값 처리
                    custom_field_values = process_custom_fields(row, project, creator_user)
                    
                    # 기본 이슈 데이터 준비
                    issue_data = {
                        "name": safe_str(row.get("Name", "")),
                        "description": description_data["description"],
                        "description_html": description_data["description_html"],
                        "description_stripped": description_data["description_stripped"],
                        "priority": normalize_priority(safe_str(row.get("Priority", "none"))),
                        "state_id": state.id if state else default_state.id,
                        "sequence_id": sequence_id,
                        "start_date": start_date,
                        "target_date": target_date
                    }

                    # print("\n[Debug] 이슈 데이터 준비:")
                    # print(f"user_id: {user_id}")
                    # print(f"issue_data: {issue_data}")

                    # 이슈 ID가 있는 경우 기존 이슈 찾기
                    existing_issue = existing_issues.get(sequence_id)
                    
                    if existing_issue:
                        # print("\n[Debug] 기존 이슈 업데이트:")
                        # print(f"existing_issue.created_by_id before: {existing_issue.created_by_id}")
                        
                        # 기존 이슈의 현재 상태 저장 (활동 로그용)
                        current_instance = json.dumps(
                            IssueSerializer(existing_issue).data, 
                            cls=DjangoJSONEncoder
                        )
                        
                        # User 객체를 조회
                        user = User.objects.get(id=UUID(user_id))
                        
                        # created_by는 제외하고 업데이트
                        created_by = existing_issue.created_by  # 기존 created_by 저장
                        for key, value in issue_data.items():
                            # created_by_id와 description 관련 필드들은 업데이트하지 않음
                            if key not in ['created_by_id', 'description', 'description_html', 'description_stripped']:
                                setattr(existing_issue, key, value)
                        existing_issue.created_by = created_by  # 기존 created_by 복원
                        existing_issue.updated_by = user  # updated_by는 현재 사용자로 설정
                        existing_issue.save()
                        
                        # print(f"existing_issue.created_by_id after: {existing_issue.created_by_id}")
                        
                        issue = existing_issue
                        updated_count += 1
                        
                        # 관계 데이터만 삭제 후 재생성
                        IssueLabel.objects.filter(issue=issue).delete(soft=False)
                        IssueAssignee.objects.filter(issue=issue).delete(soft=False)
                        ModuleIssue.objects.filter(issue=issue).delete(soft=False)
                        CycleIssue.objects.filter(issue=issue).delete(soft=False)
                        # 커스텀 필드 값도 삭제 후 재생성 (hard delete 사용)
                        CustomFieldValue.objects.filter(issue=issue).delete(soft=False)
                    else:
                        # print("\n[Debug] 새 이슈 생성:")
                        # UUID 문자열을 UUID 객체로 변환
                        user_uuid = UUID(user_id)
                        workspace_uuid = UUID(workspace_id)
                        
                        # 현재 import를 실행한 사용자 (updated_by용)
                        import_user = User.objects.get(id=user_uuid)
                        
                        # Issue 모델을 직접 인스턴스화하는 대신 Django ORM을 통해 생성
                        issue_data.update({
                            "workspace_id": workspace_uuid,
                            "project": project,
                        })
                        
                        # 직접 모델 객체를 생성하고 저장
                        issue = Issue(**issue_data)
                        # 먼저 저장
                        issue.save()
                        
                        # 저장 후 created_by_id와 updated_by_id를 직접 데이터베이스에 설정
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "UPDATE issues SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                                [creator_user.id, import_user.id, issue.id]
                            )
                        
                        # 객체를 새로고침하여 데이터베이스 변경사항을 반영
                        issue.refresh_from_db()
                        
                        # print(f"Created issue.created_by_id: {issue.created_by_id}")
                        
                        current_instance = None
                        imported_count += 1
                    
                    id_mapping[sequence_id] = issue
                    
                    # 부모 이슈 관계 저장
                    parent_id = clean_id_field(row.get("Parent Issue", ""))
                    if parent_id:
                        try:
                            parent_sequence_id = int(parent_id.split('-')[1])
                            parent_relations.append((issue, parent_sequence_id))
                            #print(f"Added parent relation - Issue: {issue.name}, Parent ID: {parent_id}")
                        except (IndexError, ValueError):
                            #print(f"Warning: Invalid parent issue ID format: {parent_id}")
                            continue
                    
                    # 관련 데이터 처리 (라벨, 담당자, 모듈, 사이클)
                    process_related_data(issue, row, project, workspace_id, creator_user)
                    
                    # 커스텀 필드 값 처리
                    if custom_field_values:
                        process_custom_field_values(issue, custom_field_values, project, workspace_id, creator_user)
                    
                    # 이슈 활동 로그 생성
                    requested_data = json.dumps(row, cls=DjangoJSONEncoder)
                    issue_activity.delay(
                        type="issue.activity.imported" if not existing_issue else "issue.activity.updated",
                        requested_data=requested_data,
                        actor_id=str(user_id),
                        issue_id=str(issue.id),
                        project_id=str(project_id),
                        current_instance=current_instance,
                        epoch=int(timezone.now().timestamp()),
                        notification=True
                    )
                    
                except Exception as e:
                    #print(f"Error processing issue {sequence_id}: {str(e)}")
                    log_exception(e)
                    continue
            
            # 부모-자식 관계 설정
            for issue, parent_id in parent_relations:
                if parent_id in id_mapping:
                    parent_issue = id_mapping[parent_id]
                    issue.parent = parent_issue
                    issue.save()
                    #print(f"Set parent relationship - Issue: {issue.name}, Parent: {parent_issue.name}")
                else:
                    # 서버에서 부모 이슈 찾기
                    parent_issue = Issue.objects.filter(
                        sequence_id=parent_id,
                        project=project
                    ).first()
                    if parent_issue:
                        issue.parent = parent_issue
                        issue.save()
                        #print(f"Set parent relationship with existing issue - Issue: {issue.name}, Parent: {parent_issue.name}")
                    # else:
                        #print(f"Warning: Parent issue with sequence_id {parent_id} not found in server")
            
            #print(f"Import completed - Imported: {imported_count}, Updated: {updated_count}")

            return {
                "success": True,
                "imported_count": imported_count,
                "updated_count": updated_count
            }
            
    except Exception as e:
        #print(f"Import task failed: {str(e)}")
        log_exception(e)
        return {
            "success": False,
            "error": str(e)
        }

def process_related_data(issue, row, project, workspace_id, creator_user):
    # User 객체 조회
    created_by = issue.created_by or creator_user
    updated_by = issue.updated_by
    
    # updated_by가 None인 경우 creator_user 사용
    if updated_by is None:
        updated_by = creator_user
    
    # 모두 None인 경우 실행하지 않음
    if created_by is None and updated_by is None:
        print("Warning: No creator or updater found for issue relationships")
        return
    
    # 사용할 created_by_id와 updated_by_id 준비
    created_by_id = created_by.id if created_by else None
    updated_by_id = updated_by.id if updated_by else None
    
    # 라벨 처리
    if not pd.isna(row.get("Labels")):
        for label_name in str(row["Labels"]).split(","):
            label_name = label_name.strip()
            if label_name:
                label = Label.objects.filter(project=project, name=label_name).first()
                if label:
                    # 객체 생성
                    label_relation = IssueLabel.objects.create(
                        issue=issue, 
                        label=label,
                        project_id=project.id,
                        workspace_id=workspace_id,
                    )
                    
                    # 직접 SQL로 created_by_id와 updated_by_id 설정
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "UPDATE issue_labels SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                            [created_by_id, updated_by_id, label_relation.id]
                        )
    
    # 담당자 처리 - 이메일로 검색하도록 변경
    if not pd.isna(row.get("Assignee")):
        for assignee_email in str(row["Assignee"]).split(","):
            assignee_email = assignee_email.strip()
            if assignee_email:
                # 이메일로 사용자 검색
                member = find_user_by_email(assignee_email, project)
                
                if member:
                    # 객체 생성
                    assignee_relation = IssueAssignee.objects.create(
                        issue=issue,
                        assignee=member,
                        project_id=project.id,
                        workspace_id=workspace_id,
                    )
                    
                    # 직접 SQL로 created_by_id와 updated_by_id 설정
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "UPDATE issue_assignees SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                            [created_by_id, updated_by_id, assignee_relation.id]
                        )
    
    # 모듈 처리
    module_name = safe_str(row.get("Module Name"))
    if module_name:
        module = Module.objects.filter(project=project, name=module_name).first()  # Module 모델을 직접 사용
        if module:
            # 객체 생성
            module_relation = ModuleIssue.objects.create(
                issue=issue, 
                module=module,
                project_id=project.id,
                workspace_id=workspace_id,
            )
            
            # 직접 SQL로 created_by_id와 updated_by_id 설정
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE module_issues SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                    [created_by_id, updated_by_id, module_relation.id]
                )
    
    # 사이클 처리
    cycle_name = safe_str(row.get("Cycle Name"))
    if cycle_name:
        cycle = Cycle.objects.filter(project=project, name=cycle_name).first()
        if cycle:
            # 객체 생성
            cycle_relation = CycleIssue.objects.create(
                issue=issue, 
                cycle=cycle,
                project_id=project.id,
                workspace_id=workspace_id,
            )
            
            # 직접 SQL로 created_by_id와 updated_by_id 설정
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE cycle_issues SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                    [created_by_id, updated_by_id, cycle_relation.id]
                )

def process_custom_field_values(issue, custom_field_values, project, workspace_id, creator_user):
    """커스텀 필드 값들을 데이터베이스에 저장하는 함수"""
    # 사용할 created_by_id와 updated_by_id 준비
    created_by_id = creator_user.id if creator_user else None
    updated_by_id = creator_user.id if creator_user else None
    
    for cfv_data in custom_field_values:
        try:
            # CustomFieldValue 객체 생성
            custom_field_value = CustomFieldValue.objects.create(
                custom_field_id=cfv_data["custom_field_id"],
                issue=issue,
                value=cfv_data["value"],
                project_id=project.id,
                workspace_id=workspace_id,
            )
            
            # 직접 SQL로 created_by_id와 updated_by_id 설정
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE custom_field_values SET created_by_id = %s, updated_by_id = %s WHERE id = %s",
                    [created_by_id, updated_by_id, custom_field_value.id]
                )
                
        except Exception as e:
            print(f"Error saving custom field value for field {cfv_data.get('field_name', 'unknown')}: {str(e)}")
            continue
