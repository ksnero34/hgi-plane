from lxml import html

# Django imports
from django.utils import timezone
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from datetime import datetime
import json

# Third Party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer, DynamicBaseSerializer
from .user import UserLiteSerializer
from .state import StateLiteSerializer
from .project import ProjectLiteSerializer
from .workspace import WorkspaceLiteSerializer
from plane.db.models import (
    User,
    Issue,
    IssueActivity,
    IssueComment,
    IssueUserProperty,
    IssueAssignee,
    IssueSubscriber,
    IssueLabel,
    Label,
    CycleIssue,
    Cycle,
    Module,
    ModuleIssue,
    IssueLink,
    FileAsset,
    IssueReaction,
    CommentReaction,
    IssueVote,
    IssueRelation,
    State,
    IssueVersion,
    IssueDescriptionVersion,
    ProjectMember,
    CustomField,
    CustomFieldValue,
    IssueType,
    ProjectIssueType,
    EstimatePoint,
)
from plane.utils.content_validator import (
    validate_html_content,
    validate_binary_data,
)

def format_custom_field_value_for_activity(field, value):
    """커스텀 필드 값을 activity 표시용으로 포맷팅"""
    if value is None:
        return "없음"

    try:
        if field.field_type == "project_member":
            # 단일 멤버인 경우 UUID 그대로 반환 (프론트엔드에서 변환)
            return str(value)

        elif field.field_type == "project_members":
            # 다중 멤버인 경우 UUID 배열을 JSON 문자열로 반환
            try:
                if isinstance(value, str):
                    member_ids = json.loads(value) if value.startswith('[') else [value]
                elif isinstance(value, list):
                    member_ids = value
                else:
                    member_ids = [value]

                # UUID 배열을 JSON 문자열로 반환
                return json.dumps(member_ids)
            except (json.JSONDecodeError, ValueError):
                return str(value)

        elif field.field_type in ["select", "multiselect"]:
            # 선택 필드인 경우
            if field.field_type == "multiselect":
                try:
                    if isinstance(value, str):
                        options = json.loads(value) if value.startswith('[') else [value]
                    elif isinstance(value, list):
                        options = value
                    else:
                        options = [value]
                    return ", ".join(str(opt) for opt in options)
                except (json.JSONDecodeError, ValueError):
                    return str(value)
            else:
                return str(value)
        else:
            # 기타 필드 타입 (text, number, date 등)
            return str(value)

    except Exception:
        return str(value)


class IssueFlatSerializer(BaseSerializer):
    ## Contain only flat fields

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "description",
            "description_html",
            "priority",
            "start_date",
            "target_date",
            "sequence_id",
            "sort_order",
            "is_draft",
        ]


class IssueProjectLiteSerializer(BaseSerializer):
    project_detail = ProjectLiteSerializer(source="project", read_only=True)

    class Meta:
        model = Issue
        fields = ["id", "project_detail", "name", "sequence_id"]
        read_only_fields = fields


