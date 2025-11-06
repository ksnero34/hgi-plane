from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0116_merge_20251105_1650"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="overview",
            field=models.TextField(blank=True, null=True, verbose_name="Project Overview"),
        ),
        migrations.AddField(
            model_name="project",
            name="overview_html",
            field=models.JSONField(blank=True, null=True, verbose_name="Project Overview HTML"),
        ),
        migrations.AddField(
            model_name="project",
            name="overview_text",
            field=models.JSONField(blank=True, null=True, verbose_name="Project Overview RT"),
        ),
    ]
