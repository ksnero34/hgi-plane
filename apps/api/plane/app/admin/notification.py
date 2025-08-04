# Django imports
from django.contrib import admin
from django.db import models
from django.forms import widgets
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib import messages
from django.template.response import TemplateResponse
import json

# Module imports
from plane.db.models import RestNotificationConfig, RestNotificationLog, NotificationTemplate
from plane.bgtasks.rest_notification_task import send_rest_notification


class JSONWidget(widgets.Textarea):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.attrs.update({
            'class': 'json-widget',
            'rows': 10,
            'style': 'width: 100%; font-family: monospace; font-size: 12px;'
        })

    def format_value(self, value):
        if value is None:
            return ''
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                return value
        return json.dumps(value, indent=2, ensure_ascii=False)


@admin.register(RestNotificationConfig)
class RestNotificationConfigAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'workspace', 'endpoint_url', 'method', 'is_enabled', 
        'success_rate', 'last_success', 'created_at', 'test_button'
    ]
    list_filter = ['is_enabled', 'method', 'workspace', 'created_at']
    search_fields = ['name', 'workspace__name', 'endpoint_url']
    readonly_fields = ['created_at', 'updated_at', 'success_rate', 'last_success']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('workspace', 'name', 'is_enabled')
        }),
        ('연결 설정', {
            'fields': ('endpoint_url', 'method', 'timeout', 'retry_count')
        }),
        ('헤더 설정', {
            'fields': ('headers',),
            'classes': ('collapse',)
        }),
        ('JSON 템플릿', {
            'fields': ('json_template',),
            'classes': ('collapse',)
        }),
        ('상태 정보', {
            'fields': ('success_rate', 'last_success', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    formfield_overrides = {
        models.JSONField: {'widget': JSONWidget},
    }
    
    def success_rate(self, obj):
        logs = obj.logs.all()
        if not logs.exists():
            return "데이터 없음"
        
        total = logs.count()
        success = logs.filter(success=True).count()
        rate = (success / total) * 100 if total > 0 else 0
        
        color = "green" if rate >= 80 else "orange" if rate >= 50 else "red"
        return format_html(
            '<span style="color: {};">{:.1f}% ({}/{})</span>',
            color, rate, success, total
        )
    success_rate.short_description = "성공률"
    
    def last_success(self, obj):
        last_log = obj.logs.filter(success=True).first()
        if last_log:
            return last_log.created_at.strftime("%Y-%m-%d %H:%M:%S")
        return "성공 기록 없음"
    last_success.short_description = "마지막 성공"
    
    def test_button(self, obj):
        return format_html(
            '<a class="button" href="{}">테스트</a>',
            reverse('admin:test_notification', args=[obj.pk])
        )
    test_button.short_description = "테스트"
    
    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path(
                'test/<int:config_id>/',
                self.admin_site.admin_view(self.test_notification),
                name='test_notification',
            ),
            path(
                'create_from_template/',
                self.admin_site.admin_view(self.create_from_template),
                name='create_from_template',
            ),
        ]
        return custom_urls + urls
    
    def test_notification(self, request, config_id):
        config = get_object_or_404(RestNotificationConfig, id=config_id)
        
        if request.method == 'POST':
            test_data = {
                "user_id": "test_user",
                "user_email": "test@example.com",
                "title": "테스트 알림",
                "message": "이것은 테스트 알림입니다.",
                "issue_id": "TEST-001",
                "issue_name": "테스트 이슈",
                "workspace_name": config.workspace.name,
                "project_name": "테스트 프로젝트",
                "actor_name": "테스트 사용자",
                "notification_type": "test",
                "entity_type": "issue",
                "entity_id": "test-entity-id"
            }
            
            try:
                send_rest_notification.delay(config.id, test_data)
                messages.success(request, f"테스트 알림이 '{config.name}'으로 전송되었습니다.")
            except Exception as e:
                messages.error(request, f"테스트 알림 전송 실패: {str(e)}")
            
            return JsonResponse({'status': 'success'})
        
        context = {
            'config': config,
            'title': f'알림 설정 테스트: {config.name}',
        }
        return TemplateResponse(request, 'admin/test_notification.html', context)
    
    def create_from_template(self, request):
        if request.method == 'POST':
            template_id = request.POST.get('template_id')
            workspace_id = request.POST.get('workspace_id')
            
            template = get_object_or_404(NotificationTemplate, id=template_id)
            from plane.db.models import Workspace
            workspace = get_object_or_404(Workspace, id=workspace_id)
            
            config = RestNotificationConfig.objects.create(
                workspace=workspace,
                name=f"{template.name} - {workspace.name}",
                endpoint_url=template.endpoint_url or "",
                method=template.method,
                headers=template.headers,
                json_template=template.json_template,
                is_enabled=False
            )
            
            messages.success(request, f"템플릿 '{template.name}'으로부터 설정이 생성되었습니다.")
            return JsonResponse({'status': 'success', 'config_id': config.id})
        
        templates = NotificationTemplate.objects.all()
        from plane.db.models import Workspace
        workspaces = Workspace.objects.all()
        
        context = {
            'templates': templates,
            'workspaces': workspaces,
            'title': '템플릿에서 설정 생성',
        }
        return TemplateResponse(request, 'admin/create_from_template.html', context)


@admin.register(RestNotificationLog)
class RestNotificationLogAdmin(admin.ModelAdmin):
    list_display = [
        'config', 'success', 'status_code', 'attempt_count', 
        'created_at', 'response_preview'
    ]
    list_filter = ['success', 'status_code', 'config', 'created_at']
    search_fields = ['config__name', 'error_message']
    readonly_fields = ['config', 'notification', 'request_data', 'response_data', 
                      'status_code', 'success', 'error_message', 'attempt_count', 'created_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('config', 'notification', 'success', 'status_code', 'attempt_count', 'created_at')
        }),
        ('요청 데이터', {
            'fields': ('request_data',),
            'classes': ('collapse',)
        }),
        ('응답 데이터', {
            'fields': ('response_data',),
            'classes': ('collapse',)
        }),
        ('오류 정보', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )
    
    formfield_overrides = {
        models.JSONField: {'widget': JSONWidget},
    }
    
    def response_preview(self, obj):
        if obj.response_data:
            preview = str(obj.response_data)[:100]
            if len(str(obj.response_data)) > 100:
                preview += "..."
            return preview
        return "응답 없음"
    response_preview.short_description = "응답 미리보기"
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'service_type', 'description', 'is_system_template', 'created_at']
    list_filter = ['service_type', 'is_system_template', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('name', 'description', 'service_type', 'is_system_template')
        }),
        ('연결 설정', {
            'fields': ('endpoint_url', 'method'),
            'classes': ('collapse',)
        }),
        ('헤더 설정', {
            'fields': ('headers',),
            'classes': ('collapse',)
        }),
        ('JSON 템플릿', {
            'fields': ('json_template',),
            'classes': ('collapse',)
        }),
        ('시스템 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    formfield_overrides = {
        models.JSONField: {'widget': JSONWidget},
    }
    
    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path(
                'create_system_templates/',
                self.admin_site.admin_view(self.create_system_templates),
                name='create_system_templates',
            ),
        ]
        return custom_urls + urls
    
    def create_system_templates(self, request):
        if request.method == 'POST':
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
                    },
                    "is_system_template": True
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
                    },
                    "is_system_template": True
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
                    },
                    "is_system_template": True
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
                    },
                    "is_system_template": True
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
                    },
                    "is_system_template": True
                }
            ]

            created_count = 0
            for template_data in templates:
                # 이미 존재하는 시스템 템플릿인지 확인
                if not NotificationTemplate.objects.filter(
                    name=template_data["name"],
                    is_system_template=True
                ).exists():
                    NotificationTemplate.objects.create(**template_data)
                    created_count += 1

            messages.success(request, f"{created_count}개의 시스템 템플릿이 생성되었습니다.")
            return JsonResponse({'status': 'success', 'created_count': created_count})
        
        context = {
            'title': '시스템 템플릿 생성',
        }
        return TemplateResponse(request, 'admin/create_system_templates.html', context)


# Admin 사이트 커스터마이징
admin.site.site_header = "Plane REST 알림 관리"
admin.site.site_title = "Plane Admin"
admin.site.index_title = "REST 알림 시스템 관리"