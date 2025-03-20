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
from plane.license.models import Instance, InstanceAdmin

logger = logging.getLogger(__name__)

class MinioUploadView(BaseAPIView):
    """
    Minio 파일 업로드를 위한 프록시 뷰
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [BaseSessionAuthentication]
    
    def post(self, request, *args, **kwargs):
        try:
            print("\n=== MinioUploadView POST ===")
            print(f"Request Headers: {request.headers}")
            print(f"Request POST data: {request.POST}")
            print(f"Request FILES: {request.FILES}")
            
            # S3Storage를 사용하여 파일 업로드
            storage = S3Storage(request=request)
            
            # 파일 데이터 가져오기 (multipart/form-data에서 file 필드)
            files = request.FILES
            if not files:
                print("Error: No file provided")
                return Response(
                    {"error": "No file provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 첫 번째 파일 가져오기 (일반적으로 하나의 파일만 업로드)
            file = next(iter(files.values()))
            
            # Content-Type 확인
            content_type = file.content_type or request.META.get('CONTENT_TYPE', '')
            
            # Key 파라미터 확인 (POST 데이터에서)
            key = request.POST.get('key')
            if not key:
                print("Error: No key parameter provided in POST data")
                return Response(
                    {"error": "No key parameter provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            print(f"File Info - Key: {key}, Content-Type: {content_type}, Size: {file.size}")
            
            # 파일 업로드 처리
            response = storage.s3_client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
                Body=file,
                ContentType=content_type
            )
            
            # 파일 업로드 성공 시 FileAsset 업데이트
            try:
                asset = FileAsset.objects.get(asset=key)
                asset.is_uploaded = True
                
                # User avatar/cover 업데이트
                if asset.entity_type in [FileAsset.EntityTypeContext.USER_AVATAR, FileAsset.EntityTypeContext.USER_COVER]:
                    user = asset.user
                    if asset.entity_type == FileAsset.EntityTypeContext.USER_AVATAR:
                        user.avatar = f"/api/assets/v2/static/{asset.id}/"
                        user.avatar_asset = asset
                        user.save(update_fields=["avatar", "avatar_asset"])
                    else:
                        user.cover_image = f"/api/assets/v2/static/{asset.id}/"
                        user.cover_image_asset = asset
                        user.save(update_fields=["cover_image", "cover_image_asset"])
                
                asset.save(update_fields=["is_uploaded"])
                print(f"FileAsset updated - Key: {key}, is_uploaded: True")
            except FileAsset.DoesNotExist:
                print(f"FileAsset not found for key: {key}")
            
            print("File upload successful")
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error during file upload: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class StorageObjectView(BaseAPIView):
    """
    Minio 파일 접근을 위한 프록시 뷰
    인증된 사용자 또는 인스턴스 관리자의 접근을 허용
    """
    permission_classes = []  # 인증 요구사항 제거
    authentication_classes = []  # 인증 클래스 제거
    
    def is_instance_admin(self, user):
        if not user or not user.is_authenticated:
            return False
            
        instance = Instance.objects.first()
        if not instance:
            return False
            
        return InstanceAdmin.objects.filter(
            instance=instance,
            user=user,
            role__gte=15  # 관리자 권한 체크
        ).exists()
    
    def get(self, request, file_path):
        try:
            # URL 쿼리 파라미터 처리
            query_params = request.GET.dict()
            
            print(f"요청된 file_path: {file_path}")
            
            # 파일명 추출 (경로의 마지막 부분)
            file_name = file_path.split('/')[-1]
            print(f"검색할 파일명: {file_name}")
            
            # 인스턴스 관리자 여부 확인
            is_admin = self.is_instance_admin(request.user)
            print(f"Is instance admin: {is_admin}")
            
            # 파일 검색
            asset = FileAsset.objects.filter(
                asset__icontains=file_name,  # 파일명으로 검색
                is_deleted=False
            ).first()
            
            if asset:
                print(f"파일 찾음 - asset.asset: {asset.asset}")
            else:
                print(f"파일을 찾을 수 없음: {file_path}")
                return Response(
                    {"error": f"File not found: {file_path}"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 인스턴스 관리자가 아닌 경우에만 권한 체크
            if not is_admin:
                # 인증되지 않은 사용자인 경우
                if not request.user.is_authenticated:
                    return Response(
                        {"error": "Authentication required"},
                        status=status.HTTP_401_UNAUTHORIZED
                    )

                # 프로젝트 관련 파일인 경우 프로젝트 멤버십 확인
                if asset.project_id and not ProjectMember.objects.filter(
                    project_id=asset.project_id,
                    member=request.user,
                    is_active=True
                ).exists():
                    print(f"프로젝트 접근 권한 없음: {request.user}")
                    return Response(
                        {"error": "You don't have permission to access this file."},
                        status=status.HTTP_403_FORBIDDEN
                    )

                # 워크스페이스 관련 파일인 경우 워크스페이스 멤버십 확인
                if asset.workspace_id and not WorkspaceMember.objects.filter(
                    workspace_id=asset.workspace_id,
                    member=request.user,
                    is_active=True
                ).exists():
                    print(f"워크스페이스 접근 권한 없음: {request.user}")
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
                print(f"파일 스트리밍 실패: {asset.asset}")
                return Response(
                    {"error": "File streaming failed"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
            print(f"파일 스트리밍 시작: {asset.asset}")
            
            # 파일 확장자에 따른 content-type 설정
            content_type = s3_response.get('ContentType', 'application/octet-stream')
            print(f"Content-Type from S3: {content_type}")
            
            # S3에서 받은 content-type이 없거나 기본값인 경우 파일 확장자로 판단
            if content_type == 'application/octet-stream':
                asset_path = str(asset.asset)
                if asset_path.lower().endswith('.pdf'):
                    content_type = 'application/pdf'
                elif asset_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    content_type = 'image/' + asset_path.lower().split('.')[-1]
                print(f"Content-Type from extension: {content_type}")
            
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
            response['Content-Disposition'] = disposition
            
            # Content-Length 헤더 설정 (있는 경우)
            if 'ContentLength' in s3_response:
                response['Content-Length'] = str(s3_response['ContentLength'])
            
            return response
                
        except Exception as e:
            print(f"파일 스트리밍 중 에러 발생: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 