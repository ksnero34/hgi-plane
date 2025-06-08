from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('db', '0104_merge_20250607_2213'),
    ]

    operations = [
        migrations.AddField(
            model_name='page',
            name='is_folder',
            field=models.BooleanField(default=False),
        ),
    ]
