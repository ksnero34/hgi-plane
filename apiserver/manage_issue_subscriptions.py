#!/usr/bin/env python3
"""
이슈 구독 관리 스크립트
특정 사용자가 특정 프로젝트에서 구독하고 있는 이슈들을 확인하고 관리하는 도구

사용법:
    python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action list
    python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action remove-all
    python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action remove-selected --issue-ids id1,id2,id3
"""

import os
import sys
import argparse
import django
from datetime import datetime
from typing import List, Optional

# Django 설정
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "plane.settings.production")
django.setup()

from django.db import transaction
from django.db.models import Q
from plane.db.models import (
    User, 
    Project, 
    Issue, 
    IssueSubscriber, 
    Workspace,
    State
)


class IssueSubscriptionManager:
    """이슈 구독 관리 클래스"""
    
    def __init__(self):
        self.user = None
        self.project = None
        self.workspace = None
        
    def setup(self, workspace_slug: str, project_identifier: str, user_email: str):
        """사용자, 프로젝트, 워크스페이스 정보 설정"""
        try:
            # 워크스페이스 찾기
            self.workspace = Workspace.objects.get(slug=workspace_slug, deleted_at__isnull=True)
            print(f"✓ 워크스페이스 발견: {self.workspace.name} ({workspace_slug})")
            
            # 프로젝트 찾기
            self.project = Project.objects.get(
                identifier=project_identifier, 
                workspace=self.workspace,
                deleted_at__isnull=True
            )
            print(f"✓ 프로젝트 발견: {self.project.name} ({project_identifier})")
            
            # 사용자 찾기
            self.user = User.objects.get(email=user_email, is_active=True)
            print(f"✓ 사용자 발견: {self.user.display_name} ({user_email})")
            
            return True
            
        except Workspace.DoesNotExist:
            print(f"❌ 오류: 워크스페이스 '{workspace_slug}'를 찾을 수 없습니다.")
            return False
        except Project.DoesNotExist:
            print(f"❌ 오류: 프로젝트 '{project_identifier}'를 워크스페이스 '{workspace_slug}'에서 찾을 수 없습니다.")
            return False
        except User.DoesNotExist:
            print(f"❌ 오류: 사용자 '{user_email}'를 찾을 수 없습니다.")
            return False
        except Exception as e:
            print(f"❌ 설정 중 오류 발생: {str(e)}")
            return False
    
    def get_subscribed_issues(self) -> List[dict]:
        """구독 중인 이슈 목록 가져오기"""
        if not all([self.user, self.project, self.workspace]):
            print("❌ 오류: 설정이 완료되지 않았습니다.")
            return []
        
        try:
            # 구독 정보와 이슈 정보를 함께 가져오기
            subscriptions = IssueSubscriber.objects.filter(
                subscriber=self.user,
                project=self.project,
                workspace=self.workspace,
                deleted_at__isnull=True
            ).select_related('issue', 'issue__state', 'issue__created_by').order_by('-created_at')
            
            issues = []
            for subscription in subscriptions:
                if subscription.issue and subscription.issue.deleted_at is None:
                    issues.append({
                        'subscription_id': str(subscription.id),
                        'issue_id': str(subscription.issue.id),
                        'issue_name': subscription.issue.name,
                        'issue_identifier': f"{self.project.identifier}-{subscription.issue.sequence_id}",
                        'issue_state': subscription.issue.state.name if subscription.issue.state else "상태 없음",
                        'issue_state_group': subscription.issue.state.group if subscription.issue.state else "unknown",
                        'issue_priority': subscription.issue.priority,
                        'issue_created_by': subscription.issue.created_by.display_name if subscription.issue.created_by else "알 수 없음",
                        'issue_created_at': subscription.issue.created_at,
                        'subscribed_at': subscription.created_at
                    })
            
            return issues
            
        except Exception as e:
            print(f"❌ 구독 이슈 조회 중 오류 발생: {str(e)}")
            return []
    
    def list_subscriptions(self):
        """구독 목록 출력"""
        print(f"\n📋 {self.user.display_name}님이 프로젝트 '{self.project.name}'에서 구독 중인 이슈 목록:")
        print("=" * 100)
        
        issues = self.get_subscribed_issues()
        
        if not issues:
            print("구독 중인 이슈가 없습니다.")
            return
        
        print(f"총 {len(issues)}개의 이슈를 구독 중입니다.\n")
        
        # 상태별로 그룹화
        state_groups = {}
        for issue in issues:
            group = issue['issue_state_group']
            if group not in state_groups:
                state_groups[group] = []
            state_groups[group].append(issue)
        
        # 상태 그룹별 출력
        group_names = {
            'backlog': '📝 백로그',
            'unstarted': '⏸️ 시작 전',
            'started': '🚀 진행 중',
            'completed': '✅ 완료',
            'cancelled': '❌ 취소됨',
            'triage': '🔍 분류',
            'unknown': '❓ 알 수 없음'
        }
        
        for group, group_issues in state_groups.items():
            group_name = group_names.get(group, f"📌 {group}")
            print(f"\n{group_name} ({len(group_issues)}개)")
            print("-" * 80)
            
            for issue in group_issues:
                priority_icon = self._get_priority_icon(issue['issue_priority'])
                print(f"{priority_icon} {issue['issue_identifier']} | {issue['issue_name']}")
                print(f"   상태: {issue['issue_state']} | 생성자: {issue['issue_created_by']}")
                print(f"   구독일: {issue['subscribed_at'].strftime('%Y-%m-%d %H:%M')}")
                print(f"   이슈 ID: {issue['issue_id']}")
                print()
    
    def _get_priority_icon(self, priority: str) -> str:
        """우선순위 아이콘 반환"""
        priority_icons = {
            'urgent': '🔴',
            'high': '🟠', 
            'medium': '🟡',
            'low': '🟢',
            'none': '⚪'
        }
        return priority_icons.get(priority, '⚪')
    
    def remove_all_subscriptions(self, dry_run: bool = False):
        """모든 구독 제거"""
        issues = self.get_subscribed_issues()
        
        if not issues:
            print("제거할 구독이 없습니다.")
            return
        
        print(f"\n🗑️ {len(issues)}개의 이슈 구독을 {'시뮬레이션' if dry_run else '실제로'} 제거합니다:")
        
        if dry_run:
            print("\n[DRY RUN 모드] 실제로는 제거되지 않습니다.")
        
        for issue in issues:
            print(f"- {issue['issue_identifier']} | {issue['issue_name']}")
        
        if not dry_run:
            # 확인 요청
            confirm = input(f"\n정말로 {len(issues)}개의 구독을 모두 제거하시겠습니까? (yes/no): ")
            if confirm.lower() not in ['yes', 'y', '예']:
                print("취소되었습니다.")
                return
            
            try:
                with transaction.atomic():
                    # soft delete 방식으로 제거
                    deleted_count = IssueSubscriber.objects.filter(
                        subscriber=self.user,
                        project=self.project,
                        workspace=self.workspace,
                        deleted_at__isnull=True
                    ).update(deleted_at=datetime.now())
                    
                    print(f"✅ {deleted_count}개의 구독이 성공적으로 제거되었습니다.")
                    
            except Exception as e:
                print(f"❌ 구독 제거 중 오류 발생: {str(e)}")
        else:
            print("\n[DRY RUN 완료] 위의 구독들이 제거될 예정입니다.")
    
    def remove_selected_subscriptions(self, issue_ids: List[str], dry_run: bool = False):
        """선택된 이슈들의 구독 제거"""
        if not issue_ids:
            print("제거할 이슈 ID가 지정되지 않았습니다.")
            return
        
        # 유효한 구독 찾기
        valid_subscriptions = IssueSubscriber.objects.filter(
            subscriber=self.user,
            project=self.project,
            workspace=self.workspace,
            issue_id__in=issue_ids,
            deleted_at__isnull=True
        ).select_related('issue')
        
        if not valid_subscriptions.exists():
            print("지정된 이슈 ID에 해당하는 구독을 찾을 수 없습니다.")
            return
        
        print(f"\n🗑️ {valid_subscriptions.count()}개의 이슈 구독을 {'시뮬레이션' if dry_run else '실제로'} 제거합니다:")
        
        if dry_run:
            print("\n[DRY RUN 모드] 실제로는 제거되지 않습니다.")
        
        for subscription in valid_subscriptions:
            issue = subscription.issue
            if issue:
                print(f"- {self.project.identifier}-{issue.sequence_id} | {issue.name}")
        
        # 유효하지 않은 ID 확인
        valid_issue_ids = [str(sub.issue_id) for sub in valid_subscriptions if sub.issue]
        invalid_ids = [iid for iid in issue_ids if iid not in valid_issue_ids]
        
        if invalid_ids:
            print(f"\n⚠️ 다음 이슈 ID들은 구독되지 않았거나 존재하지 않습니다:")
            for invalid_id in invalid_ids:
                print(f"  - {invalid_id}")
        
        if not dry_run:
            # 확인 요청
            confirm = input(f"\n정말로 {valid_subscriptions.count()}개의 구독을 제거하시겠습니까? (yes/no): ")
            if confirm.lower() not in ['yes', 'y', '예']:
                print("취소되었습니다.")
                return
            
            try:
                with transaction.atomic():
                    # soft delete 방식으로 제거
                    deleted_count = valid_subscriptions.update(deleted_at=datetime.now())
                    print(f"✅ {deleted_count}개의 구독이 성공적으로 제거되었습니다.")
                    
            except Exception as e:
                print(f"❌ 구독 제거 중 오류 발생: {str(e)}")
        else:
            print("\n[DRY RUN 완료] 위의 구독들이 제거될 예정입니다.")


