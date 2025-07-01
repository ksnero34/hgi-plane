#!/usr/bin/env python
"""
삭제된 이슈들을 확인하고 복구하는 스크립트

사용법:
1. 삭제된 이슈 확인: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --list
2. 특정 이슈 복구: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore ISSUE_ID
3. 상위 이슈와 하위 이슈 일괄 복구: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore-parent PARENT_ISSUE_ID
4. 특정 이슈와 하위 이슈들의 모든 관련 데이터 복구: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore-full ISSUE_ID
5. 이미 복구된 이슈의 누락된 관련 데이터 복구 (생성자 포함): python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore-data ISSUE_ID
6. 이미 복구된 이슈의 누락된 관련 데이터 복구 (담당자/커스텀필드는 최신만): python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore-data-latest ISSUE_ID
7. 특정 이슈의 복구 가능한 활동/댓글 데이터 확인: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --check-issue-data ISSUE_ID
8. 생성자 이메일 지정하여 복구: python restore_deleted_issues.py --workspace YOUR_WORKSPACE --project YOUR_PROJECT --restore-data ISSUE_ID --creator-email USER@EXAMPLE.COM

추가 옵션:
- --admin-email: 복구 작업을 수행할 관리자 이메일 지정
- --creator-email: 누락된 created_by 필드에 설정할 생성자 이메일 지정 (--restore-data, --restore-data-latest와 함께 사용)
"""

import os
import sys
import django
from pathlib import Path
import argparse
from datetime import datetime

# Django 환경 설정
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plane.settings.production')
django.setup()

from django.db import transaction, models
from django.utils import timezone
from plane.db.models import Issue, Workspace, Project, IssueActivity, User, IssueAssignee, CustomFieldValue, IssueComment


