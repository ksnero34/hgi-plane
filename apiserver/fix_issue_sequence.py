#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# chmod +x apiserver/fix_issue_sequence.py
# python fix_issue_sequence.py --project-id "your-project-uuid" --dry-run
# python fix_issue_sequence.py --project-id "your-project-uuid"
import os
import sys
import django
import uuid
import argparse
from django.db import transaction
from django.db.models import Max

# Django 설정 로드
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

from plane.db.models import Issue, IssueSequence, Project


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


def validate_uuid(uuid_string):
    """UUID 형식 검증"""
    try:
        return uuid.UUID(uuid_string)
    except ValueError:
        raise ValueError(f'잘못된 UUID 형식입니다: {uuid_string}')


def fix_issue_sequence(project_id, workspace_slug=None, dry_run=False):
    """이슈 sequence 재정렬 메인 함수"""
    
    try:
        # UUID 형식 검증
        project_uuid = validate_uuid(project_id)
    except ValueError as e:
        print_colored(str(e), 'red')
        return False

    # 프로젝트 존재 확인
    try:
        if workspace_slug:
            project = Project.objects.get(id=project_uuid, workspace__slug=workspace_slug)
            print(f"프로젝트 확인: {project.name} (워크스페이스: {project.workspace.name})")
        else:
            project = Project.objects.get(id=project_uuid)
            print(f"프로젝트 확인: {project.name} (워크스페이스: {project.workspace.name})")
    except Project.DoesNotExist:
        print_colored(f'프로젝트를 찾을 수 없습니다: {project_id}', 'red')
        return False

    # 현재 이슈들 조회 (생성일자 순으로 정렬)
    issues = Issue.objects.filter(
        project_id=project_uuid,
        deleted_at__isnull=True
    ).order_by('created_at', 'id')

    issue_count = issues.count()
    print(f"총 {issue_count}개의 이슈를 처리합니다.")

    if issue_count == 0:
        print_colored("처리할 이슈가 없습니다.", 'yellow')
        return True

    # 현재 상태 출력
    print("\n=== 현재 이슈 상태 (처음 10개) ===")
    for i, issue in enumerate(issues[:10]):
        print(f"ID: {issue.id}, Sequence: {issue.sequence_id}, "
              f"생성일: {issue.created_at}, 제목: {issue.name[:50]}")

    # IssueSequence 현재 상태 확인
    current_max_sequence = IssueSequence.objects.filter(
        project_id=project_uuid,
        deleted=False
    ).aggregate(max_seq=Max('sequence'))['max_seq'] or 0
    
    print(f"\n현재 IssueSequence 최대값: {current_max_sequence}")

    if dry_run:
        print_colored("\n=== DRY RUN 모드 - 실제 변경되지 않습니다 ===", 'yellow')
    
    # 변경 사항 미리보기
    print("\n=== 변경 예정 사항 ===")
    changes = []
    new_sequence = 1
    
    for issue in issues:
        if issue.sequence_id != new_sequence:
            changes.append({
                'issue': issue,
                'old_sequence': issue.sequence_id,
                'new_sequence': new_sequence
            })
            if len(changes) <= 10:  # 처음 10개만 출력
                print(f"이슈 {issue.id}: {issue.sequence_id} → {new_sequence}")
        new_sequence += 1

    if len(changes) > 10:
        print(f"... 외 {len(changes) - 10}개 더")

    print(f"\n총 {len(changes)}개의 이슈 sequence가 변경됩니다.")
    print(f"새로운 최대 sequence: {new_sequence - 1}")

    if not changes:
        print_colored("모든 이슈의 sequence가 이미 올바르게 설정되어 있습니다.", 'green')
        return True

    if dry_run:
        print_colored("DRY RUN 완료. 실제 변경하려면 --dry-run 옵션을 제거하고 다시 실행하세요.", 'green')
        return True

    # 사용자 확인
    confirm = input(f"\n정말로 {len(changes)}개 이슈의 sequence를 변경하시겠습니까? (yes/no): ")
    if confirm.lower() not in ['yes', 'y']:
        print("작업이 취소되었습니다.")
        return False

    # 실제 업데이트 수행
    with transaction.atomic():
        try:
            updated_issues = 0
            updated_sequences = 0
            
            # 1. 이슈 sequence_id 업데이트
            print("이슈 sequence_id 업데이트 중...")
            for change in changes:
                issue = change['issue']
                new_seq = change['new_sequence']
                
                Issue.objects.filter(id=issue.id).update(sequence_id=new_seq)
                updated_issues += 1
                
                if updated_issues % 100 == 0:
                    print(f"  {updated_issues}/{len(changes)} 이슈 처리 완료")

            # 2. IssueSequence 테이블 정리 및 재구성
            print("\nIssueSequence 테이블 정리 중...")
            
            # 기존 IssueSequence 삭제 (소프트 삭제)
            IssueSequence.objects.filter(project_id=project_uuid).update(deleted=True)
            
            # 새로운 IssueSequence 레코드 생성
            print("새로운 IssueSequence 레코드 생성 중...")
            sequence_records = []
            
            # 업데이트된 이슈들 다시 조회 (sequence_id 순으로)
            updated_issues_qs = Issue.objects.filter(
                project_id=project_uuid,
                deleted_at__isnull=True
            ).order_by('sequence_id')
            
            for issue in updated_issues_qs:
                sequence_records.append(
                    IssueSequence(
                        issue=issue,
                        sequence=issue.sequence_id,
                        project_id=project_uuid,
                        workspace_id=project.workspace_id,
                        created_by_id=issue.created_by_id,
                        updated_by_id=issue.updated_by_id,
                        deleted=False
                    )
                )
                updated_sequences += 1
                
                if updated_sequences % 100 == 0:
                    print(f"  {updated_sequences} IssueSequence 레코드 준비 완료")

            # 배치로 생성
            IssueSequence.objects.bulk_create(sequence_records, batch_size=100)
            
            print_colored(f"\n작업 완료!", 'green')
            print(f"- 업데이트된 이슈: {updated_issues}개")
            print(f"- 생성된 IssueSequence 레코드: {updated_sequences}개")
            print(f"- 새로운 최대 sequence: {updated_sequences}")
            
            # 최종 검증
            final_max = Issue.objects.filter(
                project_id=project_uuid,
                deleted_at__isnull=True
            ).aggregate(max_seq=Max('sequence_id'))['max_seq']
            
            final_sequence_max = IssueSequence.objects.filter(
                project_id=project_uuid,
                deleted=False
            ).aggregate(max_seq=Max('sequence'))['max_seq']
            
            print(f"\n=== 최종 검증 ===")
            print(f"이슈 테이블 최대 sequence: {final_max}")
            print(f"IssueSequence 테이블 최대 sequence: {final_sequence_max}")
            
            if final_max == final_sequence_max == updated_sequences:
                print_colored("✓ 모든 데이터가 올바르게 동기화되었습니다.", 'green')
            else:
                print_colored("✗ 데이터 동기화에 문제가 있을 수 있습니다.", 'red')
                return False

        except Exception as e:
            print_colored(f"오류 발생: {str(e)}", 'red')
            raise

    print_colored("\n모든 작업이 성공적으로 완료되었습니다!", 'green')
    print("이제 새로운 이슈 생성 시 올바른 sequence가 할당됩니다.")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='프로젝트의 이슈 sequence를 생성일자 기준으로 재정렬합니다'
    )
    parser.add_argument(
        '--project-id',
        type=str,
        required=True,
        help='수정할 프로젝트의 UUID'
    )
    parser.add_argument(
        '--workspace-slug',
        type=str,
        help='워크스페이스 슬러그 (선택사항, 검증용)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='실제 수정하지 않고 변경 사항만 미리보기'
    )

    args = parser.parse_args()

    print_colored("=== 이슈 Sequence 재정렬 스크립트 ===", 'cyan')
    print(f"프로젝트 ID: {args.project_id}")
    if args.workspace_slug:
        print(f"워크스페이스 슬러그: {args.workspace_slug}")
    if args.dry_run:
        print_colored("DRY RUN 모드로 실행됩니다.", 'yellow')
    print()

    try:
        success = fix_issue_sequence(
            project_id=args.project_id,
            workspace_slug=args.workspace_slug,
            dry_run=args.dry_run
        )
        
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        print_colored(f"예상치 못한 오류가 발생했습니다: {str(e)}", 'red')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main() 