##TODO: Find a better way to write this serializer
## Find a better approach to save manytomany?
class IssueCreateSerializer(BaseSerializer):
    # ids
    state_id = serializers.PrimaryKeyRelatedField(
        source="state", queryset=State.all_state_objects.all(), required=False, allow_null=True
    )
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent", queryset=Issue.objects.all(), required=False, allow_null=True
    )
    type_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    label_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=Label.objects.all()),
        write_only=True,
        required=False,
    )
    assignee_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.all()),
        write_only=True,
        required=False,
    )
    project_id = serializers.UUIDField(source="project.id", read_only=True)
    workspace_id = serializers.UUIDField(source="workspace.id", read_only=True)
    custom_field_values = serializers.ListField(
        child=serializers.JSONField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Issue
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def validate_custom_field_values(self, values):
        """커스텀 필드 값 유효성 검사"""
        if not values:
            return values

        project_id = self.context.get("project_id")
        custom_fields = CustomField.objects.filter(
            project_id=project_id,
            deleted_at__isnull=True
        )
        custom_field_map = {str(field.id): field for field in custom_fields}
        duplicate_detector = set()

        for value in values:
            field_id = value.get("custom_field_id")
            if not field_id:
                raise serializers.ValidationError("custom_field_id는 필수입니다.")

            field_id_str = str(field_id)
            if field_id_str in duplicate_detector:
                raise serializers.ValidationError(
                    f"커스텀 필드 {field_id} 값이 중복으로 전달되었습니다."
                )
            duplicate_detector.add(field_id_str)

            field = custom_field_map.get(str(field_id))
            if not field:
                raise serializers.ValidationError(f"커스텀 필드 {field_id}를 찾을 수 없습니다.")

            # 필수 필드 체크
            if field.is_required and value.get("value") is None:
                raise serializers.ValidationError(f"필드 {field.name}는 필수입니다.")

            # 타입별 유효성 검사
            field_value = value.get("value")
            if field_value is not None:
                if field.field_type == "text":
                    # text 필드: 문자열 타입 검증
                    if not isinstance(field_value, str):
                        raise serializers.ValidationError(f"필드 {field.name}는 문자열이어야 합니다.")
                elif field.field_type == "number":
                    try:
                        float(field_value)
                    except (TypeError, ValueError):
                        raise serializers.ValidationError(f"필드 {field.name}는 숫자여야 합니다.")
                elif field.field_type == "date":
                    try:
                        datetime.strptime(field_value, "%Y-%m-%d")
                    except (TypeError, ValueError):
                        raise serializers.ValidationError(f"필드 {field.name}는 YYYY-MM-DD 형식이어야 합니다.")
                elif field.field_type in ["select", "multiselect"]:
                    options = field.options or []
                    if field.field_type == "select":
                        if field_value not in options:
                            raise serializers.ValidationError(f"필드 {field.name}의 값이 유효하지 않습니다.")
                    else:  # multiselect
                        if not isinstance(field_value, list):
                            raise serializers.ValidationError(f"필드 {field.name}는 리스트여야 합니다.")
                        if not all(v in options for v in field_value):
                            raise serializers.ValidationError(f"필드 {field.name}의 값이 유효하지 않습니다.")
                elif field.field_type in ["project_member", "project_members"]:
                    # 프로젝트 멤버 검증 로직
                    if field.field_type == "project_member":
                        # 단일 멤버 검증
                        if not ProjectMember.objects.filter(
                            project_id=self.context.get("project_id"),
                            member_id=field_value,
                            is_active=True
                        ).exists():
                            raise serializers.ValidationError(f"필드 {field.name}의 멤버가 유효하지 않습니다.")
                    else:  # project_members
                        # 다중 멤버 검증
                        if not isinstance(field_value, list):
                            raise serializers.ValidationError(f"필드 {field.name}는 리스트여야 합니다.")

                        valid_members = ProjectMember.objects.filter(
                            project_id=self.context.get("project_id"),
                            member_id__in=field_value,
                            is_active=True
                        ).values_list("member_id", flat=True)

                        if len(valid_members) != len(field_value):
                            raise serializers.ValidationError(f"필드 {field.name}에 유효하지 않은 멤버가 포함되어 있습니다.")

        return values

    def to_representation(self, instance):
        data = super().to_representation(instance)
        assignee_ids = self.initial_data.get("assignee_ids")
        data["assignee_ids"] = assignee_ids if assignee_ids else []
        label_ids = self.initial_data.get("label_ids")
        data["label_ids"] = label_ids if label_ids else []

        # Convert IssueType ID to ProjectIssueType ID for consistency with frontend
        if instance.type_id:
            project_id = self.context.get("project_id")
            if project_id:
                project_issue_type = ProjectIssueType.objects.filter(
                    issue_type_id=instance.type_id,
                    project_id=project_id,
                    deleted_at__isnull=True
                ).first()
                if project_issue_type:
                    data["type_id"] = str(project_issue_type.id)

        # 커스텀 필드 값 포함 (간소화된 형태)
        custom_field_values = CustomFieldValue.objects.filter(
            issue=instance,
            deleted_at__isnull=True
        ).select_related('custom_field')

        data["custom_field_values"] = [
            {
                "custom_field_id": str(cfv.custom_field_id),
                "value": cfv.value,
                "field_name": cfv.custom_field.name,
                "field_type": cfv.custom_field.field_type,
            }
            for cfv in custom_field_values
        ]

        return data

    def validate(self, attrs):
        allow_triage = self.context.get("allow_triage_state", False)
        state_manager = State.triage_objects if allow_triage else State.objects

        if (
            attrs.get("start_date", None) is not None
            and attrs.get("target_date", None) is not None
            and attrs.get("start_date", None) > attrs.get("target_date", None)
        ):
            raise serializers.ValidationError("Start date cannot exceed target date")

        # Validate description content for security
        if "description_html" in attrs and attrs["description_html"]:
            is_valid, error_msg, sanitized_html = validate_html_content(attrs["description_html"])
            if not is_valid:
                raise serializers.ValidationError({"error": "html content is not valid"})
            # Update the attrs with sanitized HTML if available
            if sanitized_html is not None:
                attrs["description_html"] = sanitized_html

        if "description_binary" in attrs and attrs["description_binary"]:
            is_valid, error_msg = validate_binary_data(attrs["description_binary"])
            if not is_valid:
                raise serializers.ValidationError({"description_binary": "Invalid binary data"})

        # Validate assignees are from project
        if attrs.get("assignee_ids", []):
            attrs["assignee_ids"] = ProjectMember.objects.filter(
                project_id=self.context["project_id"],
                role__gte=8,
                is_active=True,
                member_id__in=attrs["assignee_ids"],
            ).values_list("member_id", flat=True)

        # Validate labels are from project
        if attrs.get("label_ids"):
            label_ids = [label.id for label in attrs["label_ids"]]
            attrs["label_ids"] = list(
                Label.objects.filter(
                    project_id=self.context.get("project_id"),
                    id__in=label_ids,
                ).values_list("id", flat=True)
            )

        # Check state is from the project only else raise validation error
        if (
            attrs.get("state")
            and not state_manager.filter(
                project_id=self.context.get("project_id"),
                pk=attrs.get("state").id,
            ).exists()
        ):
            raise serializers.ValidationError("State is not valid please pass a valid state_id")

        # Check parent issue is from workspace as it can be cross workspace
        if (
            attrs.get("parent")
            and not Issue.objects.filter(
                project_id=self.context.get("project_id"),
                pk=attrs.get("parent").id,
            ).exists()
        ):
            raise serializers.ValidationError("Parent is not valid issue_id please pass a valid issue_id")

        if (
            attrs.get("estimate_point")
            and not EstimatePoint.objects.filter(
                project_id=self.context.get("project_id"),
                pk=attrs.get("estimate_point").id,
            ).exists()
        ):
            raise serializers.ValidationError(
                "Estimate point is not valid please pass a valid estimate_point_id"
            )
        # Check workflow transition rules for state changes (for updates only)
        if self.instance and attrs.get("state") and self.instance.state != attrs.get("state"):
            # Only validate workflow transitions for existing issues with workflow assigned
            if self.instance.workflow:
                from plane.db.models import WorkflowTransition

                from_state = self.instance.state
                to_state = attrs.get("state")

                # Check if transition exists in workflow
                transition = WorkflowTransition.objects.filter(
                    workflow=self.instance.workflow,
                    from_state=from_state,
                    to_state=to_state
                ).first()

                if not transition:
                    raise serializers.ValidationError(
                        f"State transition from '{from_state.name}' to '{to_state.name}' is not allowed by workflow rules"
                    )

        # Handle type_id validation and conversion
        if attrs.get("type_id"):
            workspace_id = self.context.get("workspace_id")
            project_id = self.context.get("project_id")

            # First try to find IssueType directly
            issue_type = IssueType.objects.filter(
                id=attrs["type_id"],
                workspace_id=workspace_id
            ).first()

            if not issue_type:
                # If not found, try to find through ProjectIssueType
                project_issue_type = ProjectIssueType.objects.filter(
                    id=attrs["type_id"],
                    project_id=project_id,
                    deleted_at__isnull=True
                ).first()

                if project_issue_type:
                    issue_type = project_issue_type.issue_type
                else:
                    raise serializers.ValidationError(f"Issue type with id {attrs['type_id']} does not exist in this workspace or project")

            attrs["type"] = issue_type
            # Remove type_id from attrs since it's not a model field
            attrs.pop("type_id", None)

        return attrs

    def get_valid_assignees(self, assignees, project_id):
        if not assignees:
            return []

        return ProjectMember.objects.filter(
            project_id=project_id,
            role__gte=8,
            is_active=True,
            member_id__in=assignees
        ).values_list('member_id', flat=True)

    def create(self, validated_data):
        custom_field_values = validated_data.pop("custom_field_values", None)
        assignees = validated_data.pop("assignee_ids", None)
        labels = validated_data.pop("label_ids", None)

        # Get project_id from context
        project_id = self.context["project_id"]
        workspace_id = self.context["workspace_id"]
        default_assignee_id = self.context["default_assignee_id"]

        # Check for default workflow and set workflow_id if exists
        from plane.db.models import WorkflowTemplate

        # Get the default workflow for the project
        default_workflow = WorkflowTemplate.objects.filter(
            project_id=project_id,
            is_default=True,
            is_active=True,
            deleted_at__isnull=True
        ).first()

        if default_workflow:
            # Set the workflow_id for the new issue
            validated_data["workflow_id"] = default_workflow.id

            # If state is not provided, set initial state from workflow
            if not validated_data.get("state"):
                from plane.db.models import WorkflowState

                # Get the first state that allows new issues
                initial_state = WorkflowState.objects.filter(
                    workflow=default_workflow,
                    allow_new_issues=True,
                    deleted_at__isnull=True
                ).order_by('sequence').first()

                if initial_state:
                    validated_data["state_id"] = initial_state.state_id

        # Create Issue
        with transaction.atomic():
            issue = Issue.objects.create(**validated_data, project_id=project_id)

            # Issue Audit Users
            created_by_id = issue.created_by_id
            updated_by_id = issue.updated_by_id

            if assignees is not None and len(assignees):
                try:
                    IssueAssignee.objects.bulk_create(
                        [
                            IssueAssignee(
                                assignee_id=assignee_id,
                                issue=issue,
                                project_id=project_id,
                                workspace_id=workspace_id,
                                created_by_id=created_by_id,
                                updated_by_id=updated_by_id,
                            )
                            for assignee_id in assignees
                        ],
                        batch_size=10,
                    )
                except IntegrityError:
                    pass
            else:
                # Then assign it to default assignee, if it is a valid assignee
                if (
                    default_assignee_id is not None
                    and ProjectMember.objects.filter(
                        member_id=default_assignee_id,
                        project_id=project_id,
                        role__gte=8,
                        is_active=True,
                    ).exists()
                ):
                    try:
                        IssueAssignee.objects.create(
                            assignee_id=default_assignee_id,
                            issue=issue,
                            project_id=project_id,
                            workspace_id=workspace_id,
                            created_by_id=created_by_id,
                            updated_by_id=updated_by_id,
                        )
                    except IntegrityError:
                        pass

            if labels is not None and len(labels):
                try:
                    IssueLabel.objects.bulk_create(
                        [
                            IssueLabel(
                                label_id=label_id,
                                issue=issue,
                                project_id=project_id,
                                workspace_id=workspace_id,
                                created_by_id=created_by_id,
                                updated_by_id=updated_by_id,
                            )
                            for label_id in labels
                        ],
                        batch_size=10,
                    )
                except IntegrityError:
                    pass

            if custom_field_values:
                for field_value in custom_field_values:
                    # 커스텀 필드 값 생성
                    CustomFieldValue.objects.create(
                        custom_field_id=field_value["custom_field_id"],
                        issue=issue,
                        value=field_value["value"],
                        project_id=project_id,
                        workspace_id=workspace_id,
                        created_by_id=created_by_id,
                        updated_by_id=updated_by_id,
                    )

        return issue

    def update(self, instance, validated_data):
        custom_field_values = validated_data.pop("custom_field_values", None)
        assignees = validated_data.pop("assignee_ids", None)
        labels = validated_data.pop("label_ids", None)

        # Related models
        project_id = instance.project_id
        workspace_id = instance.workspace_id
        created_by_id = instance.created_by_id
        updated_by_id = instance.updated_by_id

        if assignees is not None:
            IssueAssignee.objects.filter(issue=instance).delete()
            try:
                IssueAssignee.objects.bulk_create(
                    [
                        IssueAssignee(
                            assignee_id=assignee_id,
                            issue=instance,
                            project_id=project_id,
                            workspace_id=workspace_id,
                            created_by_id=created_by_id,
                            updated_by_id=updated_by_id,
                        )
                        for assignee_id in assignees
                    ],
                    batch_size=10,
                    ignore_conflicts=True,
                )
            except IntegrityError:
                pass

        if labels is not None:
            IssueLabel.objects.filter(issue=instance).delete()
            try:
                IssueLabel.objects.bulk_create(
                    [
                        IssueLabel(
                            label_id=label_id,
                            issue=instance,
                            project_id=project_id,
                            workspace_id=workspace_id,
                            created_by_id=created_by_id,
                            updated_by_id=updated_by_id,
                        )
                        for label_id in labels
                    ],
                    batch_size=10,
                    ignore_conflicts=True,
                )
            except IntegrityError:
                pass

        if custom_field_values is not None:
            # print(f"[IssueCreateSerializer] Processing custom field values: {custom_field_values}")

            # 중복된 custom_field_id 제거 - 마지막 값만 사용
            unique_custom_fields = {}
            for field_value in custom_field_values:
                field_id = field_value["custom_field_id"]
                unique_custom_fields[field_id] = field_value

            # print(f"[IssueCreateSerializer] After deduplication: {list(unique_custom_fields.values())}")

            # 커스텀 필드 정보 가져오기
            custom_fields = CustomField.objects.filter(
                id__in=[field_value["custom_field_id"] for field_value in unique_custom_fields.values()],
                deleted_at__isnull=True
            )
            custom_field_map = {str(field.id): field for field in custom_fields}

            # 새로운 값들 생성/수정
            for field_value in unique_custom_fields.values():
                field_id = field_value.get("custom_field_id")
                new_value = field_value.get("value")
                field = custom_field_map.get(str(field_id)) if field_id else None

                if not field:
                    # print(f"[IssueCreateSerializer] Field {field_id} not found, skipping")
                    continue

                # print(f"[IssueCreateSerializer] Processing field {field_id} ({field.field_type}) with value {new_value}")

                # 모든 타입 동일 처리: 하나의 custom_field_id에 하나의 값 (단일값 또는 JSON 배열)
                existing_value = CustomFieldValue.objects.filter(
                    issue=instance,
                    custom_field_id=field_id,
                    deleted_at__isnull=True
                ).first()

                if existing_value:
                    # 기존 값 업데이트
                    previous_value = existing_value.value

                    # print(f"[IssueCreateSerializer] Updating existing field {field_id}: {previous_value} -> {new_value}")

                    if existing_value.value != new_value:
                        existing_value.value = new_value
                        existing_value.updated_by_id = updated_by_id
                        existing_value.save()

                        # 활동 로그 생성
                        # IssueActivity 객체를 직접 생성하지 않고 issue_activity.delay 호출
                        # (issue_activity.delay는 메인 HTTP 요청 처리 후 별도 워커에서 수행됨)
                        from plane.bgtasks.issue_activities_task import issue_activity

                        # 값 변환
                        old_value_str = format_custom_field_value_for_activity(field, previous_value)
                        new_value_str = format_custom_field_value_for_activity(field, new_value)

                        # 활동 로그 생성 - identifier는 project_member 타입만 사용
                        old_identifier = previous_value if field.field_type == "project_member" else None
                        new_identifier = new_value if field.field_type == "project_member" else None

                        issue_activity.delay(
                            type="issue.activity.updated",
                            requested_data=json.dumps({
                                "field": f"custom_field_{field.name}",
                                "old_value": old_value_str,
                                "new_value": new_value_str,
                                "old_identifier": old_identifier,
                                "new_identifier": new_identifier,
                                "custom_field_id": field_id
                            }),
                            current_instance=None,
                            issue_id=str(instance.id),
                            actor_id=str(updated_by_id),
                            project_id=str(project_id),
                            epoch=int(timezone.now().timestamp()),
                            notification=True
                        )
                    else:
                        # print(f"[IssueCreateSerializer] Field {field_id} value unchanged: {new_value}")
                        pass
                else:
                    # 새로운 값 생성
                    # print(f"[IssueCreateSerializer] Creating new field {field_id} with value {new_value}")

                    CustomFieldValue.objects.create(
                        custom_field_id=field_id,
                        issue=instance,
                        value=new_value,
                        project_id=project_id,
                        workspace_id=workspace_id,
                        created_by_id=created_by_id,
                        updated_by_id=updated_by_id,
                    )

                    # print(f"[IssueCreateSerializer] Successfully created field {field_id}")

                    # 이중 활동 로그 생성 방지를 위해 주석 처리
                    # 활동 로그는 issue_activity.delay를 통해 처리됨
                    """
                    # 활동 로그 생성
                    new_identifier = None
                    if field.field_type == "project_member":
                        new_identifier = new_value
                    
                    IssueActivity.objects.create(
                        issue=instance,
                        project_id=project_id,
                        workspace_id=workspace_id,
                        actor_id=updated_by_id,
                        verb="created",
                        field=f"custom_field_{field.name}",
                        new_value=format_custom_field_value_for_activity(field, new_value),
                        new_identifier=new_identifier,
                        comment=f"커스텀 필드 '{field.name}' 값을 '{format_custom_field_value_for_activity(field, new_value)}'로 설정했습니다."
                    )
                    """

        # Time updation occues even when other related models are updated
        instance.updated_at = timezone.now()
        return super().update(instance, validated_data)


class IssueActivitySerializer(BaseSerializer):
    actor_detail = UserLiteSerializer(read_only=True, source="actor")
    issue_detail = IssueFlatSerializer(read_only=True, source="issue")
    project_detail = ProjectLiteSerializer(read_only=True, source="project")
    workspace_detail = WorkspaceLiteSerializer(read_only=True, source="workspace")
    source_data = serializers.SerializerMethodField()

    def get_source_data(self, obj):
        if hasattr(obj, "issue") and hasattr(obj.issue, "source_data") and obj.issue.source_data:
            return {
                "source": obj.issue.source_data[0].source,
                "source_email": obj.issue.source_data[0].source_email,
                "extra": obj.issue.source_data[0].extra,
            }
        return None

    class Meta:
        model = IssueActivity
        fields = "__all__"


class IssueUserPropertySerializer(BaseSerializer):
    class Meta:
        model = IssueUserProperty
        fields = "__all__"
        read_only_fields = ["user", "workspace", "project"]


class LabelSerializer(BaseSerializer):
    class Meta:
        model = Label
        fields = [
            "parent",
            "name",
            "color",
            "id",
            "project_id",
            "workspace_id",
            "sort_order",
        ]
        read_only_fields = ["workspace", "project"]

    def validate_name(self, value):
        project_id = self.context.get("project_id")

        label = Label.objects.filter(project_id=project_id, name__iexact=value)

        if self.instance:
            label = label.exclude(id=self.instance.pk)

        if label.exists():
            raise serializers.ValidationError(detail="LABEL_NAME_ALREADY_EXISTS")

        return value


class LabelLiteSerializer(BaseSerializer):
    class Meta:
        model = Label
        fields = ["id", "name", "color"]


class IssueLabelSerializer(BaseSerializer):
    class Meta:
        model = IssueLabel
        fields = "__all__"
        read_only_fields = ["workspace", "project"]


class IssueRelationSerializer(BaseSerializer):
    id = serializers.UUIDField(source="related_issue.id", read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(source="related_issue.project_id", read_only=True)
    sequence_id = serializers.IntegerField(source="related_issue.sequence_id", read_only=True)
    name = serializers.CharField(source="related_issue.name", read_only=True)
    relation_type = serializers.CharField(read_only=True)
    state_id = serializers.UUIDField(source="related_issue.state.id", read_only=True)
    priority = serializers.CharField(source="related_issue.priority", read_only=True)
    assignee_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.all()),
        write_only=True,
        required=False,
    )

    class Meta:
        model = IssueRelation
        fields = [
            "id",
            "project_id",
            "sequence_id",
            "relation_type",
            "name",
            "state_id",
            "priority",
            "assignee_ids",
            "created_by",
            "created_at",
            "updated_at",
            "updated_by",
        ]
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "created_at",
            "updated_by",
            "updated_at",
        ]


