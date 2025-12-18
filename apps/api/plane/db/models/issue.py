# Python import
from uuid import uuid4
from datetime import datetime
import re

# Django imports
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction, connection
from django.utils import timezone
from django.db.models import Q
from django import apps

# Module imports
from plane.utils.html_processor import strip_tags
from plane.db.mixins import SoftDeletionManager
from plane.utils.exception_logger import log_exception
from .project import ProjectBaseModel
from plane.utils.uuid import convert_uuid_to_integer
from .description import Description
from plane.db.mixins import ChangeTrackerMixin
from .state import StateGroup


def get_default_properties():
    return {
        "assignee": True,
        "start_date": True,
        "due_date": True,
        "labels": True,
        "key": True,
        "priority": True,
        "state": True,
        "sub_issue_count": True,
        "link": True,
        "attachment_count": True,
        "estimate": True,
        "created_on": True,
        "updated_on": True,
    }


def get_default_filters():
    return {
        "priority": None,
        "state": None,
        "state_group": None,
        "assignees": None,
        "created_by": None,
        "labels": None,
        "start_date": None,
        "target_date": None,
        "subscriber": None,
    }


def get_default_display_filters():
    return {
        "group_by": None,
        "order_by": "-created_at",
        "type": None,
        "sub_issue": True,
        "show_empty_groups": True,
        "layout": "list",
        "calendar_date_range": "",
    }


def get_default_display_properties():
    return {
        "assignee": True,
        "attachment_count": True,
        "created_on": True,
        "due_date": True,
        "estimate": True,
        "key": True,
        "labels": True,
        "link": True,
        "priority": True,
        "start_date": True,
        "state": True,
        "sub_issue_count": True,
        "updated_on": True,
        "custom_fields": True,
    }


# TODO: Handle identifiers for Bulk Inserts - nk
class IssueManager(SoftDeletionManager):
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                models.Q(issue_intake__status=1)
                | models.Q(issue_intake__status=-1)
                | models.Q(issue_intake__status=2)
                | models.Q(issue_intake__isnull=True)
            )
            .filter(deleted_at__isnull=True)
            .filter(state__is_triage=False)
            .exclude(state__group=StateGroup.TRIAGE.value)
            .exclude(archived_at__isnull=False)
            .exclude(project__archived_at__isnull=False)
            .exclude(is_draft=True)
        )


