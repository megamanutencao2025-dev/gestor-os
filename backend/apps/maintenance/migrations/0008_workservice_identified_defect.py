from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0007_backfill_pending_solicitations"),
    ]

    operations = [
        migrations.AddField(
            model_name="workservice",
            name="identified_defect",
            field=models.TextField(blank=True),
        ),
    ]
