#!/usr/bin/env python
"""
CSV 임포트로 인해 잘못 변경된 이슈들을 찾고 복구하는 스크립트

사용법:
    # 최근 변경사항 확인
    python check_recent_issue_changes.py --project-id="프로젝트_UUID" --hours=2

    # 특정 시간 이후 변경된 이슈들 확인
    python check_recent_issue_changes.py --project-id="프로젝트_UUID" --since="2024-01-15 14:30:00"

    # 복구 실행 (dry-run 먼저)
    python check_recent_issue_changes.py --project-id="프로젝트_UUID" --restore --dry-run

    # 실제 복구
    python check_recent_issue_changes.py --project-id="프로젝트_UUID" --restore
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

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from plane.db.models import Issue, IssueActivity, User, Project
from plane.app.serializers import IssueSerializer
from django.core.serializers.json import DjangoJSONEncoder
import uuid


def parse_time_input(time_str):
    """시간 문자열을 datetime 객체로 변환"""
    try:
        # 다양한 형식 지원
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%m-%d %H:%M",
            "%H:%M"
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(time_str, fmt)
                # 년도나 월/일이 없으면 현재로 설정
                if fmt == "%H:%M":
                    now = datetime.now()
                    parsed = parsed.replace(year=now.year, month=now.month, day=now.day)
                elif fmt == "%m-%d %H:%M":
                    parsed = parsed.replace(year=datetime.now().year)
                return timezone.make_aware(parsed)
            except ValueError:
                continue
        
        # ISO 형식도 시도
        return parse_datetime(time_str)
    except:
        return None


def find_import_activities(project, since_time):
    """CSV 임포트 관련 활동들을 찾기"""
    activities = IssueActivity.objects.filter(
        project=project,
        created_at__gte=since_time,
        verb__in=['updated', 'imported']
    ).select_related('issue', 'actor').order_by('created_at')
    
    return activities


def analyze_issue_changes(project, since_time):
    """이슈 변경사항 분석"""
    print(f"🔍 {since_time} 이후의 이슈 변경사항을 분석합니다...")
    
    activities = find_import_activities(project, since_time)
    
    if not activities:
        print("✅ 해당 시간 이후로 변경된 이슈가 없습니다.")
        return []
    
    print(f"📊 총 {activities.count()}개의 활동을 발견했습니다.")
    
    # 이슈별로 그룹화
    issue_changes = {}
    import_activities = []
    
    for activity in activities:
        issue_id = str(activity.issue.id)
        
        if issue_id not in issue_changes:
            issue_changes[issue_id] = {
                'issue': activity.issue,
                'activities': [],
                'is_import_related': False
            }
        
        issue_changes[issue_id]['activities'].append(activity)
        
        # 임포트 관련 활동인지 확인
        if (activity.verb == 'imported' or 
            'import' in str(activity.comment or '').lower() or
            activity.verb == 'updated'):
            issue_changes[issue_id]['is_import_related'] = True
            import_activities.append(activity)
    
    # 임포트 관련 이슈들만 필터링
    import_related_issues = [
        data for data in issue_changes.values() 
        if data['is_import_related']
    ]
    
    print(f"🚨 임포트와 관련된 이슈: {len(import_related_issues)}개")
    
    # 상세 정보 출력
    for data in import_related_issues[:10]:  # 처음 10개만
        issue = data['issue']
        activities = data['activities']
        
        print(f"\n📋 이슈: {project.identifier}-{issue.sequence_id} - {issue.name}")
        print(f"   총 {len(activities)}개의 변경사항")
        
        for activity in activities[-3:]:  # 최근 3개만
            print(f"   • {activity.created_at}: {activity.verb}")
            if activity.field:
                old_val = str(activity.old_value)[:50] if activity.old_value else "None"
                new_val = str(activity.new_value)[:50] if activity.new_value else "None"
                print(f"     {activity.field}: {old_val} → {new_val}")
    
    if len(import_related_issues) > 10:
        print(f"\n... 외 {len(import_related_issues) - 10}개 더")
    
    return import_related_issues


def restore_issues_from_activity(project, issue_changes, dry_run=True):
    """활동 로그에서 이슈 복구"""
    print(f"\n🔄 이슈 복구를 시작합니다 (DRY_RUN: {dry_run})")
    
    restored_count = 0
    failed_count = 0
    
    for data in issue_changes:
        issue = data['issue']
        activities = data['activities']
        
        try:
            # 가장 오래된 업데이트 활동 찾기 (임포트 이전 상태)
            oldest_update = None
            for activity in sorted(activities, key=lambda x: x.created_at):
                if activity.verb == 'updated' and hasattr(activity, 'old_value'):
                    oldest_update = activity
                    break
            
            if not oldest_update:
                print(f"⚠️  {project.identifier}-{issue.sequence_id}: 복구 가능한 이전 상태를 찾을 수 없습니다.")
                continue
            
            # 복구할 데이터 준비
            restore_data = {}
            
            # 해당 이슈의 모든 필드 변경사항 수집
            field_history = {}
            for activity in sorted(activities, key=lambda x: x.created_at):
                if activity.field and activity.old_value is not None:
                    if activity.field not in field_history:
                        field_history[activity.field] = activity.old_value
            
            print(f"\n🔧 {project.identifier}-{issue.sequence_id} 복구:")
            for field, old_value in field_history.items():
                current_value = getattr(issue, field, None)
                if str(current_value) != str(old_value):
                    restore_data[field] = old_value
                    print(f"   {field}: {str(current_value)[:50]} → {str(old_value)[:50]}")
            
            if not restore_data:
                print(f"✅ {project.identifier}-{issue.sequence_id}: 복구할 필드가 없습니다.")
                continue
            
            if not dry_run:
                # 실제 복구 수행
                for field, value in restore_data.items():
                    setattr(issue, field, value)
                
                issue.updated_at = timezone.now()
                issue.save()
                
                # 복구 활동 로그 생성
                IssueActivity.objects.create(
                    issue=issue,
                    verb='restored',
                    comment=f'CSV 임포트로 인한 변경사항 복구: {", ".join(restore_data.keys())}',
                    actor=User.objects.filter(is_superuser=True).first(),
                    project=project,
                    workspace=project.workspace
                )
                
            restored_count += 1
            
        except Exception as e:
            print(f"❌ {project.identifier}-{issue.sequence_id} 복구 실패: {str(e)}")
            failed_count += 1
            continue
    
    print(f"\n📊 복구 결과:")
    print(f"   성공: {restored_count}개")
    print(f"   실패: {failed_count}개")
    
    if dry_run:
        print("\n⚠️  DRY RUN 모드였습니다. 실제 복구하려면 --dry-run 옵션을 제거하세요.")
    
    return restored_count > 0


def export_backup_data(project, issue_changes, filename=None):
    """백업 데이터 생성"""
    if not filename:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'issue_backup_{project.identifier}_{timestamp}.json'
    
    backup_data = []
    
    for data in issue_changes:
        issue = data['issue']
        activities = data['activities']
        
        issue_data = {
            'issue_id': str(issue.id),
            'sequence_id': issue.sequence_id,
            'identifier': f"{project.identifier}-{issue.sequence_id}",
            'current_state': IssueSerializer(issue).data,
            'activities': []
        }
        
        for activity in activities:
            activity_data = {
                'id': str(activity.id),
                'created_at': activity.created_at.isoformat(),
                'verb': activity.verb,
                'field': activity.field,
                'old_value': activity.old_value,
                'new_value': activity.new_value,
                'comment': activity.comment,
                'actor_email': activity.actor.email if activity.actor else None
            }
            issue_data['activities'].append(activity_data)
        
        backup_data.append(issue_data)
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2, cls=DjangoJSONEncoder)
    
    print(f"💾 백업 파일 생성: {filename}")
    return filename


def main():
    parser = argparse.ArgumentParser(description='CSV 임포트로 인해 변경된 이슈들을 찾고 복구')
    parser.add_argument('--project-id', type=str, required=True, help='프로젝트 ID')
    parser.add_argument('--hours', type=int, help='몇 시간 전부터 확인할지 (기본: 2시간)')
    parser.add_argument('--since', type=str, help='특정 시간 이후 (예: "2024-01-15 14:30:00")')
    parser.add_argument('--restore', action='store_true', help='복구 실행')
    parser.add_argument('--dry-run', action='store_true', help='실제 변경 없이 미리보기')
    parser.add_argument('--backup', action='store_true', help='백업 파일 생성')
    
    args = parser.parse_args()
    
    # 프로젝트 확인
    try:
        project = Project.objects.get(id=args.project_id)
        print(f"📋 프로젝트: {project.name} ({project.identifier})")
    except Project.DoesNotExist:
        print(f"❌ 프로젝트를 찾을 수 없습니다: {args.project_id}")
        return 1
    
    # 시간 범위 설정
    if args.since:
        since_time = parse_time_input(args.since)
        if not since_time:
            print(f"❌ 잘못된 시간 형식: {args.since}")
            return 1
    else:
        hours = args.hours or 2
        since_time = timezone.now() - timedelta(hours=hours)
    
    print(f"⏰ {since_time} 이후의 변경사항을 확인합니다.")
    
    # 변경사항 분석
    issue_changes = analyze_issue_changes(project, since_time)
    
    if not issue_changes:
        return 0
    
    # 백업 생성
    if args.backup or args.restore:
        backup_file = export_backup_data(project, issue_changes)
    
    # 복구 실행
    if args.restore:
        if not args.dry_run:
            confirm = input(f"\n⚠️  {len(issue_changes)}개 이슈를 복구하시겠습니까? (yes/no): ")
            if confirm.lower() != 'yes':
                print("복구가 취소되었습니다.")
                return 0
        
        success = restore_issues_from_activity(project, issue_changes, args.dry_run)
        
        if success:
            print("✅ 복구가 완료되었습니다!")
        else:
            print("❌ 복구에 실패했습니다.")
            return 1
    
    return 0


if __name__ == '__main__':
    exit(main()) 