class Issue(ProjectBaseModel):
    PRIORITY_CHOICES = (
        ("urgent", "Urgent"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
        ("none", "None"),
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="parent_issue",
    )
    state = models.ForeignKey(
        "db.State",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="state_issue",
        db_index=True
    )
    point = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(12)], null=True, blank=True)
    estimate_point = models.ForeignKey(
        "db.EstimatePoint",
        on_delete=models.SET_NULL,
        related_name="issue_estimates",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255, verbose_name="Issue Name", db_index=True)
    description = models.JSONField(blank=True, default=dict)
    description_html = models.TextField(blank=True, default="<p></p>")
    description_stripped = models.TextField(blank=True, null=True)
    description_binary = models.BinaryField(null=True)
    priority = models.CharField(
        max_length=30,
        choices=PRIORITY_CHOICES,
        verbose_name="Issue Priority",
        default="none",
        db_index=True
    )
    start_date = models.DateField(null=True, blank=True, db_index=True)
    target_date = models.DateField(null=True, blank=True, db_index=True)
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="assignee",
        through="IssueAssignee",
        through_fields=("issue", "assignee"),
    )
    sequence_id = models.IntegerField(default=1, verbose_name="Issue Sequence ID", db_index=True)
    labels = models.ManyToManyField("db.Label", blank=True, related_name="labels", through="IssueLabel")
    sort_order = models.FloatField(default=65535, db_index=True)
    completed_at = models.DateTimeField(null=True, db_index=True)
    archived_at = models.DateField(null=True, db_index=True)
    is_draft = models.BooleanField(default=False, db_index=True)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    type = models.ForeignKey(
        "db.IssueType",
        on_delete=models.SET_NULL,
        related_name="issue_type",
        null=True,
        blank=True,
        db_index=True
    )
    workflow = models.ForeignKey(
        "db.WorkflowTemplate",
        on_delete=models.SET_NULL,
        related_name="workflow_issues",
        null=True,
        blank=True,
        db_index=True
    )

    issue_objects = IssueManager()

    class Meta:
        verbose_name = "Issue"
        verbose_name_plural = "Issues"
        db_table = "issues"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['project', 'state'], name='idx_issue_proj_state'),
            models.Index(fields=['project', 'created_at'], name='idx_issue_proj_created'),
            models.Index(fields=['project', 'priority'], name='idx_issue_proj_priority'),
            models.Index(fields=['project', 'is_draft'], name='idx_issue_proj_draft'),
            models.Index(fields=['project', 'completed_at'], name='idx_issue_proj_completed'),
            models.Index(fields=['project', 'archived_at'], name='idx_issue_proj_archived'),
            models.Index(fields=['project', 'sequence_id'], name='idx_issue_proj_sequence'),
            models.Index(fields=['project', 'sort_order'], name='idx_issue_proj_sort'),
            models.Index(fields=['parent', 'deleted_at'], name='idx_issue_parent_deleted'),
            models.Index(fields=['project', 'state', 'sort_order'], name='idx_issue_proj_state_sort'),
            models.Index(fields=['project', 'created_at'], name='idx_issue_proj_created_2'),
        ]

    def save(self, *args, **kwargs):
        if self.state is None:
            try:
                from plane.db.models import State

                default_state = State.objects.filter(
                    ~models.Q(is_triage=True), project=self.project, default=True
                ).first()
                if default_state is None:
                    random_state = State.objects.filter(~models.Q(is_triage=True), project=self.project).first()
                    self.state = random_state
                else:
                    self.state = default_state
            except ImportError:
                pass
        else:
            try:
                from plane.db.models import State

                if self.state.group == "completed":
                    self.completed_at = timezone.now()
                else:
                    self.completed_at = None
            except ImportError:
                pass

        if self._state.adding:
            with transaction.atomic():
                # Create a lock for this specific project using a transaction-level advisory lock
                # This ensures only one transaction per project can execute this code at a time
                # The lock is automatically released when the transaction ends
                lock_key = convert_uuid_to_integer(self.project.id)

                with connection.cursor() as cursor:
                    # Get an exclusive transaction-level lock using the project ID as the lock key
                    cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_key])

                # Get the last sequence for the project
                last_sequence = IssueSequence.objects.filter(project=self.project).aggregate(
                    largest=models.Max("sequence")
                )["largest"]
                self.sequence_id = last_sequence + 1 if last_sequence else 1
                # Strip the html tags using html parser
                self.description_stripped = (
                    None
                    if (self.description_html == "" or self.description_html is None)
                    else strip_tags(self.description_html)
                )
                largest_sort_order = Issue.objects.filter(project=self.project, state=self.state).aggregate(
                    largest=models.Max("sort_order")
                )["largest"]
                if largest_sort_order is not None:
                    self.sort_order = largest_sort_order + 10000

                super(Issue, self).save(*args, **kwargs)

                IssueSequence.objects.create(issue=self, sequence=self.sequence_id, project=self.project)
        else:
            # Strip the html tags using html parser
            self.description_stripped = (
                None
                if (self.description_html == "" or self.description_html is None)
                else strip_tags(self.description_html)
            )
            super(Issue, self).save(*args, **kwargs)

    def get_queryset(self):
        return (
            Issue.issue_objects.annotate(
                sub_issues_count=models.Count('parent_issue', filter=models.Q(deleted_at__isnull=True))
            )
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("project")
            .select_related("workspace")
            .select_related("state")
            .select_related("parent")
            .prefetch_related("assignees")
            .prefetch_related("labels")
            .order_by(self.kwargs.get("order_by", "-created_at"))
        ).distinct()

    def __str__(self):
        """Return name of the issue"""
        return f"{self.name} <{self.project.name}>"


class IssueBlocker(ProjectBaseModel):
    block = models.ForeignKey(Issue, related_name="blocker_issues", on_delete=models.CASCADE)
    blocked_by = models.ForeignKey(Issue, related_name="blocked_issues", on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Issue Blocker"
        verbose_name_plural = "Issue Blockers"
        db_table = "issue_blockers"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.block.name} {self.blocked_by.name}"


