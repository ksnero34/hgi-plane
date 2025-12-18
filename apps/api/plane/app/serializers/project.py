# Third party imports
from rest_framework import serializers
import base64

# Module imports
from .base import BaseSerializer, DynamicBaseSerializer
from plane.app.serializers.workspace import WorkspaceLiteSerializer
from plane.app.serializers.user import UserLiteSerializer, UserAdminLiteSerializer
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    ProjectIdentifier,
    DeployBoard,
    ProjectPublicMember,
    ProjectMattermostConfig,
)
from plane.utils.content_validator import (
    validate_html_content,
    validate_binary_data,
)


class ProjectSerializer(BaseSerializer):
    workspace_detail = WorkspaceLiteSerializer(source="workspace", read_only=True)
    inbox_view = serializers.BooleanField(read_only=True, source="intake_view")

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["workspace", "deleted_at"]

    def validate_name(self, name):
        project_id = self.instance.id if self.instance else None
        workspace_id = self.context["workspace_id"]

        project = Project.objects.filter(name=name, workspace_id=workspace_id)

        if project_id:
            project = project.exclude(id=project_id)

        if project.exists():
            raise serializers.ValidationError(
                detail="PROJECT_NAME_ALREADY_EXIST",
            )

        return name

    def validate_identifier(self, identifier):
        project_id = self.instance.id if self.instance else None
        workspace_id = self.context["workspace_id"]

        project = Project.objects.filter(identifier=identifier, workspace_id=workspace_id)

        if project_id:
            project = project.exclude(id=project_id)

        if project.exists():
            raise serializers.ValidationError(
                detail="PROJECT_IDENTIFIER_ALREADY_EXIST",
            )

        return identifier

    def validate(self, data):
        # Validate description content for security
        if "description_html" in data and data["description_html"]:
            is_valid, error_msg, sanitized_html = validate_html_content(str(data["description_html"]))
            # Update the data with sanitized HTML if available
            if sanitized_html is not None:
                data["description_html"] = sanitized_html

            if not is_valid:
                raise serializers.ValidationError({"error": "html content is not valid"})

        if "overview_html" in data and data["overview_html"]:
            is_valid, error_msg, sanitized_overview = validate_html_content(str(data["overview_html"]))
            if sanitized_overview is not None:
                data["overview_html"] = sanitized_overview

            if not is_valid:
                raise serializers.ValidationError({"error": "overview html content is not valid"})

        return data

    def create(self, validated_data):
        workspace_id = self.context["workspace_id"]

        project = Project.objects.create(**validated_data, workspace_id=workspace_id)

        ProjectIdentifier.objects.create(name=project.identifier, project=project, workspace_id=workspace_id)

        return project


class ProjectLiteSerializer(BaseSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "identifier",
            "name",
            "cover_image",
            "cover_image_url",
            "logo_props",
            "description",
            "overview",
            "overview_html",
            "overview_text",
        ]
        read_only_fields = fields


class ProjectListSerializer(DynamicBaseSerializer):
    is_favorite = serializers.BooleanField(read_only=True)
    sort_order = serializers.FloatField(read_only=True)
    member_role = serializers.IntegerField(read_only=True)
    anchor = serializers.CharField(read_only=True)
    members = serializers.SerializerMethodField()
    cover_image_url = serializers.CharField(read_only=True)
    inbox_view = serializers.BooleanField(read_only=True, source="intake_view")

    def get_members(self, obj):
        project_members = getattr(obj, "members_list", None)
        if project_members is not None:
            # Filter members by the project ID
            return [member.member_id for member in project_members if member.is_active and not member.member.is_bot]
        return []

    class Meta:
        model = Project
        fields = "__all__"


class ProjectDetailSerializer(BaseSerializer):
    # workspace = WorkSpaceSerializer(read_only=True)
    default_assignee = UserLiteSerializer(read_only=True)
    project_lead = UserLiteSerializer(read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)
    sort_order = serializers.FloatField(read_only=True)
    member_role = serializers.IntegerField(read_only=True)
    anchor = serializers.CharField(read_only=True)

    class Meta:
        model = Project
        fields = "__all__"


class ProjectMemberSerializer(BaseSerializer):
    workspace = WorkspaceLiteSerializer(read_only=True)
    project = ProjectLiteSerializer(read_only=True)
    member = UserLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = "__all__"


class ProjectMemberPreferenceSerializer(BaseSerializer):
    class Meta:
        model = ProjectMember
        fields = ["preferences", "project_id", "member_id", "workspace_id"]

    def validate_preferences(self, value):
        preferences = self.instance.preferences

        preferences.update(value)
        return preferences


class ProjectMemberAdminSerializer(BaseSerializer):
    workspace = WorkspaceLiteSerializer(read_only=True)
    project = ProjectLiteSerializer(read_only=True)
    member = UserAdminLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = "__all__"


class ProjectMemberRoleSerializer(DynamicBaseSerializer):
    original_role = serializers.IntegerField(source="role", read_only=True)

    class Meta:
        model = ProjectMember
        fields = ("id", "role", "member", "project", "original_role", "created_at")
        read_only_fields = ["original_role", "created_at"]


class ProjectMemberInviteSerializer(BaseSerializer):
    project = ProjectLiteSerializer(read_only=True)
    workspace = WorkspaceLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMemberInvite
        fields = "__all__"


class ProjectIdentifierSerializer(BaseSerializer):
    class Meta:
        model = ProjectIdentifier
        fields = "__all__"


class ProjectMemberLiteSerializer(BaseSerializer):
    member = UserLiteSerializer(read_only=True)
    is_subscribed = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ["member", "id", "is_subscribed"]
        read_only_fields = fields


class ProjectOverviewBinarySerializer(serializers.Serializer):
    """Serializer to validate project overview binary updates."""

    overview_binary = serializers.CharField(required=False, allow_blank=True)
    overview_html = serializers.CharField(required=False, allow_blank=True)
    overview = serializers.JSONField(required=False, allow_null=True)

    def validate_overview_binary(self, value: str):
        if value == "":
            return b""
        if value is None or not value:
            return value
        try:
            binary_data = base64.b64decode(value)
        except Exception as error:  # pragma: no cover - defensive guard
            raise serializers.ValidationError("Failed to decode base64 data") from error

        is_valid, error_message = validate_binary_data(binary_data)
        if not is_valid:
            raise serializers.ValidationError(f"Invalid binary data: {error_message}")

        return binary_data

    def validate_overview_html(self, value: str):
        if not value:
            return value
        is_valid, error_message, sanitized_html = validate_html_content(value)
        if not is_valid:
            raise serializers.ValidationError(error_message or "Invalid HTML content")
        return sanitized_html if sanitized_html is not None else value


class DeployBoardSerializer(BaseSerializer):
    project_details = ProjectLiteSerializer(read_only=True, source="project")
    workspace_detail = WorkspaceLiteSerializer(read_only=True, source="workspace")

    class Meta:
        model = DeployBoard
        fields = "__all__"
        read_only_fields = ["workspace", "project", "anchor"]


class ProjectPublicMemberSerializer(BaseSerializer):
    class Meta:
        model = ProjectPublicMember
        fields = "__all__"
        read_only_fields = ["workspace", "project", "member"]


class ProjectMattermostConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMattermostConfig
        fields = (
            "id",
            "project",
            "is_enabled",
            "server_url",
            "bot_token",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "project",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
