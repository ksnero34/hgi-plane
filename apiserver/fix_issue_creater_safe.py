#!/usr/bin/env python
"""
안전한 방식으로 이슈 created_by 수정
- update() 방식 사용으로 save() 메서드의 복잡한 로직 우회
- 백업 기능 포함
- 단계별 검증
"""

import os
import sys
import django
from pathlib import Path
import json
from datetime import datetime

# Django 환경 설정
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

from django.db import transaction, connection
from django.utils import timezone
from plane.db.models import Issue, IssueActivity, User, Project
import argparse


def backup_issues(issues, backup_file):
    """이슈 백업"""
    backup_data = []
    for issue in issues:
        backup_data.append({
            'id': str(issue.id),
            'sequence_id': issue.sequence_id,
            'name': issue.name,
            'created_by_id': str(issue.created_by.id) if issue.created_by else None,
            'created_by_email': issue.created_by.email if issue.created_by else None,
            'updated_by_id': str(issue.updated_by.id) if issue.updated_by else None,
            'created_at': issue.created_at.isoformat(),
            'updated_at': issue.updated_at.isoformat(),
        })
    
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)
    
    print(f'✅ 백업 완료: {backup_file}')
    return len(backup_data)


def verify_user_exists(email):
    """사용자 존재 여부 확인"""
    try:
        user = User.objects.get(email=email)
        print(f'✅ 사용자 확인: {user.email} (ID: {user.id})')
        return user
    except User.DoesNotExist:
        print(f'❌ 사용자를 찾을 수 없습니다: {email}')
        return None


def safe_update_created_by(issues, correct_creator, admin_user):
    """안전한 방식으로 created_by 업데이트 (update() 사용)"""
    
    issue_ids = [issue.id for issue in issues]
    
    # 1. 먼저 테스트 업데이트 (단일 이슈로)
    if issues:
        test_issue = issues[0]
        print(f'\n🧪 테스트 업데이트: {test_issue.project.identifier}-{test_issue.sequence_id}')
        
        # 단일 이슈 업데이트 테스트
        updated_count = Issue.objects.filter(id=test_issue.id).update(
            created_by=correct_creator,
            updated_by=admin_user,
            updated_at=timezone.now()
        )
        
        if updated_count != 1:
            print(f'❌ 테스트 업데이트 실패: {updated_count}개 업데이트됨')
            return False, 0
        
        # 테스트 이슈 확인
        test_issue.refresh_from_db()
        if test_issue.created_by != correct_creator:
            print(f'❌ 테스트 검증 실패: created_by={test_issue.created_by}')
            return False, 0
        
        print(f'✅ 테스트 성공: created_by가 {correct_creator.email}로 변경됨')
    
    # 2. 전체 업데이트
    print(f'\n🔄 전체 업데이트 실행 중...')
    
    with transaction.atomic():
        # 벌크 업데이트 (save() 메서드 우회)
        updated_count = Issue.objects.filter(id__in=issue_ids).update(
            created_by=correct_creator,
            updated_by=admin_user,
            updated_at=timezone.now()
        )
        
        print(f'📊 업데이트된 이슈 수: {updated_count}')
        
        # Activity 로그 생성 (배치로)
        activities = []
        for issue in issues:
            old_creator_email = issue.created_by.email if issue.created_by else 'None'
            
            activities.append(IssueActivity(
                issue=issue,
                verb='updated',
                field='created_by',
                old_value=old_creator_email,
                new_value=correct_creator.email,
                actor=admin_user,
                project=issue.project,
                workspace=issue.workspace,
                created_by=admin_user,
                updated_by=admin_user,
                created_at=timezone.now(),
                updated_at=timezone.now()
            ))
        
        # 배치로 Activity 생성
        IssueActivity.objects.bulk_create(activities, batch_size=100)
        print(f'✅ Activity 로그 {len(activities)}개 생성 완료')
    
    return True, updated_count


def final_verification(project, correct_creator):
    """최종 검증"""
    print(f'\n🔍 최종 검증 중...')
    
    # 모든 이슈의 created_by 상태 확인
    all_issues = Issue.objects.filter(project=project)
    total_count = all_issues.count()
    
    # created_by별 분류
    creator_stats = {}
    null_count = 0
    
    for issue in all_issues.select_related('created_by'):
        if issue.created_by is None:
            null_count += 1
        else:
            email = issue.created_by.email
            creator_stats[email] = creator_stats.get(email, 0) + 1
    
    print(f'📋 프로젝트 전체 이슈: {total_count}개')
    print(f'🚨 created_by가 NULL인 이슈: {null_count}개')
    
    for email, count in creator_stats.items():
        if email == correct_creator.email:
            print(f'✅ {email}: {count}개')
        else:
            print(f'👤 {email}: {count}개')
    
    return null_count == 0


