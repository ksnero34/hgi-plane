# Python imports
import json
import base64
from datetime import datetime
from django.core.serializers.json import DjangoJSONEncoder

# Django imports
from django.db import connection
from django.db.models import Exists, OuterRef, Q, Value, UUIDField
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page
from django.http import StreamingHttpResponse
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models.functions import Coalesce

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import (
    PageLogSerializer,
    PageSerializer,
    SubPageSerializer,
    PageDetailSerializer,
    PageBinaryUpdateSerializer,
)
from plane.db.models import (
    Page,
    PageLog,
    UserFavorite,
    ProjectMember,
    ProjectPage,
    Project,
    UserRecentVisit,
)
from plane.utils.error_codes import ERROR_CODES
from ..base import BaseAPIView, BaseViewSet
from plane.bgtasks.page_transaction_task import page_transaction
from plane.bgtasks.page_version_task import page_version
from plane.bgtasks.recent_visited_task import recent_visited_task
from plane.bgtasks.copy_s3_object import copy_s3_objects_of_description_and_assets


def unarchive_archive_page_and_descendants(page_id, archived_at):
    # Your SQL query
    sql = """
    WITH RECURSIVE descendants AS (
        SELECT id FROM pages WHERE id = %s
        UNION ALL
        SELECT pages.id FROM pages, descendants WHERE pages.parent_id = descendants.id
    )
    UPDATE pages SET archived_at = %s WHERE id IN (SELECT id FROM descendants);
    """

    # Execute the SQL query
    with connection.cursor() as cursor:
        cursor.execute(sql, [page_id, archived_at])