class IssueRelationChoices(models.TextChoices):
    DUPLICATE = "duplicate", "Duplicate"
    RELATES_TO = "relates_to", "Relates To"
    BLOCKED_BY = "blocked_by", "Blocked By"
    START_BEFORE = "start_before", "Start Before"
    FINISH_BEFORE = "finish_before", "Finish Before"
    IMPLEMENTED_BY = "implemented_by", "Implemented By"


# Bidirectional relation pairs: (forward, reverse)
# Defined after class to avoid enum metaclass conflicts
IssueRelationChoices._RELATION_PAIRS = (
    ("blocked_by", "blocking"),
    ("relates_to", "relates_to"),  # symmetric
    ("duplicate", "duplicate"),  # symmetric
    ("start_before", "start_after"),
    ("finish_before", "finish_after"),
    ("implemented_by", "implements"),
)

# Generate reverse mapping from pairs
IssueRelationChoices._REVERSE_MAPPING = {forward: reverse for forward, reverse in IssueRelationChoices._RELATION_PAIRS}


class IssueRelation(ProjectBaseModel):
    issue = models.ForeignKey(Issue, related_name="issue_relation", on_delete=models.CASCADE)
    related_issue = models.ForeignKey(Issue, related_name="issue_related", on_delete=models.CASCADE)
    relation_type = models.CharField(
        max_length=20,
        verbose_name="Issue Relation Type",
        default=IssueRelationChoices.BLOCKED_BY,
    )

    class Meta:
        unique_together = ["issue", "related_issue", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "related_issue"],
                condition=Q(deleted_at__isnull=True),
                name="issue_relation_unique_issue_related_issue_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Relation"
        verbose_name_plural = "Issue Relations"
        db_table = "issue_relations"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.related_issue.name}"


class IssueMention(ProjectBaseModel):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="issue_mention")
    mention = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="issue_mention")

    class Meta:
        unique_together = ["issue", "mention", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "mention"],
                condition=Q(deleted_at__isnull=True),
                name="issue_mention_unique_issue_mention_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Mention"
        verbose_name_plural = "Issue Mentions"
        db_table = "issue_mentions"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.mention.email}"


class IssueAssignee(ProjectBaseModel):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="issue_assignee")
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_assignee",
        db_index=True
    )

    class Meta:
        unique_together = ["issue", "assignee", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "assignee"],
                condition=Q(deleted_at__isnull=True),
                name="issue_assignee_unique_issue_assignee_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Assignee"
        verbose_name_plural = "Issue Assignees"
        db_table = "issue_assignees"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['issue', 'deleted_at']),
            models.Index(fields=['assignee', 'deleted_at']),
        ]

    def __str__(self):
        return f"{self.issue.name} {self.assignee.email}"


class IssueLink(ProjectBaseModel):
    title = models.CharField(max_length=255, null=True, blank=True)
    url = models.TextField()
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="issue_link")
    metadata = models.JSONField(default=dict)

    class Meta:
        verbose_name = "Issue Link"
        verbose_name_plural = "Issue Links"
        db_table = "issue_links"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['issue_id', 'deleted_at']),
        ]

    def __str__(self):
        return f"{self.issue.name} {self.url}"


def get_upload_path(instance, filename):
    return f"{instance.workspace.id}/{uuid4().hex}-{filename}"


def file_size(value):
    # File limit check is only for cloud hosted
    if value.size > settings.FILE_SIZE_LIMIT:
        raise ValidationError("File too large. Size should not exceed 5 MB.")


class IssueAttachment(ProjectBaseModel):
    attributes = models.JSONField(default=dict)
    asset = models.FileField(upload_to=get_upload_path, validators=[file_size])
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="issue_attachment")
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "Issue Attachment"
        verbose_name_plural = "Issue Attachments"
        db_table = "issue_attachments"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.asset}"


