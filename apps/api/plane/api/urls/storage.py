from django.urls import path, re_path
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from plane.api.views.storage import StorageObjectView, MinioUploadView

bucket_name = settings.AWS_STORAGE_BUCKET_NAME

urlpatterns = [
    # 파일 조회 경로
    path(f"{bucket_name}/<path:file_path>", StorageObjectView.as_view(), name="storage-proxy"),
    # 파일 업로드 엔드포인트
    path(f"{bucket_name}", csrf_exempt(MinioUploadView.as_view()), name="minio-upload"),
] 