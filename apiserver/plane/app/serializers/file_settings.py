from rest_framework import serializers
from plane.license.models import FileUploadSettings, validate_extension

class FileSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileUploadSettings
        fields = ('id', 'allowed_extensions', 'max_file_size', 'created_at', 'updated_at', 'instance')
        read_only_fields = ('id', 'created_at', 'updated_at', 'instance')
        
    def validate_max_file_size(self, value):
        """파일 크기 제한 검증"""
        max_allowed = 5000 * 1024 * 1024  # 5000MB
        if value > max_allowed:
            raise serializers.ValidationError(f"Maximum allowed file size is {max_allowed} bytes")
        return value

    def validate_allowed_extensions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Allowed extensions must be a list")
        
        if len(value) > 50:  # 최대 50개 확장자로 제한
            raise serializers.ValidationError("Maximum 50 extensions allowed")
            
        for extension in value:
            if not validate_extension(extension):
                raise serializers.ValidationError(
                    f"Invalid extension format: {extension}. "
                    "Extensions must contain only letters and numbers, "
                    "and be 10 characters or less."
                )
        
        return value 