class RelatedIssueSerializer(BaseSerializer):
    id = serializers.UUIDField(source="issue.id", read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(source="issue.project_id", read_only=True)
    sequence_id = serializers.IntegerField(source="issue.sequence_id", read_only=True)
    name = serializers.CharField(source="issue.name", read_only=True)
    relation_type = serializers.CharField(read_only=True)
    state_id = serializers.UUIDField(source="issue.state.id", read_only=True)
    priority = serializers.CharField(source="issue.priority", read_only=True)
    assignee_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.all()),
        write_only=True,
        required=False,
    )

    class Meta:
        model = IssueRelation
        fields = [
            "id",
            "project_id",
            "sequence_id",
            "relation_type",
            "name",
            "state_id",
            "priority",
            "assignee_ids",
            "created_by",
            "created_at",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "created_at",
            "updated_by",
            "updated_at",
        ]


class IssueAssigneeSerializer(BaseSerializer):
    assignee_details = UserLiteSerializer(read_only=True, source="assignee")

    class Meta:
        model = IssueAssignee
        fields = "__all__"


class CycleBaseSerializer(BaseSerializer):
    class Meta:
        model = Cycle
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueCycleDetailSerializer(BaseSerializer):
    cycle_detail = CycleBaseSerializer(read_only=True, source="cycle")

    class Meta:
        model = CycleIssue
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class ModuleBaseSerializer(BaseSerializer):
    class Meta:
        model = Module
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueModuleDetailSerializer(BaseSerializer):
    module_detail = ModuleBaseSerializer(read_only=True, source="module")

    class Meta:
        model = ModuleIssue
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueLinkSerializer(BaseSerializer):
    created_by_detail = UserLiteSerializer(read_only=True, source="created_by")

    class Meta:
        model = IssueLink
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "issue",
        ]

    def to_internal_value(self, data):
        # Modify the URL before validation by appending http:// if missing
        url = data.get("url", "")
        if url and not url.startswith(("http://", "https://")):
            data["url"] = "http://" + url

        return super().to_internal_value(data)

    def validate_url(self, value):
        # Use Django's built-in URLValidator for validation
        url_validator = URLValidator()
        try:
            url_validator(value)
        except ValidationError:
            raise serializers.ValidationError({"error": "Invalid URL format."})

        return value

    # Validation if url already exists
    def create(self, validated_data):
        if IssueLink.objects.filter(url=validated_data.get("url"), issue_id=validated_data.get("issue_id")).exists():
            raise serializers.ValidationError({"error": "URL already exists for this Issue"})
        return IssueLink.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if (
            IssueLink.objects.filter(url=validated_data.get("url"), issue_id=instance.issue_id)
            .exclude(pk=instance.id)
            .exists()
        ):
            raise serializers.ValidationError({"error": "URL already exists for this Issue"})

        return super().update(instance, validated_data)


