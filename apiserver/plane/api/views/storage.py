from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import StreamingHttpResponse, HttpResponseRedirect, HttpResponse
from django.conf import settings
from minio import Minio
from rest_framework.permissions import IsAuthenticated
import os
import logging

from plane.db.models import ProjectMember, Project, WorkspaceMember, FileAsset
from plane.app.permissions import ProjectEntityPermission
from .base import BaseAPIView
from plane.settings.storage import S3Storage
from plane.authentication.session import BaseSessionAuthentication

logger = logging.getLogger(__name__)

class MinioUploadView(BaseAPIView):
    """
    Minio 파일 업로드를 위한 프록시 뷰
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [BaseSessionAuthentication]
    
    def post(self, request, *args, **kwargs):
        try:
            # S3Storage를 사용하여 파일 업로드
            storage = S3Storage(request=request)
            
            # 파일 데이터 가져오기 (multipart/form-data에서 file 필드)
            files = request.FILES
            if not files:
                return Response(
                    {"error": "No file provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 첫 번째 파일 가져오기 (일반적으로 하나의 파일만 업로드)
            file = next(iter(files.values()))
            
            # Content-Type 확인
            content_type = file.content_type or request.META.get('CONTENT_TYPE', '')
            
            # Key 파라미터 확인
            key = request.GET.get('key')
            if not key:
                return Response(
                    {"error": "No key parameter provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"파일 업로드 시작 - Key: {key}, Content-Type: {content_type}")
            
            # 파일 업로드 처리
            response = storage.s3_client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
                Body=file,
                ContentType=content_type
            )
            
            logger.info(f"파일 업로드 완료 - Key: {key}")
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"파일 업로드 중 에러 발생: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class StorageObjectView(BaseAPIView):
    """
    Minio 파일 접근을 위한 프록시 뷰
    인증된 사용자만 파일에 접근할 수 있도록 처리
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [BaseSessionAuthentication]
    
    def get(self, request, file_path):
        try:
            # URL 쿼리 파라미터 처리
            query_params = request.GET.dict()
            
            logger.info(f"요청된 file_path: {file_path}")
            
            # 파일명 추출 (경로의 마지막 부분)
            file_name = file_path.split('/')[-1]
            logger.info(f"검색할 파일명: {file_name}")
            
            # 파일 검색
            asset = FileAsset.objects.filter(
                asset__icontains=file_name,  # 파일명으로 검색
                is_deleted=False
            ).first()
            
            if asset:
                logger.info(f"파일 찾음 - asset.asset: {asset.asset}")
            else:
                logger.error(f"파일을 찾을 수 없음: {file_path}")
                return Response(
                    {"error": f"File not found: {file_path}"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 프로젝트 관련 파일인 경우 프로젝트 멤버십 확인
            if asset.project_id:
                if not ProjectMember.objects.filter(
                    project_id=asset.project_id,
                    member=request.user,
                    is_active=True
                ).exists():
                    logger.warning(f"프로젝트 접근 권한 없음: {request.user}")
                    return Response(
                        {"error": "You don't have permission to access this file."},
                        status=status.HTTP_403_FORBIDDEN
                    )

            # 워크스페이스 관련 파일인 경우 워크스페이스 멤버십 확인
            if asset.workspace_id:
                if not WorkspaceMember.objects.filter(
                    workspace_id=asset.workspace_id,
                    member=request.user,
                    is_active=True
                ).exists():
                    logger.warning(f"워크스페이스 접근 권한 없음: {request.user}")
                    return Response(
                        {"error": "You don't have permission to access this file."},
                        status=status.HTTP_403_FORBIDDEN
                    )

            # S3Storage를 사용하여 파일 스트리밍
            storage = S3Storage(request=request)
            s3_response = storage.s3_client.get_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=str(asset.asset)
            )
            
            if not s3_response:
                logger.error(f"파일 스트리밍 실패: {asset.asset}")
                return Response(
                    {"error": "File streaming failed"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
            logger.info(f"파일 스트리밍 시작: {asset.asset}")
            
            # 파일 확장자에 따른 content-type 설정
            content_type = s3_response.get('ContentType', 'application/octet-stream')
            logger.info(f"Content-Type from S3: {content_type}")
            
            # S3에서 받은 content-type이 없거나 기본값인 경우 파일 확장자로 판단
            if content_type == 'application/octet-stream':
                asset_path = str(asset.asset)
                if asset_path.lower().endswith('.pdf'):
                    content_type = 'application/pdf'
                elif asset_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    content_type = 'image/' + asset_path.lower().split('.')[-1]
                logger.info(f"Content-Type from extension: {content_type}")
            
            # 청크 크기 설정 (8MB)
            chunk_size = 8 * 1024 * 1024
            
            def file_streamer():
                try:
                    while True:
                        chunk = s3_response['Body'].read(chunk_size)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    s3_response['Body'].close()
            
            response = StreamingHttpResponse(
                file_streamer(),
                content_type=content_type
            )
            
            # Content-Disposition 헤더 설정
            disposition = query_params.get('response-content-disposition', 'inline')
            response['Content-Disposition'] = f'{disposition}; filename="{file_name}"'
            
            # Content-Length 헤더 설정 (있는 경우)
            if 'ContentLength' in s3_response:
                response['Content-Length'] = str(s3_response['ContentLength'])
            
            return response
                
        except Exception as e:
            logger.exception(f"파일 스트리밍 중 에러 발생: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 