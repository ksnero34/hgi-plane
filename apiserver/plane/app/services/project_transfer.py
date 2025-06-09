from django.db import transaction
from django.db.models import Q
from django.utils import timezone

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
    IssueSequence,
    IssueVersion,
    IssueDescriptionVersion,
    CustomField,
    CustomFieldValue,
)


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
        
        # 프로젝트 워크스페이스 업데이트
        old_workspace = project.workspace
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
            from plane.db.models import WorkspaceMember
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
        
        # 페이지 업데이트 (프로젝트 페이지만) - 디렉토리 구조 고려
        project_pages = ProjectPage.objects.filter(project=project).select_related('page')
        
        # 페이지들을 parent 관계에 따라 정렬 (부모 먼저, 자식 나중에)
        pages_to_process = []
        for pp in project_pages:
            pages_to_process.append(pp)
        
        # 부모-자식 관계를 고려한 정렬 함수
        def sort_pages_by_hierarchy(pages):
            """부모 페이지가 먼저 오도록 정렬"""
            sorted_pages = []
            processed_ids = set()
            
            def add_page_and_children(page_project_page):
                if page_project_page.page.id in processed_ids:
                    return
                
                # 부모가 있고 아직 처리되지 않았다면 부모부터 처리
                if page_project_page.page.parent and page_project_page.page.parent.id not in processed_ids:
                    # 같은 프로젝트 내에서 부모 찾기
                    parent_pp = next((pp for pp in pages if pp.page.id == page_project_page.page.parent.id), None)
                    if parent_pp:
                        add_page_and_children(parent_pp)
                
                # 현재 페이지 추가
                if page_project_page.page.id not in processed_ids:
                    sorted_pages.append(page_project_page)
                    processed_ids.add(page_project_page.page.id)
            
            # 모든 페이지 처리
            for pp in pages:
                add_page_and_children(pp)
            
            return sorted_pages
        
        # 계층 구조에 따라 정렬
        sorted_project_pages = sort_pages_by_hierarchy(pages_to_process)
        
        # 페이지 ID 매핑 (이동 후 parent 관계 업데이트용)
        page_id_mapping = {}
        
        for pp in sorted_project_pages:
            # ProjectPage 워크스페이스 업데이트
            pp.workspace = target_workspace
            pp.save()
            
            page = pp.page
            
            # 이름 중복 확인 및 처리
            existing_page = Page.objects.filter(
                ~Q(id=page.id), 
                workspace=target_workspace, 
                name=page.name, 
                deleted_at__isnull=True
            ).first()
            
            if not existing_page:
                # 페이지 워크스페이스 업데이트
                page.workspace = target_workspace
                
                # parent 관계 업데이트 - 같은 프로젝트 내의 페이지만 참조하도록
                if page.parent:
                    # 부모 페이지가 같은 프로젝트에 속하는지 확인
                    parent_in_same_project = ProjectPage.objects.filter(
                        project=project, 
                        page=page.parent,
                        deleted_at__isnull=True
                    ).exists()
                    
                    if not parent_in_same_project:
                        # 부모가 같은 프로젝트에 없으면 루트로 이동
                        page.parent = None
                
                page.save()
                page_id_mapping[page.id] = page.id
            else:
                # 이름이 중복되는 경우 처리 (필요시 이름 변경 등)
                # 현재는 기존 페이지를 유지하고 새 페이지는 스킵
                pass
        
        # 이슈 뷰 업데이트
        issue_views = IssueView.objects.filter(project=project)
        for view in issue_views:
            view.workspace = target_workspace
            view.save()
        
        # IssueSequence 업데이트
        IssueSequence.objects.filter(project=project).update(workspace=target_workspace)
        
        # 이슈 버전 이력 업데이트
        IssueVersion.objects.filter(project=project).update(workspace=target_workspace)
        
        # 이슈 설명 버전 이력 업데이트
        IssueDescriptionVersion.objects.filter(project=project).update(workspace=target_workspace)
        
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
        
        # 커스텀 필드 업데이트
        custom_fields = CustomField.objects.filter(project=project)
        for custom_field in custom_fields:
            custom_field.workspace = target_workspace
            custom_field.save()
            
            # 커스텀 필드 값 업데이트
            CustomFieldValue.objects.filter(custom_field=custom_field).update(workspace=target_workspace)
        
        # 이동이 완료되었습니다.
        return {
            "success": True, 
            "project": project,
            "source_workspace": old_workspace,
            "target_workspace": target_workspace
        } 