class PageViewSet(BaseViewSet):
    serializer_class = PageSerializer
    model = Page
    search_fields = ["name"]

    def get_queryset(self):
        subquery = UserFavorite.objects.filter(
            user=self.request.user,
            entity_type="page",
            entity_identifier=OuterRef("pk"),
            workspace__slug=self.kwargs.get("slug"),
        )
        parent_id = self.request.GET.get("parent")
        queryset = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                projects__project_projectmember__member=self.request.user,
                projects__project_projectmember__is_active=True,
                projects__archived_at__isnull=True,
            )
        )
        if parent_id:
            queryset = queryset.filter(parent_id=parent_id)
        else:
            queryset = queryset.filter(parent__isnull=True)
        return self.filter_queryset(
            queryset
            .filter(Q(owned_by=self.request.user) | Q(access=0))
            .prefetch_related("projects")
            .select_related("workspace")
            .select_related("owned_by")
            .annotate(is_favorite=Exists(subquery))
            .order_by(self.request.GET.get("order_by", "-created_at"))
            .prefetch_related("labels")
            .order_by("-is_favorite", "-created_at")
            .annotate(
                project=Exists(
                    ProjectPage.objects.filter(
                        page_id=OuterRef("id"), project_id=self.kwargs.get("project_id")
                    )
                )
            )
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "page_labels__label_id",
                        distinct=True,
                        filter=~Q(page_labels__label_id__isnull=True),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                project_ids=Coalesce(
                    ArrayAgg(
                        "projects__id", distinct=True, filter=~Q(projects__id=True)
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .filter(project=True)
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER,ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def create(self, request, slug, project_id):
        # parent 검증 로직 추가
        parent = request.data.get("parent", None)
        if parent:
            try:
                _ = Page.objects.get(
                    pk=parent, workspace__slug=slug, projects__id=project_id
                )
            except Page.DoesNotExist:
                return Response(
                    {"error": "Parent page not found"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = PageSerializer(
            data=request.data,
            context={
                "project_id": project_id,
                "owned_by_id": request.user.id,
                "description": request.data.get("description", {}),
                "description_binary": request.data.get("description_binary", None),
                "description_html": request.data.get("description_html", "<p></p>"),
            },
        )

        if serializer.is_valid():
            serializer.save()
            # capture the page transaction
            page_transaction.delay(request.data, None, serializer.data["id"])
            
            # 생성된 페이지를 parent 필터 없이 직접 조회
            page = (
                Page.objects
                .filter(pk=serializer.data["id"], workspace__slug=slug)
                .filter(
                    projects__project_projectmember__member=request.user,
                    projects__project_projectmember__is_active=True,
                    projects__archived_at__isnull=True,
                )
                .filter(Q(owned_by=request.user) | Q(access=0))
                .prefetch_related("projects")
                .select_related("workspace")
                .select_related("owned_by")
                .annotate(
                    is_favorite=Exists(
                        UserFavorite.objects.filter(
                            user=request.user,
                            entity_type="page",
                            entity_identifier=serializer.data["id"],
                            workspace__slug=slug,
                        )
                    )
                )
                .prefetch_related("labels")
                .annotate(
                    project=Exists(
                        ProjectPage.objects.filter(
                            page_id=serializer.data["id"], project_id=project_id
                        )
                    )
                )
                .annotate(
                    label_ids=Coalesce(
                        ArrayAgg(
                            "page_labels__label_id",
                            distinct=True,
                            filter=~Q(page_labels__label_id__isnull=True),
                        ),
                        Value([], output_field=ArrayField(UUIDField())),
                    ),
                    project_ids=Coalesce(
                        ArrayAgg(
                            "projects__id", distinct=True, filter=~Q(projects__id=True)
                        ),
                        Value([], output_field=ArrayField(UUIDField())),
                    ),
                )
                .filter(project=True)
                .first()
            )
            
            if page:
                serializer = PageDetailSerializer(page)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(
                    {"error": "Failed to retrieve created page"}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER,ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def partial_update(self, request, slug, project_id, pk):
        try:
            page = Page.objects.get(
                pk=pk, workspace__slug=slug, projects__id=project_id
            )

            if page.is_locked:
                return Response(
                    {"error": "Page is locked"}, status=status.HTTP_400_BAD_REQUEST
                )

            parent = request.data.get("parent", None)
            if parent:
                _ = Page.objects.get(
                    pk=parent, workspace__slug=slug, projects__id=project_id
                )

            # Only update access if the page owner is the requesting  user
            if (
                page.access != request.data.get("access", page.access)
                and page.owned_by_id != request.user.id
            ):
                return Response(
                    {
                        "error": "Access cannot be updated since this page is owned by someone else"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = PageDetailSerializer(page, data=request.data, partial=True)
            page_description = page.description_html
            if serializer.is_valid():
                serializer.save()
                # capture the page transaction
                if request.data.get("description_html"):
                    page_transaction.delay(
                        new_value=request.data,
                        old_value=json.dumps(
                            {"description_html": page_description},
                            cls=DjangoJSONEncoder,
                        ),
                        page_id=pk,
                    )

                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Page.DoesNotExist:
            return Response(
                {
                    "error": "Access cannot be updated since this page is owned by someone else"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @allow_permission(
        [
            ROLE.ADMIN,
            ROLE.MEMBER,
            ROLE.VIEWER, 
            ROLE.RESTRICTED,
            ROLE.GUEST,
        ]
    )
    def retrieve(self, request, slug, project_id, pk=None):
        # retrieve에서는 parent 필터를 적용하지 않고 직접 페이지를 조회
        subquery = UserFavorite.objects.filter(
            user=request.user,
            entity_type="page",
            entity_identifier=pk,
            workspace__slug=slug,
        )
        
        page = (
            Page.objects
            .filter(pk=pk, workspace__slug=slug)
            .filter(
                projects__project_projectmember__member=request.user,
                projects__project_projectmember__is_active=True,
                projects__archived_at__isnull=True,
            )
            .filter(Q(owned_by=request.user) | Q(access=0))
            .prefetch_related("projects")
            .select_related("workspace")
            .select_related("owned_by")
            .annotate(is_favorite=Exists(subquery))
            .prefetch_related("labels")
            .annotate(
                project=Exists(
                    ProjectPage.objects.filter(
                        page_id=pk, project_id=project_id
                    )
                )
            )
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "page_labels__label_id",
                        distinct=True,
                        filter=~Q(page_labels__label_id__isnull=True),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                project_ids=Coalesce(
                    ArrayAgg(
                        "projects__id", distinct=True, filter=~Q(projects__id=True)
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .filter(project=True)
            .first()
        )
        
        project = Project.objects.get(pk=project_id)

        """
        if the role is guest and guest_view_all_features is false and owned by is not
        the requesting user then dont show the page
        """

        if (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                member=request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
            and not page.owned_by == request.user
        ):
            return Response(
                {"error": "You are not allowed to view this page"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if page is None:
            return Response(
                {"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND
            )
        else:
            issue_ids = PageLog.objects.filter(
                page_id=pk, entity_name="issue"
            ).values_list("entity_identifier", flat=True)
            data = PageDetailSerializer(page).data
            data["issue_ids"] = issue_ids
            recent_visited_task.delay(
                slug=slug,
                entity_name="page",
                entity_identifier=pk,
                user_id=request.user.id,
                project_id=project_id,
            )
            return Response(data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def lock(self, request, slug, project_id, pk):
        page = Page.objects.filter(
            pk=pk, workspace__slug=slug, projects__id=project_id
        ).first()

        page.is_locked = True
        page.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER,ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST], model=Page, creator=True)
    def unlock(self, request, slug, project_id, pk):
        page = Page.objects.filter(
            pk=pk, workspace__slug=slug, projects__id=project_id
        ).first()

        page.is_locked = False
        page.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST], model=Page, creator=True)
    def access(self, request, slug, project_id, pk):
        access = request.data.get("access", 0)
        page = Page.objects.filter(
            pk=pk, workspace__slug=slug, projects__id=project_id
        ).first()

        # Only update access if the page owner is the requesting user
        if (
            page.access != request.data.get("access", page.access)
            and page.owned_by_id != request.user.id
        ):
            return Response(
                {
                    "error": "Access cannot be updated since this page is owned by someone else"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        page.access = access
        page.save()
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
    def list(self, request, slug, project_id):
        queryset = self.get_queryset()
        project = Project.objects.get(pk=project_id)
        if (
            ProjectMember.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                member=request.user,
                role=5,
                is_active=True,
            ).exists()
            and not project.guest_view_all_features
        ):
            queryset = queryset.filter(owned_by=request.user)
        pages = PageSerializer(queryset, many=True).data
        return Response(pages, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST], model=Page, creator=True)
    def archive(self, request, slug, project_id, pk):
        page = Page.objects.get(pk=pk, workspace__slug=slug, projects__id=project_id)

        # only the owner or admin can archive the page
        if (
            ProjectMember.objects.filter(
                project_id=project_id, member=request.user, is_active=True, role__lte=15
            ).exists()
            and request.user.id != page.owned_by_id
        ):
            return Response(
                {"error": "Only the owner or admin can archive the page"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        UserFavorite.objects.filter(
            entity_type="page",
            entity_identifier=pk,
            project_id=project_id,
            workspace__slug=slug,
        ).delete()

        unarchive_archive_page_and_descendants(pk, datetime.now())

        return Response({"archived_at": str(datetime.now())}, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST], model=Page, creator=True)
    def unarchive(self, request, slug, project_id, pk):
        page = Page.objects.get(pk=pk, workspace__slug=slug, projects__id=project_id)

        # only the owner or admin can un archive the page
        if (
            ProjectMember.objects.filter(
                project_id=project_id, member=request.user, is_active=True, role__lte=15
            ).exists()
            and request.user.id != page.owned_by_id
        ):
            return Response(
                {"error": "Only the owner or admin can un archive the page"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # if parent page is archived then the page will be un archived breaking the hierarchy
        if page.parent_id and page.parent.archived_at:
            page.parent = None
            page.save(update_fields=["parent"])

        unarchive_archive_page_and_descendants(pk, None)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN], model=Page, creator=True)
    def destroy(self, request, slug, project_id, pk):
        page = Page.objects.get(pk=pk, workspace__slug=slug, projects__id=project_id)

        if page.archived_at is None:
            return Response(
                {"error": "The page should be archived before deleting"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if page.owned_by_id != request.user.id and (
            not ProjectMember.objects.filter(
                workspace__slug=slug,
                member=request.user,
                role=20,
                project_id=project_id,
                is_active=True,
            ).exists()
        ):
            return Response(
                {"error": "Only admin or owner can delete the page"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # remove parent from all the children
        _ = Page.objects.filter(
            parent_id=pk, projects__id=project_id, workspace__slug=slug
        ).update(parent=None)

        page.delete()
        # Delete the user favorite page
        UserFavorite.objects.filter(
            project=project_id,
            workspace__slug=slug,
            entity_identifier=pk,
            entity_type="page",
        ).delete()
        # Delete the page from recent visit
        UserRecentVisit.objects.filter(
            project_id=project_id,
            workspace__slug=slug,
            entity_identifier=pk,
            entity_name="page",
        ).delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageFavoriteViewSet(BaseViewSet):
    model = UserFavorite

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id, pk):
        _ = UserFavorite.objects.create(
            project_id=project_id,
            entity_identifier=pk,
            entity_type="page",
            user=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, pk):
        page_favorite = UserFavorite.objects.get(
            project=project_id,
            user=request.user,
            workspace__slug=slug,
            entity_identifier=pk,
            entity_type="page",
        )
        page_favorite.delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageLogEndpoint(BaseAPIView):
    serializer_class = PageLogSerializer
    model = PageLog

    def post(self, request, slug, project_id, page_id):
        serializer = PageLogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, page_id=page_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, slug, project_id, page_id, transaction):
        page_transaction = PageLog.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            page_id=page_id,
            transaction=transaction,
        )
        serializer = PageLogSerializer(
            page_transaction, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, page_id, transaction):
        transaction = PageLog.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            page_id=page_id,
            transaction=transaction,
        )
        # Delete the transaction object
        transaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubPagesEndpoint(BaseAPIView):
    @method_decorator(gzip_page)
    def get(self, request, slug, project_id, page_id):
        pages = (
            PageLog.objects.filter(
                page_id=page_id,
                workspace__slug=slug,
                entity_name__in=["forward_link", "back_link"],
            )
            .select_related("project")
            .select_related("workspace")
        )
        return Response(
            SubPageSerializer(pages, many=True).data, status=status.HTTP_200_OK
        )


class PagesDescriptionViewSet(BaseViewSet):

    @allow_permission(
        [
            ROLE.ADMIN,
            ROLE.MEMBER,
            ROLE.VIEWER,
            ROLE.RESTRICTED,
            ROLE.GUEST,
        ]
    )
    def retrieve(self, request, slug, project_id, pk):
        page = (
            Page.objects.filter(pk=pk, workspace__slug=slug, projects__id=project_id)
            .filter(Q(owned_by=self.request.user) | Q(access=0))
            .first()
        )
        if page is None:
            return Response({"error": "Page not found"}, status=404)
        binary_data = page.description_binary

        def stream_data():
            if binary_data:
                yield binary_data
            else:
                yield b""

        response = StreamingHttpResponse(
            stream_data(), content_type="application/octet-stream"
        )
        response["Content-Disposition"] = 'attachment; filename="page_description.bin"'
        return response

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED,ROLE.GUEST])
    def partial_update(self, request, slug, project_id, pk):
        page = (
            Page.objects.filter(pk=pk, workspace__slug=slug, projects__id=project_id)
            .filter(Q(owned_by=self.request.user) | Q(access=0))
            .first()
        )

        if page is None:
            return Response({"error": "Page not found"}, status=404)

        if page.is_locked:
            return Response(
                {
                    "error_code": ERROR_CODES["PAGE_LOCKED"],
                    "error_message": "PAGE_LOCKED",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if page.archived_at:
            return Response(
                {
                    "error_code": ERROR_CODES["PAGE_ARCHIVED"],
                    "error_message": "PAGE_ARCHIVED",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Serialize the existing instance
        existing_instance = json.dumps(
            {"description_html": page.description_html}, cls=DjangoJSONEncoder
        )

        # Use serializer for validation and update
        serializer = PageBinaryUpdateSerializer(page, data=request.data, partial=True)
        if serializer.is_valid():
            # Capture the page transaction
            if request.data.get("description_html"):
                page_transaction.delay(
                    new_value=request.data, old_value=existing_instance, page_id=pk
                )

            # Update the page using serializer
            updated_page = serializer.save()

            # Run background tasks
            page_version.delay(
                page_id=updated_page.id,
                existing_instance=existing_instance,
                user_id=request.user.id,
            )
            return Response({"message": "Updated successfully"})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PageDuplicateEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.VIEWER, ROLE.RESTRICTED, ROLE.GUEST])
    def post(self, request, slug, project_id, page_id):
        page = Page.objects.filter(
            pk=page_id, workspace__slug=slug, projects__id=project_id
        ).first()

        # check for permission
        if page.access == Page.PRIVATE_ACCESS and page.owned_by_id != request.user.id:
            return Response(
                {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
            )

        # get all the project ids where page is present
        project_ids = ProjectPage.objects.filter(page_id=page_id).values_list(
            "project_id", flat=True
        )

        page.pk = None
        page.name = f"{page.name} (Copy)"
        page.description_binary = None
        page.owned_by = request.user
        page.created_by = request.user
        page.updated_by = request.user
        page.save()

        for project_id in project_ids:
            ProjectPage.objects.create(
                workspace_id=page.workspace_id,
                project_id=project_id,
                page_id=page.id,
                created_by_id=page.created_by_id,
                updated_by_id=page.updated_by_id,
            )

        page_transaction.delay(
            {"description_html": page.description_html}, None, page.id
        )

        # Copy the s3 objects uploaded in the page
        copy_s3_objects_of_description_and_assets.delay(
            entity_name="PAGE",
            entity_identifier=page.id,
            project_id=project_id,
            slug=slug,
            user_id=request.user.id,
        )

        page = (
            Page.objects.filter(pk=page.id)
            .annotate(
                project_ids=Coalesce(
                    ArrayAgg(
                        "projects__id", distinct=True, filter=~Q(projects__id=True)
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                )
            )
            .first()
        )
        serializer = PageDetailSerializer(page)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