class IssueActivity(ProjectBaseModel):
    issue = models.ForeignKey(Issue, on_delete=models.DO_NOTHING, null=True, related_name="issue_activity")
    verb = models.CharField(max_length=255, verbose_name="Action", default="created")
    field = models.CharField(max_length=255, verbose_name="Field Name", blank=True, null=True)
    old_value = models.TextField(verbose_name="Old Value", blank=True, null=True)
    new_value = models.TextField(verbose_name="New Value", blank=True, null=True)

    comment = models.TextField(verbose_name="Comment", blank=True)
    attachments = ArrayField(models.URLField(), size=10, blank=True, default=list)
    issue_comment = models.ForeignKey(
        "db.IssueComment",
        on_delete=models.DO_NOTHING,
        related_name="issue_comment",
        null=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="issue_activities",
    )
    old_identifier = models.UUIDField(null=True)
    new_identifier = models.UUIDField(null=True)
    epoch = models.FloatField(null=True)

    class Meta:
        verbose_name = "Issue Activity"
        verbose_name_plural = "Issue Activities"
        db_table = "issue_activities"
        ordering = ("-created_at",)

    def __str__(self):
        """Return issue of the comment"""
        return str(self.issue)


class IssueComment(ChangeTrackerMixin, ProjectBaseModel):
    comment_stripped = models.TextField(verbose_name="Comment", blank=True)
    comment_json = models.JSONField(blank=True, default=dict)
    comment_html = models.TextField(blank=True, default="<p></p>")
    description = models.OneToOneField(
        "db.Description", on_delete=models.CASCADE, related_name="issue_comment_description", null=True
    )
    attachments = ArrayField(models.URLField(), size=10, blank=True, default=list)
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="issue_comments", db_index=True)
    # System can also create comment
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        db_index=True
    )
    access = models.CharField(
        choices=(("INTERNAL", "INTERNAL"), ("EXTERNAL", "EXTERNAL")),
        default="INTERNAL",
        max_length=100,
        db_index=True
    )
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    edited_at = models.DateTimeField(null=True, blank=True, db_index=True)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="parent_issue_comment"
    )

    TRACKED_FIELDS = ["comment_stripped", "comment_json", "comment_html"]

    def save(self, *args, **kwargs):
        """
        Custom save method for IssueComment that manages the associated Description model.

        This method handles creation and updates of both the comment and its description in a
        single atomic transaction to ensure data consistency.
        """

        self.comment_stripped = strip_tags(self.comment_html) if self.comment_html != "" else ""
        is_creating = self._state.adding

        # Prepare description defaults
        description_defaults = {
            "workspace_id": self.workspace_id,
            "project_id": self.project_id,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
            "description_stripped": self.comment_stripped,
            "description_json": self.comment_json,
            "description_html": self.comment_html,
        }

        with transaction.atomic():
            super(IssueComment, self).save(*args, **kwargs)

            if is_creating or not self.description_id:
                # Create new description for new comment
                description = Description.objects.create(**description_defaults)
                self.description_id = description.id
                super(IssueComment, self).save(update_fields=["description_id"])
            else:
                field_mapping = {
                    "comment_html": "description_html",
                    "comment_stripped": "description_stripped",
                    "comment_json": "description_json",
                }

                # Use _changes_on_save which is captured by ChangeTrackerMixin.save()
                # before the tracked fields are reset
                changed_fields = {
                    desc_field: getattr(self, comment_field)
                    for comment_field, desc_field in field_mapping.items()
                    if comment_field in self._changes_on_save
                }

                # Update description only if comment fields changed
                if changed_fields and self.description_id:
                    Description.objects.filter(pk=self.description_id).update(
                        **changed_fields, updated_by_id=self.updated_by_id, updated_at=self.updated_at
                    )

    class Meta:
        verbose_name = "Issue Comment"
        verbose_name_plural = "Issue Comments"
        db_table = "issue_comments"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['issue', 'created_at']),
            models.Index(fields=['actor', 'created_at']),
            models.Index(fields=['access', 'created_at']),
            models.Index(fields=['edited_at', 'created_at']),
        ]

    def __str__(self):
        """Return issue of the comment"""
        return str(self.issue)


class IssueUserProperty(ProjectBaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_property_user",
    )
    filters = models.JSONField(default=get_default_filters)
    display_filters = models.JSONField(default=get_default_display_filters)
    display_properties = models.JSONField(default=get_default_display_properties)
    rich_filters = models.JSONField(default=dict)

    class Meta:
        verbose_name = "Issue User Property"
        verbose_name_plural = "Issue User Properties"
        db_table = "issue_user_properties"
        ordering = ("-created_at",)
        unique_together = ["user", "project", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project"],
                condition=Q(deleted_at__isnull=True),
                name="issue_user_property_unique_user_project_when_deleted_at_null",
            )
        ]

    def __str__(self):
        """Return properties status of the issue"""
        return str(self.user)


