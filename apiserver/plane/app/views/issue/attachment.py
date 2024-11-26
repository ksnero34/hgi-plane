# Python imports
import json
import magic  # 파일 타입 감지를 위한 라이브러리 추가

# Django imports
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings

# Third Party imports
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

# Module imports
from .. import BaseAPIView
from plane.app.serializers import IssueAttachmentSerializer
from plane.db.models import IssueAttachment
from plane.license.models import Instance
from plane.bgtasks.issue_activities_task import issue_activity
from plane.app.permissions import allow_permission, ROLE


class IssueAttachmentEndpoint(BaseAPIView):
    serializer_class = IssueAttachmentSerializer
    model = IssueAttachment
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
            'txt': ['text/plain'],
            'pdf': ['application/pdf'],
            'jpg': ['image/jpeg'],
            'jpeg': ['image/jpeg'],
            'png': ['image/png'],
            'gif': ['image/gif'],
            'doc': ['application/msword'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'zip': ['application/zip', 'application/x-zip-compressed'],
            # 필요한 확장자와 MIME 타입을 추가
        }

        allowed_mime_types = mime_extension_map.get(file_extension.lower(), [])
        return mime_type in allowed_mime_types

    def validate_file(self, file):
        # Instance 설정 가져오기
        instance = Instance.objects.first()
        if not instance:
            return False, "Instance settings not found"

        # FileUploadSettings 객체에서 직접 속성에 접근
        file_settings = instance.file_settings
        if not file_settings:
            return False, "File settings not found"

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
        if serializer.is_valid():
            serializer.save(project_id=project_id, issue_id=issue_id)
            issue_activity.delay(
                type="attachment.activity.created",
                requested_data=None,
                actor_id=str(self.request.user.id),
                issue_id=str(self.kwargs.get("issue_id", None)),
                project_id=str(self.kwargs.get("project_id", None)),
                current_instance=json.dumps(
                    serializer.data,
                    cls=DjangoJSONEncoder,
                ),
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=request.META.get("HTTP_ORIGIN"),
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], creator=True, model=IssueAttachment)
    def delete(self, request, slug, project_id, issue_id, pk):
        issue_attachment = IssueAttachment.objects.get(pk=pk)
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
        issue_attachments = IssueAttachment.objects.filter(
            issue_id=issue_id, workspace__slug=slug, project_id=project_id
        )
        serializer = IssueAttachmentSerializer(issue_attachments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
