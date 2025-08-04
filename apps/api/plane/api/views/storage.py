from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import StreamingHttpResponse, HttpResponseRedirect, HttpResponse
from django.conf import settings
from minio import Minio
from rest_framework.permissions import IsAuthenticated
import os
import logging
import hashlib
import time
from django.core.cache import cache
from hashlib import md5

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
            # print("\n=== MinioUploadView POST ===")
            # print(f"Request Headers: {request.headers}")
            # print(f"Request POST data: {request.POST}")
            # print(f"Request FILES: {request.FILES}")
            
            # S3Storage를 사용하여 파일 업로드
            storage = S3Storage(request=request)
            
            # 파일 데이터 가져오기 (multipart/form-data에서 file 필드)
            files = request.FILES
            if not files:
                # print("Error: No file provided")
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
                # print("Error: No key parameter provided in POST data")
                return Response(
                    {"error": "No key parameter provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # print(f"File Info - Key: {key}, Content-Type: {content_type}, Size: {file.size}")
            
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
                # print(f"FileAsset updated - Key: {key}, is_uploaded: True")
            except FileAsset.DoesNotExist:
                # print(f"FileAsset not found for key: {key}")
                pass
            
            # print("File upload successful")
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            # print(f"Error during file upload: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class StorageObjectView(BaseAPIView):
    """
    Minio 파일 접근을 위한 프록시 뷰
    인증된 사용자 또는 인스턴스 관리자의 접근을 허용
    사용자 아바타나 공개 자원의 경우 인증 없이도 접근 가능
    """
    # 기본적으로 인증이 필요하지만 특정 경우 예외 처리
    permission_classes = [IsAuthenticated]
    authentication_classes = [BaseSessionAuthentication]
    
    # 공개적으로 접근 가능한 에셋 타입 목록
    PUBLIC_ASSET_TYPES = [
        FileAsset.EntityTypeContext.USER_AVATAR,
        FileAsset.EntityTypeContext.USER_COVER,
        FileAsset.EntityTypeContext.WORKSPACE_LOGO,
        FileAsset.EntityTypeContext.PROJECT_COVER
    ]
    
    @staticmethod
    def validate_access_token(file_path, token):
        """
        파일 접근 토큰을 검증합니다.
        """
        if not token:
            return False
            
        # 캐시에서 토큰 조회
        cache_key = f"file_access:{file_path}"
        valid_token = cache.get(cache_key)
        
        if not valid_token or valid_token != token:
            return False
            
        return True
    
    def check_permissions(self, request):
        """
        공개 에셋에 대한 접근인 경우 권한 체크를 건너뜁니다.
        또는 유효한 액세스 토큰이 있는 경우에도 권한 체크를 건너뜁니다.
        """
        # 파일 경로를 쿼리 파라미터에서 추출
        file_path = self.kwargs.get('file_path')
        if not file_path:
            # 파일 경로가 없으면 일반 권한 체크 진행
            # print("파일 경로 없음, 일반 권한 체크 진행")
            return super().check_permissions(request)
            
        # 액세스 토큰 확인
        access_token = request.GET.get('access_token')
        if access_token and self.validate_access_token(file_path, access_token):
            # print(f"유효한 접근 토큰으로 접근: {file_path}")
            return None
        
        # 파일명 추출
        file_name = file_path.split('/')[-1]
        
        # print(f"권한 체크 중: 파일 '{file_name}', 인증 상태: {request.user.is_authenticated}")
        
        # 파일이 공개 에셋인지 확인
        asset = FileAsset.objects.filter(
            asset__icontains=file_name,
            is_deleted=False
        ).first()
        
        if not asset:
            # print(f"에셋을 찾을 수 없음: {file_name}, 일반 권한 체크 진행")
            return super().check_permissions(request)
        
        # print(f"에셋 정보 - 타입: {asset.entity_type}, 업로드 여부: {asset.is_uploaded}")
        
        # 공개 에셋이면 권한 체크 건너뜀
        if asset.entity_type in self.PUBLIC_ASSET_TYPES:
            # print(f"공개 에셋 타입({asset.entity_type})이므로 권한 체크 생략")
            return None
        
        # print(f"비공개 에셋 타입({asset.entity_type})이므로 일반 권한 체크 진행")
        # 그 외의 경우 일반 권한 체크 진행
        return super().check_permissions(request)
    
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
            # 파일명 추출
            file_name = file_path.split('/')[-1]
            # print(f"검색할 파일명: {file_name}")
            
            # 에셋 검색
            asset = FileAsset.objects.filter(
                asset__icontains=file_name,
                is_deleted=False
            ).first()
            
            if not asset:
                return Response(
                    {"error": "File not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 공개 에셋인 경우 토큰 생성 없이 바로 스트리밍
            if asset.entity_type in self.PUBLIC_ASSET_TYPES:
                storage = S3Storage(request=request)
                s3_response = storage.s3_client.get_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=str(asset.asset)
                )
                
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
                
                content_type = s3_response.get('ContentType', 'application/octet-stream')
                response = StreamingHttpResponse(
                    file_streamer(),
                    content_type=content_type
                )
                
                # Content-Disposition 헤더 설정
                disposition = request.GET.get('response-content-disposition', 'inline')
                response['Content-Disposition'] = disposition
                
                return response
            
            # 비공개 에셋인 경우 기존 로직대로 처리
            else:
                if not request.user.is_authenticated:
                    return Response(
                        {"error": "Authentication required"},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                
                user_id = str(request.user.id)
                access_token = self.generate_access_token(
                    file_path=asset.asset.name,
                    user_id=user_id
                )
                
                # 인스턴스 관리자 여부 확인
                is_admin = self.is_instance_admin(request.user)
                # print(f"Is instance admin: {is_admin}")
                
                # 파일 검색
                asset = FileAsset.objects.filter(
                    asset__icontains=file_name,  # 파일명으로 검색
                    is_deleted=False
                ).first()
                
                if asset:
                    # print(f"파일 찾음 - asset.asset: {asset.asset}")
                    pass
                else:
                    # print(f"파일을 찾을 수 없음: {file_path}")
                    return Response(
                        {"error": f"File not found: {file_path}"},
                        status=status.HTTP_404_NOT_FOUND
                    )

                # 인스턴스 관리자가 아닌 경우에만 권한 체크
                if not is_admin:
                    # 사용자가 이미 인증되어 있음 (권한 클래스에서 체크됨)
                    # 이전에 인증 체크를 수행하던 코드 대신 프로젝트/워크스페이스 접근 권한만 확인

                    # 프로젝트 관련 파일인 경우 프로젝트 멤버십 확인
                    if asset.project_id and not ProjectMember.objects.filter(
                        project_id=asset.project_id,
                        member=request.user,
                        is_active=True
                    ).exists():
                        # print(f"프로젝트 접근 권한 없음: {request.user}")
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
                        # print(f"워크스페이스 접근 권한 없음: {request.user}")
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
                    # print(f"파일 스트리밍 실패: {asset.asset}")
                    return Response(
                        {"error": "File streaming failed"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                
                # print(f"파일 스트리밍 시작: {asset.asset}")
                
                # 파일 확장자에 따른 content-type 설정
                content_type = s3_response.get('ContentType', 'application/octet-stream')
                # print(f"Content-Type from S3: {content_type}")
                
                # S3에서 받은 content-type이 없거나 기본값인 경우 파일 확장자로 판단
                if content_type == 'application/octet-stream':
                    asset_path = str(asset.asset)
                    if asset_path.lower().endswith('.pdf'):
                        content_type = 'application/pdf'
                    elif asset_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                        content_type = 'image/' + asset_path.lower().split('.')[-1]
                    # print(f"Content-Type from extension: {content_type}")
                
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
                disposition = request.GET.get('response-content-disposition', 'inline')
                response['Content-Disposition'] = disposition
                
                # Content-Length 헤더 설정 (있는 경우)
                if 'ContentLength' in s3_response:
                    response['Content-Length'] = str(s3_response['ContentLength'])
                
                return response
                
        except Exception as e:
            # print(f"파일 스트리밍 중 에러 발생: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @staticmethod
    def generate_access_token(file_path, user_id=None, expire_seconds=3600):
        """
        파일 접근을 위한 임시 토큰을 생성합니다.
        """
        # 현재 시간과 파일 경로, 임의의 솔트로 토큰 생성
        timestamp = int(time.time())
        salt = settings.SECRET_KEY[:10]
        token_base = f"{file_path}:{timestamp}:{salt}:{user_id or 'anonymous'}"
        token = md5(token_base.encode()).hexdigest()
        
        # 토큰을 캐시에 저장 (1시간 유효)
        cache_key = f"file_access:{file_path}"
        cache.set(cache_key, token, expire_seconds)
        
        return token 