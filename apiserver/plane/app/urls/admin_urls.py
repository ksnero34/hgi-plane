from django.urls import path

from plane.app.views.admin.project import AdminProjectTransferView

admin_urls = [
    # 프로젝트 이동 API 엔드포인트
    path(
        "project-transfer/", 
        AdminProjectTransferView.as_view(), 
        name="admin-project-transfer"
    ),
] 