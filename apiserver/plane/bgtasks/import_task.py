import csv
import io
import json
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from plane.db.models import (
    Issue, State, Project, Label, 
    IssueAssignee, IssueLabel, CycleIssue, ModuleIssue,
    IssueActivity
)
from plane.utils.exception_logger import log_exception
from plane.app.serializers import IssueSerializer

@shared_task
def issue_import_task(workspace_id, project_id, file_content, user_id):
    try:
        with transaction.atomic():
            csv_file = io.StringIO(file_content)
            reader = csv.DictReader(csv_file)
            
            project = Project.objects.get(id=project_id)
            default_state = State.objects.filter(project=project, default=True).first()
            
            id_mapping = {}
            parent_relations = []
            
            for row in reader:
                try:
                    issue_id = row.get("ID", "").strip()  # format: PROJECT-123
                    
                    # 기본 이슈 데이터 준비
                    issue_data = {
                        "name": row["Name"],
                        "description_stripped": row.get("Description", ""),
                        "priority": row.get("Priority", "none"),
                        "start_date": parse_date(row.get("Start Date")),
                        "target_date": parse_date(row.get("Target Date")),
                        "state": get_or_create_state(project, row.get("State"), default_state),
                        "updated_by_id": user_id
                    }
                    
                    # 이슈 ID가 있는 경우 기존 이슈 찾기
                    existing_issue = None
                    if issue_id:
                        try:
                            project_identifier, sequence_id = issue_id.split("-")
                            if project_identifier == project.identifier:
                                existing_issue = Issue.objects.filter(
                                    project=project,
                                    sequence_id=int(sequence_id)
                                ).first()
                        except ValueError:
                            pass
                    
                    if existing_issue:
                        # 기존 이슈의 현재 상태 저장 (활동 로그용)
                        current_instance = IssueSerializer(existing_issue).data
                        
                        # 기본 필드만 업데이트
                        for key, value in issue_data.items():
                            setattr(existing_issue, key, value)
                        existing_issue.save()
                        issue = existing_issue
                        
                        # 관계 데이터만 삭제 후 재생성
                        # 댓글, 첨부파일 등은 유지
                        IssueLabel.objects.filter(issue=issue).delete()
                        IssueAssignee.objects.filter(issue=issue).delete()
                        ModuleIssue.objects.filter(issue=issue).delete()
                        CycleIssue.objects.filter(issue=issue).delete()
                        
                    else:
                        # 새 이슈 생성
                        issue_data.update({
                            "workspace_id": workspace_id,
                            "project": project,
                            "created_by_id": user_id
                        })
                        issue = Issue.objects.create(**issue_data)
                        current_instance = None
                    
                    id_mapping[issue_id or str(issue.id)] = issue
                    
                    # 부모 이슈 관계 저장
                    if row.get("Parent Issue"):
                        parent_relations.append((issue, row["Parent Issue"]))
                    
                    # 관련 데이터 처리 (라벨, 담당자, 모듈, 사이클)
                    process_related_data(issue, row, project)
                    
                    # 이슈 활동 로그 생성
                    issue_activity.delay(
                        type="issue.activity.imported" if not existing_issue else "issue.activity.updated",
                        requested_data=json.dumps(row),
                        actor_id=str(user_id),
                        issue_id=str(issue.id),
                        project_id=str(project_id),
                        current_instance=json.dumps(current_instance) if current_instance else None,
                        epoch=int(timezone.now().timestamp()),
                        notification=True
                    )
                    
                except Exception as e:
                    log_exception(e)
                    continue
            
            # 2단계: 부모-자식 관계 설정
            for issue, parent_id in parent_relations:
                if parent_id in id_mapping:
                    issue.parent = id_mapping[parent_id]
                    issue.save()
            
            return {
                "success": True,
                "imported_count": len(id_mapping),
                "updated_count": sum(1 for issue in id_mapping.values() if issue.created_at != issue.updated_at)
            }
            
    except Exception as e:
        log_exception(e)
        return {
            "success": False,
            "error": str(e)
        }

def process_related_data(issue, row, project):
    # 라벨 처리
    if row.get("Labels"):
        for label_name in row["Labels"].split(","):
            label_name = label_name.strip()
            if label_name:
                label = Label.objects.filter(project=project, name=label_name).first()
                if label:
                    IssueLabel.objects.create(issue=issue, label=label)
    
    # 담당자 처리
    if row.get("Assignee"):
        for assignee_name in row["Assignee"].split(","):
            assignee_name = assignee_name.strip()
            if assignee_name:
                first_name = assignee_name.split()[0]
                member = project.project_projectmember.filter(
                    member__first_name__icontains=first_name,
                    is_active=True
                ).first()
                if member:
                    IssueAssignee.objects.create(
                        issue=issue,
                        assignee=member.member
                    )
    
    # 모듈 처리
    if row.get("Module Name"):
        module = project.modules.filter(name=row["Module Name"]).first()
        if module:
            ModuleIssue.objects.create(issue=issue, module=module)
    
    # 사이클 처리
    if row.get("Cycle Name"):
        cycle = project.cycles.filter(name=row["Cycle Name"]).first()
        if cycle:
            CycleIssue.objects.create(issue=issue, cycle=cycle)

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return timezone.datetime.strptime(date_str.strip(), "%a, %d %b %Y").date()
    except:
        return None

def get_or_create_state(project, state_name, default_state):
    if not state_name:
        return default_state
    
    state = State.objects.filter(project=project, name=state_name).first()
    return state if state else default_state
