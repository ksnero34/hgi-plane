# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from plane.db.models import Notification, UserNotificationPreference, RestNotificationConfig, RestNotificationLog, NotificationTemplate

# Third Party imports
from rest_framework import serializers


class NotificationSerializer(BaseSerializer):
    triggered_by_details = UserLiteSerializer(read_only=True, source="triggered_by")
    is_inbox_issue = serializers.BooleanField(read_only=True)
    is_intake_issue = serializers.BooleanField(read_only=True)
    is_mentioned_notification = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = "__all__"

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        try:
            # Check if this is an approval notification with an approval_request ID
            if (
                ret.get("data")
                and isinstance(ret["data"], dict)
                and "approval_request" in ret["data"]
                and isinstance(ret["data"]["approval_request"], dict)
                and "id" in ret["data"]["approval_request"]
            ):
                from plane.db.models import WorkflowApprovalRequest
                
                approval_id = ret["data"]["approval_request"]["id"]
                # Fetch only the status to minimize overhead
                # We use filter().values_list().first() to avoid exceptions and get just the value
                status = WorkflowApprovalRequest.objects.filter(id=approval_id).values_list('status', flat=True).first()
                if status:
                    ret["data"]["approval_request"]["status"] = status
        except Exception:
            # Fail silently to avoid breaking the notification list
            pass
        return ret


class UserNotificationPreferenceSerializer(BaseSerializer):
    class Meta:
        model = UserNotificationPreference
        fields = "__all__"


class RestNotificationConfigSerializer(BaseSerializer):
    class Meta:
        model = RestNotificationConfig
        fields = [
            "id",
            "name",
            "endpoint_url",
            "method",
            "headers",
            "json_template",
            "is_enabled",
            "timeout",
            "retry_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_method(self, value):
        if value.upper() not in ["POST", "PUT", "PATCH"]:
            raise serializers.ValidationError("Method must be POST, PUT, or PATCH")
        return value.upper()

    def validate_timeout(self, value):
        if value < 1 or value > 300:
            raise serializers.ValidationError("Timeout must be between 1 and 300 seconds")
        return value

    def validate_retry_count(self, value):
        if value < 0 or value > 10:
            raise serializers.ValidationError("Retry count must be between 0 and 10")
        return value


class RestNotificationLogSerializer(BaseSerializer):
    config_name = serializers.CharField(source="config.name", read_only=True)
    
    class Meta:
        model = RestNotificationLog
        fields = [
            "id",
            "config",
            "config_name",
            "notification",
            "request_data",
            "response_data",
            "status_code",
            "success",
            "error_message",
            "attempt_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "config_name"]


class NotificationTemplateSerializer(BaseSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            "id",
            "name",
            "description",
            "service_type",
            "endpoint_url",
            "method",
            "headers",
            "json_template",
            "is_system_template",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_method(self, value):
        if value.upper() not in ["POST", "PUT", "PATCH"]:
            raise serializers.ValidationError("Method must be POST, PUT, or PATCH")
        return value.upper()

    def validate_service_type(self, value):
        valid_types = ["slack", "discord", "teams", "webhook", "custom"]
        if value not in valid_types:
            raise serializers.ValidationError(f"Service type must be one of: {', '.join(valid_types)}")
        return value
