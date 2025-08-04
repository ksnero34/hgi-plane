#!/usr/bin/env python
"""
IssueActivity 로그를 기반으로 특정 프로젝트의 이슈들을 복구하는 스크립트

CSV 업로드로 인해 잘못 업데이트된 이슈들을 복구합니다.
- 특정 시간 이후 업데이트된 이슈들을 찾습니다
- Activity 로그에서 이전 값을 찾아 복구합니다
- 백업 기능 포함

사용법:
    python restore_issues_from_activity.py \
        --project-id="프로젝트_UUID" \
        --cutoff-time="2024-01-15 14:30:00" \
        --actor-email="업로드한_사용자@example.com" \
        --dry-run
"""

import os
import sys
import django
from pathlib import Path
import json
from datetime import datetime, timedelta
import argparse

# Django 환경 설정
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

from django.db import transaction, connection
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from plane.db.models import Issue, IssueActivity, User, Project, State
from uuid import UUID
import pytz


def print_colored(text, color='white'):
    """콘솔 색상 출력"""
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'purple': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'end': '\033[0m'
    }
    print(f"{colors.get(color, colors['white'])}{text}{colors['end']}")


def parse_cutoff_time(time_str):
    """시간 문자열을 파싱"""
    try:
        # "2024-01-15 14:30:00" 형식
        dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        # 로컬 시간대로 변환
        return timezone.make_aware(dt)
    except ValueError:
        try:
            # "2024-01-15" 형식 (시간 생략)
            dt = datetime.strptime(time_str, "%Y-%m-%d")
            return timezone.make_aware(dt)
        except ValueError:
            raise ValueError(f"잘못된 시간 형식: {time_str}. 'YYYY-MM-DD HH:MM:SS' 또는 'YYYY-MM-DD' 형식을 사용하세요.")


def backup_issues(issues, backup_file):
    """이슈 백업"""
    backup_data = []
    for issue in issues:
        backup_data.append({
            'id': str(issue.id),
            'sequence_id': issue.sequence_id,
            'name': issue.name,
            'description_stripped': issue.description_stripped,
            'priority': issue.priority,
            'state_id': str(issue.state_id),
            'state_name': issue.state.name if issue.state else None,
            'start_date': issue.start_date.isoformat() if issue.start_date else None,
            'target_date': issue.target_date.isoformat() if issue.target_date else None,
            'created_by_id': str(issue.created_by.id) if issue.created_by else None,
            'created_by_email': issue.created_by.email if issue.created_by else None,
            'updated_by_id': str(issue.updated_by.id) if issue.updated_by else None,
            'created_at': issue.created_at.isoformat(),
            'updated_at': issue.updated_at.isoformat(),
        })
    
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)
    
    print_colored(f'✅ 백업 완료: {backup_file}', 'green')
    return len(backup_data)


def find_affected_issues(project, cutoff_time, actor_email=None):
    """영향받은 이슈들 찾기"""
    
    # 기본 쿼리: 특정 시간 이후 업데이트된 이슈들
    issues_query = Issue.objects.filter(
        project=project,
        updated_at__gte=cutoff_time
    ).select_related('state', 'created_by', 'updated_by')
    
    # 특정 사용자가 업데이트한 이슈들만 (선택사항)
    if actor_email:
        try:
            actor = User.objects.get(email=actor_email)
            # IssueActivity에서 해당 사용자가 업데이트한 이슈들 찾기
            affected_issue_ids = IssueActivity.objects.filter(
                project=project,
                actor=actor,
                created_at__gte=cutoff_time,
                verb='updated'
            ).values_list('issue_id', flat=True).distinct()
            
            issues_query = issues_query.filter(id__in=affected_issue_ids)
            print_colored(f'📧 특정 사용자({actor_email})가 업데이트한 이슈들로 필터링', 'blue')
        except User.DoesNotExist:
            print_colored(f'⚠️  사용자를 찾을 수 없습니다: {actor_email}', 'yellow')
    
    return list(issues_query)


def find_restoration_data(issue, cutoff_time):
    """이슈의 복구 데이터 찾기"""
    
    # 특정 시간 이전의 마지막 상태 찾기
    activities = IssueActivity.objects.filter(
        issue=issue,
        created_at__lt=cutoff_time,
        verb='updated'
    ).order_by('-created_at')
    
    restoration_data = {}
    fields_found = set()
    
    # 각 필드별로 가장 최근의 이전 값 찾기
    for activity in activities:
        field = activity.field
        if field and field not in fields_found:
            if activity.old_value is not None:
                restoration_data[field] = {
                    'old_value': activity.old_value,
                    'new_value': activity.new_value,
                    'activity_time': activity.created_at,
                    'activity_id': activity.id
                }
                fields_found.add(field)
    
    return restoration_data