def main():
    parser = argparse.ArgumentParser(
        description='안전한 방식으로 이슈 created_by 수정'
    )
    parser.add_argument('--project-id', type=str, required=True,
                      help='수정할 프로젝트 ID')
    parser.add_argument('--correct-creator-email', type=str, required=True,
                      help='올바른 생성자의 이메일')
    parser.add_argument('--exclude-creator-email', type=str, required=False,
                      help='제외할 생성자 이메일')
    parser.add_argument('--admin-email', type=str, required=False,
                      help='관리자 이메일')
    parser.add_argument('--dry-run', action='store_true',
                      help='실제 변경 없이 결과만 미리보기')

    args = parser.parse_args()

    print('🛠️  안전한 이슈 created_by 수정 도구')
    print('=' * 50)

    # 1. 프로젝트 확인
    try:
        project = Project.objects.get(id=args.project_id)
        print(f'📋 대상 프로젝트: {project.name} ({project.identifier})')
    except Project.DoesNotExist:
        print(f'❌ 프로젝트를 찾을 수 없습니다: {args.project_id}')
        return 1

    # 2. 사용자 검증
    correct_creator = verify_user_exists(args.correct_creator_email)
    if not correct_creator:
        return 1

    exclude_creator = None
    if args.exclude_creator_email:
        exclude_creator = verify_user_exists(args.exclude_creator_email)
        if not exclude_creator:
            print('⚠️  제외할 생성자를 찾을 수 없지만 계속 진행합니다.')

    # 3. 관리자 확인
    admin_user = None
    if args.admin_email:
        admin_user = verify_user_exists(args.admin_email)
    
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()
        if admin_user:
            print(f'🔧 기본 관리자 사용: {admin_user.email}')
        else:
            admin_user = correct_creator
            print(f'🔧 올바른 생성자를 관리자로 사용: {admin_user.email}')

    # 4. 수정할 이슈 찾기
    issues_query = Issue.objects.filter(project=project)
    issues_query = issues_query.exclude(created_by=correct_creator)
    
    if exclude_creator:
        issues_query = issues_query.exclude(created_by=exclude_creator)

    issues = list(issues_query.select_related('created_by', 'project'))

    if not issues:
        print('✅ 수정할 이슈가 없습니다!')
        return 0

    print(f'\n📊 수정할 이슈: {len(issues)}개')
    
    # 5. 현재 상태 분석
    creator_stats = {}
    for issue in issues:
        email = issue.created_by.email if issue.created_by else 'NULL'
        if email not in creator_stats:
            creator_stats[email] = []
        creator_stats[email].append(f'{project.identifier}-{issue.sequence_id}')

    for email, issue_list in creator_stats.items():
        print(f'\n👤 {email}: {len(issue_list)}개')
        for issue_id in issue_list[:3]:
            print(f'   - {issue_id}')
        if len(issue_list) > 3:
            print(f'   ... 외 {len(issue_list) - 3}개')

    print(f'\n➡️  모두 {correct_creator.email}으로 변경됩니다.')

    if args.dry_run:
        print('\n⚠️  --dry-run 모드입니다. 실제 변경은 수행되지 않습니다.')
        return 0

    # 6. 백업 생성
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f'backup_issues_{project.identifier}_{timestamp}.json'
    backup_count = backup_issues(issues, backup_file)
    
    # 7. 사용자 확인
    print(f'\n⚠️  {len(issues)}개 이슈의 created_by를 변경합니다.')
    print(f'📁 백업 파일: {backup_file} ({backup_count}개 이슈)')
    confirm = input('\n계속 진행하시겠습니까? (yes/no): ')
    if confirm.lower() != 'yes':
        print('작업이 취소되었습니다.')
        return 0

    # 8. 안전한 업데이트 실행
    try:
        success, updated_count = safe_update_created_by(issues, correct_creator, admin_user)
        
        if success:
            print(f'\n🎉 업데이트 완료! {updated_count}개 이슈 수정됨')
            
            # 9. 최종 검증
            if final_verification(project, correct_creator):
                print('\n✅ 최종 검증 성공! 모든 이슈의 created_by가 올바르게 설정되었습니다.')
            else:
                print('\n⚠️  최종 검증에서 문제가 발견되었습니다. 백업을 확인하세요.')
                
        else:
            print('\n❌ 업데이트 실패!')
            return 1
            
    except Exception as e:
        print(f'\n❌ 오류 발생: {e}')
        print(f'📁 백업 파일을 확인하세요: {backup_file}')
        raise

    return 0


if __name__ == '__main__':
    exit(main()) 