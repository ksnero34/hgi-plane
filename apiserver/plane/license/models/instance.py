# Python imports
from enum import Enum
import uuid
import re

# Django imports
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

# Module imports
from plane.db.models import BaseModel

ROLE_CHOICES = ((20, "Admin"),)


class InstanceEdition(Enum):
    PLANE_COMMUNITY = "PLANE_COMMUNITY"


class Instance(BaseModel):
    # General information
    instance_name = models.CharField(max_length=255)
    whitelist_emails = models.TextField(blank=True, null=True)
    instance_id = models.CharField(max_length=255, unique=True)
    current_version = models.CharField(max_length=255)
    latest_version = models.CharField(max_length=255, null=True, blank=True)
    edition = models.CharField(
        max_length=255, default=InstanceEdition.PLANE_COMMUNITY.value
    )
    domain = models.TextField(blank=True)
    # Instance specifics
    last_checked_at = models.DateTimeField()
    namespace = models.CharField(max_length=255, blank=True, null=True)
    # telemetry and support
    is_telemetry_enabled = models.BooleanField(default=True)
    is_support_required = models.BooleanField(default=True)
    # is setup done
    is_setup_done = models.BooleanField(default=False)
    # signup screen
    is_signup_screen_visited = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_test = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Instance"
        verbose_name_plural = "Instances"
        db_table = "instances"
        ordering = ("-created_at",)


class InstanceAdmin(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="instance_owner",
    )
    instance = models.ForeignKey(
        Instance, on_delete=models.CASCADE, related_name="admins"
    )
    role = models.PositiveIntegerField(choices=ROLE_CHOICES, default=20)
    is_verified = models.BooleanField(default=False)

    class Meta:
        unique_together = ["instance", "user"]
        verbose_name = "Instance Admin"
        verbose_name_plural = "Instance Admins"
        db_table = "instance_admins"
        ordering = ("-created_at",)


class InstanceConfiguration(BaseModel):
    # The instance configuration variables
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(null=True, blank=True, default=None)
    category = models.TextField()
    is_encrypted = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Instance Configuration"
        verbose_name_plural = "Instance Configurations"
        db_table = "instance_configurations"
        ordering = ("-created_at",)


class ChangeLog(BaseModel):
    """Change Log model to store the release changelogs made in the application."""

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    version = models.CharField(max_length=255)
    tags = models.JSONField(default=list)
    release_date = models.DateTimeField(null=True)
    is_release_candidate = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Change Log"
        verbose_name_plural = "Change Logs"
        db_table = "changelogs"
        ordering = ("-created_at",)


def validate_extension(extension: str) -> bool:
    """확장자 유효성 검사 규칙
    1. 영문자, 숫자만 허용
    2. 최대 10자
    3. 점(.) 제외
    """
    return bool(re.match(r'^[a-zA-Z0-9]{1,10}$', extension))


class FileUploadSettings(models.Model):
    id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        primary_key=True,
    )
    instance = models.OneToOneField(
        "Instance",
        on_delete=models.CASCADE,
        related_name="file_settings",
    )
    allowed_extensions = models.JSONField(
        default=list(["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx"]),
        help_text="허용되는 파일 확장자 목록",
    )
    max_file_size = models.PositiveIntegerField(
        default=5242880,  # 5MB in bytes
        help_text="최대 파일 크기 (bytes)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        # 확장자 유효성 검사
        for extension in self.allowed_extensions:
            if not validate_extension(extension):
                raise ValidationError(
                    f"Invalid extension format: {extension}. "
                    "Extensions must contain only letters and numbers, "
                    "and be 10 characters or less."
                )
        
        super().clean()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "파일 업로드 설정"
        verbose_name_plural = "파일 업로드 설정"
        db_table = "file_upload_settings"
