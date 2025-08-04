from django.db import migrations, models

def update_role_choices(apps, schema_editor):
    WorkspaceMember = apps.get_model("db", "WorkspaceMember")
    ProjectMember = apps.get_model("db", "ProjectMember")
    WorkspaceMemberInvite = apps.get_model("db", "WorkspaceMemberInvite")
    ProjectMemberInvite = apps.get_model("db", "ProjectMemberInvite")

class Migration(migrations.Migration):
    dependencies = [
        ("db", "0076_alter_projectmember_role_and_more"),  # 이전 마이그레이션 파일
    ]

    operations = [
        migrations.AlterField(
            model_name="projectmember",
            name="role",
            field=models.PositiveSmallIntegerField(
                choices=[(20, "Admin"), (15, "Member"), (10, "Viewer"), (8, "Restricted"), (5, "Guest")],
                default=5,
            ),
        ),
        migrations.AlterField(
            model_name="projectmemberinvite",
            name="role",
            field=models.PositiveSmallIntegerField(
                choices=[(20, "Admin"), (15, "Member"), (10, "Viewer"), (8, "Restricted"), (5, "Guest")],
                default=5,
            ),
        ),
        migrations.AlterField(
            model_name="workspacemember",
            name="role",
            field=models.PositiveSmallIntegerField(
                choices=[(20, "Admin"), (15, "Member"), (10, "Viewer"), (8, "Restricted"), (5, "Guest")],
                default=5,
            ),
        ),
        migrations.AlterField(
            model_name="workspacememberinvite",
            name="role",
            field=models.PositiveSmallIntegerField(
                choices=[(20, "Admin"), (15, "Member"), (10, "Viewer"), (8, "Restricted"), (5, "Guest")],
                default=5,
            ),
        ),
    ] 