class IssueLabel(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="label_issue", db_index=True)
    label = models.ForeignKey("db.Label", on_delete=models.CASCADE, related_name="label_issue", db_index=True)

    class Meta:
        verbose_name = "Issue Label"
        verbose_name_plural = "Issue Labels"
        db_table = "issue_labels"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['issue', 'deleted_at']),
            models.Index(fields=['label', 'deleted_at']),
        ]

    def __str__(self):
        return f"{self.issue.name} {self.label.name}"


class IssueSequence(ProjectBaseModel):
    issue = models.ForeignKey(
        Issue,
        on_delete=models.SET_NULL,
        related_name="issue_sequence",
        null=True,  # This is set to null because we want to keep the sequence even if the issue is deleted
    )
    sequence = models.PositiveBigIntegerField(default=1, db_index=True)
    deleted = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Issue Sequence"
        verbose_name_plural = "Issue Sequences"
        db_table = "issue_sequences"
        ordering = ("-created_at",)


class IssueSubscriber(ProjectBaseModel):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="issue_subscribers")
    subscriber = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_subscribers",
    )

    class Meta:
        unique_together = ["issue", "subscriber", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "subscriber"],
                condition=models.Q(deleted_at__isnull=True),
                name="issue_subscriber_unique_issue_subscriber_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Subscriber"
        verbose_name_plural = "Issue Subscribers"
        db_table = "issue_subscribers"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.subscriber.email}"


class IssueReaction(ProjectBaseModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_reactions",
    )
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="issue_reactions")
    reaction = models.TextField()

    class Meta:
        unique_together = ["issue", "actor", "reaction", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "actor", "reaction"],
                condition=models.Q(deleted_at__isnull=True),
                name="issue_reaction_unique_issue_actor_reaction_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Reaction"
        verbose_name_plural = "Issue Reactions"
        db_table = "issue_reactions"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.actor.email}"


class CommentReaction(ProjectBaseModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_reactions",
    )
    comment = models.ForeignKey(IssueComment, on_delete=models.CASCADE, related_name="comment_reactions")
    reaction = models.TextField()

    class Meta:
        unique_together = ["comment", "actor", "reaction", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "actor", "reaction"],
                condition=models.Q(deleted_at__isnull=True),
                name="comment_reaction_unique_comment_actor_reaction_when_deleted_at_null",
            )
        ]
        verbose_name = "Comment Reaction"
        verbose_name_plural = "Comment Reactions"
        db_table = "comment_reactions"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.actor.email}"


class IssueVote(ProjectBaseModel):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="votes")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="votes")
    vote = models.IntegerField(choices=((-1, "DOWNVOTE"), (1, "UPVOTE")), default=1)

    class Meta:
        unique_together = ["issue", "actor", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "actor"],
                condition=models.Q(deleted_at__isnull=True),
                name="issue_vote_unique_issue_actor_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Vote"
        verbose_name_plural = "Issue Votes"
        db_table = "issue_votes"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} {self.actor.email}"


