from .workspace_project_join import process_workspace_project_invitations
from plane.db.models import User

def post_user_auth_workflow(user, is_signup, request):
    process_workspace_project_invitations(user=user)
    
    # 새 사용자만 기본 워크스페이스에 추가 (필요시 신규 코드 추가)
    if is_signup:
        from plane.authentication.signals import add_user_to_default_workspaces
        add_user_to_default_workspaces(sender=User, instance=user, created=True)
