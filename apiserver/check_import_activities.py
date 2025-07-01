#!/usr/bin/env python
"""
CSV import로 생성된 Activity 로그들을 확인하는 스크립트

사용법:
    python check_import_activities.py \
        --project-id="프로젝트_UUID" \
        --cutoff-time="2024-01-15 14:30:00" \
        --actor-email="업로드한_사용자@example.com"
"""

import os
import sys
import django
from pathlib import Path
from datetime import datetime

# Django 환경 설정
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from plane.db.models import Issue, IssueActivity, User, Project
import argparse


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
        dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        return timezone.make_aware(dt)
    except ValueError:
        try:
            dt = datetime.strptime(time_str, "%Y-%m-%d")
            return timezone.make_aware(dt)
        except ValueError:
            raise ValueError(f"잘못된 시간 형식: {time_str}")


def main():
    parser = argparse.ArgumentParser(
        description='CSV import 관련 Activity 로그 확인'
    )
    parser.add_argument('--project-id', type=str, required=True,
                      help='확인할 프로젝트 ID')
    parser.add_argument('--cutoff-time', type=str, required=True,
                      help='이 시간 이후의 Activity를 확인 (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--actor-email', type=str, required=False,
                      help='특정 사용자의 Activity만 확인')

    args = parser.parse_args()

    print_colored('🔍 CSV Import Activity 로그 확인', 'cyan')
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

    # 3. Actor 확인
    actor = None
    if args.actor_email:
        try:
            actor = User.objects.get(email=args.actor_email)
            print_colored(f'👤 Actor: {actor.email}', 'blue')
        except User.DoesNotExist:
            print_colored(f'⚠️  사용자를 찾을 수 없습니다: {args.actor_email}', 'yellow')

    # 4. Activity 로그 조회
    activities_query = IssueActivity.objects.filter(
        project=project,
        created_at__gte=cutoff_time
    ).select_related('issue', 'actor').order_by('-created_at')

    if actor:
        activities_query = activities_query.filter(actor=actor)

    activities = list(activities_query)

    print_colored(f'\n📊 발견된 Activity: {len(activities)}개', 'blue')

    if not activities:
        print_colored('✅ 해당 조건의 Activity가 없습니다.', 'green')
        return 0

    # 5. Activity 분석
    verb_counts = {}
    field_counts = {}
    comment_patterns = {}

    for activity in activities:
        # verb 통계
        verb_counts[activity.verb] = verb_counts.get(activity.verb, 0) + 1
        
        # field 통계
        if activity.field:
            field_counts[activity.field] = field_counts.get(activity.field, 0) + 1
        
        # comment 패턴 통계
        if activity.comment:
            comment_patterns[activity.comment] = comment_patterns.get(activity.comment, 0) + 1

    print('\n📈 Activity 통계:')
    print(f'  📝 Verb 분포:')
    for verb, count in sorted(verb_counts.items()):
        print(f'    - {verb}: {count}개')

    print(f'  🏷️  Field 분포:')
    for field, count in sorted(field_counts.items()):
        print(f'    - {field or "None"}: {count}개')

    print(f'  💬 Comment 패턴:')
    for comment, count in sorted(comment_patterns.items()):
        if count > 1:  # 2개 이상인 것만 표시
            print(f'    - "{comment[:50]}...": {count}개')

    # 6. 상세 Activity 목록 (최근 20개)
    print(f'\n📋 최근 Activity 목록 (최대 20개):')
    for i, activity in enumerate(activities[:20]):
        issue_identifier = f"{project.identifier}-{activity.issue.sequence_id}" if activity.issue else "Unknown"
        actor_email = activity.actor.email if activity.actor else "Unknown"
        
        print(f'\n  {i+1}. 🎯 {issue_identifier}: {activity.issue.name[:30] if activity.issue else "Unknown"}...')
        print(f'     👤 Actor: {actor_email}')
        print(f'     📅 시간: {activity.created_at}')
        print(f'     🔄 Verb: {activity.verb}')
        print(f'     🏷️  Field: {activity.field or "None"}')
        if activity.old_value or activity.new_value:
            print(f'     📝 변경: "{activity.old_value or "None"}" → "{activity.new_value or "None"}"')
        if activity.comment:
            print(f'     💬 Comment: {activity.comment[:50]}...')

    if len(activities) > 20:
        print(f'\n  ... 외 {len(activities) - 20}개 더')

    # 7. 복구 가능한 Activity 확인
    print(f'\n🔧 복구 관련 분석:')
    
    # 각 필드별로 복구 가능한 Activity 수 확인
    restorable_fields = ['name', 'description', 'priority', 'state', 'start_date', 'target_date']
    restorable_activities = {}
    
    for field in restorable_fields:
        field_activities = [a for a in activities if a.field == field and a.old_value]
        restorable_activities[field] = len(field_activities)
        
        if field_activities:
            print(f'  📋 {field}: {len(field_activities)}개 복구 가능')
            # 샘플 표시
            sample = field_activities[0]
            print(f'     예시: "{sample.old_value}" → "{sample.new_value}"')
        else:
            print(f'  ❌ {field}: 복구 불가능 (Activity 없음)')

    total_restorable = sum(restorable_activities.values())
    print(f'\n📊 총 복구 가능한 Activity: {total_restorable}개')

    if total_restorable == 0:
        print_colored('\n⚠️  복구 가능한 Activity가 없습니다!', 'yellow')
        print('   - import_task에서 Activity 로그가 제대로 생성되지 않았을 수 있습니다.')
        print('   - "issue.activity.imported" 타입이 처리되지 않는 문제일 수 있습니다.')
    else:
        print_colored(f'\n✅ 복구 스크립트로 {total_restorable}개 변경사항을 복구할 수 있습니다!', 'green')

    return 0


if __name__ == '__main__':
    exit(main()) 