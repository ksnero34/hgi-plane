#!/usr/bin/env python
"""
특정 프로젝트에서 잘못된 created_by를 가진 이슈들을 일괄 수정

사용법:
    python fix_issue_creater.py \
        --project-id="프로젝트_UUID" \
        --correct-creator-email="올바른_생성자@example.com" \
        --exclude-creator-email="제외할_생성자@example.com" \
        --dry-run
"""

import os
import sys
import django
from pathlib import Path

# Django 환경 설정
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

# 이제 Django 모델을 import할 수 있습니다
from django.db import transaction
from django.utils import timezone
from plane.db.models import Issue, IssueActivity, User, Project
import uuid
import argparse


def main():
    parser = argparse.ArgumentParser(
        description='프로젝트에서 잘못된 created_by를 가진 이슈들을 일괄 수정합니다'
    )
    parser.add_argument('--project-id', type=str, required=True,
                      help='수정할 프로젝트 ID')
    parser.add_argument('--correct-creator-email', type=str, required=True,
                      help='올바른 생성자의 이메일 (변경될 대상)')
    parser.add_argument('--exclude-creator-email', type=str, required=False,
                      help='제외할 생성자 이메일 (이미 올바른 생성자)')
    parser.add_argument('--admin-email', type=str, required=False,
                      help='변경을 수행하는 관리자의 이메일')
    parser.add_argument('--dry-run', action='store_true',
                      help='실제 변경 없이 결과만 미리보기')

    args = parser.parse_args()

    # 프로젝트 확인
    try:
        project = Project.objects.get(id=args.project_id)
        print(f'대상 프로젝트: {project.name} ({project.identifier})')
    except Project.DoesNotExist:
        print(f'❌ 프로젝트를 찾을 수 없습니다: {args.project_id}')
        return

    # 올바른 생성자 확인
    try:
        correct_creator = User.objects.get(email=args.correct_creator_email)
        print(f'올바른 생성자: {correct_creator.email}')
    except User.DoesNotExist:
        print(f'❌ 올바른 생성자를 찾을 수 없습니다: {args.correct_creator_email}')
        return

    # 제외할 생성자 확인
    exclude_creator = None
    if args.exclude_creator_email:
        try:
            exclude_creator = User.objects.get(email=args.exclude_creator_email)
            print(f'제외할 생성자: {exclude_creator.email}')
        except User.DoesNotExist:
            print(f'⚠️  제외할 생성자를 찾을 수 없습니다: {args.exclude_creator_email}')

    # 관리자 사용자 (간단하게)
    admin_user = None
    if args.admin_email:
        try:
            admin_user = User.objects.get(email=args.admin_email)
        except User.DoesNotExist:
            admin_user = User.objects.filter(is_superuser=True).first()
    else:
        admin_user = User.objects.filter(is_superuser=True).first()
    
    if not admin_user:
        admin_user = correct_creator  # 관리자가 없으면 올바른 생성자로 설정

    # 수정할 이슈들 찾기
    issues_query = Issue.objects.filter(project_id=args.project_id)
    
    # 올바른 생성자가 아닌 이슈들만
    issues_query = issues_query.exclude(created_by=correct_creator)
    
    # 제외할 생성자가 있다면 그것도 제외
    if exclude_creator:
        issues_query = issues_query.exclude(created_by=exclude_creator)

    issues = issues_query.select_related('created_by')

    if not issues.exists():
        print('✅ 수정할 이슈가 없습니다. 모든 이슈의 생성자가 올바릅니다!')
        return

    print(f'\n수정할 이슈: {issues.count()}개')
    print('=' * 50)

    # 생성자별 통계
    creator_stats = {}
    for issue in issues:
        creator_email = issue.created_by.email if issue.created_by else 'None'
        if creator_email not in creator_stats:
            creator_stats[creator_email] = []
        creator_stats[creator_email].append(f'{project.identifier}-{issue.sequence_id}')

    for creator_email, issue_list in creator_stats.items():
        print(f'\n👤 {creator_email}: {len(issue_list)}개 이슈')
        # 처음 5개만 표시
        for issue_id in issue_list[:5]:
            print(f'   - {issue_id}')
        if len(issue_list) > 5:
            print(f'   ... 외 {len(issue_list) - 5}개')

    print(f'\n➡️  모두 {args.correct_creator_email}으로 변경됩니다.')
    print('=' * 50)

    if args.dry_run:
        print('\n⚠️  --dry-run 모드입니다. 실제 변경은 수행되지 않습니다.')
        return

    # 확인
    confirm = input('\n위의 변경사항을 적용하시겠습니까? (yes/no): ')
    if confirm.lower() != 'yes':
        print('변경이 취소되었습니다.')
        return

    # 트랜잭션으로 안전하게 변경
    try:
        with transaction.atomic():
            updated_count = 0
            for issue in issues:
                old_creator = issue.created_by
                
                # 이슈 변경
                issue.created_by = correct_creator
                issue.updated_by = admin_user
                issue.updated_at = timezone.now()
                issue.save()

                # 활동 로그 기록
                IssueActivity.objects.create(
                    issue=issue,
                    verb='updated',
                    field='created_by',
                    old_value=old_creator.email if old_creator else 'None',
                    new_value=correct_creator.email,
                    actor=admin_user,
                    project=issue.project,
                    workspace=issue.workspace,
                    created_by=admin_user,
                    updated_by=admin_user
                )

                updated_count += 1
                if updated_count % 10 == 0:  # 10개마다 진행상황 표시
                    print(f'진행중... {updated_count}/{issues.count()}')

        print(f'\n🎉 총 {updated_count}개 이슈의 생성자 변경이 완료되었습니다!')
        print(f'프로젝트: {project.name}')
        print(f'새로운 생성자: {correct_creator.email}')

    except Exception as e:
        print(f'❌ 변경 중 오류 발생: {e}')
        raise


if __name__ == '__main__':
    main() 