# Python imports
import json
import magic  # 파일 타입 감지를 위한 라이브러리 추가
import uuid

# Django imports
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings
from django.http import HttpResponseRedirect

# Third Party imports
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

# Module imports
from .. import BaseAPIView
from plane.app.serializers import IssueAttachmentSerializer
from plane.db.models import IssueAttachment
from plane.license.models import Instance
from plane.db.models import FileAsset, Workspace
from plane.bgtasks.issue_activities_task import issue_activity
from plane.app.permissions import allow_permission, ROLE
from plane.settings.storage import S3Storage
from plane.bgtasks.storage_metadata_task import get_asset_object_metadata


class IssueAttachmentEndpoint(BaseAPIView):
    serializer_class = IssueAttachmentSerializer
    model = FileAsset
    parser_classes = (MultiPartParser, FormParser)

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
            'txt': ['text/plain'],
            'css': ['text/css'],
            'js': ['text/javascript'],
            'json': ['application/json'],
            'xml': ['text/xml', 'application/xml'],
            'csv': ['text/csv'],
            'rtf': ['application/rtf'],
            
            # 이미지
            'jpg': ['image/jpeg'],
            'jpeg': ['image/jpeg'],
            'png': ['image/png'],
            'gif': ['image/gif'],
            'svg': ['image/svg+xml'],
            'webp': ['image/webp'],
            'tiff': ['image/tiff'],
            'bmp': ['image/bmp'],
            
            # 문서
            'pdf': ['application/pdf'],
            'doc': ['application/msword'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'xls': ['application/vnd.ms-excel'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'ppt': ['application/vnd.ms-powerpoint'],
            'pptx': [
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/vnd.ms-powerpoint.presentation.macroenabled.12'
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
            'zip': ['application/zip', 'application/x-zip-compressed'],
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
            # 파일 크기 검증
            if file.size > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file.name.split('.')[-1].lower()
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증
            mime_type = self.get_mime_type(file)
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 내용이 확장자와 일치하지 않습니다. 감지된 형식: {mime_type}"

        elif file_info:  # 파일 정보만 있는 경우
            # 파일 크기 검증
            if file_info.get('size', 0) > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file_info.get('name', '').split('.')[-1].lower()
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증 (file_info에서 제공된 type 사용)
            mime_type = file_info.get('type', '')
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 형식이 허용되지 않습니다. 감지된 형식: {mime_type}"

        return True, None

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def post(self, request, slug, project_id, issue_id):
        # 파일 검증
        file = request.FILES.get('asset')
        if file:
            is_valid, error_message = self.validate_file(file)
            if not is_valid:
                return Response(
                    {"error": error_message},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = IssueAttachmentSerializer(data=request.data)
        workspace = Workspace.objects.get(slug=slug)
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                issue_id=issue_id,
                workspace_id=workspace.id,
                entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            )
            issue_activity.delay(
                type="attachment.activity.created",
                requested_data=None,
                actor_id=str(self.request.user.id),
                issue_id=str(self.kwargs.get("issue_id", None)),
                project_id=str(self.kwargs.get("project_id", None)),
                current_instance=json.dumps(serializer.data, cls=DjangoJSONEncoder),
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=request.META.get("HTTP_ORIGIN"),
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=FileAsset)
    def delete(self, request, slug, project_id, issue_id, pk):
        issue_attachment = FileAsset.objects.get(pk=pk)
        issue_attachment.asset.delete(save=False)
        issue_attachment.delete()
        issue_activity.delay(
            type="attachment.activity.deleted",
            requested_data=None,
            actor_id=str(self.request.user.id),
            issue_id=str(self.kwargs.get("issue_id", None)),
            project_id=str(self.kwargs.get("project_id", None)),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=request.META.get("HTTP_ORIGIN"),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission(
        [
            ROLE.ADMIN,
            ROLE.MEMBER,
            ROLE.VIEWER, 
            ROLE.RESTRICTED,
            ROLE.GUEST,
        ]
    )
    def get(self, request, slug, project_id, issue_id):
        issue_attachments = FileAsset.objects.filter(
            issue_id=issue_id, workspace__slug=slug, project_id=project_id
        )
        serializer = IssueAttachmentSerializer(issue_attachments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class IssueAttachmentV2Endpoint(BaseAPIView):
    serializer_class = IssueAttachmentSerializer
    model = FileAsset

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
            'txt': ['text/plain'],
            'css': ['text/css'],
            'js': ['text/javascript'],
            'json': ['application/json'],
            'xml': ['text/xml', 'application/xml'],
            'csv': ['text/csv'],
            'rtf': ['application/rtf'],
            
            # 이미지
            'jpg': ['image/jpeg'],
            'jpeg': ['image/jpeg'],
            'png': ['image/png'],
            'gif': ['image/gif'],
            'svg': ['image/svg+xml'],
            'webp': ['image/webp'],
            'tiff': ['image/tiff'],
            'bmp': ['image/bmp'],
            
            # 문서
            'pdf': ['application/pdf'],
            'doc': ['application/msword'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'xls': ['application/vnd.ms-excel'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'ppt': ['application/vnd.ms-powerpoint'],
            'pptx': [
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/vnd.ms-powerpoint.presentation.macroenabled.12'
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
            'zip': ['application/zip', 'application/x-zip-compressed'],
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
            # 파일 크기 검증
            if file.size > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file.name.split('.')[-1].lower()
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증
            mime_type = self.get_mime_type(file)
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 내용이 확장자와 일치하지 않습니다. 감지된 형식: {mime_type}"

        elif file_info:  # 파일 정보만 있는 경우
            # 파일 크기 검증
            if file_info.get('size', 0) > file_settings.max_file_size:
                return False, f"파일의 용량이 허용치인 {file_settings.max_file_size / (1024*1024)}MB를 초과했습니다."

            # 파일 확장자 검증
            file_extension = file_info.get('name', '').split('.')[-1].lower()
            if file_extension not in file_settings.allowed_extensions:
                return False, f"허용되지 않는 파일 형식입니다. 허용된 형식: {', '.join(file_settings.allowed_extensions)}"

            # MIME 타입 검증 (file_info에서 제공된 type 사용)
            mime_type = file_info.get('type', '')
            if not self.is_valid_mime_type(file_extension, mime_type):
                return False, f"파일 형식이 허용되지 않습니다. 감지된 형식: {mime_type}"

        return True, None

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def post(self, request, slug, project_id, issue_id):
        name = request.data.get("name")
        type = request.data.get("type", False)
        size = int(request.data.get("size", settings.FILE_SIZE_LIMIT))
        
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

        # Get the size limit
        size_limit = min(size, settings.FILE_SIZE_LIMIT)

        # Create a File Asset
        asset = FileAsset.objects.create(
            attributes={"name": name, "type": type, "size": size_limit},
            asset=asset_key,
            size=size_limit,
            workspace_id=workspace.id,
            created_by=request.user,
            issue_id=issue_id,
            project_id=project_id,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
        )

        # Get the presigned URL
        storage = S3Storage(request=request)
        # Generate a presigned URL to share an S3 object
        presigned_url = storage.generate_presigned_post(
            object_name=asset_key, file_type=type, file_size=size_limit
        )
        # Return the presigned URL
        return Response(
            {
                "upload_data": presigned_url,
                "asset_id": str(asset.id),
                "attachment": IssueAttachmentSerializer(asset).data,
                "asset_url": asset.asset_url,
            },
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN], creator=True, model=FileAsset)
    def delete(self, request, slug, project_id, issue_id, pk):
        issue_attachment = FileAsset.objects.get(
            pk=pk, workspace__slug=slug, project_id=project_id
        )
        issue_attachment.is_deleted = True
        issue_attachment.deleted_at = timezone.now()
        issue_attachment.save()

        issue_activity.delay(
            type="attachment.activity.deleted",
            requested_data=None,
            actor_id=str(self.request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=request.META.get("HTTP_ORIGIN"),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id, pk=None):
        if pk:
            # Get the asset
            asset = FileAsset.objects.get(
                id=pk, workspace__slug=slug, project_id=project_id
            )

            # Check if the asset is uploaded
            if not asset.is_uploaded:
                return Response(
                    {"error": "The asset is not uploaded.", "status": False},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            storage = S3Storage(request=request)
            presigned_url = storage.generate_presigned_url(
                object_name=asset.asset.name,
                disposition="attachment",
                filename=asset.attributes.get("name"),
            )
            return HttpResponseRedirect(presigned_url)

        # Get all the attachments
        issue_attachments = FileAsset.objects.filter(
            issue_id=issue_id,
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            workspace__slug=slug,
            project_id=project_id,
            is_uploaded=True,
        )
        # Serialize the attachments
        serializer = IssueAttachmentSerializer(issue_attachments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def patch(self, request, slug, project_id, issue_id, pk):
        try:
            issue_attachment = FileAsset.objects.get(
                pk=pk, workspace__slug=slug, project_id=project_id
            )
            
            try:
                # S3/MinIO에서 파일 가져오기
                storage = S3Storage(request=request)
                file_content = storage.get_object(issue_attachment.asset)
                
                if not file_content:
                    return Response(
                        {"error": "파일을 읽을 수 없습니다."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # 파일의 실제 MIME 타입 확인
                try:
                    mime = magic.Magic(mime=True)
                    # 전체 내용을 읽어서 바이트로 저장
                    content_bytes = file_content.read()
                    if not content_bytes:
                        return Response(
                            {"error": "파일 내용을 읽을 수 없습니다."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                        
                    actual_mime_type = mime.from_buffer(content_bytes)
                    
                    # 파일 확장자 가져오기
                    file_name = issue_attachment.attributes.get("name", "")
                    file_extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
                    
                    # MIME 타입 검증
                    if not self.is_valid_mime_type(file_extension, actual_mime_type):
                        # 파일 삭제
                        storage.delete_object(issue_attachment.asset)
                        issue_attachment.delete()
                        
                        return Response(
                            {
                                "error": f"파일 형식이 올바르지 않습니다. 파일 확장자: {file_extension}, "
                                        f"감지된 MIME 타입: {actual_mime_type}"
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"File validation error: {str(e)}")
                    logger.error(f"File info - name: {file_name}, asset: {issue_attachment.asset}")
                    return Response(
                        {"error": "파일 내용을 처리하는 중 오류가 발생했습니다."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            except Exception as storage_error:
                # 에러 로깅
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"File validation error: {str(storage_error)}")
                logger.error(f"File info - name: {issue_attachment.attributes.get('name')}, "
                            f"asset: {issue_attachment.asset}")
                
                return Response(
                    {
                        "error": f"파일 형식 검증에 실패했습니다: {str(storage_error)}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 파일이 정상적으로 검증되면 업로드 완료 처리
            serializer = IssueAttachmentSerializer(issue_attachment)

            if not issue_attachment.is_uploaded:
                issue_activity.delay(
                    type="attachment.activity.created",
                    requested_data=None,
                    actor_id=str(request.user.id),
                    issue_id=str(issue_id),
                    project_id=str(project_id),
                    current_instance=json.dumps(serializer.data, cls=DjangoJSONEncoder),
                    epoch=int(timezone.now().timestamp()),
                    notification=True,
                    origin=request.META.get("HTTP_ORIGIN"),
                )

                # 업로드 상태 업데이트
                issue_attachment.is_uploaded = True
                issue_attachment.created_by = request.user

            # 스토리지 메타데이터 업데이트
            if not issue_attachment.storage_metadata:
                get_asset_object_metadata.delay(str(issue_attachment.id))
                
            issue_attachment.save()
            return Response(status=status.HTTP_204_NO_CONTENT)

        except FileAsset.DoesNotExist:
            return Response(
                {"error": "파일을 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected error: {str(e)}")
            return Response(
                {"error": "파일 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
