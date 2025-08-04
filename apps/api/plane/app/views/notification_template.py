# Django imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action

# Module imports
from plane.app.permissions import InstanceAdminPermission
from plane.app.serializers import NotificationTemplateSerializer
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import NotificationTemplate


class NotificationTemplateViewSet(BaseViewSet):
    serializer_class = NotificationTemplateSerializer
    model = NotificationTemplate
    permission_classes = [InstanceAdminPermission]

    def get_queryset(self):
        return self.filter_queryset(
            super().get_queryset().order_by("service_type", "name")
        )

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        instance = self.get_object()
        
        # 시스템 템플릿은 수정 불가
        if instance.is_system_template:
            return Response(
                {"error": "System templates cannot be modified"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        instance = self.get_object()
        
        # 시스템 템플릿은 삭제 불가
        if instance.is_system_template:
            return Response(
                {"error": "System templates cannot be deleted"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def create_system_templates(self, request):
        """시스템 템플릿 생성"""
        try:
            # 시스템 템플릿 데이터 정의
            templates = [
                {
                    "name": "Slack Webhook Template",
                    "description": "Slack 채널에 메시지를 전송하기 위한 템플릿",
                    "service_type": "slack",
                    "endpoint_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
                    "method": "POST",
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "json_template": {
                        "text": "{{title}}",
                        "attachments": [
                            {
                                "color": "good",
                                "fields": [
                                    {
                                        "title": "User",
                                        "value": "{{user_email}}",
                                        "short": True
                                    },
                                    {
                                        "title": "Issue",
                                        "value": "{{issue_name}}",
                                        "short": True
                                    },
                                    {
                                        "title": "Message",
                                        "value": "{{message}}",
                                        "short": False
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    "name": "Discord Webhook Template",
                    "description": "Discord 채널에 임베드 메시지를 전송하기 위한 템플릿",
                    "service_type": "discord",
                    "endpoint_url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
                    "method": "POST",
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "json_template": {
                        "username": "Plane Notifications",
                        "embeds": [
                            {
                                "title": "{{title}}",
                                "description": "{{message}}",
                                "color": 3447003,
                                "fields": [
                                    {
                                        "name": "User",
                                        "value": "{{user_email}}",
                                        "inline": True
                                    },
                                    {
                                        "name": "Issue",
                                        "value": "{{issue_name}}",
                                        "inline": True
                                    },
                                    {
                                        "name": "Project",
                                        "value": "{{project_name}}",
                                        "inline": True
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    "name": "Microsoft Teams Template",
                    "description": "Microsoft Teams 채널에 카드 메시지를 전송하기 위한 템플릿",
                    "service_type": "teams",
                    "endpoint_url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL",
                    "method": "POST",
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "json_template": {
                        "@type": "MessageCard",
                        "@context": "https://schema.org/extensions",
                        "summary": "{{title}}",
                        "themeColor": "0072C6",
                        "title": "{{title}}",
                        "text": "{{message}}",
                        "sections": [
                            {
                                "activityTitle": "Plane Notification",
                                "activitySubtitle": "{{workspace_name}}",
                                "facts": [
                                    {
                                        "name": "User:",
                                        "value": "{{user_email}}"
                                    },
                                    {
                                        "name": "Issue:",
                                        "value": "{{issue_name}}"
                                    },
                                    {
                                        "name": "Project:",
                                        "value": "{{project_name}}"
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    "name": "Generic Webhook Template",
                    "description": "일반적인 웹훅 서비스에 사용할 수 있는 기본 템플릿",
                    "service_type": "webhook",
                    "endpoint_url": "https://your-webhook-service.com/webhook",
                    "method": "POST",
                    "headers": {
                        "Content-Type": "application/json",
                        "User-Agent": "Plane-Notification-Service/1.0"
                    },
                    "json_template": {
                        "event": "notification",
                        "data": {
                            "user": {
                                "id": "{{user_id}}",
                                "email": "{{user_email}}"
                            },
                            "notification": {
                                "title": "{{title}}",
                                "message": "{{message}}",
                                "type": "{{notification_type}}"
                            },
                            "issue": {
                                "id": "{{issue_id}}",
                                "name": "{{issue_name}}"
                            },
                            "workspace": "{{workspace_name}}",
                            "project": "{{project_name}}",
                            "actor": "{{actor_name}}"
                        }
                    }
                },
                {
                    "name": "Custom API Template",
                    "description": "커스텀 API 서버에 사용할 수 있는 상세한 템플릿",
                    "service_type": "custom",
                    "endpoint_url": "https://your-api-server.com/notifications",
                    "method": "POST",
                    "headers": {
                        "Content-Type": "application/json",
                        "X-API-Key": "YOUR_API_KEY"
                    },
                    "json_template": {
                        "notification": {
                            "recipient": {
                                "id": "{{user_id}}",
                                "email": "{{user_email}}"
                            },
                            "content": {
                                "title": "{{title}}",
                                "body": "{{message}}",
                                "category": "{{notification_type}}"
                            },
                            "metadata": {
                                "source": "plane",
                                "workspace": "{{workspace_name}}",
                                "project": "{{project_name}}",
                                "issue": {
                                    "id": "{{issue_id}}",
                                    "name": "{{issue_name}}"
                                },
                                "actor": "{{actor_name}}",
                                "entity": {
                                    "type": "{{entity_type}}",
                                    "id": "{{entity_id}}"
                                }
                            }
                        }
                    }
                }
            ]

            created_count = 0
            for template_data in templates:
                # 이미 존재하는 시스템 템플릿인지 확인
                if not NotificationTemplate.objects.filter(
                    name=template_data["name"],
                    is_system_template=True
                ).exists():
                    NotificationTemplate.objects.create(
                        is_system_template=True,
                        **template_data
                    )
                    created_count += 1

            return Response({
                "message": f"Successfully created {created_count} system templates",
                "created_count": created_count
            })
        except Exception as e:
            return Response(
                {"error": f"Failed to create system templates: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NotificationTemplateListEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        """모든 템플릿 목록 조회"""
        templates = NotificationTemplate.objects.all().order_by("service_type", "name")
        serializer = NotificationTemplateSerializer(templates, many=True)
        return Response({
            "results": serializer.data
        })

    def post(self, request):
        """새 템플릿 생성"""
        serializer = NotificationTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)