def restore_issue_field(issue, field, old_value, project):
    """이슈 필드 복구"""
    
    try:
        if field == 'name':
            if old_value and old_value.strip():
                issue.name = old_value
                return True
        
        elif field == 'description':
            # description_stripped 복구
            if old_value:
                issue.description_stripped = old_value
                return True
        
        elif field == 'priority':
            if old_value in ['urgent', 'high', 'medium', 'low', 'none']:
                issue.priority = old_value
                return True
        
        elif field == 'state':
            # 상태 이름으로 State 객체 찾기
            if old_value:
                state = State.objects.filter(project=project, name=old_value).first()
                if state:
                    issue.state = state
                    return True
        
        elif field == 'start_date':
            if old_value and old_value != 'None':
                try:
                    # 날짜 파싱
                    if old_value.lower() == 'none' or old_value.lower() == 'null':
                        issue.start_date = None
                    else:
                        date_obj = parse_datetime(old_value)
                        if date_obj:
                            issue.start_date = date_obj.date()
                        else:
                            # 다른 형식 시도
                            date_obj = datetime.strptime(old_value, '%Y-%m-%d')
                            issue.start_date = date_obj.date()
                    return True
                except (ValueError, TypeError):
                    print_colored(f'⚠️  날짜 파싱 실패: {old_value}', 'yellow')
        
        elif field == 'target_date':
            if old_value and old_value != 'None':
                try:
                    if old_value.lower() == 'none' or old_value.lower() == 'null':
                        issue.target_date = None
                    else:
                        date_obj = parse_datetime(old_value)
                        if date_obj:
                            issue.target_date = date_obj.date()
                        else:
                            date_obj = datetime.strptime(old_value, '%Y-%m-%d')
                            issue.target_date = date_obj.date()
                    return True
                except (ValueError, TypeError):
                    print_colored(f'⚠️  날짜 파싱 실패: {old_value}', 'yellow')
    
    except Exception as e:
        print_colored(f'⚠️  필드 {field} 복구 중 오류: {e}', 'yellow')
    
    return False


def restore_issues(issues, project, cutoff_time, admin_user, dry_run=False):
    """이슈들 복구"""
    
    restored_count = 0
    restoration_log = []
    
    for issue in issues:
        print_colored(f'\n🔍 이슈 분석: {project.identifier}-{issue.sequence_id} - {issue.name[:50]}', 'cyan')
        
        # 복구 데이터 찾기
        restoration_data = find_restoration_data(issue, cutoff_time)
        
        if not restoration_data:
            print('   📝 복구할 활동 로그가 없습니다.')
            continue
        
        # 복구할 변경사항들 표시
        changes_made = False
        change_summary = []
        
        for field, data in restoration_data.items():
            old_val = data['old_value']
            new_val = data['new_value']
            
            print(f'   📋 {field}: "{new_val}" → "{old_val}" (활동 시간: {data["activity_time"]})')
            
            if not dry_run:
                # 실제 복구 수행
                if restore_issue_field(issue, field, old_val, project):
                    changes_made = True
                    change_summary.append(f'{field}: "{new_val}" → "{old_val}"')
        
        if changes_made and not dry_run:
            # 이슈 저장
            issue.updated_by = admin_user
            issue.updated_at = timezone.now()
            issue.save()
            
            restored_count += 1
            restoration_log.append({
                'issue_id': str(issue.id),
                'sequence_id': issue.sequence_id,
                'name': issue.name,
                'changes': change_summary
            })
            
            print_colored(f'   ✅ 복구 완료', 'green')
            
            # 복구 활동 로그 생성
            IssueActivity.objects.create(
                issue=issue,
                verb='updated',
                field='restored',
                old_value='damaged_by_csv_import',
                new_value='restored_from_activity_log',
                actor=admin_user,
                project=project,
                workspace=project.workspace,
                comment=f'CSV 업로드로 손상된 데이터를 활동 로그에서 복구했습니다. 변경사항: {", ".join(change_summary)}',
                created_by=admin_user,
                updated_by=admin_user
            )
        
        elif dry_run and restoration_data:
            print_colored(f'   🔄 DRY RUN: {len(restoration_data)}개 필드 복구 예정', 'yellow')
    
    return restored_count, restoration_log