class IssueVersion(ProjectBaseModel):
    PRIORITY_CHOICES = (
        ("urgent", "Urgent"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
        ("none", "None"),
    )

    parent = models.UUIDField(blank=True, null=True)
    state = models.UUIDField(blank=True, null=True)
    estimate_point = models.UUIDField(blank=True, null=True)
    name = models.CharField(max_length=255, verbose_name="Issue Name")
    priority = models.CharField(
        max_length=30,
        choices=PRIORITY_CHOICES,
        verbose_name="Issue Priority",
        default="none",
    )
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    assignees = ArrayField(models.UUIDField(), blank=True, default=list)
    sequence_id = models.IntegerField(default=1, verbose_name="Issue Sequence ID")
    labels = ArrayField(models.UUIDField(), blank=True, default=list)
    sort_order = models.FloatField(default=65535)
    completed_at = models.DateTimeField(null=True)
    archived_at = models.DateField(null=True)
    is_draft = models.BooleanField(default=False)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    type = models.UUIDField(blank=True, null=True)
    cycle = models.UUIDField(null=True, blank=True)
    modules = ArrayField(models.UUIDField(), blank=True, default=list)
    properties = models.JSONField(default=dict)  # issue properties
    meta = models.JSONField(default=dict)  # issue meta
    last_saved_at = models.DateTimeField(default=timezone.now)

    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="versions")
    activity = models.ForeignKey(
        "db.IssueActivity",
        on_delete=models.SET_NULL,
        null=True,
        related_name="versions",
    )
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_versions",
    )

    class Meta:
        verbose_name = "Issue Version"
        verbose_name_plural = "Issue Versions"
        db_table = "issue_versions"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} <{self.project.name}>"

    @classmethod
    def log_issue_version(cls, issue, user):
        try:
            """
            Log the issue version
            """

            Module = apps.get_model("db.Module")
            CycleIssue = apps.get_model("db.CycleIssue")
            IssueAssignee = apps.get_model("db.IssueAssignee")
            IssueLabel = apps.get_model("db.IssueLabel")

            cycle_issue = CycleIssue.objects.filter(issue=issue).first()

            cls.objects.create(
                issue=issue,
                parent=issue.parent_id,
                state=issue.state_id,
                estimate_point=issue.estimate_point_id,
                name=issue.name,
                priority=issue.priority,
                start_date=issue.start_date,
                target_date=issue.target_date,
                assignees=list(IssueAssignee.objects.filter(issue=issue).values_list("assignee_id", flat=True)),
                sequence_id=issue.sequence_id,
                labels=list(IssueLabel.objects.filter(issue=issue).values_list("label_id", flat=True)),
                sort_order=issue.sort_order,
                completed_at=issue.completed_at,
                archived_at=issue.archived_at,
                is_draft=issue.is_draft,
                external_source=issue.external_source,
                external_id=issue.external_id,
                type=issue.type_id,
                cycle=cycle_issue.cycle_id if cycle_issue else None,
                modules=list(Module.objects.filter(issue=issue).values_list("id", flat=True)),
                properties={},
                meta={},
                last_saved_at=timezone.now(),
                owned_by=user,
            )
            return True
        except Exception as e:
            log_exception(e)
            return False


class IssueDescriptionVersion(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="description_versions")
    description_binary = models.BinaryField(null=True)
    description_html = models.TextField(blank=True, default="<p></p>")
    description_stripped = models.TextField(blank=True, null=True)
    description_json = models.JSONField(default=dict, blank=True)
    last_saved_at = models.DateTimeField(default=timezone.now)
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_description_versions",
    )

    class Meta:
        verbose_name = "Issue Description Version"
        verbose_name_plural = "Issue Description Versions"
        db_table = "issue_description_versions"

    @classmethod
    def log_issue_description_version(cls, issue, user):
        try:
            """
            Log the issue description version
            """
            cls.objects.create(
                workspace_id=issue.workspace_id,
                project_id=issue.project_id,
                created_by_id=issue.created_by_id,
                updated_by_id=issue.updated_by_id,
                owned_by_id=user,
                last_saved_at=timezone.now(),
                issue_id=issue.id,
                description_binary=issue.description_binary,
                description_html=issue.description_html,
                description_stripped=issue.description_stripped,
                description_json=issue.description,
            )
            return True
        except Exception as e:
            log_exception(e)
            return False