def find_deleted_issues(workspace_slug, project_identifier):
    """삭제된 이슈들 찾기"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 삭제된 이슈들 조회 (소프트 삭제된 것들)
        deleted_issues = Issue.all_objects.filter(
            project=project,
            deleted_at__isnull=False
        ).select_related('parent').order_by('-deleted_at')
        
        # 전체 이슈 수도 확인 (디버깅용)
        total_issues = Issue.all_objects.filter(project=project).count()
        active_issues = Issue.objects.filter(project=project).count()
        
        print(f"\n🔍 [{project.identifier}] 이슈 현황:")
        print("=" * 80)
        print(f"📊 전체 이슈: {total_issues}개")
        print(f"📊 활성 이슈: {active_issues}개") 
        print(f"📊 삭제된 이슈: {deleted_issues.count()}개")
        print()
        
        if not deleted_issues.exists():
            print("❌ 소프트 삭제된 이슈가 없습니다.")
            print("💡 하드 삭제된 이슈는 복구할 수 없습니다.")
            return []
            
        parent_issues = []
        child_issues = []
        orphan_issues = []  # 상위 이슈가 하드 삭제된 하위 이슈들
        
        for issue in deleted_issues:
            deleted_time = issue.deleted_at.strftime('%Y-%m-%d %H:%M:%S') if issue.deleted_at else 'Unknown'
            
            # 고아 활동 개수 확인 (issue가 NULL인 활동들)
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            ).count()
            
            # 소프트 삭제된 활동 개수 확인
            soft_deleted_activities = IssueActivity.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 소프트 삭제된 댓글 개수 확인
            soft_deleted_comments = IssueComment.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 삭제된 assignee 개수 확인
            deleted_assignees = IssueAssignee.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 삭제된 custom field 값 개수 확인
            deleted_custom_fields = CustomFieldValue.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 상위 이슈인지 확인 (하위 이슈가 있는지)
            has_children = Issue.all_objects.filter(parent=issue).exists()
            children_count = Issue.all_objects.filter(parent=issue).count()
            
            if has_children:
                print(f"📁 상위이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                print(f"   └─ 삭제시간: {deleted_time}")
                print(f"   └─ 하위이슈: {children_count}개")
                print(f"   └─ 소프트삭제 활동: {soft_deleted_activities}개")
                print(f"   └─ 소프트삭제 댓글: {soft_deleted_comments}개")
                print(f"   └─ 고아활동: {orphaned_activities}개")
                print(f"   └─ 삭제된 담당자: {deleted_assignees}개")
                print(f"   └─ 삭제된 커스텀필드: {deleted_custom_fields}개")
                print(f"   └─ ID: {issue.id}")
                parent_issues.append(issue)
            elif issue.parent:
                # 상위 이슈가 존재하는 하위 이슈
                try:
                    parent_seq = issue.parent.sequence_id
                    parent_status = "존재" if Issue.all_objects.filter(id=issue.parent.id).exists() else "하드삭제됨"
                    print(f"📄 하위이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                    print(f"   └─ 상위이슈: {project.identifier}-{parent_seq} ({parent_status})")
                    print(f"   └─ 삭제시간: {deleted_time}")
                    print(f"   └─ 소프트삭제 활동: {soft_deleted_activities}개")
                    print(f"   └─ 소프트삭제 댓글: {soft_deleted_comments}개")
                    print(f"   └─ 고아활동: {orphaned_activities}개")
                    print(f"   └─ 삭제된 담당자: {deleted_assignees}개")
                    print(f"   └─ 삭제된 커스텀필드: {deleted_custom_fields}개")
                    print(f"   └─ ID: {issue.id}")
                    
                    if parent_status == "하드삭제됨":
                        orphan_issues.append(issue)
                    else:
                        child_issues.append(issue)
                except:
                    print(f"📄 고아이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                    print(f"   └─ 상위이슈: 참조 오류 (하드삭제됨)")
                    print(f"   └─ 삭제시간: {deleted_time}")
                    print(f"   └─ 소프트삭제 활동: {soft_deleted_activities}개")
                    print(f"   └─ 소프트삭제 댓글: {soft_deleted_comments}개")
                    print(f"   └─ 고아활동: {orphaned_activities}개")
                    print(f"   └─ 삭제된 담당자: {deleted_assignees}개")
                    print(f"   └─ 삭제된 커스텀필드: {deleted_custom_fields}개")
                    print(f"   └─ ID: {issue.id}")
                    orphan_issues.append(issue)
            else:
                # 상위 이슈가 없는 일반 이슈
                print(f"📄 일반이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                print(f"   └─ 삭제시간: {deleted_time}")
                print(f"   └─ 소프트삭제 활동: {soft_deleted_activities}개")
                print(f"   └─ 소프트삭제 댓글: {soft_deleted_comments}개")
                print(f"   └─ 고아활동: {orphaned_activities}개")
                print(f"   └─ 삭제된 담당자: {deleted_assignees}개")
                print(f"   └─ 삭제된 커스텀필드: {deleted_custom_fields}개")
                print(f"   └─ ID: {issue.id}")
                child_issues.append(issue)
            print()
            
        print(f"📊 분류 결과:")
        print(f"   📁 상위이슈: {len(parent_issues)}개")
        print(f"   📄 하위이슈: {len(child_issues)}개")
        print(f"   🔗 고아이슈 (상위가 하드삭제됨): {len(orphan_issues)}개")
        
        if orphan_issues:
            print(f"\n⚠️  고아 이슈들의 상위 이슈가 하드 삭제되었습니다.")
            print(f"   이 이슈들은 개별적으로 복구해야 합니다.")
        
        return list(deleted_issues)
        
    except Workspace.DoesNotExist:
        print(f"❌ 워크스페이스 '{workspace_slug}'를 찾을 수 없습니다.")
        return []
    except Project.DoesNotExist:
        print(f"❌ 프로젝트 '{project_identifier}'를 찾을 수 없습니다.")
        return []
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return []


def restore_issue_assignees(issue, user=None):
    """이슈의 삭제된 담당자들 복구"""
    deleted_assignees = IssueAssignee.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_assignees.exists():
        restored_count = 0
        for assignee in deleted_assignees:
            assignee.deleted_at = None
            assignee.updated_at = timezone.now()
            if user and not assignee.updated_by:
                assignee.updated_by = user
            assignee.save()
            restored_count += 1
        
        print(f"   🔗 담당자 {restored_count}개 복구 완료")
        return restored_count
    
    return 0


def restore_issue_assignees_latest_only(issue, user=None):
    """이슈의 삭제된 담당자들 중 마지막으로 설정된 것들만 복구"""
    deleted_assignees = IssueAssignee.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    ).order_by('-updated_at')  # 최신순으로 정렬
    
    if deleted_assignees.exists():
        # 각 담당자별로 가장 최근 레코드만 찾기
        latest_assignees = {}
        for assignee in deleted_assignees:
            assignee_id = assignee.assignee_id
            if assignee_id not in latest_assignees:
                latest_assignees[assignee_id] = assignee
        
        restored_count = 0
        for assignee in latest_assignees.values():
            assignee.deleted_at = None
            assignee.updated_at = timezone.now()
            if user and not assignee.updated_by:
                assignee.updated_by = user
            assignee.save()
            restored_count += 1
        
        total_deleted = deleted_assignees.count()
        print(f"   🔗 담당자 {restored_count}개 복구 완료 (전체 {total_deleted}개 중 최신만)")
        return restored_count
    
    return 0


def restore_issue_custom_fields(issue, user=None):
    """이슈의 삭제된 커스텀 필드 값들 복구"""
    deleted_custom_fields = CustomFieldValue.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_custom_fields.exists():
        restored_count = 0
        for cf_value in deleted_custom_fields:
            cf_value.deleted_at = None
            cf_value.updated_at = timezone.now()
            if user and not cf_value.updated_by:
                cf_value.updated_by = user
            cf_value.save()
            restored_count += 1
        
        print(f"   🔗 커스텀필드 {restored_count}개 복구 완료")
        return restored_count
    
    return 0


def restore_issue_custom_fields_latest_only(issue, user=None):
    """이슈의 삭제된 커스텀 필드 값들 중 마지막으로 설정된 것들만 복구"""
    deleted_custom_fields = CustomFieldValue.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    ).order_by('-updated_at')  # 최신순으로 정렬
    
    if deleted_custom_fields.exists():
        # 각 커스텀필드별로 가장 최근 값만 찾기
        latest_custom_fields = {}
        for cf_value in deleted_custom_fields:
            field_id = cf_value.custom_field_id
            if field_id not in latest_custom_fields:
                latest_custom_fields[field_id] = cf_value
        
        restored_count = 0
        for cf_value in latest_custom_fields.values():
            cf_value.deleted_at = None
            cf_value.updated_at = timezone.now()
            if user and not cf_value.updated_by:
                cf_value.updated_by = user
            cf_value.save()
            restored_count += 1
        
        total_deleted = deleted_custom_fields.count()
        print(f"   🔗 커스텀필드 {restored_count}개 복구 완료 (전체 {total_deleted}개 중 최신만)")
        return restored_count
    
    return 0


def check_issue_activities_and_comments(issue):
    """이슈의 복구 가능한 활동들과 댓글들 확인 (복구하지 않고 정보만 제공)"""
    total_available = 0
    
    print(f"📋 [{issue.project.identifier}-{issue.sequence_id}] 복구 가능한 데이터 확인:")
    
    # 0. created_by 누락 확인
    if not issue.created_by:
        print(f"   👤 누락된 생성자: 1개")
        total_available += 1
    else:
        print(f"   ✅ 생성자 존재: {issue.created_by.email}")
    
    # 1. 소프트 삭제된 활동들 확인
    deleted_activities = IssueActivity.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_activities.exists():
        deleted_count = deleted_activities.count()
        print(f"   📝 소프트삭제 활동: {deleted_count}개")
        total_available += deleted_count
        
        # 활동 유형별 분석
        activity_types = deleted_activities.values('verb').annotate(count=models.Count('verb')).order_by('-count')
        for activity_type in activity_types[:5]:  # 상위 5개만 표시
            print(f"      └─ {activity_type['verb']}: {activity_type['count']}개")
    
    # 2. 고아 활동들 확인
    orphaned_activities = IssueActivity.objects.filter(
        issue__isnull=True,
        project=issue.project,
        comment__icontains=f"{issue.project.identifier}-{issue.sequence_id}"
    )
    
    if orphaned_activities.exists():
        orphaned_count = orphaned_activities.count()
        print(f"   👻 고아활동 (댓글기반): {orphaned_count}개")
        total_available += orphaned_count
    
    # 3. 소프트 삭제된 댓글들 확인
    deleted_comments = IssueComment.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_comments.exists():
        comment_count = deleted_comments.count()
        print(f"   💬 소프트삭제 댓글: {comment_count}개")
        total_available += comment_count
        
        # 댓글 작성자별 분석 (상위 3명)
        comment_authors = deleted_comments.filter(actor__isnull=False).values('actor__email').annotate(count=models.Count('actor')).order_by('-count')[:3]
        for author in comment_authors:
            print(f"      └─ {author['actor__email']}: {author['count']}개")
    
    # 4. 고아 댓글들 확인
    try:
        orphaned_comments = IssueComment.objects.filter(
            issue__isnull=True,
            project=issue.project
        )
        
        orphan_comment_count = 0
        for comment in orphaned_comments:
            comment_text = comment.comment_stripped or comment.comment_html or ""
            if f"{issue.project.identifier}-{issue.sequence_id}" in comment_text:
                orphan_comment_count += 1
        
        if orphan_comment_count > 0:
            print(f"   👻 고아댓글 (내용기반): {orphan_comment_count}개")
            total_available += orphan_comment_count
    except Exception as e:
        print(f"   ⚠️  고아댓글 확인 중 오류: {str(e)}")
    
    # 5. 관련된 다른 활동들 확인
    try:
        issue_identifier = f"{issue.project.identifier}-{issue.sequence_id}"
        related_activities = IssueActivity.objects.filter(
            issue__isnull=True,
            project=issue.project
        ).filter(
            models.Q(old_value__icontains=issue_identifier) |
            models.Q(new_value__icontains=issue_identifier)
        )
        
        if related_activities.exists():
            related_count = related_activities.count()
            print(f"   🔗 관련활동 (값기반): {related_count}개")
            total_available += related_count
    except Exception as e:
        print(f"   ⚠️  관련활동 확인 중 오류: {str(e)}")
    
    # 6. 삭제된 담당자들 확인
    deleted_assignees = IssueAssignee.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_assignees.exists():
        assignee_count = deleted_assignees.count()
        print(f"   👥 소프트삭제 담당자: {assignee_count}개")
        total_available += assignee_count
    
    # 7. 삭제된 커스텀 필드들 확인
    deleted_custom_fields = CustomFieldValue.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_custom_fields.exists():
        cf_count = deleted_custom_fields.count()
        print(f"   🔧 소프트삭제 커스텀필드: {cf_count}개")
        total_available += cf_count
    
    print(f"   📊 총 복구 가능: {total_available}개")
    print()
    
    return total_available


def restore_issue_activities(issue):
    """이슈의 삭제된 활동들과 댓글들 복구 (개선된 버전)"""
    total_restored = 0
    
    # 1. 소프트 삭제된 활동들 복구 (해당 이슈에 직접 연결된)
    deleted_activities = IssueActivity.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_activities.exists():
        deleted_count = deleted_activities.count()
        deleted_activities.update(deleted_at=None, updated_at=timezone.now())
        print(f"   🔗 소프트삭제 활동 {deleted_count}개 복구 완료")
        total_restored += deleted_count
    
    # 2. 고아 활동들 복구 (issue 참조가 NULL인 것들)
    # 댓글에 이슈 식별자가 포함된 활동들
    orphaned_activities = IssueActivity.objects.filter(
        issue__isnull=True,
        project=issue.project,
        comment__icontains=f"{issue.project.identifier}-{issue.sequence_id}"
    )
    
    if orphaned_activities.exists():
        orphaned_count = orphaned_activities.count()
        orphaned_activities.update(issue=issue, updated_at=timezone.now())
        print(f"   🔗 고아활동 {orphaned_count}개 복구 완료")
        total_restored += orphaned_count
    
    # 3. 소프트 삭제된 댓글들 복구 (IssueComment)
    deleted_comments = IssueComment.all_objects.filter(
        issue=issue,
        deleted_at__isnull=False
    )
    
    if deleted_comments.exists():
        comment_count = deleted_comments.count()
        deleted_comments.update(deleted_at=None, updated_at=timezone.now())
        print(f"   🔗 소프트삭제 댓글 {comment_count}개 복구 완료")
        total_restored += comment_count
    
    # 4. 고아 댓글들 복구 (issue 참조가 NULL이지만 댓글 내용으로 식별 가능한)
    # 이는 드물지만 데이터 무결성 문제로 발생할 수 있음
    try:
        orphaned_comments = IssueComment.objects.filter(
            issue__isnull=True,
            project=issue.project
        )
        
        # 댓글 내용에서 이슈 식별자를 찾아서 복구
        restored_orphan_comments = 0
        for comment in orphaned_comments:
            comment_text = comment.comment_stripped or comment.comment_html or ""
            if f"{issue.project.identifier}-{issue.sequence_id}" in comment_text:
                comment.issue = issue
                comment.updated_at = timezone.now()
                comment.save()
                restored_orphan_comments += 1
        
        if restored_orphan_comments > 0:
            print(f"   🔗 고아댓글 {restored_orphan_comments}개 복구 완료")
            total_restored += restored_orphan_comments
            
    except Exception as e:
        print(f"   ⚠️  고아댓글 복구 중 오류: {str(e)}")
    
    # 5. 관련된 다른 활동들 복구 (old_value나 new_value에 이슈 식별자가 포함된)
    try:
        issue_identifier = f"{issue.project.identifier}-{issue.sequence_id}"
        related_activities = IssueActivity.objects.filter(
            issue__isnull=True,
            project=issue.project
        ).filter(
            models.Q(old_value__icontains=issue_identifier) |
            models.Q(new_value__icontains=issue_identifier)
        )
        
        if related_activities.exists():
            related_count = related_activities.count()
            related_activities.update(issue=issue, updated_at=timezone.now())
            print(f"   🔗 관련활동 {related_count}개 복구 완료")
            total_restored += related_count
            
    except Exception as e:
        print(f"   ⚠️  관련활동 복구 중 오류: {str(e)}")
    
    if total_restored == 0:
        print(f"   ℹ️  복구할 활동이 없습니다")
    
    return total_restored


def restore_issue_created_by(issue, user=None, creator_email=None):
    """이슈의 누락된 created_by 복구"""
    restored = False
    
    if not issue.created_by:
        if creator_email:
            # 이메일로 사용자 찾기
            try:
                creator = User.objects.get(email=creator_email)
                issue.created_by = creator
                issue.updated_at = timezone.now()
                issue.save()
                print(f"   👤 생성자 복구: {creator.email}")
                restored = True
            except User.DoesNotExist:
                print(f"   ⚠️  이메일 '{creator_email}'로 사용자를 찾을 수 없습니다.")
                if user:
                    issue.created_by = user
                    issue.updated_at = timezone.now()
                    issue.save()
                    print(f"   👤 생성자 복구 (대체): {user.email}")
                    restored = True
        elif user:
            # 기본 사용자로 설정
            issue.created_by = user
            issue.updated_at = timezone.now()
            issue.save()
            print(f"   👤 생성자 복구 (기본): {user.email}")
            restored = True
        else:
            print(f"   ⚠️  생성자를 설정할 사용자가 없습니다.")
    else:
        print(f"   ✅ 생성자 이미 존재: {issue.created_by.email}")
    
    return restored


def restore_issue(workspace_slug, project_identifier, issue_id, user=None):
    """단일 이슈 복구"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 삭제된 이슈 찾기
        issue = Issue.all_objects.get(
            id=issue_id,
            project=project,
            deleted_at__isnull=False
        )
        
        with transaction.atomic():
            # 관리자 사용자 설정
            if not user:
                user = User.objects.filter(is_superuser=True).first()
            
            # 생성자가 비어있는 경우 설정
            if not issue.created_by:
                print(f"⚠️  생성자가 비어있습니다. 관리자로 설정합니다: {user.email if user else 'None'}")
                issue.created_by = user
            
            # 수정자가 비어있는 경우 설정
            if not issue.updated_by:
                issue.updated_by = user
            
            # 소프트 삭제 해제
            issue.deleted_at = None
            issue.updated_at = timezone.now()
            issue.save()
            
            # 관련 데이터 복구
            restore_issue_activities(issue)
            restore_issue_assignees(issue, user)
            restore_issue_custom_fields(issue, user)
            
            # 복구 활동 로그 생성
            if user:
                IssueActivity.objects.create(
                    issue=issue,
                    verb='restored',
                    comment='삭제된 이슈 복구',
                    actor=user,
                    project=project,
                    workspace=workspace,
                    created_by=user,
                    updated_by=user,
                    epoch=int(timezone.now().timestamp())
                )
            
            print(f"✅ 이슈 복구 완료: {project.identifier}-{issue.sequence_id} | {issue.name}")
            return issue
            
    except Issue.DoesNotExist:
        print(f"❌ 삭제된 이슈 ID '{issue_id}'를 찾을 수 없습니다.")
        return None
    except Exception as e:
        print(f"❌ 이슈 복구 실패: {str(e)}")
        return None


