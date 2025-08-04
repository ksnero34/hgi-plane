# Django imports
from rest_framework import serializers

# Module imports
from plane.db.models import IssueType, ProjectIssueType


class IssueTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueType
        fields = "__all__"
        read_only_fields = [
            "workspace",
        ]


class ProjectIssueTypeSerializer(serializers.ModelSerializer):
    issue_type = IssueTypeSerializer(read_only=True)

    class Meta:
        model = ProjectIssueType
        fields = "__all__"
        read_only_fields = [
            "project",
        ]
