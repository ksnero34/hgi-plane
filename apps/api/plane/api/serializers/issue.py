# Django imports
from django.utils import timezone
from lxml import html
from django.db import IntegrityError

#  Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import (
    Issue,
    IssueType,
    IssueActivity,
    IssueAssignee,
    FileAsset,
    IssueComment,
    IssueLabel,
    IssueLink,
    Label,
    ProjectMember,
    State,
    User,
    EstimatePoint,
    CustomField,
    CustomFieldValue,
)
from plane.utils.content_validator import (
    validate_html_content,
    validate_binary_data,
)

from .base import BaseSerializer
from .cycle import CycleLiteSerializer, CycleSerializer
from .module import ModuleLiteSerializer, ModuleSerializer
from .state import StateLiteSerializer
from .user import UserLiteSerializer

# Django imports
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator


class IssueSerializer(BaseSerializer):
    """
    Comprehensive work item serializer with full relationship management.

    Handles complete work item lifecycle including assignees, labels, validation,
    and related model updates. Supports dynamic field expansion and HTML content
    processing.
    """

    assignees = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.values_list("id", flat=True)),
        write_only=True,
        required=False,
    )

    labels = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=Label.objects.values_list("id", flat=True)),
        write_only=True,
        required=False,
    )

    custom_field_values = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    type_id = serializers.PrimaryKeyRelatedField(
        source="type", queryset=IssueType.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Issue
        read_only_fields = ["id", "workspace", "project", "updated_by", "updated_at"]
        exclude = ["description", "description_stripped"]

    def validate(self, data):
        if (
            data.get("start_date", None) is not None
            and data.get("target_date", None) is not None
            and data.get("start_date", None) > data.get("target_date", None)
        ):
            raise serializers.ValidationError("Start date cannot exceed target date")

        try:
            if data.get("description_html", None) is not None:
                parsed = html.fromstring(data["description_html"])
                parsed_str = html.tostring(parsed, encoding="unicode")
                data["description_html"] = parsed_str

        except Exception:
            raise serializers.ValidationError("Invalid HTML passed")

        # Validate description content for security
        if data.get("description_html"):
            is_valid, error_msg, sanitized_html = validate_html_content(data["description_html"])
            if not is_valid:
                raise serializers.ValidationError({"error": "html content is not valid"})
            # Update the data with sanitized HTML if available
            if sanitized_html is not None:
                data["description_html"] = sanitized_html

        if data.get("description_binary"):
            is_valid, error_msg = validate_binary_data(data["description_binary"])
            if not is_valid:
                raise serializers.ValidationError({"description_binary": "Invalid binary data"})

        # Validate assignees are from project
        if data.get("assignees", []):
            data["assignees"] = ProjectMember.objects.filter(
                project_id=self.context.get("project_id"),
                is_active=True,
                role__gte=8,
                member_id__in=data["assignees"],
            ).values_list("member_id", flat=True)

        # Validate labels are from project
        if data.get("labels", []):
            data["labels"] = Label.objects.filter(
                project_id=self.context.get("project_id"), id__in=data["labels"]
            ).values_list("id", flat=True)

        # Check state is from the project only else raise validation error
        if (
            data.get("state")
            and not State.objects.filter(project_id=self.context.get("project_id"), pk=data.get("state").id).exists()
        ):
            raise serializers.ValidationError("State is not valid please pass a valid state_id")

        # Check workflow transition rules for state changes
        if self.instance and data.get("state") and self.instance.state != data.get("state"):
            # Only validate workflow transitions for existing issues with workflow assigned
            if self.instance.workflow:
                from plane.db.models import WorkflowTransition

                from_state = self.instance.state
                to_state = data.get("state")

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

        # Check parent issue is from workspace as it can be cross workspace
        if (
            data.get("parent")
            and not Issue.objects.filter(
                workspace_id=self.context.get("workspace_id"),
                project_id=self.context.get("project_id"),
                pk=data.get("parent").id,
            ).exists()
        ):
            raise serializers.ValidationError("Parent is not valid issue_id please pass a valid issue_id")

        if (
            data.get("estimate_point")
            and not EstimatePoint.objects.filter(
                workspace_id=self.context.get("workspace_id"),
                project_id=self.context.get("project_id"),
                pk=data.get("estimate_point").id,
            ).exists()
        ):
            raise serializers.ValidationError("Estimate point is not valid please pass a valid estimate_point_id")

        return data

    def create(self, validated_data):
        assignees = validated_data.pop("assignees", None)
        labels = validated_data.pop("labels", None)
        custom_field_values = validated_data.pop("custom_field_values", None)

        project_id = self.context["project_id"]
        workspace_id = self.context["workspace_id"]
        default_assignee_id = self.context["default_assignee_id"]

        issue_type = validated_data.pop("type", None)

        if not issue_type:
            # Get default issue type
            issue_type = IssueType.objects.filter(project_issue_types__project_id=project_id, is_default=True).first()
            issue_type = issue_type

        issue = Issue.objects.create(**validated_data, project_id=project_id, type=issue_type)

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
            try:
                # Then assign it to default assignee, if it is a valid assignee
                if (
                    default_assignee_id is not None
                    and ProjectMember.objects.filter(
                        member_id=default_assignee_id,
                        project_id=project_id,
                        role__gte=15,
                        is_active=True,
                    ).exists()
                ):
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

        # 커스텀 필드 값 생성
        if custom_field_values:
            # 현재 이슈 타입에 해당하는 커스텀 필드와 프로젝트 공통 커스텀 필드를 가져옴
            valid_custom_fields = CustomField.objects.filter(
                Q(project_id=project_id) &
                (Q(issue_type=issue_type) | Q(issue_type__isnull=True))
            ).values_list("id", flat=True)

            for field_value in custom_field_values:
                custom_field_id = field_value["custom_field_id"]
                if custom_field_id not in valid_custom_fields:
                    print(f"[IssueSerializer] Invalid custom_field_id {custom_field_id} for issue type {issue_type.id}, skipping.")
                    continue
                try:
                    CustomFieldValue.objects.create(
                        custom_field_id=custom_field_id,
                        issue=issue,
                        value=field_value["value"],
                        project_id=project_id,
                        workspace_id=workspace_id,
                        created_by_id=created_by_id,
                        updated_by_id=updated_by_id,
                    )
                except Exception as e:
                    # 커스텀 필드 생성 실패 시 로그만 남기고 계속 진행
                    print(f"커스텀 필드 값 생성 실패: {e}")

        return issue

    def update(self, instance, validated_data):
        assignees = validated_data.pop("assignees", None)
        labels = validated_data.pop("labels", None)
        custom_field_values = validated_data.pop("custom_field_values", None)

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

        # 커스텀 필드 값 업데이트
        if custom_field_values is not None:
            print(f"[IssueSerializer] Processing custom field values: {custom_field_values}")

            # 중복된 custom_field_id 제거 - 마지막 값만 사용
            unique_custom_fields = {}
            for field_value in custom_field_values:
                field_id = field_value["custom_field_id"]
                unique_custom_fields[field_id] = field_value

            print(f"[IssueSerializer] After deduplication: {list(unique_custom_fields.values())}")

            # 현재 이슈 타입에 해당하는 커스텀 필드와 프로젝트 공통 커스텀 필드를 가져옴
            issue_type = instance.type # 현재 이슈의 타입
            valid_custom_fields = CustomField.objects.filter(
                Q(project_id=project_id) &
                (Q(issue_type=issue_type) | Q(issue_type__isnull=True))
            ).values_list("id", flat=True)

            # 커스텀 필드 정보 가져오기
            custom_fields = CustomField.objects.filter(
                id__in=[field_value["custom_field_id"] for field_value in unique_custom_fields.values() if field_value["custom_field_id"] in valid_custom_fields],
                deleted_at__isnull=True
            )
            custom_field_map = {str(field.id): field for field in custom_fields}

            # 새로운 값들 생성/수정
            for field_value in unique_custom_fields.values():
                field_id = field_value["custom_field_id"]
                new_value = field_value["value"]

                if field_id not in valid_custom_fields:
                    print(f"[IssueSerializer] Invalid custom_field_id {field_id} for issue type {issue_type.id}, skipping update.")
                    continue

                field = custom_field_map.get(str(field_id))

                if not field:
                    print(f"[IssueSerializer] Field {field_id} not found, skipping")
                    continue

                print(f"[IssueSerializer] Processing field {field_id} ({field.field_type}) with value {new_value}")

                # 모든 타입 동일 처리: 하나의 custom_field_id에 하나의 값 (단일값 또는 JSON 배열)
                existing_value = CustomFieldValue.objects.filter(
                    issue=instance,
                    custom_field_id=field_id,
                    deleted_at__isnull=True
                ).first()

                if existing_value:
                    # 기존 값 업데이트
                    if existing_value.value != new_value:
                        existing_value.value = new_value
                        existing_value.updated_by_id = updated_by_id
                        existing_value.save()

                        print(f"[IssueSerializer] Successfully updated field {field_id}")
                    else:
                        print(f"[IssueSerializer] Field {field_id} value unchanged: {new_value}")
                else:
                    # 새로운 값 생성
                    print(f"[IssueSerializer] Creating new field {field_id} with value {new_value}")

                    CustomFieldValue.objects.create(
                        custom_field_id=field_id,
                        issue=instance,
                        value=new_value,
                        project_id=project_id,
                        workspace_id=workspace_id,
                        created_by_id=created_by_id,
                        updated_by_id=updated_by_id,
                    )

                    print(f"[IssueSerializer] Successfully created field {field_id}")

        # Time updation occues even when other related models are updated
        instance.updated_at = timezone.now()
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "assignees" in self.fields:
            if "assignees" in self.expand:
                from .user import UserLiteSerializer

                data["assignees"] = UserLiteSerializer(
                    User.objects.filter(
                        pk__in=IssueAssignee.objects.filter(issue=instance).values_list("assignee_id", flat=True)
                    ),
                    many=True,
                ).data
            else:
                data["assignees"] = [
                    str(assignee)
                    for assignee in IssueAssignee.objects.filter(issue=instance).values_list("assignee_id", flat=True)
                ]
        if "labels" in self.fields:
            if "labels" in self.expand:
                data["labels"] = LabelSerializer(
                    Label.objects.filter(
                        pk__in=IssueLabel.objects.filter(issue=instance).values_list("label_id", flat=True)
                    ),
                    many=True,
                ).data
            else:
                data["labels"] = [
                    str(label) for label in IssueLabel.objects.filter(issue=instance).values_list("label_id", flat=True)
                ]

        # 커스텀 필드 값 포함
        custom_field_values = CustomFieldValue.objects.filter(
            issue=instance,
            deleted_at__isnull=True
        ).select_related('custom_field')

        data["custom_field_values"] = [
            {
                "custom_field_id": str(cfv.custom_field_id),
                "value": cfv.value,
            }
            for cfv in custom_field_values
        ]

        return data


class IssueLiteSerializer(BaseSerializer):
    """
    Lightweight work item serializer for minimal data transfer.

    Provides essential work item identifiers optimized for list views,
    references, and performance-critical operations.
    """

    class Meta:
        model = Issue
        fields = ["id", "sequence_id", "project_id"]
        read_only_fields = fields


class LabelCreateUpdateSerializer(BaseSerializer):
    """
    Serializer for creating and updating work item labels.

    Manages label metadata including colors, descriptions, hierarchy,
    and sorting for work item categorization and filtering.
    """

    class Meta:
        model = Label
        fields = [
            "name",
            "color",
            "description",
            "external_source",
            "external_id",
            "parent",
            "sort_order",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class LabelSerializer(BaseSerializer):
    """
    Full serializer for work item labels with complete metadata.

    Provides comprehensive label information including hierarchical relationships,
    visual properties, and organizational data for work item tagging.
    """

    class Meta:
        model = Label
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class IssueLinkCreateSerializer(BaseSerializer):
    """
    Serializer for creating work item external links with validation.

    Handles URL validation, format checking, and duplicate prevention
    for attaching external resources to work items.
    """

    class Meta:
        model = IssueLink
        fields = ["title", "url", "issue_id"]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def validate_url(self, value):
        # Check URL format
        validate_url = URLValidator()
        try:
            validate_url(value)
        except ValidationError:
            raise serializers.ValidationError("Invalid URL format.")

        # Check URL scheme
        if not value.startswith(("http://", "https://")):
            raise serializers.ValidationError("Invalid URL scheme.")

        return value

    # Validation if url already exists
    def create(self, validated_data):
        if IssueLink.objects.filter(url=validated_data.get("url"), issue_id=validated_data.get("issue_id")).exists():
            raise serializers.ValidationError({"error": "URL already exists for this Issue"})
        return IssueLink.objects.create(**validated_data)


class IssueLinkUpdateSerializer(IssueLinkCreateSerializer):
    """
    Serializer for updating work item external links.

    Extends link creation with update-specific validation to prevent
    URL conflicts and maintain link integrity during modifications.
    """

    class Meta(IssueLinkCreateSerializer.Meta):
        model = IssueLink
        fields = IssueLinkCreateSerializer.Meta.fields + [
            "issue_id",
        ]
        read_only_fields = IssueLinkCreateSerializer.Meta.read_only_fields

    def update(self, instance, validated_data):
        if (
            IssueLink.objects.filter(url=validated_data.get("url"), issue_id=instance.issue_id)
            .exclude(pk=instance.id)
            .exists()
        ):
            raise serializers.ValidationError({"error": "URL already exists for this Issue"})

        return super().update(instance, validated_data)


class IssueLinkSerializer(BaseSerializer):
    """
    Full serializer for work item external links.

    Provides complete link information including metadata and timestamps
    for managing external resource associations with work items.
    """

    class Meta:
        model = IssueLink
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueAttachmentSerializer(BaseSerializer):
    """
    Serializer for work item file attachments.

    Manages file asset associations with work items including metadata,
    storage information, and access control for document management.
    """

    class Meta:
        model = FileAsset
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "updated_by",
            "updated_at",
        ]


class IssueCommentCreateSerializer(BaseSerializer):
    """
    Serializer for creating work item comments.

    Handles comment creation with JSON and HTML content support,
    access control, and external integration tracking.
    """

    class Meta:
        model = IssueComment
        fields = [
            "comment_json",
            "comment_html",
            "access",
            "external_source",
            "external_id",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
            "actor",
            "comment_stripped",
            "edited_at",
        ]


class IssueCommentSerializer(BaseSerializer):
    """
    Full serializer for work item comments with membership context.

    Provides complete comment data including member status, content formatting,
    and edit tracking for collaborative work item discussions.
    """

    is_member = serializers.BooleanField(read_only=True)

    class Meta:
        model = IssueComment
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        exclude = ["comment_stripped", "comment_json"]

    def validate(self, data):
        try:
            if data.get("comment_html", None) is not None:
                parsed = html.fromstring(data["comment_html"])
                parsed_str = html.tostring(parsed, encoding="unicode")
                data["comment_html"] = parsed_str

        except Exception:
            raise serializers.ValidationError("Invalid HTML passed")
        return data


class IssueActivitySerializer(BaseSerializer):
    """
    Serializer for work item activity and change history.

    Tracks and represents work item modifications, state changes,
    and user interactions for audit trails and activity feeds.
    """

    class Meta:
        model = IssueActivity
        exclude = ["created_by", "updated_by"]


class CycleIssueSerializer(BaseSerializer):
    """
    Serializer for work items within cycles.

    Provides cycle context for work items including cycle metadata
    and timing information for sprint and iteration management.
    """

    cycle = CycleSerializer(read_only=True)

    class Meta:
        fields = ["cycle"]


class ModuleIssueSerializer(BaseSerializer):
    """
    Serializer for work items within modules.

    Provides module context for work items including module metadata
    and organizational information for feature-based work grouping.
    """

    module = ModuleSerializer(read_only=True)

    class Meta:
        fields = ["module"]


class LabelLiteSerializer(BaseSerializer):
    """
    Lightweight label serializer for minimal data transfer.

    Provides essential label information with visual properties,
    optimized for UI display and performance-critical operations.
    """

    class Meta:
        model = Label
        fields = ["id", "name", "color"]


class IssueExpandSerializer(BaseSerializer):
    """
    Extended work item serializer with full relationship expansion.

    Provides work items with expanded related data including cycles, modules,
    labels, assignees, and states for comprehensive data representation.
    """

    cycle = CycleLiteSerializer(source="issue_cycle.cycle", read_only=True)
    module = ModuleLiteSerializer(source="issue_module.module", read_only=True)

    labels = serializers.SerializerMethodField()
    assignees = serializers.SerializerMethodField()
    state = StateLiteSerializer(read_only=True)

    def get_labels(self, obj):
        expand = self.context.get("expand", [])
        if "labels" in expand:
            # Use prefetched data
            return LabelLiteSerializer([il.label for il in obj.label_issue.all()], many=True).data
        return [il.label_id for il in obj.label_issue.all()]

    def get_assignees(self, obj):
        expand = self.context.get("expand", [])
        if "assignees" in expand:
            return UserLiteSerializer([ia.assignee for ia in obj.issue_assignee.all()], many=True).data
        return [ia.assignee_id for ia in obj.issue_assignee.all()]

    class Meta:
        model = Issue
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class IssueAttachmentUploadSerializer(serializers.Serializer):
    """
    Serializer for work item attachment upload request validation.

    Handles file upload metadata validation including size, type, and external
    integration tracking for secure work item document attachment workflows.
    """

    name = serializers.CharField(help_text="Original filename of the asset")
    type = serializers.CharField(required=False, help_text="MIME type of the file")
    size = serializers.IntegerField(help_text="File size in bytes")
    external_id = serializers.CharField(
        required=False,
        help_text="External identifier for the asset (for integration tracking)",
    )
    external_source = serializers.CharField(
        required=False, help_text="External source system (for integration tracking)"
    )


class IssueSearchSerializer(serializers.Serializer):
    """
    Serializer for work item search result data formatting.

    Provides standardized search result structure including work item identifiers,
    project context, and workspace information for search API responses.
    """

    id = serializers.CharField(required=True, help_text="Issue ID")
    name = serializers.CharField(required=True, help_text="Issue name")
    sequence_id = serializers.CharField(required=True, help_text="Issue sequence ID")
    project__identifier = serializers.CharField(required=True, help_text="Project identifier")
    project_id = serializers.CharField(required=True, help_text="Project ID")
    workspace__slug = serializers.CharField(required=True, help_text="Workspace slug")