def restore_parent_and_children(workspace_slug, project_identifier, parent_issue_id, user=None):
    """상위 이슈와 모든 하위 이슈 복구"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 상위 이슈 찾기
        parent_issue = Issue.all_objects.get(
            id=parent_issue_id,
            project=project,
            deleted_at__isnull=False
        )
        
        # 하위 이슈들 찾기 (삭제된 것들만)
        child_issues = Issue.all_objects.filter(
            parent=parent_issue,
            deleted_at__isnull=False
        )
        
        print(f"🔄 복구 대상:")
        print(f"   📁 상위이슈: {project.identifier}-{parent_issue.sequence_id} | {parent_issue.name}")
        print(f"   📄 하위이슈: {child_issues.count()}개")
        print()
        
        # 사용자 확인
        confirm = input("위의 이슈들을 복구하시겠습니까? (yes/no): ")
        if confirm.lower() != 'yes':
            print("복구가 취소되었습니다.")
            return None, []
        
        restored_count = 0
        
        with transaction.atomic():
            if not user:
                user = User.objects.filter(is_superuser=True).first()
            
            # 상위 이슈 복구
            # 생성자가 비어있는 경우 설정
            if not parent_issue.created_by:
                print(f"⚠️  상위이슈 생성자가 비어있습니다. 관리자로 설정합니다: {user.email if user else 'None'}")
                parent_issue.created_by = user
            if not parent_issue.updated_by:
                parent_issue.updated_by = user
                
            parent_issue.deleted_at = None
            parent_issue.updated_at = timezone.now()
            parent_issue.save()
            
            # 상위 이슈 관련 데이터 복구
            restore_issue_activities(parent_issue)
            restore_issue_assignees(parent_issue, user)
            restore_issue_custom_fields(parent_issue, user)
            
            if user:
                IssueActivity.objects.create(
                    issue=parent_issue,
                    verb='restored',
                    comment='삭제된 상위 이슈 복구',
                    actor=user,
                    project=project,
                    workspace=workspace,
                    created_by=user,
                    updated_by=user,
                    epoch=int(timezone.now().timestamp())
                )
            
            print(f"✅ 상위이슈 복구: {project.identifier}-{parent_issue.sequence_id}")
            restored_count += 1
            
            # 하위 이슈들 복구
            for child_issue in child_issues:
                # 생성자가 비어있는 경우 설정
                if not child_issue.created_by:
                    print(f"⚠️  하위이슈 생성자가 비어있습니다. 관리자로 설정합니다: {user.email if user else 'None'}")
                    child_issue.created_by = user
                if not child_issue.updated_by:
                    child_issue.updated_by = user
                    
                child_issue.deleted_at = None
                child_issue.updated_at = timezone.now()
                child_issue.save()
                
                # 하위 이슈 관련 데이터 복구
                restore_issue_activities(child_issue)
                restore_issue_assignees(child_issue, user)
                restore_issue_custom_fields(child_issue, user)
                
                if user:
                    IssueActivity.objects.create(
                        issue=child_issue,
                        verb='restored',
                        comment='삭제된 하위 이슈 복구',
                        actor=user,
                        project=project,
                        workspace=workspace,
                        created_by=user,
                        updated_by=user,
                        epoch=int(timezone.now().timestamp())
                    )
                
                print(f"✅ 하위이슈 복구: {project.identifier}-{child_issue.sequence_id} | {child_issue.name}")
                restored_count += 1
        
        print(f"\n🎉 총 {restored_count}개 이슈 복구 완료!")
        return parent_issue, list(child_issues)
        
    except Issue.DoesNotExist:
        print(f"❌ 삭제된 상위 이슈 ID '{parent_issue_id}'를 찾을 수 없습니다.")
        return None, []
    except Exception as e:
        print(f"❌ 복구 실패: {str(e)}")
        return None, []


def restore_issue_and_children_full(workspace_slug, project_identifier, issue_id, user=None):
    """특정 이슈와 모든 하위 이슈들을 관련 데이터와 함께 완전 복구"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 대상 이슈 찾기 (상위 이슈일 수도 있고 일반 이슈일 수도 있음)
        target_issue = Issue.all_objects.get(
            id=issue_id,
            project=project,
            deleted_at__isnull=False
        )
        
        # 하위 이슈들 찾기 (삭제된 것들만)
        child_issues = Issue.all_objects.filter(
            parent=target_issue,
            deleted_at__isnull=False
        )
        
        all_issues = [target_issue] + list(child_issues)
        
        print(f"🔄 완전 복구 대상:")
        print(f"   📁 대상이슈: {project.identifier}-{target_issue.sequence_id} | {target_issue.name}")
        if child_issues.exists():
            print(f"   📄 하위이슈: {child_issues.count()}개")
        
        # 복구할 관련 데이터 개수 미리 확인
        total_activities = 0
        total_assignees = 0
        total_custom_fields = 0
        
        for issue in all_issues:
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            ).count()
            
            deleted_assignees = IssueAssignee.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            deleted_custom_fields = CustomFieldValue.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            total_activities += orphaned_activities
            total_assignees += deleted_assignees
            total_custom_fields += deleted_custom_fields
        
        print(f"   🔗 복구할 고아활동: {total_activities}개")
        print(f"   🔗 복구할 담당자: {total_assignees}개")
        print(f"   🔗 복구할 커스텀필드: {total_custom_fields}개")
        print()
        
        # 사용자 확인
        confirm = input("위의 이슈들과 모든 관련 데이터를 복구하시겠습니까? (yes/no): ")
        if confirm.lower() != 'yes':
            print("복구가 취소되었습니다.")
            return None, []
        
        restored_count = 0
        total_restored_activities = 0
        total_restored_assignees = 0
        total_restored_custom_fields = 0
        
        with transaction.atomic():
            if not user:
                user = User.objects.filter(is_superuser=True).first()
            
            # 모든 이슈 복구
            for issue in all_issues:
                # 생성자가 비어있는 경우 설정
                if not issue.created_by:
                    print(f"⚠️  이슈 생성자가 비어있습니다. 관리자로 설정합니다: {user.email if user else 'None'}")
                    issue.created_by = user
                if not issue.updated_by:
                    issue.updated_by = user
                    
                issue.deleted_at = None
                issue.updated_at = timezone.now()
                issue.save()
                
                # 관련 데이터 복구
                activities_restored = restore_issue_activities(issue)
                assignees_restored = restore_issue_assignees(issue, user)
                custom_fields_restored = restore_issue_custom_fields(issue, user)
                
                total_restored_activities += activities_restored
                total_restored_assignees += assignees_restored
                total_restored_custom_fields += custom_fields_restored
                
                # 복구 활동 로그 생성
                if user:
                    comment = "삭제된 이슈 완전 복구 (활동, 담당자, 커스텀필드 포함)"
                    IssueActivity.objects.create(
                        issue=issue,
                        verb='restored',
                        comment=comment,
                        actor=user,
                        project=project,
                        workspace=workspace,
                        created_by=user,
                        updated_by=user,
                        epoch=int(timezone.now().timestamp())
                    )
        
        print(f"\n🎉 완전 복구 완료!")
        print(f"   📊 복구된 이슈: {restored_count}개")
        print(f"   📊 복구된 활동: {total_restored_activities}개")
        print(f"   📊 복구된 담당자: {total_restored_assignees}개")
        print(f"   📊 복구된 커스텀필드: {total_restored_custom_fields}개")
        
        return target_issue, list(child_issues)
        
    except Issue.DoesNotExist:
        print(f"❌ 삭제된 이슈 ID '{issue_id}'를 찾을 수 없습니다.")
        return None, []
    except Exception as e:
        print(f"❌ 완전 복구 실패: {str(e)}")
        return None, []


