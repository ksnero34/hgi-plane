# Django imports
from django.conf import settings
from django.db import models

# Module imports
from .base import BaseModel


class Notification(BaseModel):
    workspace = models.ForeignKey("db.Workspace", related_name="notifications", on_delete=models.CASCADE)
    project = models.ForeignKey("db.Project", related_name="notifications", on_delete=models.CASCADE, null=True)
    data = models.JSONField(null=True)
    entity_identifier = models.UUIDField(null=True)
    entity_name = models.CharField(max_length=255)
    title = models.TextField()
    message = models.JSONField(null=True)
    message_html = models.TextField(blank=True, default="<p></p>")
    message_stripped = models.TextField(blank=True, null=True)
    sender = models.CharField(max_length=255)
    triggered_by = models.ForeignKey(
        "db.User",
        related_name="triggered_notifications",
        on_delete=models.SET_NULL,
        null=True,
    )
    receiver = models.ForeignKey("db.User", related_name="received_notifications", on_delete=models.CASCADE)
    read_at = models.DateTimeField(null=True)
    snoozed_till = models.DateTimeField(null=True)
    archived_at = models.DateTimeField(null=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        db_table = "notifications"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["entity_identifier"], name="notif_entity_identifier_idx"),
            models.Index(fields=["entity_name"], name="notif_entity_name_idx"),
            models.Index(fields=["read_at"], name="notif_read_at_idx"),
            models.Index(fields=["receiver", "read_at"], name="notif_entity_idx"),
            models.Index(
                fields=["receiver", "workspace", "read_at", "created_at"],
                name="notif_receiver_status_idx",
            ),
            models.Index(
                fields=["receiver", "workspace", "entity_name", "read_at"],
                name="notif_receiver_entity_idx",
            ),
            models.Index(
                fields=["receiver", "workspace", "snoozed_till", "archived_at"],
                name="notif_receiver_state_idx",
            ),
            models.Index(
                fields=["receiver", "workspace", "sender"],
                name="notif_receiver_sender_idx",
            ),
            models.Index(
                fields=["workspace", "entity_identifier", "entity_name"],
                name="notif_entity_lookup_idx",
            ),
        ]

    def __str__(self):
        """Return name of the notifications"""
        return f"{self.receiver.email} <{self.workspace.name}>"


def get_default_preference():
    return {
        "property_change": {"email": True},
        "state": {"email": True},
        "comment": {"email": True},
        "mentions": {"email": True},
    }


class UserNotificationPreference(BaseModel):
    # user it is related to
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    # workspace if it is applicable
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="workspace_notification_preferences",
        null=True,
    )
    # project
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="project_notification_preferences",
        null=True,
    )

    # preference fields
    property_change = models.BooleanField(default=True)
    state_change = models.BooleanField(default=True)
    comment = models.BooleanField(default=True)
    mention = models.BooleanField(default=True)
    issue_completed = models.BooleanField(default=True)

    class Meta:
        verbose_name = "UserNotificationPreference"
        verbose_name_plural = "UserNotificationPreferences"
        db_table = "user_notification_preferences"
        ordering = ("-created_at",)

    def __str__(self):
        """Return the user"""
        return f"<{self.user}>"


class EmailNotificationLog(BaseModel):
    # receiver
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_notifications",
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="triggered_emails",
    )
    # entity - can be issues, pages, etc.
    entity_identifier = models.UUIDField(null=True)
    entity_name = models.CharField(max_length=255)
    # data
    data = models.JSONField(null=True)
    # sent at
    processed_at = models.DateTimeField(null=True)
    sent_at = models.DateTimeField(null=True)
    entity = models.CharField(max_length=200)
    old_value = models.CharField(max_length=300, blank=True, null=True)
    new_value = models.CharField(max_length=300, blank=True, null=True)

    class Meta:
        verbose_name = "Email Notification Log"
        verbose_name_plural = "Email Notification Logs"
        db_table = "email_notification_logs"
        ordering = ("-created_at",)


class RestNotificationConfig(BaseModel):
    workspace = models.ForeignKey(
        "db.Workspace", related_name="rest_notification_configs", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=255, default="Default REST Notification")
    endpoint_url = models.URLField(max_length=500)
    method = models.CharField(max_length=10, default="POST")
    headers = models.JSONField(default=dict)
    json_template = models.JSONField(default=dict)
    is_enabled = models.BooleanField(default=True)
    timeout = models.IntegerField(default=30)
    retry_count = models.IntegerField(default=3)
    
    class Meta:
        verbose_name = "REST Notification Config"
        verbose_name_plural = "REST Notification Configs"
        db_table = "rest_notification_configs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} - {self.workspace.name}"


class RestNotificationLog(BaseModel):
    config = models.ForeignKey(
        "db.RestNotificationConfig", related_name="logs", on_delete=models.CASCADE
    )
    notification = models.ForeignKey(
        "db.Notification", related_name="rest_logs", on_delete=models.CASCADE, null=True
    )
    request_data = models.JSONField(null=True)
    response_data = models.JSONField(null=True)
    status_code = models.IntegerField(null=True)
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)
    attempt_count = models.IntegerField(default=1)
    
    class Meta:
        verbose_name = "REST Notification Log"
        verbose_name_plural = "REST Notification Logs"
        db_table = "rest_notification_logs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.config.name} - {self.success}"


class NotificationTemplate(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    service_type = models.CharField(
        max_length=50,
        choices=[
            ('slack', 'Slack'),
            ('discord', 'Discord'),
            ('teams', 'Microsoft Teams'),
            ('webhook', 'Generic Webhook'),
            ('custom', 'Custom API'),
        ],
        default='custom'
    )
    endpoint_url = models.URLField(max_length=500, blank=True, null=True)
    method = models.CharField(max_length=10, default="POST")
    headers = models.JSONField(default=dict)
    json_template = models.JSONField(default=dict)
    is_system_template = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = "Notification Template"
        verbose_name_plural = "Notification Templates"
        db_table = "notification_templates"
        ordering = ("service_type", "name")

    def __str__(self):
        return f"{self.name} ({self.service_type})"