class IssueLinkLiteSerializer(BaseSerializer):
    class Meta:
        model = IssueLink
        fields = [
            "id",
            "issue_id",
            "title",
            "url",
            "metadata",
            "created_by_id",
            "created_at",
        ]
        read_only_fields = fields


class IssueAttachmentSerializer(BaseSerializer):
    asset_url = serializers.CharField(read_only=True)

    class Meta:
        model = FileAsset
        fields = "__all__"
        read_only_fields = [
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "workspace",
            "project",
            "issue",
        ]


class IssueAttachmentLiteSerializer(DynamicBaseSerializer):
    class Meta:
        model = FileAsset
        fields = [
            "id",
            "asset",
            "attributes",
            # "issue_id",
            "created_by",
            "updated_at",
            "updated_by",
            "asset_url",
        ]
        read_only_fields = fields


class IssueReactionSerializer(BaseSerializer):
    actor_detail = UserLiteSerializer(read_only=True, source="actor")

    class Meta:
        model = IssueReaction
        fields = "__all__"
        read_only_fields = ["workspace", "project", "issue", "actor", "deleted_at"]


class IssueReactionLiteSerializer(DynamicBaseSerializer):
    display_name = serializers.CharField(source="actor.display_name", read_only=True)

    class Meta:
        model = IssueReaction
        fields = ["id", "actor", "issue", "reaction", "display_name"]


