# Python imports
import uuid
import magic
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import re

# Django imports
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.db import IntegrityError

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

# Module imports
from ..base import BaseAPIView
from plane.db.models import FileAsset, Workspace, Project, User
from plane.settings.storage import S3Storage
from plane.app.permissions import allow_permission, ROLE
from plane.utils.cache import invalidate_cache_directly
from plane.bgtasks.storage_metadata_task import get_asset_object_metadata
from plane.license.models import Instance
from plane.throttles.asset import AssetRateThrottle


class BaseFileAssetEndpoint(BaseAPIView):
    """Base class for file asset endpoints with common validation methods"""

    def get_mime_type(self, file):
        """파일의 실제 MIME 타입을 확인"""
        mime = magic.Magic(mime=True)
        file.seek(0)  # 파일 포인터를 처음으로
        mime_type = mime.from_buffer(file.read(1024))  # 처음 1024바이트만 읽어서 확인
        file.seek(0)  # 파일 포인터를 다시 처음으로
        return mime_type

    def is_valid_mime_type(self, file_extension, mime_type):
        """파일 확장자와 MIME 타입이 일치하는지 확인"""
        mime_extension_map = {
            # 텍스트 문서
            'txt': ['text/plain', 'application/octet-stream'],
            'css': ['text/css'],
            'js': ['text/javascript'],
            'json': ['application/json'],
            'xml': ['text/xml', 'application/xml'],
            'csv': ['text/csv'],
            'rtf': ['application/rtf'],

            # 이미지
            'jpg': ['image/jpeg', 'image/png' ,'image/gif'],
            'jpeg': ['image/jpeg', 'image/png' ,'image/gif'],
            'png': ['image/jpeg', 'image/png' ,'image/gif'],
            'gif': ['image/jpeg', 'image/png' ,'image/gif'],
            'svg': ['image/svg+xml'],
            'webp': ['image/webp'],
            'tiff': ['image/tiff'],
            'bmp': ['image/bmp'],

            # 문서
            'pdf': ['application/pdf', 'application/octet-stream'],
            'doc': ['application/msword', 'application/octet-stream'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', 'application/haansoftdocx'],
            'xls': ['application/vnd.ms-excel', 'application/octet-stream'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
            'ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
            'pptx': [
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/vnd.ms-powerpoint.presentation.macroenabled.12',
                'application/octet-stream'
            ],

            # 오디오
            'mp3': ['audio/mpeg'],
            'wav': ['audio/wav'],
            'ogg': ['audio/ogg'],
            'midi': ['audio/midi', 'audio/x-midi'],
            'aac': ['audio/aac'],
            'flac': ['audio/flac'],
            'm4a': ['audio/x-m4a'],

            # 비디오
            'mp4': ['video/mp4'],
            'mpeg': ['video/mpeg'],
            'ogv': ['video/ogg'],
            'webm': ['video/webm'],
            'mov': ['video/quicktime'],
            'avi': ['video/x-msvideo'],
            'wmv': ['video/x-ms-wmv'],

            # 압축파일
            'zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
            'rar': ['application/x-rar-compressed'],
            'tar': ['application/x-tar'],
            'gz': ['application/gzip'],

            # 3D 모델
            'glb': ['model/gltf-binary'],
            'gltf': ['model/gltf+json'],
            'obj': ['application/octet-stream'],

            # 폰트
            'ttf': ['font/ttf'],
            'otf': ['font/otf'],
            'woff': ['font/woff'],
            'woff2': ['font/woff2'],
        }

        allowed_mime_types = mime_extension_map.get(file_extension.lower(), [])
        return mime_type in allowed_mime_types

    def validate_file(self, file=None, file_info=None):
        """파일 또는 파일 정보를 검증"""
        # Instance 설정 가져오기
        instance = Instance.objects.first()
        if not instance:
            return False, "Instance settings not found"

        # FileUploadSettings 객체에서 직접 속성에 접근
        file_settings = instance.file_settings
        if not file_settings:
            return False, "File settings not found"

        if file:  # 실제 파일이 있는 경우
            # 파일명 검증 (널 바이트 및 변조 검사)
            file_name = getattr(file, "name", "") or ""
            if not file_name:
                return False, "파일명이 유효하지 않습니다."
            # 널 바이트 검사 (%00, \x00, 0x00 등)
            if '%00' in file_name or '\x00' in file_name or re.search(r'\\x00', file_name) or re.search(r'0x00', file_name):
                return False, "파일명에 널 바이트가 포함되어 있어 보안상 위험합니다."

            # 파일명 안전성 검사 (특수문자 제한)
            # if not re.match(r'^[a-zA-Z0-9가-힣._\-() ]+$', file_name):
            #     return False, "파일명에 허용되지 않는 특수문자가 포함되어 있습니다."

            # 파일 크기 검증
            if file.size > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증
            mime_type = self.get_mime_type(file)
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 내용이 확장자와 일치하지 않습니다. 감지된 형식: {mime_type}"

        elif file_info:  # 파일 정보만 있는 경우
            # 파일명 검증 (널 바이트 및 변조 검사)
            file_name = file_info.get('name')
            if not isinstance(file_name, str):
                return False, "파일명이 유효하지 않습니다."
            file_name = file_name.strip()
            if not file_name:
                return False, "파일명이 유효하지 않습니다."
            # 널 바이트 검사 (%00, \x00, 0x00 등)
            if '%00' in file_name or '\x00' in file_name or re.search(r'\\x00', file_name) or re.search(r'0x00', file_name):
                return False, "파일명에 널 바이트가 포함되어 있어 보안상 위험합니다."

            # 파일명 안전성 검사 (특수문자 제한)
            # if not re.match(r'^[a-zA-Z0-9가-힣._\-() ]+$', file_name):
            #     return False, "파일명에 허용되지 않는 특수문자가 포함되어 있습니다."

            # 파일 크기 검증
            if file_info.get('size', 0) > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증 (file_info에서 제공된 type 사용)
            mime_type = file_info.get('type', '')
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 형식이 허용되지 않습니다. 감지된 형식: {mime_type}"

        return True, None


def modify_presigned_post_url(request, presigned_data):
    """presigned post URL의 도메인을 요청 도메인으로 변경"""
    if not presigned_data or 'url' not in presigned_data:
        return presigned_data

    presigned_data['url'] = replace_domain_in_url(request, presigned_data['url'])
    return presigned_data

class UserAssetsV2Endpoint(BaseFileAssetEndpoint):
    """This endpoint is used to upload user profile images."""

    def asset_delete(self, asset_id):
        asset = FileAsset.objects.filter(id=asset_id).first()
        if asset is None:
            return
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return

    def entity_asset_save(self, asset_id, entity_type, asset, request):
        # User Avatar
        if entity_type == FileAsset.EntityTypeContext.USER_AVATAR:
            user = User.objects.get(id=asset.user_id)
            user.avatar = ""
            # Delete the previous avatar
            if user.avatar_asset_id:
                self.asset_delete(user.avatar_asset_id)
            # Save the new avatar
            user.avatar_asset_id = asset_id
            user.save()
            invalidate_cache_directly(path="/api/users/me/", url_params=False, user=True, request=request)
            invalidate_cache_directly(
                path="/api/users/me/settings/",
                url_params=False,
                user=True,
                request=request,
            )
            return
        # User Cover
        if entity_type == FileAsset.EntityTypeContext.USER_COVER:
            user = User.objects.get(id=asset.user_id)
            user.cover_image = None
            # Delete the previous cover image
            if user.cover_image_asset_id:
                self.asset_delete(user.cover_image_asset_id)
            # Save the new cover image
            user.cover_image_asset_id = asset_id
            user.save()
            invalidate_cache_directly(path="/api/users/me/", url_params=False, user=True, request=request)
            invalidate_cache_directly(
                path="/api/users/me/settings/",
                url_params=False,
                user=True,
                request=request,
            )
            return
        return

    def entity_asset_delete(self, entity_type, asset, request):
        # User Avatar
        if entity_type == FileAsset.EntityTypeContext.USER_AVATAR:
            user = User.objects.get(id=asset.user_id)
            user.avatar_asset_id = None
            user.save()
            invalidate_cache_directly(path="/api/users/me/", url_params=False, user=True, request=request)
            invalidate_cache_directly(
                path="/api/users/me/settings/",
                url_params=False,
                user=True,
                request=request,
            )
            return
        # User Cover
        if entity_type == FileAsset.EntityTypeContext.USER_COVER:
            user = User.objects.get(id=asset.user_id)
            user.cover_image_asset_id = None
            user.save()
            invalidate_cache_directly(path="/api/users/me/", url_params=False, user=True, request=request)
            invalidate_cache_directly(
                path="/api/users/me/settings/",
                url_params=False,
                user=True,
                request=request,
            )
            return
        return

    def post(self, request):
        # get the asset key
        name = request.data.get("name")
        type = request.data.get("type", "image/jpeg")
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        entity_type = request.data.get("entity_type", False)

        # Check if the file size is within the limit
        size_limit = min(size, settings.FILE_SIZE_LIMIT)

        #  Check if the entity type is allowed
        if not entity_type or entity_type not in ["USER_AVATAR", "USER_COVER"]:
            return Response(
                {"error": "Invalid entity type.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 파일이 있는 경우와 파일 정보만 있는 경우를 구분하여 검증
        file = request.FILES.get('asset')
        if file:
            is_valid, error_message = self.validate_file(file=file)
        else:
            file_info = {
                'name': name,
                'type': type,
                'size': size
            }
            is_valid, error_message = self.validate_file(file_info=file_info)

        if not is_valid:
            return Response(
                {"error": "파일 검증 실패", "status": False, "message": error_message},
                status=status.HTTP_400_BAD_REQUEST
            )

        # asset key
        asset_key = f"{uuid.uuid4().hex}-{name}"

        # Create a File Asset
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": type, "size": size_limit},
            asset=asset_key,
            size=size_limit,
            user=request.user,
            created_by=request.user,
            entity_type=entity_type,
        )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        presigned_url = storage.generate_presigned_post(
            object_name=asset_key, file_type=type, file_size=size_limit
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_presigned_data = modify_presigned_post_url(request, presigned_url)
        # Return the presigned URL
        return Response(
            {
                "upload_data": modified_presigned_data,
                "asset_id": str(asset.id),
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, asset_id):
        """Update user profile image asset."""
        asset = FileAsset.objects.filter(id=asset_id).first()

        # Check if the asset exists
        if asset is None:
            return Response(
                {"error": "Asset not found", "status": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if the user has permission
        if asset.user != request.user:
            return Response(
                {"error": "You don't have permission to update this asset", "status": False},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Update the asset
        if request.data.get("is_uploaded", False):
            # 먼저 is_uploaded 플래그를 True로 설정하고 저장
            asset.is_uploaded = True
            asset.save(update_fields=["is_uploaded"])

            # Update user profile based on entity type
            user = request.user
            if asset.entity_type == FileAsset.EntityTypeContext.USER_AVATAR:
                # Delete previous avatar asset if exists
                if user.avatar_asset:
                    user.avatar_asset.is_deleted = True
                    user.avatar_asset.deleted_at = timezone.now()
                    user.avatar_asset.save(update_fields=["is_deleted", "deleted_at"])

                user.avatar = asset.asset_url
                user.avatar_asset = asset
                user.save(update_fields=["avatar", "avatar_asset"])

            elif asset.entity_type == FileAsset.EntityTypeContext.USER_COVER:
                # Delete previous cover image asset if exists
                if user.cover_image_asset:
                    user.cover_image_asset.is_deleted = True
                    user.cover_image_asset.deleted_at = timezone.now()
                    user.cover_image_asset.save(update_fields=["is_deleted", "deleted_at"])

                user.cover_image = asset.asset_url
                user.cover_image_asset = asset
                user.save(update_fields=["cover_image", "cover_image_asset"])

            # Invalidate user profile cache
            invalidate_cache_directly(
                path="/api/users/me/",
                url_params=False,
                user=True,
                request=request,
            )
            invalidate_cache_directly(
                path="/api/users/me/profile/",
                url_params=False,
                user=True,
                request=request,
            )

            # Update storage metadata if needed
            if not asset.storage_metadata:
                get_asset_object_metadata.delay(asset_id=str(asset_id))

        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, asset_id):
        """Delete user profile image asset."""
        from django.db import transaction

        try:
            with transaction.atomic():
                # Get the asset
                asset = FileAsset.objects.select_for_update().filter(id=asset_id).first()

                # Check if the asset exists
                if asset is None:
                    return Response(
                        {"error": "Asset not found", "status": False},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                # Check if the user has permission
                if asset.user != request.user:
                    return Response(
                        {"error": "You don't have permission to delete this asset", "status": False},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                # Update user profile based on entity type
                user = request.user
                if asset.entity_type == FileAsset.EntityTypeContext.USER_AVATAR:
                    if user.avatar_asset_id:
                        # 첫 번째 단계: 업로드된 이미지만 삭제
                        user.avatar_asset = None
                        user.save(update_fields=["avatar_asset"])
                    else:
                        # 두 번째 단계: avatar_asset이 없는 상태에서의 삭제 요청은 URL도 함께 삭제
                        user.avatar = ""
                        user.save(update_fields=["avatar"])
                elif asset.entity_type == FileAsset.EntityTypeContext.USER_COVER:
                    if user.cover_image_asset_id == asset.id:
                        user.cover_image_asset = None
                        user.cover_image = ""
                        user.save(update_fields=["cover_image", "cover_image_asset"])

                # Mark the asset as deleted
                asset.is_deleted = True
                asset.deleted_at = timezone.now()
                asset.save(update_fields=["is_deleted", "deleted_at"])

                # Invalidate user profile cache
                invalidate_cache_directly(
                    path="/api/users/me/",
                    url_params=False,
                    user=True,
                    request=request,
                )
                invalidate_cache_directly(
                    path="/api/users/me/profile/",
                    url_params=False,
                    user=True,
                    request=request,
                )

                return Response(status=status.HTTP_204_NO_CONTENT)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class WorkspaceFileAssetEndpoint(BaseFileAssetEndpoint):
    """This endpoint is used to upload cover images/logos etc for workspace, projects and users."""

    def get_entity_id_field(self, entity_type, entity_id):
        # Workspace Logo
        if entity_type == FileAsset.EntityTypeContext.WORKSPACE_LOGO:
            return {"workspace_id": entity_id}

        # Project Cover
        if entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            return {"project_id": entity_id}

        # User Avatar and Cover
        if entity_type in [
            FileAsset.EntityTypeContext.USER_AVATAR,
            FileAsset.EntityTypeContext.USER_COVER,
        ]:
            return {"user_id": entity_id}

        # Issue Attachment and Description
        if entity_type in [
            FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            FileAsset.EntityTypeContext.ISSUE_DESCRIPTION,
        ]:
            return {"issue_id": entity_id}

        # Page Description
        if entity_type == FileAsset.EntityTypeContext.PAGE_DESCRIPTION:
            return {"page_id": entity_id}

        # Comment Description
        if entity_type == FileAsset.EntityTypeContext.COMMENT_DESCRIPTION:
            return {"comment_id": entity_id}
        return {}

    def asset_delete(self, asset_id):
        asset = FileAsset.objects.filter(id=asset_id).first()
        # Check if the asset exists
        if asset is None:
            return
        # Mark the asset as deleted
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return

    def entity_asset_save(self, asset_id, entity_type, asset, request):
        # Workspace Logo
        if entity_type == FileAsset.EntityTypeContext.WORKSPACE_LOGO:
            workspace = Workspace.objects.filter(id=asset.workspace_id).first()
            if workspace is None:
                return
            # Delete the previous logo
            if workspace.logo_asset_id:
                self.asset_delete(workspace.logo_asset_id)
            # Save the new logo
            workspace.logo = ""
            workspace.logo_asset_id = asset_id
            workspace.save()
            invalidate_cache_directly(path="/api/workspaces/", url_params=False, user=False, request=request)
            invalidate_cache_directly(
                path="/api/users/me/workspaces/",
                url_params=False,
                user=True,
                request=request,
            )
            invalidate_cache_directly(path="/api/instances/", url_params=False, user=False, request=request)
            return

        # Project Cover
        elif entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            project = Project.objects.filter(id=asset.project_id).first()
            if project is None:
                return
            # Delete the previous cover image
            if project.cover_image_asset_id:
                self.asset_delete(project.cover_image_asset_id)
            # Save the new cover image
            project.cover_image = ""
            project.cover_image_asset_id = asset_id
            project.save()
            return
        else:
            return

    def entity_asset_delete(self, entity_type, asset, request):
        # Workspace Logo
        if entity_type == FileAsset.EntityTypeContext.WORKSPACE_LOGO:
            workspace = Workspace.objects.get(id=asset.workspace_id)
            if workspace is None:
                return
            workspace.logo_asset_id = None
            workspace.save()
            invalidate_cache_directly(path="/api/workspaces/", url_params=False, user=False, request=request)
            invalidate_cache_directly(
                path="/api/users/me/workspaces/",
                url_params=False,
                user=True,
                request=request,
            )
            invalidate_cache_directly(path="/api/instances/", url_params=False, user=False, request=request)
            return
        # Project Cover
        elif entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            project = Project.objects.filter(id=asset.project_id).first()
            if project is None:
                return
            project.cover_image_asset_id = None
            project.save()
            return
        else:
            return

    def post(self, request, slug):
        name = request.data.get("name")
        type = request.data.get("type", "image/jpeg")
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        entity_type = request.data.get("entity_type")
        entity_identifier = request.data.get("entity_identifier", False)

        if not name or not isinstance(name, str) or not name.strip():
            return Response(
                {"error": "유효한 파일명이 필요합니다.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = name.strip()

        # Check if the entity type is allowed
        if entity_type not in FileAsset.EntityTypeContext.values:
            return Response(
                {"error": "Invalid entity type.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 파일이 있는 경우와 파일 정보만 있는 경우를 구분하여 검증
        file = request.FILES.get('asset')
        if file:
            is_valid, error_message = self.validate_file(file=file)
        else:
            file_info = {
                'name': name,
                'type': type,
                'size': size
            }
            is_valid, error_message = self.validate_file(file_info=file_info)

        if not is_valid:
            return Response(
                {"error": "파일 검증 실패", "status": False, "message": error_message},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the size limit
        size_limit = min(settings.FILE_SIZE_LIMIT, size)

        # Get the workspace
        workspace = Workspace.objects.get(slug=slug)

        # asset key
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{name}"

        # Create a File Asset
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": type, "size": size_limit},
            asset=asset_key,
            size=size_limit,
            workspace=workspace,
            created_by=request.user,
            entity_type=entity_type,
            **self.get_entity_id_field(entity_type=entity_type, entity_id=entity_identifier),
        )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        presigned_url = storage.generate_presigned_post(
            object_name=asset_key, file_type=type, file_size=size_limit
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_presigned_data = modify_presigned_post_url(request, presigned_url)
        # Return the presigned URL
        return Response(
            {
                "upload_data": modified_presigned_data,
                "asset_id": str(asset.id),
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, slug, asset_id):
        # get the asset id
        asset = FileAsset.objects.get(id=asset_id, workspace__slug=slug)
        # get the storage metadata
        asset.is_uploaded = True
        # get the storage metadata
        if not asset.storage_metadata:
            get_asset_object_metadata.delay(asset_id=str(asset_id))
        # get the entity and save the asset id for the request field
        self.entity_asset_save(
            asset_id=asset_id,
            entity_type=asset.entity_type,
            asset=asset,
            request=request,
        )
        # update the attributes
        asset.attributes = request.data.get("attributes", asset.attributes)
        # save the asset
        asset.save(update_fields=["is_uploaded", "attributes"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, slug, asset_id):
        asset = FileAsset.objects.get(id=asset_id, workspace__slug=slug)
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        # get the entity and save the asset id for the request field
        self.entity_asset_delete(entity_type=asset.entity_type, asset=asset, request=request)
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get(self, request, slug, asset_id):
        # get the asset id
        asset = FileAsset.objects.get(id=asset_id, workspace__slug=slug)

        # Check if the asset is uploaded
        if not asset.is_uploaded:
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        signed_url = storage.generate_presigned_url(
            object_name=asset.asset.name,
            disposition="attachment",
            filename=asset.attributes.get("name"),
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_url = replace_domain_in_url(request, signed_url)
        # Redirect to the modified signed URL
        return HttpResponseRedirect(modified_url)


class StaticFileAssetEndpoint(BaseAPIView):
    """This endpoint is used to get the signed URL for a static asset."""

    permission_classes = [AllowAny]

    def get(self, request, asset_id):
        # print("\n=== StaticFileAssetEndpoint GET ===")
        # print(f"asset_id: {asset_id}")

        try:
            # get the asset id
            asset = FileAsset.objects.get(id=asset_id)
            # print(f"asset found: {asset.asset}")
            # print(f"asset.is_uploaded: {asset.is_uploaded}")
            # print(f"asset.entity_type: {asset.entity_type}")
            # print(f"asset.asset.name: {asset.asset.name}")

            # Check if the asset is uploaded
            if not asset.is_uploaded:
                # print("Asset not uploaded")
                return Response(
                    {"error": "The requested asset could not be found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Check if the entity type is allowed
            if asset.entity_type not in [
                FileAsset.EntityTypeContext.USER_AVATAR,
                FileAsset.EntityTypeContext.USER_COVER,
                FileAsset.EntityTypeContext.WORKSPACE_LOGO,
                FileAsset.EntityTypeContext.PROJECT_COVER,
            ]:
                # print(f"Invalid entity type: {asset.entity_type}")
                return Response(
                    {"error": "Invalid entity type.", "status": False},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get the presigned URL
            storage = S3Storage(request=request)
            # Generate a presigned URL to share an S3 object
            signed_url = storage.generate_presigned_url(object_name=asset.asset.name)
            # print(f"Generated signed URL: {signed_url}")

            # URL의 도메인을 요청 도메인으로 변경
            modified_url = replace_domain_in_url(request, signed_url)

            # 공개 에셋이 아니고 인증이 필요한 경우, 접근 토큰 생성
            if asset.entity_type not in [
                FileAsset.EntityTypeContext.USER_AVATAR,
                FileAsset.EntityTypeContext.USER_COVER,
                FileAsset.EntityTypeContext.WORKSPACE_LOGO,
                FileAsset.EntityTypeContext.PROJECT_COVER,
            ] and request.user.is_authenticated:
                # StorageObjectView의 토큰 생성 메서드 사용
                from plane.api.views.storage import StorageObjectView

                user_id = str(request.user.id) if request.user.is_authenticated else None
                if user_id:  # 인증된 사용자인 경우에만 토큰 생성
                    access_token = StorageObjectView.generate_access_token(
                        file_path=asset.asset.name,
                        user_id=user_id
                    )

                    # URL에 액세스 토큰 추가
                    url_parts = list(urlparse(modified_url))
                    query = dict(parse_qsl(url_parts[4]))
                    query.update({'access_token': access_token})
                    url_parts[4] = urlencode(query)
                    modified_url = urlunparse(url_parts)

                    # print(f"인증 토큰이 포함된 URL로 변경: {modified_url}")

            # print(f"Modified URL: {modified_url}")

            # Redirect to the modified signed URL
            return HttpResponseRedirect(modified_url)

        except FileAsset.DoesNotExist:
            # print(f"Asset not found: {asset_id}")
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            # print(f"Error accessing asset: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AssetRestoreEndpoint(BaseAPIView):
    """Endpoint to restore a deleted assets."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], level="WORKSPACE")
    def post(self, request, slug, asset_id):
        asset = FileAsset.all_objects.get(id=asset_id, workspace__slug=slug)
        asset.is_deleted = False
        asset.deleted_at = None
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectAssetEndpoint(BaseFileAssetEndpoint):
    """This endpoint is used to upload cover images/logos etc for workspace, projects and users."""

    def get_entity_id_field(self, entity_type, entity_id):
        if entity_type == FileAsset.EntityTypeContext.WORKSPACE_LOGO:
            return {"workspace_id": entity_id}

        if entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            return {"project_id": entity_id}

        if entity_type in [
            FileAsset.EntityTypeContext.USER_AVATAR,
            FileAsset.EntityTypeContext.USER_COVER,
        ]:
            return {"user_id": entity_id}

        if entity_type in [
            FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            FileAsset.EntityTypeContext.ISSUE_DESCRIPTION,
        ]:
            return {"issue_id": entity_id}

        if entity_type == FileAsset.EntityTypeContext.PAGE_DESCRIPTION:
            return {"page_id": entity_id}

        if entity_type == FileAsset.EntityTypeContext.COMMENT_DESCRIPTION:
            return {"comment_id": entity_id}

        if entity_type == FileAsset.EntityTypeContext.DRAFT_ISSUE_DESCRIPTION:
            return {"draft_issue_id": entity_id}
        return {}

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def post(self, request, slug, project_id):
        name = request.data.get("name")
        type = request.data.get("type", "image/jpeg")
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        entity_type = request.data.get("entity_type", "")
        entity_identifier = request.data.get("entity_identifier")

        # Check if the entity type is allowed
        if entity_type not in FileAsset.EntityTypeContext.values:
            return Response(
                {"error": "Invalid entity type.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 파일이 있는 경우와 파일 정보만 있는 경우를 구분하여 검증
        file = request.FILES.get('asset')
        if file:
            is_valid, error_message = self.validate_file(file=file)
        else:
            file_info = {
                'name': name,
                'type': type,
                'size': size
            }
            is_valid, error_message = self.validate_file(file_info=file_info)

        if not is_valid:
            return Response(
                {"error": "파일 검증 실패", "status": False, "message": error_message},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the size limit
        size_limit = min(settings.FILE_SIZE_LIMIT, size)

        # Get the workspace
        workspace = Workspace.objects.get(slug=slug)

        # asset key
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{name}"

        # Create a File Asset
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": type, "size": size_limit},
            asset=asset_key,
            size=size_limit,
            workspace=workspace,
            created_by=request.user,
            entity_type=entity_type,
            project_id=project_id,
            **self.get_entity_id_field(entity_type, entity_identifier),
        )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        presigned_url = storage.generate_presigned_post(
            object_name=asset_key, file_type=type, file_size=size_limit
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_presigned_data = modify_presigned_post_url(request, presigned_url)
        # Return the presigned URL
        return Response(
            {
                "upload_data": modified_presigned_data,
                "asset_id": str(asset.id),
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def patch(self, request, slug, project_id, pk):
        # get the asset id
        asset = FileAsset.objects.get(id=pk)
        # get the storage metadata
        asset.is_uploaded = True
        # get the storage metadata
        if not asset.storage_metadata:
            get_asset_object_metadata.delay(asset_id=str(pk))

        # update the attributes
        asset.attributes = request.data.get("attributes", asset.attributes)
        # save the asset
        asset.save(update_fields=["is_uploaded", "attributes"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def delete(self, request, slug, project_id, pk):
        # Get the asset
        asset = FileAsset.objects.get(id=pk, workspace__slug=slug, project_id=project_id)
        # Check deleted assets
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        # Save the asset
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def get(self, request, slug, project_id, pk):
        # get the asset id
        asset = FileAsset.objects.get(workspace__slug=slug, project_id=project_id, pk=pk)

        # Check if the asset is uploaded
        if not asset.is_uploaded:
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        signed_url = storage.generate_presigned_url(
            object_name=asset.asset.name,
            disposition="attachment",
            filename=asset.attributes.get("name"),
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_url = replace_domain_in_url(request, signed_url)
        # Redirect to the modified signed URL
        return HttpResponseRedirect(modified_url)


class ProjectBulkAssetEndpoint(BaseAPIView):
    def save_project_cover(self, asset, project_id):
        project = Project.objects.get(id=project_id)
        project.cover_image_asset_id = asset.id
        project.save()

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def post(self, request, slug, project_id, entity_id):
        asset_ids = request.data.get("asset_ids", [])

        # Check if the asset ids are provided
        if not asset_ids:
            return Response({"error": "No asset ids provided."}, status=status.HTTP_400_BAD_REQUEST)

        # get the asset id
        assets = FileAsset.objects.filter(id__in=asset_ids, workspace__slug=slug)

        # Get the first asset
        asset = assets.first()

        if not asset:
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if the asset is uploaded
        if asset.entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            assets.update(project_id=project_id)
            [self.save_project_cover(asset, project_id) for asset in assets]

        if asset.entity_type == FileAsset.EntityTypeContext.ISSUE_DESCRIPTION:
            # For some cases, the bulk api is called after the issue is deleted creating
            # an integrity error
            try:
                assets.update(issue_id=entity_id, project_id=project_id)
            except IntegrityError:
                pass

        if asset.entity_type == FileAsset.EntityTypeContext.COMMENT_DESCRIPTION:
            # For some cases, the bulk api is called after the comment is deleted
            # creating an integrity error
            try:
                assets.update(comment_id=entity_id)
            except IntegrityError:
                pass

        if asset.entity_type == FileAsset.EntityTypeContext.PAGE_DESCRIPTION:
            assets.update(page_id=entity_id)

        if asset.entity_type == FileAsset.EntityTypeContext.DRAFT_ISSUE_DESCRIPTION:
            # For some cases, the bulk api is called after the draft issue is deleted
            # creating an integrity error
            try:
                assets.update(draft_issue_id=entity_id)
            except IntegrityError:
                pass

        return Response(status=status.HTTP_204_NO_CONTENT)


class PageFileAssetEndpoint(BaseFileAssetEndpoint):
    """This endpoint is used to upload files for pages."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def post(self, request, slug, project_id):
        name = request.data.get("name")
        type = request.data.get("type", "application/octet-stream")
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        entity_type = request.data.get("entity_type", "")
        entity_identifier = request.data.get("entity_identifier")

        # Check if the entity type is allowed
        if entity_type not in FileAsset.EntityTypeContext.values:
            return Response(
                {"error": "Invalid entity type.", "status": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 파일이 있는 경우와 파일 정보만 있는 경우를 구분하여 검증
        file = request.FILES.get('asset')
        if file:
            is_valid, error_message = self.validate_file(file=file)
        else:
            file_info = {
                'name': name,
                'type': type,
                'size': size
            }
            is_valid, error_message = self.validate_file(file_info=file_info)

        if not is_valid:
            return Response(
                {"error": "파일 검증 실패", "status": False, "message": error_message},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the workspace
        workspace = Workspace.objects.get(slug=slug)

        # asset key
        asset_key = f"{workspace.id}/{uuid.uuid4().hex}-{name}"

        # Create a File Asset
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": type, "size": size},
            asset=asset_key,
            size=size,
            workspace=workspace,
            created_by=request.user,
            entity_type=entity_type,
            project_id=project_id,
            page_id=entity_identifier,
        )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        presigned_data = storage.generate_presigned_post(
            object_name=asset_key, file_type=type, file_size=size
        )
        # URL의 도메인을 요청 도메인으로 변경
        modified_presigned_data = modify_presigned_post_url(request, presigned_data)
        # Return the presigned URL
        return Response(
            {
                "upload_data": modified_presigned_data,
                "asset_id": str(asset.id),
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def patch(self, request, slug, project_id, pk):
        # get the asset id
        asset = FileAsset.objects.get(id=pk)
        # get the storage metadata
        asset.is_uploaded = True
        # get the storage metadata
        if not asset.storage_metadata:
            get_asset_object_metadata.delay(asset_id=str(pk))

        # update the attributes
        asset.attributes = request.data.get("attributes", asset.attributes)
        # save the asset
        asset.save(update_fields=["is_uploaded", "attributes"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def delete(self, request, slug, project_id, pk):
        # Get the asset
        asset = FileAsset.objects.get(
            id=pk, workspace__slug=slug, project_id=project_id
        )
        # Check deleted assets
        asset.is_deleted = True
        asset.deleted_at = timezone.now()
        # Save the asset
        asset.save(update_fields=["is_deleted", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def get(self, request, slug, project_id):
        page_id = request.GET.get("page_id")
        if not page_id:
            return Response(
                {"error": "Page ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 페이지에 속한 파일 목록 조회
        assets = FileAsset.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            page_id=page_id,
            is_deleted=False
        ).order_by("-created_at")

        # 응답 데이터 구성
        response_data = []
        for asset in assets:
            response_data.append({
                "asset_id": str(asset.id),
                "asset_url": asset.asset_url,
                "name": asset.attributes.get("name", ""),
                "size": asset.size,
                "created_at": asset.created_at,
                "created_by": {
                    "id": str(asset.created_by.id),
                    "display_name": asset.created_by.display_name,
                    "avatar": asset.created_by.avatar
                }
            })

        return Response(response_data, status=status.HTTP_200_OK)

def replace_domain_in_url(request, url):
    """URL의 도메인을 요청의 도메인으로 변경"""
    if not url:
        return url

    # 원본 URL 파싱
    parsed = urlparse(url)

    # 요청 URL에서 scheme과 netloc 가져오기
    request_url = request.build_absolute_uri('/')
    request_parsed = urlparse(request_url)

    # 새로운 URL 생성 (scheme과 netloc만 변경)
    new_url = urlunparse((
        request_parsed.scheme,
        request_parsed.netloc,
        parsed.path,
        parsed.params,
        parsed.query,
        parsed.fragment
    ))

    return new_url
class AssetCheckEndpoint(BaseAPIView):
    """Endpoint to check if an asset exists."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, asset_id):
        asset = FileAsset.all_objects.filter(
            id=asset_id, workspace__slug=slug, deleted_at__isnull=True
        ).exists()
        return Response({"exists": asset}, status=status.HTTP_200_OK)


class DuplicateAssetEndpoint(BaseAPIView):
    throttle_classes = [AssetRateThrottle]

    def get_entity_id_field(self, entity_type, entity_id):
        # Workspace Logo
        if entity_type == FileAsset.EntityTypeContext.WORKSPACE_LOGO:
            return {"workspace_id": entity_id}

        # Project Cover
        if entity_type == FileAsset.EntityTypeContext.PROJECT_COVER:
            return {"project_id": entity_id}

        # User Avatar and Cover
        if entity_type in [
            FileAsset.EntityTypeContext.USER_AVATAR,
            FileAsset.EntityTypeContext.USER_COVER,
        ]:
            return {"user_id": entity_id}

        # Issue Attachment and Description
        if entity_type in [
            FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            FileAsset.EntityTypeContext.ISSUE_DESCRIPTION,
        ]:
            return {"issue_id": entity_id}

        # Page Description
        if entity_type == FileAsset.EntityTypeContext.PAGE_DESCRIPTION:
            return {"page_id": entity_id}

        # Comment Description
        if entity_type == FileAsset.EntityTypeContext.COMMENT_DESCRIPTION:
            return {"comment_id": entity_id}

        return {}

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def post(self, request, slug, asset_id):
        project_id = request.data.get("project_id", None)
        entity_id = request.data.get("entity_id", None)
        entity_type = request.data.get("entity_type", None)

        if not entity_type or entity_type not in FileAsset.EntityTypeContext.values:
            return Response(
                {"error": "Invalid entity type or entity id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace = Workspace.objects.get(slug=slug)
        if project_id:
            # check if project exists in the workspace
            if not Project.objects.filter(id=project_id, workspace=workspace).exists():
                return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        storage = S3Storage(request=request)
        original_asset = FileAsset.objects.filter(id=asset_id, is_uploaded=True).first()

        if not original_asset:
            return Response({"error": "Asset not found"}, status=status.HTTP_404_NOT_FOUND)

        destination_key = f"{workspace.id}/{uuid.uuid4().hex}-{original_asset.attributes.get('name')}"
        duplicated_asset = FileAsset.objects.create(
            attributes={
                "name": original_asset.attributes.get("name"),
                "type": original_asset.attributes.get("type"),
                "size": original_asset.attributes.get("size"),
            },
            asset=destination_key,
            size=original_asset.size,
            workspace=workspace,
            created_by_id=request.user.id,
            entity_type=entity_type,
            project_id=project_id if project_id else None,
            storage_metadata=original_asset.storage_metadata,
            **self.get_entity_id_field(entity_type=entity_type, entity_id=entity_id),
        )
        storage.copy_object(original_asset.asset, destination_key)
        # Update the is_uploaded field for all newly created assets
        FileAsset.objects.filter(id=duplicated_asset.id).update(is_uploaded=True)

        return Response({"asset_id": str(duplicated_asset.id)}, status=status.HTTP_200_OK)


class WorkspaceAssetDownloadEndpoint(BaseAPIView):
    """Endpoint to generate a download link for an asset with content-disposition=attachment."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, asset_id):
        try:
            asset = FileAsset.objects.get(
                id=asset_id,
                workspace__slug=slug,
                is_uploaded=True,
            )
        except FileAsset.DoesNotExist:
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        storage = S3Storage(request=request)
        original_filename = asset.attributes.get("name", "download")
        signed_url = storage.generate_presigned_url(
            object_name=asset.asset.name,
            disposition="attachment",
            filename=asset.attributes.get("name", uuid.uuid4().hex),
        )

        return HttpResponseRedirect(signed_url)


class ProjectAssetDownloadEndpoint(BaseAPIView):
    """Endpoint to generate a download link for an asset with content-disposition=attachment."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], level="PROJECT")
    def get(self, request, slug, project_id, asset_id):
        try:
            asset = FileAsset.objects.get(
                id=asset_id,
                workspace__slug=slug,
                project_id=project_id,
                is_uploaded=True,
            )
        except FileAsset.DoesNotExist:
            return Response(
                {"error": "The requested asset could not be found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        storage = S3Storage(request=request)
        # 원본 파일명 가져오기 (attributes에서)
        original_filename = asset.attributes.get("name", "download")
        # print(f"[ProjectAssetDownloadEndpoint] Original filename: {original_filename}")
        signed_url = storage.generate_presigned_url(
            object_name=asset.asset.name,
            disposition="attachment",
            filename=asset.attributes.get("name", uuid.uuid4().hex),
        )
        # print(f"[ProjectAssetDownloadEndpoint] Generated signed URL: {signed_url}")
        # URL의 도메인을 요청 도메인으로 변경
        modified_presigned_data = modify_presigned_post_url(request, signed_url)
        # print(f"[ProjectAssetDownloadEndpoint] Modified URL: {modified_presigned_data}")

        return HttpResponseRedirect(modified_presigned_data)