def main():
    parser = argparse.ArgumentParser(
        description='IssueActivity를 기반으로 이슈 복구'
    )
    parser.add_argument('--project-id', type=str, required=True,
                      help='복구할 프로젝트 ID')
    parser.add_argument('--cutoff-time', type=str, required=True,
                      help='이 시간 이후 업데이트된 이슈들을 복구 대상으로 합니다 (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--actor-email', type=str, required=False,
                      help='특정 사용자가 업데이트한 이슈들만 복구 (선택사항)')
    parser.add_argument('--admin-email', type=str, required=False,
                      help='복구를 수행하는 관리자 이메일')
    parser.add_argument('--dry-run', action='store_true',
                      help='실제 복구 없이 결과만 미리보기')

    args = parser.parse_args()

    print_colored('🔧 이슈 복구 스크립트 (Activity 기반)', 'cyan')
    print('=' * 60)

    # 1. 프로젝트 확인
    try:
        project = Project.objects.get(id=args.project_id)
        print_colored(f'📋 대상 프로젝트: {project.name} ({project.identifier})', 'blue')
    except Project.DoesNotExist:
        print_colored(f'❌ 프로젝트를 찾을 수 없습니다: {args.project_id}', 'red')
        return 1

    # 2. 시간 파싱
    try:
        cutoff_time = parse_cutoff_time(args.cutoff_time)
        print_colored(f'⏰ 기준 시간: {cutoff_time}', 'blue')
    except ValueError as e:
        print_colored(f'❌ {e}', 'red')
        return 1

    # 3. 관리자 확인
    admin_user = None
    if args.admin_email:
        try:
            admin_user = User.objects.get(email=args.admin_email)
        except User.DoesNotExist:
            print_colored(f'⚠️  관리자를 찾을 수 없습니다: {args.admin_email}', 'yellow')
    
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()
        if admin_user:
            print_colored(f'🔧 기본 관리자 사용: {admin_user.email}', 'blue')
        else:
            print_colored('❌ 관리자를 찾을 수 없습니다.', 'red')
            return 1

    # 4. 영향받은 이슈들 찾기
    print_colored('\n🔍 영향받은 이슈들 검색 중...', 'cyan')
    affected_issues = find_affected_issues(project, cutoff_time, args.actor_email)
    
    if not affected_issues:
        print_colored('✅ 복구할 이슈가 없습니다!', 'green')
        return 0

    print_colored(f'📊 복구 대상 이슈: {len(affected_issues)}개', 'blue')
    
    # 5. 이슈 목록 표시
    print('\n📋 복구 대상 이슈들:')
    for i, issue in enumerate(affected_issues[:10]):
        print(f'   {i+1}. {project.identifier}-{issue.sequence_id}: {issue.name[:50]}')
        print(f'      업데이트: {issue.updated_at} (by {issue.updated_by.email if issue.updated_by else "Unknown"})')
    
    if len(affected_issues) > 10:
        print(f'   ... 외 {len(affected_issues) - 10}개')

    if args.dry_run:
        print_colored('\n⚠️  --dry-run 모드입니다. 실제 복구는 수행되지 않습니다.', 'yellow')
    else:
        # 6. 백업 생성
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = f'backup_before_restore_{project.identifier}_{timestamp}.json'
        backup_count = backup_issues(affected_issues, backup_file)
        
        # 7. 사용자 확인
        print(f'\n⚠️  {len(affected_issues)}개 이슈를 복구합니다.')
        print(f'📁 백업 파일: {backup_file} ({backup_count}개 이슈)')
        confirm = input('\n계속 진행하시겠습니까? (yes/no): ')
        if confirm.lower() != 'yes':
            print('작업이 취소되었습니다.')
            return 0

    # 8. 복구 실행
    try:
        with transaction.atomic():
            restored_count, restoration_log = restore_issues(
                affected_issues, project, cutoff_time, admin_user, args.dry_run
            )
            
            if args.dry_run:
                print_colored(f'\n🔄 DRY RUN 완료! {len(affected_issues)}개 이슈 분석됨', 'yellow')
            else:
                print_colored(f'\n🎉 복구 완료! {restored_count}개 이슈 복구됨', 'green')
                
                # 복구 로그 저장
                if restoration_log:
                    log_file = f'restoration_log_{project.identifier}_{timestamp}.json'
                    with open(log_file, 'w', encoding='utf-8') as f:
                        json.dump(restoration_log, f, ensure_ascii=False, indent=2)
                    print_colored(f'📄 복구 로그: {log_file}', 'blue')
                
    except Exception as e:
        print_colored(f'❌ 복구 중 오류 발생: {e}', 'red')
        if not args.dry_run:
            print_colored(f'📁 백업 파일을 확인하세요: {backup_file}', 'yellow')
        raise

    return 0


if __name__ == '__main__':
    exit(main()) 