class CommentReactionSerializer(BaseSerializer):
    display_name = serializers.CharField(source="actor.display_name", read_only=True)

    class Meta:
        model = CommentReaction
        fields = [
            "id",
            "actor",
            "comment",
            "reaction",
            "display_name",
            "deleted_at",
            "workspace",
            "project",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["workspace", "project", "comment", "actor", "deleted_at", "created_by", "updated_by"]


class IssueVoteSerializer(BaseSerializer):
    actor_detail = UserLiteSerializer(read_only=True, source="actor")

    class Meta:
        model = IssueVote
        fields = ["issue", "vote", "workspace", "project", "actor", "actor_detail"]
        read_only_fields = fields


class IssueCommentSerializer(BaseSerializer):
    actor_detail = UserLiteSerializer(read_only=True, source="actor")
    issue_detail = IssueFlatSerializer(read_only=True, source="issue")
    project_detail = ProjectLiteSerializer(read_only=True, source="project")
    workspace_detail = WorkspaceLiteSerializer(read_only=True, source="workspace")
    comment_reactions = CommentReactionSerializer(read_only=True, many=True)
    is_member = serializers.BooleanField(read_only=True)

    class Meta:
        model = IssueComment
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueStateFlatSerializer(BaseSerializer):
    state_detail = StateLiteSerializer(read_only=True, source="state")
    project_detail = ProjectLiteSerializer(read_only=True, source="project")

    class Meta:
        model = Issue
        fields = ["id", "sequence_id", "name", "state_detail", "project_detail"]


# Issue Serializer with state details
class IssueStateSerializer(DynamicBaseSerializer):
    label_details = LabelLiteSerializer(read_only=True, source="labels", many=True)
    state_detail = StateLiteSerializer(read_only=True, source="state")
    project_detail = ProjectLiteSerializer(read_only=True, source="project")
    assignee_details = UserLiteSerializer(read_only=True, source="assignees", many=True)
    sub_issues_count = serializers.IntegerField(read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)
    link_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Issue
        fields = "__all__"


class IssueIntakeSerializer(DynamicBaseSerializer):
    label_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "priority",
            "sequence_id",
            "project_id",
            "created_at",
            "label_ids",
            "created_by",
        ]
        read_only_fields = fields


