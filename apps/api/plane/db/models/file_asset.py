class FileAsset(ProjectBaseModel):
    attributes = models.JSONField(default=dict)
    asset = models.FileField(upload_to=get_upload_path, validators=[file_size])
    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="issue_attachment"
    )
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "Issue Attachment"
        verbose_name_plural = "Issue Attachments"
        db_table = "issue_attachments"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=['issue_id', 'entity_type', 'deleted_at']),
        ]

    def __str__(self):
        return f"{self.issue.name} {self.asset}" 