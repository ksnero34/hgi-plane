# Third party imports
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseSerializer, DynamicBaseSerializer
from .user import UserLiteSerializer, UserAdminLiteSerializer


from plane.db.models import (
    Workspace,
    WorkspaceMember,
    WorkspaceMemberInvite,
    WorkspaceTheme,
    WorkspaceUserProperties,
    WorkspaceUserLink,
    UserRecentVisit,
    Issue,
    Page,
    Project,
    ProjectMember,
    WorkspaceHomePreference,
    Sticky,
    WorkspaceUserPreference,
)
from plane.utils.constants import RESTRICTED_WORKSPACE_SLUGS

# Django imports
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError


class WorkSpaceSerializer(DynamicBaseSerializer):
    total_members = serializers.IntegerField(read_only=True)
    logo_url = serializers.CharField(read_only=True)
    role = serializers.IntegerField(read_only=True)

    def validate_slug(self, value):
        # Check if the slug is restricted
        if value in RESTRICTED_WORKSPACE_SLUGS:
            raise serializers.ValidationError("Slug is not valid")
        return value

    class Meta:
        model = Workspace
        fields = "__all__"
        read_only_fields = [
            "id",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "owner",
            "logo_url",
        ]


class WorkspaceLiteSerializer(BaseSerializer):
    class Meta:
        model = Workspace
        fields = ["name", "slug", "id", "logo_url"]
        read_only_fields = fields


class WorkSpaceMemberSerializer(DynamicBaseSerializer):
    member = UserLiteSerializer(read_only=True)
    workspace = WorkspaceLiteSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = "__all__"


class WorkspaceMemberMeSerializer(BaseSerializer):
    draft_issue_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = "__all__"


class WorkspaceMemberAdminSerializer(DynamicBaseSerializer):
    member = UserAdminLiteSerializer(read_only=True)
    workspace = WorkspaceLiteSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = "__all__"


class WorkSpaceMemberInviteSerializer(BaseSerializer):
    workspace = WorkspaceLiteSerializer(read_only=True)
    invite_link = serializers.SerializerMethodField()

    def get_invite_link(self, obj):
        return f"/workspace-invitations/?invitation_id={obj.id}&email={obj.email}&slug={obj.workspace.slug}"

    class Meta:
        model = WorkspaceMemberInvite
        fields = "__all__"
        read_only_fields = [
            "id",
            "email",
            "token",
            "workspace",
            "message",
            "responded_at",
            "created_at",
            "updated_at",
            "invite_link",
        ]


class WorkspaceThemeSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceTheme
        fields = "__all__"
        read_only_fields = ["workspace", "actor"]


class WorkspaceUserPropertiesSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceUserProperties
        fields = "__all__"
        read_only_fields = ["workspace", "user"]


class WorkspaceUserLinkSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceUserLink
        fields = "__all__"
        read_only_fields = ["workspace", "owner"]

    def to_internal_value(self, data):
        url = data.get("url", "")
        if url and not url.startswith(("http://", "https://")):
            data["url"] = "http://" + url

        return super().to_internal_value(data)

    def validate_url(self, value):
        url_validator = URLValidator()
        try:
            url_validator(value)
        except ValidationError:
            raise serializers.ValidationError({"error": "Invalid URL format."})

        return value


    def create(self, validated_data):
        # Filtering the WorkspaceUserLink with the given url to check if the link already exists.

        url = validated_data.get("url")

        workspace_user_link = WorkspaceUserLink.objects.filter(
            url=url,
            workspace_id=validated_data.get("workspace_id"),
            owner_id=validated_data.get("owner_id")
        )

        if workspace_user_link.exists():
            raise serializers.ValidationError(
                {"error": "URL already exists for this workspace and owner"}
            )

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Filtering the WorkspaceUserLink with the given url to check if the link already exists.

        url = validated_data.get("url")

        workspace_user_link = WorkspaceUserLink.objects.filter(
                url=url,
                workspace_id=instance.workspace_id,
                owner=instance.owner
            )

        if workspace_user_link.exclude(pk=instance.id).exists():
            raise serializers.ValidationError(
                {"error": "URL already exists for this workspace and owner"}
            )

        return super().update(instance, validated_data)

class IssueRecentVisitSerializer(serializers.ModelSerializer):
    project_identifier = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "state",
            "priority",
            "assignees",
            "type",
            "sequence_id",
            "project_id",
            "project_identifier",
        ]

    def get_project_identifier(self, obj):
        project = obj.project

        return project.identifier if project else None