class CustomFieldSerializer(BaseSerializer):
    class Meta:
        model = CustomField
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]

    def validate(self, data):
        field_type = data.get("field_type")
        options = data.get("options", [])

        if field_type in ["select", "multiselect"]:
            if not options or len(options) == 0:
                raise serializers.ValidationError("선택 타입의 필드는 최소 하나의 옵션이 필요합니다.")
        elif field_type == "date":
            # 날짜 타입은 options가 필요하지 않음
            pass
        elif field_type in ["project_member", "project_members"]:
            # 프로젝트 멤버 타입은 options가 필요하지 않음
            pass

        return data

    def to_representation(self, instance):
        """Convert IssueType ID to ProjectIssueType ID in response"""
        data = super().to_representation(instance)

        # Convert issue_type from IssueType to ProjectIssueType
        if data.get('issue_type') and instance.issue_type:
            try:
                project_issue_type = ProjectIssueType.objects.get(
                    issue_type_id=instance.issue_type_id,
                    project_id=instance.project_id,
                    deleted_at__isnull=True
                )
                data['issue_type'] = str(project_issue_type.id)
            except ProjectIssueType.DoesNotExist:
                pass

        return data

    def update(self, instance, validated_data):
        # key 필드는 수정할 수 없도록 제거
        validated_data.pop('key', None)
        return super().update(instance, validated_data)


