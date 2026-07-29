import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("maintenance", "0005_workorder_equipment_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="workorder",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendente"),
                    ("approved", "Aprovada"),
                    ("rejected", "Recusada"),
                ],
                db_index=True,
                default="approved",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="workorder",
            name="approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="workorder",
            name="approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_work_orders",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="workorder",
            name="rejection_reason",
            field=models.TextField(blank=True),
        ),
    ]