class ProjectRecentVisitSerializer(serializers.ModelSerializer):
    project_members = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "logo_props", "project_members", "identifier"]

    def get_project_members(self, obj):
        members = ProjectMember.objects.filter(
            project_id=obj.id, member__is_bot=False, is_active=True
        ).values_list("member", flat=True)

        return members


class PageRecentVisitSerializer(serializers.ModelSerializer):
    project_id = serializers.SerializerMethodField()
    project_identifier = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "logo_props",
            "project_id",
            "owned_by",
            "project_identifier",
        ]

    def get_project_id(self, obj):
        return (
            obj.project_id
            if hasattr(obj, "project_id")
            else obj.projects.values_list("id", flat=True).first()
        )

    def get_project_identifier(self, obj):
        project = obj.projects.first()

        return project.identifier if project else None


def get_entity_model_and_serializer(entity_type):
    entity_map = {
        "issue": (Issue, IssueRecentVisitSerializer),
        "page": (Page, PageRecentVisitSerializer),
        "project": (Project, ProjectRecentVisitSerializer),
    }
    return entity_map.get(entity_type, (None, None))


class WorkspaceRecentVisitSerializer(BaseSerializer):
    entity_data = serializers.SerializerMethodField()

    class Meta:
        model = UserRecentVisit
        fields = ["id", "entity_name", "entity_identifier", "entity_data", "visited_at"]
        read_only_fields = ["workspace", "owner", "created_by", "updated_by"]

    def get_entity_data(self, obj):
        entity_name = obj.entity_name
        entity_identifier = obj.entity_identifier

        entity_model, entity_serializer = get_entity_model_and_serializer(entity_name)

        if entity_model and entity_serializer:
            try:
                entity = entity_model.objects.get(pk=entity_identifier)

                return entity_serializer(entity).data
            except entity_model.DoesNotExist:
                return None
        return None


class WorkspaceHomePreferenceSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceHomePreference
        fields = ["key", "is_enabled", "sort_order"]
        read_only_fields = ["workspace", "created_by", "updated_by"]


class StickySerializer(BaseSerializer):
    class Meta:
        model = Sticky
        fields = "__all__"
        read_only_fields = ["workspace", "owner"]
        extra_kwargs = {"name": {"required": False}}

    def mask_private_information(self, text):
        import re

        # 개인정보 패턴 정의
        PRIVACY_PATTERNS = {
            # 주민등록번호 (예: 123456-1234567)
            'koreanSSN': r'\d{6}[-]\d{7}',
            # 이메일 주소
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            # 전화번호 (예: 010-1234-5678)
            'phoneNumber': r'\d{2,3}[-]\d{3,4}[-]\d{4}',
            # 신용카드 번호
            'creditCard': r'\d{4}[-]\d{4}[-]\d{4}[-]\d{4}'
        }

        masked_text = text

        # 전화번호 마스킹 (가운데 부분)
        masked_text = re.sub(
            PRIVACY_PATTERNS['phoneNumber'],
            lambda m: re.sub(r'(?<=[-])\d{3,4}(?=[-])', '****', m.group()),
            masked_text
        )

        # 주민등록번호 마스킹 (뒷자리 전체)
        masked_text = re.sub(
            PRIVACY_PATTERNS['koreanSSN'],
            lambda m: m.group().split('-')[0] + '-*******',
            masked_text
        )

        # 이메일 마스킹 (@ 앞부분 일부)
        masked_text = re.sub(
            PRIVACY_PATTERNS['email'],
            lambda m: m.group().split('@')[0][:3] + '*' * (len(m.group().split('@')[0]) - 3) + '@' + m.group().split('@')[1],
            masked_text
        )

        # 신용카드 번호 마스킹 (가운데 8자리)
        masked_text = re.sub(
            PRIVACY_PATTERNS['creditCard'],
            lambda m: m.group().split('-')[0] + '-****-****-' + m.group().split('-')[3],
            masked_text
        )

        return masked_text

    def validate(self, data):
        if 'description_html' in data:
            data['description_html'] = self.mask_private_information(data['description_html'])
        return data


class WorkspaceUserPreferenceSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceUserPreference
        fields = ["key", "is_pinned", "sort_order"]
        read_only_fields = ["workspace", "created_by", "updated_by"]