class CustomFieldValueSerializer(BaseSerializer):
    class Meta:
        model = CustomFieldValue
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by"]

    def validate(self, data):
        custom_field = data.get("custom_field")
        value = data.get("value")

        if custom_field.is_required and value is None:
            raise serializers.ValidationError("이 필드는 필수입니다.")

        if value is not None:
            field_type = custom_field.field_type

            if field_type == "text":
                # text 필드: 문자열 타입 검증
                if not isinstance(value, str):
                    raise serializers.ValidationError(f"필드 {custom_field.name}는 문자열이어야 합니다.")
            elif field_type == "number":
                try:
                    float(value)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(f"필드 {custom_field.name}는 숫자여야 합니다.")
            elif field_type == "date":
                try:
                    datetime.strptime(value, "%Y-%m-%d")
                except (TypeError, ValueError):
                    raise serializers.ValidationError(f"필드 {custom_field.name}는 YYYY-MM-DD 형식이어야 합니다.")
            elif field_type in ["select", "multiselect"]:
                options = custom_field.options
                if field_type == "select":
                    if value not in options:
                        raise serializers.ValidationError("유효하지 않은 선택값입니다.")
                else:  # multiselect
                    if not isinstance(value, list):
                        raise serializers.ValidationError("다중 선택은 리스트 형태여야 합니다.")
                    if not all(v in options for v in value):
                        raise serializers.ValidationError("유효하지 않은 선택값이 포함되어 있습니다.")
            elif field_type in ["project_member", "project_members"]:
                # 프로젝트 멤버 검증 로직
                if field_type == "project_member":
                    # 단일 멤버 검증
                    if not ProjectMember.objects.filter(
                        project_id=custom_field.project_id,
                        member_id=value,
                        is_active=True
                    ).exists():
                        raise serializers.ValidationError("유효하지 않은 프로젝트 멤버입니다.")
                else:  # project_members
                    # 다중 멤버 검증
                    if not isinstance(value, list):
                        raise serializers.ValidationError("프로젝트 멤버(다중)는 리스트 형태여야 합니다.")

                    valid_members = ProjectMember.objects.filter(
                        project_id=custom_field.project_id,
                        member_id__in=value,
                        is_active=True
                    ).values_list("member_id", flat=True)

                    if len(valid_members) != len(value):
                        raise serializers.ValidationError("유효하지 않은 프로젝트 멤버가 포함되어 있습니다.")

        return data


class IssueSerializer(DynamicBaseSerializer):
    # ids
    cycle_id = serializers.PrimaryKeyRelatedField(read_only=True)
    module_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    # Many to many
    label_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    assignee_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    # Count items
    sub_issues_count = serializers.IntegerField(read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)
    link_count = serializers.IntegerField(read_only=True)
    custom_field_values = serializers.SerializerMethodField()

    def get_custom_field_values(self, obj):
        """커스텀 필드 값을 간소화된 형태로 반환"""
        custom_field_values = CustomFieldValue.objects.filter(
            issue=obj,
            deleted_at__isnull=True,
            custom_field__isnull=False,
            custom_field__deleted_at__isnull=True  # 삭제된 커스텀 필드 제외
        ).select_related('custom_field')

        return [
            {
                "custom_field_id": str(cfv.custom_field_id),
                "value": cfv.value,
                "field_name": cfv.custom_field.name,
                "field_type": cfv.custom_field.field_type,
            }
            for cfv in custom_field_values
        ]

    def to_representation(self, instance):
        """Convert IssueType ID to ProjectIssueType ID in response"""
        data = super().to_representation(instance)

        # Convert type_id from IssueType to ProjectIssueType
        if data.get('type_id') and instance.type_id:
            try:
                project_issue_type = ProjectIssueType.objects.get(
                    issue_type_id=instance.type_id,
                    project_id=instance.project_id,
                    deleted_at__isnull=True
                )
                data['type_id'] = str(project_issue_type.id)
                # print(f"IssueSerializer: Converted type_id from {instance.type_id} to {project_issue_type.id}")
            except ProjectIssueType.DoesNotExist:
                # print(f"IssueSerializer: No ProjectIssueType found for issue_type_id={instance.type_id}, project_id={instance.project_id}")
                pass
        else:
            # print(f"IssueSerializer: type_id is None or empty - data.type_id={data.get('type_id')}, instance.type_id={instance.type_id}")
            pass
        return data

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "state_id",
            "type_id",
            "sort_order",
            "completed_at",
            "estimate_point",
            "priority",
            "start_date",
            "target_date",
            "sequence_id",
            "project_id",
            "parent_id",
            "cycle_id",
            "module_ids",
            "label_ids",
            "assignee_ids",
            "sub_issues_count",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "attachment_count",
            "link_count",
            "is_draft",
            "archived_at",
            "custom_field_values",
        ]
        read_only_fields = fields

    def validate(self, data):
        if (
            data.get("state_id")
            and not State.objects.filter(project_id=self.context.get("project_id"), pk=data.get("state_id")).exists()
        ):
            raise serializers.ValidationError("State is not valid please pass a valid state_id")
        return data


