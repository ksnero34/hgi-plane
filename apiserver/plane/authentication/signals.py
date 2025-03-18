# Django imports
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction

# Module imports
from plane.db.models import User, DefaultWorkspaceConfig, WorkspaceMember

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
                    WorkspaceMember.objects.create(
                        workspace=config.workspace,
                        member=instance,
                        role=config.role,
                        created_by=instance,
                        updated_by=instance,
                        is_active=True
                    )
                    print(f"사용자 {instance.email}가 워크스페이스 {config.workspace.name}에 자동으로 추가되었습니다.")