def main():
    parser = argparse.ArgumentParser(
        description='이슈 구독 관리 도구',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  # 구독 목록 확인
  python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action list
  
  # 모든 구독 제거 (시뮬레이션)
  python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action remove-all --dry-run
  
  # 모든 구독 제거 (실제 실행)
  python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action remove-all
  
  # 선택된 이슈들만 구독 제거
  python manage_issue_subscriptions.py --workspace-slug my-workspace --project-identifier PROJ --user-email user@example.com --action remove-selected --issue-ids id1,id2,id3
        """
    )
    
    parser.add_argument('--workspace-slug', required=True, help='워크스페이스 슬러그')
    parser.add_argument('--project-identifier', required=True, help='프로젝트 식별자 (예: PROJ)')
    parser.add_argument('--user-email', required=True, help='사용자 이메일')
    parser.add_argument('--action', required=True, choices=['list', 'remove-all', 'remove-selected'], 
                       help='수행할 작업')
    parser.add_argument('--issue-ids', help='제거할 이슈 ID들 (쉼표로 구분, remove-selected 액션에서 사용)')
    parser.add_argument('--dry-run', action='store_true', 
                       help='실제 제거하지 않고 시뮬레이션만 수행')
    
    args = parser.parse_args()
    
    # 입력 검증
    if args.action == 'remove-selected' and not args.issue_ids:
        parser.error("remove-selected 액션에는 --issue-ids 옵션이 필요합니다.")
    
    print("🔧 이슈 구독 관리 도구")
    print("=" * 50)
    
    # 매니저 초기화 및 설정
    manager = IssueSubscriptionManager()
    if not manager.setup(args.workspace_slug, args.project_identifier, args.user_email):
        sys.exit(1)
    
    # 액션 수행
    if args.action == 'list':
        manager.list_subscriptions()
        
    elif args.action == 'remove-all':
        manager.remove_all_subscriptions(dry_run=args.dry_run)
        
    elif args.action == 'remove-selected':
        issue_ids = [id.strip() for id in args.issue_ids.split(',') if id.strip()]
        manager.remove_selected_subscriptions(issue_ids, dry_run=args.dry_run)
    
    print("\n✨ 작업이 완료되었습니다.")


if __name__ == "__main__":
    main() 