class IssueListDetailSerializer(serializers.Serializer):
    def __init__(self, *args, **kwargs):
        # Extract expand parameter and store it as instance variable
        self.expand = kwargs.pop("expand", []) or []
        # Extract fields parameter and store it as instance variable
        self.fields = kwargs.pop("fields", []) or []
        super().__init__(*args, **kwargs)

    def get_module_ids(self, obj):
        return [module.module_id for module in obj.issue_module.all()]

    def get_label_ids(self, obj):
        return [label.label_id for label in obj.label_issue.all()]

    def get_assignee_ids(self, obj):
        return [assignee.assignee_id for assignee in obj.issue_assignee.all()]

    def to_representation(self, instance):
        data = {
            # Basic fields
            "id": instance.id,
            "name": instance.name,
            "state_id": instance.state_id,
            "type_id": instance.type_id,
            "sort_order": instance.sort_order,
            "completed_at": instance.completed_at,
            "estimate_point": instance.estimate_point_id,
            "priority": instance.priority,
            "start_date": instance.start_date,
            "target_date": instance.target_date,
            "sequence_id": instance.sequence_id,
            "project_id": instance.project_id,
            "parent_id": instance.parent_id,
            "created_at": instance.created_at,
            "updated_at": instance.updated_at,
            "created_by": instance.created_by_id,
            "updated_by": instance.updated_by_id,
            "is_draft": instance.is_draft,
            "archived_at": instance.archived_at,
            # Computed fields
            "cycle_id": instance.cycle_id,
            "module_ids": self.get_module_ids(instance),
            "label_ids": self.get_label_ids(instance),
            "assignee_ids": self.get_assignee_ids(instance),
            "sub_issues_count": instance.sub_issues_count,
            "attachment_count": instance.attachment_count,
            "link_count": instance.link_count,
        }

        # Handle expanded fields only when requested - using direct field access
        if self.expand:
            if "issue_relation" in self.expand:
                relations = []
                for relation in instance.issue_relation.all():
                    related_issue = relation.related_issue
                    # If the related issue is deleted, skip it
                    if not related_issue:
                        continue
                    # Add the related issue to the relations list
                    relations.append(
                        {
                            "id": related_issue.id,
                            "project_id": related_issue.project_id,
                            "sequence_id": related_issue.sequence_id,
                            "name": related_issue.name,
                            "relation_type": relation.relation_type,
                            "state_id": related_issue.state_id,
                            "priority": related_issue.priority,
                            "created_by": related_issue.created_by_id,
                            "created_at": related_issue.created_at,
                            "updated_at": related_issue.updated_at,
                            "updated_by": related_issue.updated_by_id,
                        }
                    )
                data["issue_relation"] = relations

            if "issue_related" in self.expand:
                related = []
                for relation in instance.issue_related.all():
                    issue = relation.issue
                    # If the related issue is deleted, skip it
                    if not issue:
                        continue
                    # Add the related issue to the related list
                    related.append(
                        {
                            "id": issue.id,
                            "project_id": issue.project_id,
                            "sequence_id": issue.sequence_id,
                            "name": issue.name,
                            "relation_type": relation.relation_type,
                            "state_id": issue.state_id,
                            "priority": issue.priority,
                            "created_by": issue.created_by_id,
                            "created_at": issue.created_at,
                            "updated_at": issue.updated_at,
                            "updated_by": issue.updated_by_id,
                        }
                    )
                data["issue_related"] = related

        return data


class IssueLiteSerializer(DynamicBaseSerializer):
    class Meta:
        model = Issue
        fields = ["id", "sequence_id", "project_id"]
        read_only_fields = fields


class IssueDetailSerializer(IssueSerializer):
    description_html = serializers.CharField()
    is_subscribed = serializers.BooleanField(read_only=True)
    is_intake = serializers.BooleanField(read_only=True)

    class Meta(IssueSerializer.Meta):
        fields = IssueSerializer.Meta.fields + [
            "description_html",
            "is_subscribed",
            "is_intake",
        ]
        read_only_fields = fields


class IssuePublicSerializer(BaseSerializer):
    project_detail = ProjectLiteSerializer(read_only=True, source="project")
    state_detail = StateLiteSerializer(read_only=True, source="state")
    reactions = IssueReactionSerializer(read_only=True, many=True, source="issue_reactions")
    votes = IssueVoteSerializer(read_only=True, many=True)

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "description_html",
            "sequence_id",
            "state",
            "state_detail",
            "project",
            "project_detail",
            "workspace",
            "priority",
            "target_date",
            "reactions",
            "votes",
        ]
        read_only_fields = fields


class IssueSubscriberSerializer(BaseSerializer):
    class Meta:
        model = IssueSubscriber
        fields = "__all__"
        read_only_fields = ["workspace", "project", "issue"]


class IssueVersionDetailSerializer(BaseSerializer):
    class Meta:
        model = IssueVersion
        fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "parent",
            "state",
            "estimate_point",
            "name",
            "priority",
            "start_date",
            "target_date",
            "assignees",
            "sequence_id",
            "labels",
            "sort_order",
            "completed_at",
            "archived_at",
            "is_draft",
            "external_source",
            "external_id",
            "type",
            "cycle",
            "modules",
            "meta",
            "name",
            "last_saved_at",
            "owned_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["workspace", "project", "issue"]


class IssueDescriptionVersionDetailSerializer(BaseSerializer):
    class Meta:
        model = IssueDescriptionVersion
        fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "description_binary",
            "description_html",
            "description_stripped",
            "description_json",
            "last_saved_at",
            "owned_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["workspace", "project", "issue"]