class CustomField(ProjectBaseModel):
    """프로젝트의 커스텀 필드 정의"""
    issue_type = models.ForeignKey(
        "db.IssueType",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_fields",
        verbose_name="이슈 타입"
    )
    name = models.CharField(max_length=100, verbose_name="필드 이름")
    key = models.CharField(max_length=50, verbose_name="고유 식별자")
    description = models.TextField(blank=True, null=True, verbose_name="설명")
    field_type = models.CharField(
        max_length=20,
        choices=(
            ("text", "텍스트"),
            ("select", "선택"),
            ("multiselect", "다중선택"),
            ("date", "날짜"),
            ("project_member", "프로젝트 멤버"),
            ("project_members", "프로젝트 멤버(다중)"),
        ),
        verbose_name="필드 타입"
    )
    options = models.JSONField(default=list, blank=True, verbose_name="선택 옵션")  # select, multiselect 타입의 옵션
    is_required = models.BooleanField(default=False, verbose_name="필수 여부")
    default_value = models.JSONField(null=True, blank=True, verbose_name="기본값")
    settings = models.JSONField(default=dict, blank=True, verbose_name="추가 설정")  # validation rules 등
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "커스텀 필드"
        verbose_name_plural = "커스텀 필드들"
        db_table = "custom_fields"
        ordering = ("sort_order", "created_at",)
        unique_together = ["project", "key", "deleted_at"]
        indexes = [
            models.Index(fields=["project", "key"]),
            models.Index(fields=["workspace", "project", "key"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.key})"

    def clean(self):
        super().clean()
        
        # 필드 타입별 설정 검증
        if self.field_type in ["select", "multiselect"]:
            if not isinstance(self.options, list):
                raise ValidationError({"options": "options는 리스트 형식이어야 합니다."})
            
            if not self.options:
                raise ValidationError({"options": "선택 타입의 필드는 최소 하나의 옵션이 필요합니다."})
        
        elif self.field_type == "text":
            # 텍스트 타입은 추가 검증 필요 없음
            pass
        
        elif self.field_type == "date":
            # 날짜 타입은 추가 검증 필요 없음
            pass
        
        elif self.field_type in ["project_member", "project_members"]:
            # 프로젝트 멤버 타입은 추가 검증 필요 없음
            pass

class CustomFieldValue(ProjectBaseModel):
    """이슈의 커스텀 필드 값"""
    custom_field = models.ForeignKey(
        CustomField, 
        on_delete=models.SET_NULL,
        null=True,
        related_name="field_values",
        verbose_name="커스텀 필드"
    )
    issue = models.ForeignKey(
        Issue, 
        on_delete=models.CASCADE, 
        related_name="custom_field_values",
        verbose_name="이슈"
    )
    value = models.JSONField(verbose_name="필드 값")

    class Meta:
        verbose_name = "커스텀 필드 값"
        verbose_name_plural = "커스텀 필드 값들"
        db_table = "custom_field_values"
        ordering = ("custom_field__sort_order", "created_at",)
        unique_together = ["custom_field", "issue", "deleted_at"]
        indexes = [
            models.Index(fields=["issue", "deleted_at"]),
            models.Index(fields=["custom_field", "deleted_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["custom_field", "issue"],
                condition=Q(deleted_at__isnull=True),
                name="unique_active_custom_field_value",
            ),
        ]

    def __str__(self):
        return f"{self.custom_field.name}: {self.value} <{self.issue.name}>"

    def clean(self):
        # 필드 타입에 따른 값 검증
        field_type = self.custom_field.field_type
        value = self.value

        if self.custom_field.is_required and value is None:
            raise ValidationError("이 필드는 필수입니다.")

        if value is not None:
            if field_type == "text":
                # text 필드: 문자열 타입 검증
                if not isinstance(value, str):
                    raise ValidationError("텍스트 필드는 문자열이어야 합니다.")
            elif field_type == "date":
                try:
                    datetime.strptime(value, "%Y-%m-%d")
                except (TypeError, ValueError):
                    raise ValidationError("날짜 형식이 아닙니다.")
            elif field_type in ["select", "multiselect"]:
                options = self.custom_field.options
                if field_type == "select":
                    if value not in options:
                        raise ValidationError("유효하지 않은 선택값입니다.")
                else:  # multiselect
                    if not isinstance(value, list):
                        raise ValidationError("다중 선택은 리스트 형태여야 합니다.")
                    if not all(v in options for v in value):
                        raise ValidationError("유효하지 않은 선택값이 포함되어 있습니다.")
            elif field_type in ["project_member", "project_members"]:
                # 프로젝트 멤버 검증 로직
                from plane.db.models import ProjectMember
                
                if field_type == "project_member":
                    # 단일 멤버 검증
                    if not ProjectMember.objects.filter(
                        project_id=self.project_id,
                        member_id=value,
                        is_active=True
                    ).exists():
                        raise ValidationError("유효하지 않은 프로젝트 멤버입니다.")
                else:  # project_members
                    # 다중 멤버 검증
                    if not isinstance(value, list):
                        raise ValidationError("프로젝트 멤버(다중)는 리스트 형태여야 합니다.")
                    
                    valid_members = ProjectMember.objects.filter(
                        project_id=self.project_id,
                        member_id__in=value,
                        is_active=True
                    ).values_list("member_id", flat=True)
                    
                    if len(valid_members) != len(value):
                        raise ValidationError("유효하지 않은 프로젝트 멤버가 포함되어 있습니다.")
