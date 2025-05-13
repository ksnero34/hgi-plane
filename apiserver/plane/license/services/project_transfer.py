from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.conf import settings

from plane.db.models import (
    Project,
    ProjectMember,
    ProjectIdentifier,
    Issue,
    IssueActivity,
    State,
    IssueComment,
    Page,
    ProjectPage,
    Label,
    Cycle,
    Module,
    ModuleIssue,
    CycleIssue,
    IssueLabel,
    IssueSubscriber,
    IssueAttachment,
    IssueLink,
    IssueAssignee,
    Estimate,
    EstimatePoint,
    IssueView,
    WorkspaceMember,
    FileAsset,
)

from plane.utils.audit_logger import log_audit
from plane.utils.storage_client import StorageClient


class ProjectTransferService:
    """프로젝트를 다른 워크스페이스로 이동하는 서비스 - 인스턴스 관리자 전용"""

    @staticmethod
    def validate_transfer(project, target_workspace):
        """이동 가능 여부 검증"""
        # 동일한 워크스페이스인 경우
        if project.workspace_id == target_workspace.id:
            return False, "프로젝트가 이미 해당 워크스페이스에 있습니다."

        # 이름 중복 확인
        if Project.objects.filter(
            workspace=target_workspace, name=project.name, deleted_at__isnull=True
        ).exists():
            return False, "대상 워크스페이스에 동일한 이름의 프로젝트가 존재합니다."

        # 식별자 중복 확인
        if Project.objects.filter(
            workspace=target_workspace, identifier=project.identifier, deleted_at__isnull=True
        ).exists():
            return False, "대상 워크스페이스에 동일한 식별자의 프로젝트가 존재합니다."

        return True, ""

    @staticmethod
    def _move_storage_files(old_workspace_slug, new_workspace_slug, project_id):
        """스토리지의 파일들을 새 경로로 이동"""
        storage_client = StorageClient()
        
        # 프로젝트 관련 파일들의 기본 경로
        old_base_path = f"workspaces/{old_workspace_slug}/projects/{project_id}/"
        new_base_path = f"workspaces/{new_workspace_slug}/projects/{project_id}/"
        
        # 스토리지의 모든 파일 목록 조회
        files = storage_client.list_files(old_base_path)
        
        for file_path in files:
            # 새로운 경로 생성
            new_file_path = file_path.replace(old_base_path, new_base_path)
            
            # 파일 복사
            storage_client.copy_file(file_path, new_file_path)
            # 원본 파일 삭제
            storage_client.delete_file(file_path)

    @staticmethod
    def _update_file_paths(project, old_workspace, new_workspace):
        """DB에 저장된 파일 경로 정보 업데이트"""
        # FileAsset 모델의 경로 업데이트
        FileAsset.objects.filter(project=project).update(
            workspace=new_workspace
        )
        
        # 이슈 본문의 파일 경로 업데이트
        issues = Issue.objects.filter(project=project)
        for issue in issues:
            if issue.description:
                # 본문의 파일 경로 업데이트
                old_path = f"/api/assets/v2/workspaces/{old_workspace.slug}/projects/{project.id}/"
                new_path = f"/api/assets/v2/workspaces/{new_workspace.slug}/projects/{project.id}/"
                issue.description = issue.description.replace(old_path, new_path)
                issue.save()
            
            # 이슈 코멘트의 파일 경로 업데이트
            comments = IssueComment.objects.filter(issue=issue)
            for comment in comments:
                if comment.comment_html:
                    old_path = f"/api/assets/v2/workspaces/{old_workspace.slug}/projects/{project.id}/"
                    new_path = f"/api/assets/v2/workspaces/{new_workspace.slug}/projects/{project.id}/"
                    comment.comment_html = comment.comment_html.replace(old_path, new_path)
                    comment.save()
            
            # 이슈 첨부파일 경로 업데이트
            attachments = IssueAttachment.objects.filter(issue=issue)
            for attachment in attachments:
                if attachment.asset_url:
                    old_path = f"/api/assets/v2/workspaces/{old_workspace.slug}/projects/{project.id}/issues/{issue.id}/attachments/"
                    new_path = f"/api/assets/v2/workspaces/{new_workspace.slug}/projects/{project.id}/issues/{issue.id}/attachments/"
                    attachment.asset_url = attachment.asset_url.replace(old_path, new_path)
                    attachment.save()

    @staticmethod
    @transaction.atomic
    def transfer_project(project_id, source_workspace_id, target_workspace_id, admin_user):
        """프로젝트를 소스 워크스페이스에서 대상 워크스페이스로 이동 - 인스턴스 관리자 전용"""
        # 프로젝트 및 워크스페이스 조회
        from plane.db.models import Workspace
        
        project = Project.objects.get(id=project_id, workspace_id=source_workspace_id)
        target_workspace = Workspace.objects.get(id=target_workspace_id)
        
        # 이동 가능 여부 검증
        is_valid, error = ProjectTransferService.validate_transfer(project, target_workspace)
        if not is_valid:
            return {"success": False, "error": error}
        
        old_workspace = project.workspace
        
        try:
            # 스토리지의 파일들을 새 경로로 이동
            ProjectTransferService._move_storage_files(
                old_workspace_slug=old_workspace.slug,
                new_workspace_slug=target_workspace.slug,
                project_id=str(project.id)
            )
            
            # DB의 파일 경로 정보 업데이트
            ProjectTransferService._update_file_paths(
                project=project,
                old_workspace=old_workspace,
                new_workspace=target_workspace
            )
            
            # 기존 프로젝트 이동 로직
            project.workspace = target_workspace
            project.updated_by = admin_user
            project.save()
            
            # 프로젝트 식별자 업데이트
            try:
                project_identifier = ProjectIdentifier.objects.get(project=project)
                project_identifier.workspace = target_workspace
                project_identifier.save()
            except ProjectIdentifier.DoesNotExist:
                # 식별자가 없으면 생성
                ProjectIdentifier.objects.create(
                    workspace=target_workspace,
                    project=project,
                    name=project.identifier,
                    created_by=admin_user,
                    updated_by=admin_user,
                )
            
            # Estimate 및 EstimatePoint 업데이트
            estimates = Estimate.objects.filter(project=project)
            for estimate in estimates:
                estimate.workspace = target_workspace
                estimate.save()
                
                # 추정 포인트 업데이트
                EstimatePoint.objects.filter(estimate=estimate).update(workspace=target_workspace)
            
            # 관련 레이블 이동 (워크스페이스 레벨 레이블이면 프로젝트 레벨로 변환)
            labels = Label.objects.filter(
                Q(project=project) | Q(project__isnull=True, workspace=old_workspace)
            )
            for label in labels:
                # 먼저 이 레이블을 사용하는 이슈 레이블 관계를 가져옴
                issue_labels = IssueLabel.objects.filter(
                    issue__project=project, label=label
                )
                
                if label.project is None:  # 워크스페이스 레벨 레이블인 경우
                    # 대상 워크스페이스에 동일한 이름의 레이블이 있는지 확인
                    existing_label = Label.objects.filter(
                        workspace=target_workspace, 
                        project__isnull=True, 
                        name=label.name,
                        deleted_at__isnull=True
                    ).first()
                    
                    if existing_label:
                        # 이슈에 연결된 레이블 업데이트
                        issue_labels.update(
                            label=existing_label,
                            workspace=target_workspace
                        )
                    else:
                        # 새 레이블 생성 (프로젝트 레벨로)
                        new_label = Label.objects.create(
                            name=label.name,
                            description=label.description,
                            color=label.color,
                            workspace=target_workspace,
                            project=project,
                            created_by=admin_user,
                            updated_by=admin_user,
                        )
                        
                        # 이슈에 연결된 레이블 업데이트
                        issue_labels.update(
                            label=new_label,
                            workspace=target_workspace
                        )
                else:
                    # 프로젝트 레이블인 경우 워크스페이스만 업데이트
                    label.workspace = target_workspace
                    label.save()
                    
                    # 이슈 레이블 관계 업데이트
                    issue_labels.update(workspace=target_workspace)
            
            # 프로젝트 멤버 업데이트
            project_members = ProjectMember.objects.filter(project=project)
            for member in project_members:
                # 대상 워크스페이스에 해당 멤버가 있는지 확인
                ws_member = WorkspaceMember.objects.filter(
                    workspace=target_workspace, 
                    member=member.member,
                    deleted_at__isnull=True
                ).first()
                
                # 워크스페이스 멤버가 없으면 기존 역할로 추가
                if not ws_member and member.member:
                    WorkspaceMember.objects.create(
                        workspace=target_workspace,
                        member=member.member,
                        role=member.role,  # 프로젝트의 역할을 워크스페이스 역할로 사용
                        created_by=admin_user,
                        updated_by=admin_user,
                    )
                
                # 프로젝트 멤버의 워크스페이스 업데이트
                member.workspace = target_workspace
                member.save()
            
            # 상태 업데이트
            State.objects.filter(project=project).update(workspace=target_workspace)
            
            # 사이클 및 사이클 이슈 업데이트
            cycles = Cycle.objects.filter(project=project)
            for cycle in cycles:
                cycle.workspace = target_workspace
                cycle.save()
                
                # 사이클 이슈 업데이트
                CycleIssue.objects.filter(cycle=cycle).update(workspace=target_workspace)
            
            # 모듈 및 모듈 이슈 업데이트
            modules = Module.objects.filter(project=project)
            for module in modules:
                module.workspace = target_workspace
                module.save()
                
                # 모듈 이슈 업데이트
                ModuleIssue.objects.filter(module=module).update(workspace=target_workspace)
            
            # 페이지 업데이트 (프로젝트 페이지만)
            project_pages = ProjectPage.objects.filter(project=project)
            for pp in project_pages:
                pp.workspace = target_workspace
                pp.save()
                
                page = pp.page
                # 프로젝트 페이지의 워크스페이스도 업데이트
                if not Page.objects.filter(
                    ~Q(id=page.id), workspace=target_workspace, name=page.name, deleted_at__isnull=True
                ).exists():
                    page.workspace = target_workspace
                    page.save()
            
            # 이슈 뷰 업데이트
            issue_views = IssueView.objects.filter(project=project)
            for view in issue_views:
                view.workspace = target_workspace
                view.save()
            
            # 이슈와 관련 데이터 업데이트 (마지막에 처리하여 관련 엔티티가 모두 업데이트된 후 진행)
            issues = Issue.objects.filter(project=project)
            for issue in issues:
                issue.workspace = target_workspace
                issue.save()
                
                # 이슈 코멘트 업데이트
                IssueComment.objects.filter(issue=issue).update(workspace=target_workspace)
                
                # 이슈 활동 업데이트
                IssueActivity.objects.filter(issue=issue).update(workspace=target_workspace)
                
                # 이슈 구독자 업데이트
                IssueSubscriber.objects.filter(issue=issue).update(workspace=target_workspace)
                
                # 이슈 첨부파일 업데이트
                IssueAttachment.objects.filter(issue=issue).update(workspace=target_workspace)
                
                # 이슈 링크 업데이트
                IssueLink.objects.filter(issue=issue).update(workspace=target_workspace)
                
                # 이슈 담당자 업데이트
                IssueAssignee.objects.filter(issue=issue).update(workspace=target_workspace)
            
        except Exception as e:
            # 오류 발생 시 롤백은 transaction.atomic에 의해 자동으로 처리됨
            return {"success": False, "error": f"파일 이동 중 오류가 발생했습니다: {str(e)}"}
        
        # 감사 로그 기록
        log_audit(
            action="project_transfer",
            user_id=str(admin_user.id),
            user_email=admin_user.email,
            resource_type="project",
            resource_id=str(project.id),
            details={
                "project_id": str(project.id),
                "project_name": project.name,
                "source_workspace_id": str(old_workspace.id),
                "source_workspace_name": old_workspace.name,
                "target_workspace_id": str(target_workspace.id),
                "target_workspace_name": target_workspace.name,
            }
        )
        
        # 이동이 완료되었습니다.
        return {
            "success": True, 
            "project": project,
            "source_workspace": old_workspace,
            "target_workspace": target_workspace
        } 