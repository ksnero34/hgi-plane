from django.db import migrations, models
import django.db.models.deletion
import uuid

def get_default_extensions():
    return ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx"]

class Migration(migrations.Migration):
    dependencies = [
        ("db", "0077_add_new_user_role_migration"),
        ("license", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FileUploadSettings",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "instance",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="file_settings",
                        to="license.Instance",
                    ),
                ),
                (
                    "allowed_extensions",
                    models.JSONField(
                        default=get_default_extensions,
                        help_text="허용되는 파일 확장자 목록",
                    ),
                ),
                (
                    "max_file_size",
                    models.PositiveIntegerField(
                        default=5242880,  # 5MB in bytes
                        help_text="최대 파일 크기 (bytes)",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "파일 업로드 설정",
                "verbose_name_plural": "파일 업로드 설정",
                "db_table": "file_upload_settings",
            },
        ),
        # 기존 인스턴스에 대한 기본 설정 생성을 위한 데이터 마이그레이션
        migrations.RunPython(
            code=lambda apps, schema_editor: apps.get_model("db", "FileUploadSettings").objects.create(
                instance=apps.get_model("license", "Instance").objects.first(),
                allowed_extensions=["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx"],
                max_file_size=5242880,  # 5MB
            ) if apps.get_model("license", "Instance").objects.exists() else None,
            reverse_code=migrations.RunPython.noop,
        ),
    ] 