def restore_orphaned_activities(workspace_slug, project_identifier):
    """이미 복구된 이슈들의 고아 활동들을 복구"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 활성 이슈들 조회
        active_issues = Issue.objects.filter(project=project)
        
        print(f"\n🔗 [{project.identifier}] 고아 활동 복구:")
        print("=" * 80)
        
        total_restored = 0
        
        for issue in active_issues:
            # 해당 이슈의 고아 활동들 찾기
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            )
            
            if orphaned_activities.exists():
                orphaned_count = orphaned_activities.count()
                
                print(f"📄 이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                print(f"   └─ 고아활동: {orphaned_count}개 발견")
                
                # 고아 활동들을 이슈에 다시 연결
                with transaction.atomic():
                    orphaned_activities.update(issue=issue)
                    total_restored += orphaned_count
                
                print(f"   └─ ✅ {orphaned_count}개 활동 복구 완료")
                print()
        
        if total_restored == 0:
            print("❌ 복구할 고아 활동이 없습니다.")
        else:
            print(f"🎉 총 {total_restored}개의 고아 활동을 복구했습니다!")
        
        return total_restored
        
    except Workspace.DoesNotExist:
        print(f"❌ 워크스페이스 '{workspace_slug}'를 찾을 수 없습니다.")
        return 0
    except Project.DoesNotExist:
        print(f"❌ 프로젝트 '{project_identifier}'를 찾을 수 없습니다.")
        return 0
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return 0


def check_orphaned_activities(workspace_slug, project_identifier):
    """고아 활동들 현황만 확인 (복구하지 않음)"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        print(f"\n🔍 [{project.identifier}] 고아 활동 현황:")
        print("=" * 80)
        
        # 전체 고아 활동 수
        total_orphaned = IssueActivity.objects.filter(
            issue__isnull=True,
            project=project
        ).count()
        
        print(f"📊 전체 고아 활동: {total_orphaned}개")
        print()
        
        # 활성 이슈들의 고아 활동 확인
        active_issues = Issue.objects.filter(project=project)
        recoverable_count = 0
        
        for issue in active_issues:
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            )
            
            if orphaned_activities.exists():
                orphaned_count = orphaned_activities.count()
                recoverable_count += orphaned_count
                
                print(f"📄 이슈: {project.identifier}-{issue.sequence_id} | {issue.name}")
                print(f"   └─ 복구 가능한 고아활동: {orphaned_count}개")
        
        unrecoverable_count = total_orphaned - recoverable_count
        
        print(f"\n📊 요약:")
        print(f"   🔗 복구 가능: {recoverable_count}개")
        print(f"   ❓ 복구 불가능: {unrecoverable_count}개")
        
        return recoverable_count, unrecoverable_count
        
    except Workspace.DoesNotExist:
        print(f"❌ 워크스페이스 '{workspace_slug}'를 찾을 수 없습니다.")
        return 0, 0
    except Project.DoesNotExist:
        print(f"❌ 프로젝트 '{project_identifier}'를 찾을 수 없습니다.")
        return 0, 0
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return 0, 0


