# Django imports
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction

# Module imports
from plane.db.models import User, DefaultWorkspaceConfig, WorkspaceMember
from plane.utils.audit_logger import log_audit

@receiver(post_save, sender=User)
def add_user_to_default_workspaces(sender, instance, created, **kwargs):
    """사용자 생성 시 모든 기본 워크스페이스에 자동 추가"""
    if created:  # 새로운 사용자인 경우에만 실행
        from plane.db.models import DefaultWorkspaceConfig
        
        # 활성화된 모든 기본 워크스페이스 설정 가져오기
        default_configs = DefaultWorkspaceConfig.objects.filter(is_active=True)
        
        with transaction.atomic():
            for config in default_configs:
                # 이미 멤버인지 확인
                if not WorkspaceMember.objects.filter(
                    workspace=config.workspace, 
                    member=instance
                ).exists():
                    # 워크스페이스 멤버로 추가
                    workspace_member = WorkspaceMember.objects.create(
                        workspace=config.workspace,
                        member=instance,
                        role=config.role,
                        created_by=instance,
                        updated_by=instance,
                        is_active=True
                    )
                    
                    # 감사 로그 추가
                    log_audit(
                        action="auto_add_workspace_member",
                        user_id=str(instance.id),
                        user_email=instance.email,
                        resource_type="workspace",
                        resource_id=str(config.workspace_id),
                        details={
                            "member_id": str(instance.id),
                            "member_email": instance.email,
                            "role": config.role,
                        },
                        ip_address=None,  # 자동 추가이므로 IP 주소 없음
                    )
                    
                    print(f"사용자 {instance.email}가 워크스페이스 {config.workspace.name}에 자동으로 추가되었습니다.")
