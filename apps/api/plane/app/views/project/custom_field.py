# Python imports
from django.db import transaction
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectEntityPermission
from plane.app.serializers import CustomFieldSerializer
from plane.app.views.base import BaseViewSet
from plane.db.models import CustomField, CustomFieldValue
from plane.utils.issue_filters import issue_filters

class CustomFieldViewSet(BaseViewSet):
    serializer_class = CustomFieldSerializer
    model = CustomField
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"), project_id=self.kwargs.get("project_id"))
            .select_related("workspace", "project")
        )

    def perform_create(self, serializer):
        serializer.save(
            project_id=self.kwargs.get("project_id"),
            workspace_id=self.kwargs.get("workspace_id")
        )

    def perform_update(self, serializer):
        serializer.save(
            project_id=self.kwargs.get("project_id"),
            workspace_id=self.kwargs.get("workspace_id")
        )

    def perform_destroy(self, instance):
        """커스텀 필드와 관련 값들 모두 소프트 삭제"""
        from plane.db.models import CustomFieldValue
        
        # 1. 관련된 모든 CustomFieldValue 소프트 삭제
        CustomFieldValue.objects.filter(
            custom_field=instance,
            deleted_at__isnull=True
        ).update(
            deleted_at=timezone.now()
        )
        
        # 2. CustomField 소프트 삭제
        instance.deleted_at = timezone.now()
        instance.save()

    def bulk_create(self, request, slug, project_id):
        """여러 커스텀 필드를 한번에 생성"""
        fields = request.data.get("fields", [])
        
        with transaction.atomic():
            created_fields = []
            for field_data in fields:
                serializer = self.get_serializer(data=field_data)
                serializer.is_valid(raise_exception=True)
                field = serializer.save(
                    project_id=project_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                created_fields.append(field)

            response_serializer = self.get_serializer(created_fields, many=True)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def usage_count(self, request, slug, project_id, pk=None):
        """커스텀 필드 사용량 조회"""
        from plane.db.models import CustomFieldValue
        
        field = self.get_object()
        count = CustomFieldValue.objects.filter(
            custom_field=field,
            deleted_at__isnull=True
        ).count()
        return Response({
            "count": count, 
            "field_id": field.id,
            "field_name": field.name
        })

    def reorder(self, request, slug, project_id):
        """커스텀 필드 순서 변경"""
        field_orders = request.data.get("field_orders", [])
        
        with transaction.atomic():
            for order in field_orders:
                field = CustomField.objects.get(
                    id=order["id"], 
                    project_id=project_id
                )
                field.sort_order = order["sort_order"]
                field.save(update_fields=["sort_order", "updated_at"])

            return Response(status=status.HTTP_200_OK)

    def analytics(self, request, slug, project_id):
        """커스텀 필드 기반 분석"""
        field_id = request.GET.get("field_id")
        field = CustomField.objects.get(id=field_id, project_id=project_id)
        
        if field.field_type not in ["select", "multiselect", "number"]:
            return Response(
                {"error": "이 필드 타입은 분석을 지원하지 않습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 필드 타입에 따른 분석 데이터 생성
        field_values = CustomFieldValue.objects.filter(
            custom_field=field,
            deleted_at__isnull=True
        )

        if field.field_type in ["select", "multiselect"]:
            # 선택형 필드의 경우 각 옵션별 카운트
            value_counts = {}
            for field_value in field_values:
                value = field_value.value
                if isinstance(value, list):  # multiselect
                    for v in value:
                        value_counts[v] = value_counts.get(v, 0) + 1
                else:  # select
                    value_counts[value] = value_counts.get(value, 0) + 1
            
            analytics_data = {
                "type": "distribution",
                "data": [
                    {"label": option, "count": value_counts.get(option, 0)}
                    for option in field.options
                ]
            }
        else:  # number
            # 숫자형 필드의 경우 기본 통계
            values = [float(fv.value) for fv in field_values if fv.value is not None]
            if values:
                analytics_data = {
                    "type": "statistics",
                    "data": {
                        "count": len(values),
                        "min": min(values),
                        "max": max(values),
                        "average": sum(values) / len(values)
                    }
                }
            else:
                analytics_data = {
                    "type": "statistics",
                    "data": {
                        "count": 0,
                        "min": None,
                        "max": None,
                        "average": None
                    }
                }

        return Response(analytics_data) 