def restore_active_issue_data(workspace_slug, project_identifier, issue_id, user=None, creator_email=None):
    """이미 복구된(활성) 이슈의 누락된 관련 데이터들을 복구"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 활성 이슈 찾기 (이미 복구된 이슈)
        target_issue = Issue.objects.get(
            id=issue_id,
            project=project
        )
        
        # 하위 이슈들 찾기 (활성 이슈들)
        child_issues = Issue.objects.filter(
            parent=target_issue
        )
        
        all_issues = [target_issue] + list(child_issues)
        
        print(f"🔄 활성 이슈 데이터 복구 대상:")
        print(f"   📁 대상이슈: {project.identifier}-{target_issue.sequence_id} | {target_issue.name}")
        if child_issues.exists():
            print(f"   📄 하위이슈: {child_issues.count()}개")
        
        # 복구할 관련 데이터 개수 미리 확인
        total_activities = 0
        total_assignees = 0
        total_custom_fields = 0
        missing_creators = 0
        
        for issue in all_issues:
            # 기존 확인 항목들
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            ).count()
            
            # 소프트 삭제된 활동들도 확인
            soft_deleted_activities = IssueActivity.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 소프트 삭제된 댓글들도 확인
            soft_deleted_comments = IssueComment.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            deleted_assignees = IssueAssignee.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            deleted_custom_fields = CustomFieldValue.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # created_by 누락 확인
            if not issue.created_by:
                missing_creators += 1
            
            total_activities += (orphaned_activities + soft_deleted_activities + soft_deleted_comments)
            total_assignees += deleted_assignees
            total_custom_fields += deleted_custom_fields
        
        print(f"   🔗 복구할 활동/댓글: {total_activities}개")
        print(f"   🔗 복구할 담당자: {total_assignees}개")
        print(f"   🔗 복구할 커스텀필드: {total_custom_fields}개")
        print(f"   👤 누락된 생성자: {missing_creators}개")
        
        if creator_email:
            print(f"   📧 지정된 생성자 이메일: {creator_email}")
        
        if total_activities == 0 and total_assignees == 0 and total_custom_fields == 0 and missing_creators == 0:
            print("\n✅ 복구할 누락된 데이터가 없습니다!")
            return target_issue, list(child_issues)
        
        print()
        
        # 사용자 확인
        confirm = input("위의 누락된 관련 데이터들을 복구하시겠습니까? (yes/no): ")
        if confirm.lower() != 'yes':
            print("복구가 취소되었습니다.")
            return None, []
        
        total_restored_activities = 0
        total_restored_assignees = 0
        total_restored_custom_fields = 0
        total_restored_creators = 0
        
        with transaction.atomic():
            if not user:
                user = User.objects.filter(is_superuser=True).first()
            
            # 모든 이슈의 관련 데이터 복구
            for issue in all_issues:
                print(f"🔄 처리중: {project.identifier}-{issue.sequence_id} | {issue.name}")
                
                # created_by 복구 (가장 먼저)
                creator_restored = restore_issue_created_by(issue, user, creator_email)
                if creator_restored:
                    total_restored_creators += 1
                
                # 관련 데이터 복구
                activities_restored = restore_issue_activities(issue)
                assignees_restored = restore_issue_assignees(issue, user)
                custom_fields_restored = restore_issue_custom_fields(issue, user)
                
                total_restored_activities += activities_restored
                total_restored_assignees += assignees_restored
                total_restored_custom_fields += custom_fields_restored
                
                # 복구 활동 로그 생성 (데이터가 실제로 복구된 경우만)
                if (activities_restored > 0 or assignees_restored > 0 or custom_fields_restored > 0 or creator_restored) and user:
                    comment = f"누락된 관련 데이터 복구 (생성자:{1 if creator_restored else 0}, 활동:{activities_restored}, 담당자:{assignees_restored}, 커스텀필드:{custom_fields_restored})"
                    IssueActivity.objects.create(
                        issue=issue,
                        verb='data_restored',
                        comment=comment,
                        actor=user,
                        project=project,
                        workspace=workspace,
                        created_by=user,
                        updated_by=user,
                        epoch=int(timezone.now().timestamp())
                    )
        
        print(f"\n🎉 관련 데이터 복구 완료!")
        print(f"   📊 복구된 생성자: {total_restored_creators}개")
        print(f"   📊 복구된 활동: {total_restored_activities}개")
        print(f"   📊 복구된 담당자: {total_restored_assignees}개")
        print(f"   📊 복구된 커스텀필드: {total_restored_custom_fields}개")
        
        return target_issue, list(child_issues)
        
    except Issue.DoesNotExist:
        print(f"❌ 활성 이슈 ID '{issue_id}'를 찾을 수 없습니다.")
        print("💡 이 이슈가 아직 삭제된 상태라면 --restore-full 옵션을 사용하세요.")
        return None, []
    except Exception as e:
        print(f"❌ 관련 데이터 복구 실패: {str(e)}")
        return None, []


def restore_active_issue_data_latest_only(workspace_slug, project_identifier, issue_id, user=None, creator_email=None):
    """이미 복구된(활성) 이슈의 누락된 관련 데이터들을 복구 (담당자/커스텀필드는 최신만)"""
    try:
        workspace = Workspace.objects.get(slug=workspace_slug)
        project = Project.objects.get(identifier=project_identifier, workspace=workspace)
        
        # 활성 이슈 찾기 (이미 복구된 이슈)
        target_issue = Issue.objects.get(
            id=issue_id,
            project=project
        )
        
        # 하위 이슈들 찾기 (활성 이슈들)
        child_issues = Issue.objects.filter(
            parent=target_issue
        )
        
        all_issues = [target_issue] + list(child_issues)
        
        print(f"🔄 활성 이슈 데이터 복구 대상 (최신만):")
        print(f"   📁 대상이슈: {project.identifier}-{target_issue.sequence_id} | {target_issue.name}")
        if child_issues.exists():
            print(f"   📄 하위이슈: {child_issues.count()}개")
        
        # 복구할 관련 데이터 개수 미리 확인
        total_activities = 0
        total_assignees = 0
        total_custom_fields = 0
        missing_creators = 0
        
        for issue in all_issues:
            # 기존 확인 항목들
            orphaned_activities = IssueActivity.objects.filter(
                issue__isnull=True,
                project=project,
                comment__icontains=f"{project.identifier}-{issue.sequence_id}"
            ).count()
            
            # 소프트 삭제된 활동들도 확인
            soft_deleted_activities = IssueActivity.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # 소프트 삭제된 댓글들도 확인
            soft_deleted_comments = IssueComment.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            deleted_assignees = IssueAssignee.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            deleted_custom_fields = CustomFieldValue.all_objects.filter(
                issue=issue,
                deleted_at__isnull=False
            ).count()
            
            # created_by 누락 확인
            if not issue.created_by:
                missing_creators += 1
            
            total_activities += (orphaned_activities + soft_deleted_activities + soft_deleted_comments)
            total_assignees += deleted_assignees
            total_custom_fields += deleted_custom_fields
        
        print(f"   🔗 복구할 활동/댓글: {total_activities}개")
        print(f"   🔗 복구할 담당자: {total_assignees}개 (최신만)")
        print(f"   🔗 복구할 커스텀필드: {total_custom_fields}개 (최신만)")
        print(f"   👤 누락된 생성자: {missing_creators}개")
        
        if creator_email:
            print(f"   📧 지정된 생성자 이메일: {creator_email}")
        
        if total_activities == 0 and total_assignees == 0 and total_custom_fields == 0 and missing_creators == 0:
            print("\n✅ 복구할 누락된 데이터가 없습니다!")
            return target_issue, list(child_issues)
        
        print()
        
        # 사용자 확인
        confirm = input("위의 누락된 관련 데이터들을 복구하시겠습니까? (담당자/커스텀필드는 최신만) (yes/no): ")
        if confirm.lower() != 'yes':
            print("복구가 취소되었습니다.")
            return None, []
        
        total_restored_activities = 0
        total_restored_assignees = 0
        total_restored_custom_fields = 0
        total_restored_creators = 0
        
        with transaction.atomic():
            if not user:
                user = User.objects.filter(is_superuser=True).first()
            
            # 모든 이슈의 관련 데이터 복구
            for issue in all_issues:
                print(f"🔄 처리중: {project.identifier}-{issue.sequence_id} | {issue.name}")
                
                # created_by 복구 (가장 먼저)
                creator_restored = restore_issue_created_by(issue, user, creator_email)
                if creator_restored:
                    total_restored_creators += 1
                
                # 관련 데이터 복구 (담당자/커스텀필드는 최신만)
                activities_restored = restore_issue_activities(issue)
                assignees_restored = restore_issue_assignees_latest_only(issue, user)
                custom_fields_restored = restore_issue_custom_fields_latest_only(issue, user)
                
                total_restored_activities += activities_restored
                total_restored_assignees += assignees_restored
                total_restored_custom_fields += custom_fields_restored
                
                # 복구 활동 로그 생성 (데이터가 실제로 복구된 경우만)
                if (activities_restored > 0 or assignees_restored > 0 or custom_fields_restored > 0 or creator_restored) and user:
                    comment = f"누락된 관련 데이터 복구-최신만 (생성자:{1 if creator_restored else 0}, 활동:{activities_restored}, 담당자:{assignees_restored}, 커스텀필드:{custom_fields_restored})"
                    IssueActivity.objects.create(
                        issue=issue,
                        verb='data_restored_latest',
                        comment=comment,
                        actor=user,
                        project=project,
                        workspace=workspace,
                        created_by=user,
                        updated_by=user,
                        epoch=int(timezone.now().timestamp())
                    )
        
        print(f"\n🎉 관련 데이터 복구 완료 (최신만)!")
        print(f"   📊 복구된 생성자: {total_restored_creators}개")
        print(f"   📊 복구된 활동: {total_restored_activities}개")
        print(f"   📊 복구된 담당자: {total_restored_assignees}개")
        print(f"   📊 복구된 커스텀필드: {total_restored_custom_fields}개")
        
        return target_issue, list(child_issues)
        
    except Issue.DoesNotExist:
        print(f"❌ 활성 이슈 ID '{issue_id}'를 찾을 수 없습니다.")
        print("💡 이 이슈가 아직 삭제된 상태라면 --restore-full 옵션을 사용하세요.")
        return None, []
    except Exception as e:
        print(f"❌ 관련 데이터 복구 실패: {str(e)}")
        return None, []


def main():
    parser = argparse.ArgumentParser(description='삭제된 이슈 복구 도구')
    parser.add_argument('--workspace', '-w', required=True, help='워크스페이스 슬러그')
    parser.add_argument('--project', '-p', required=True, help='프로젝트 식별자')
    parser.add_argument('--list', '-l', action='store_true', help='삭제된 이슈 목록 보기')
    parser.add_argument('--restore', '-r', help='복구할 이슈 ID')
    parser.add_argument('--restore-parent', '-rp', help='상위 이슈와 하위 이슈들 일괄 복구할 상위 이슈 ID')
    parser.add_argument('--restore-full', '-rf', help='특정 이슈와 하위 이슈들의 모든 관련 데이터 완전 복구할 이슈 ID')
    parser.add_argument('--restore-data', '-rd', help='이미 복구된 이슈의 누락된 관련 데이터(활동, 담당자, 커스텀필드, 생성자) 복구할 이슈 ID')
    parser.add_argument('--restore-data-latest', '-rdl', help='이미 복구된 이슈의 누락된 관련 데이터 복구 (담당자/커스텀필드는 최신만)할 이슈 ID')
    parser.add_argument('--check-activities', '-ca', action='store_true', help='고아 활동 현황 확인')
    parser.add_argument('--restore-activities', '-ra', action='store_true', help='고아 활동들 복구')
    parser.add_argument('--check-issue-data', '-cid', help='특정 이슈의 복구 가능한 활동/댓글 데이터 확인 (이슈 ID)')
    parser.add_argument('--admin-email', help='복구 작업을 수행할 관리자 이메일')
    parser.add_argument('--creator-email', help='누락된 created_by 필드에 설정할 생성자 이메일 (--restore-data, --restore-data-latest와 함께 사용)')
    
    args = parser.parse_args()
    
    # 관리자 사용자 설정
    admin_user = None
    if args.admin_email:
        try:
            admin_user = User.objects.get(email=args.admin_email)
            print(f"👤 관리자: {admin_user.email}")
        except User.DoesNotExist:
            print(f"⚠️  관리자 '{args.admin_email}'를 찾을 수 없습니다. 기본 관리자를 사용합니다.")
    
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()
        if admin_user:
            print(f"👤 기본 관리자 사용: {admin_user.email}")
    
    if args.list:
        find_deleted_issues(args.workspace, args.project)
    elif args.restore:
        restore_issue(args.workspace, args.project, args.restore, admin_user)
    elif args.restore_parent:
        restore_parent_and_children(args.workspace, args.project, args.restore_parent, admin_user)
    elif args.restore_full:
        restore_issue_and_children_full(args.workspace, args.project, args.restore_full, admin_user)
    elif args.restore_data:
        restore_active_issue_data(args.workspace, args.project, args.restore_data, admin_user, args.creator_email)
    elif args.restore_data_latest:
        restore_active_issue_data_latest_only(args.workspace, args.project, args.restore_data_latest, admin_user, args.creator_email)
    elif args.check_activities:
        check_orphaned_activities(args.workspace, args.project)
    elif args.restore_activities:
        restore_orphaned_activities(args.workspace, args.project)
    elif args.check_issue_data:
        # 새로운 기능: 특정 이슈의 복구 가능한 데이터 확인
        try:
            workspace = Workspace.objects.get(slug=args.workspace)
            project = Project.objects.get(identifier=args.project, workspace=workspace)
            
            # 먼저 삭제된 이슈에서 찾아보기
            try:
                issue = Issue.all_objects.get(id=args.check_issue_data, project=project, deleted_at__isnull=False)
                print(f"🔍 삭제된 이슈 분석: {project.identifier}-{issue.sequence_id} | {issue.name}")
            except Issue.DoesNotExist:
                # 활성 이슈에서 찾아보기
                try:
                    issue = Issue.objects.get(id=args.check_issue_data, project=project)
                    print(f"🔍 활성 이슈 분석: {project.identifier}-{issue.sequence_id} | {issue.name}")
                except Issue.DoesNotExist:
                    print(f"❌ 이슈 ID '{args.check_issue_data}'를 찾을 수 없습니다.")
                    return
            
            check_issue_activities_and_comments(issue)
            
        except Workspace.DoesNotExist:
            print(f"❌ 워크스페이스 '{args.workspace}'를 찾을 수 없습니다.")
        except Project.DoesNotExist:
            print(f"❌ 프로젝트 '{args.project}'를 찾을 수 없습니다.")
    else:
        print("❌ 다음 옵션 중 하나를 선택해주세요:")
        print("   --list: 삭제된 이슈 목록 보기")
        print("   --restore: 특정 이슈 복구")
        print("   --restore-parent: 상위 이슈와 하위 이슈들 일괄 복구")
        print("   --restore-full: 특정 이슈와 하위 이슈들의 모든 관련 데이터 완전 복구")
        print("   --restore-data: 이미 복구된 이슈의 누락된 관련 데이터 복구 (생성자 포함)")
        print("   --restore-data-latest: 이미 복구된 이슈의 누락된 관련 데이터 복구 (담당자/커스텀필드는 최신만)")
        print("   --check-activities: 고아 활동 현황 확인")
        print("   --restore-activities: 고아 활동들 복구")
        print("   --check-issue-data: 특정 이슈의 복구 가능한 활동/댓글 데이터 확인")
        print("   --creator-email: 생성자 이메일 지정 (--restore-data와 함께 사용)")
        parser.print_help()


if __name__ == '__main__':
    main() 