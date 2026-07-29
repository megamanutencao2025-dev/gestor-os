from django.db import migrations


def mark_unread_requests_as_pending(apps, schema_editor):
    Notification = apps.get_model("maintenance", "Notification")
    WorkOrder = apps.get_model("maintenance", "WorkOrder")
    work_order_ids = Notification.objects.filter(
        notification_type="nova_solicitacao",
        is_read=False,
    ).values_list("work_order_id", flat=True)
    WorkOrder.objects.filter(
        pk__in=work_order_ids,
        approval_status="approved",
        approved_by__isnull=True,
    ).update(
        approval_status="pending",
        rejection_reason="",
        approved_at=None,
    )


def restore_automatic_approval(apps, schema_editor):
    Notification = apps.get_model("maintenance", "Notification")
    WorkOrder = apps.get_model("maintenance", "WorkOrder")
    work_order_ids = Notification.objects.filter(
        notification_type="nova_solicitacao",
        is_read=False,
    ).values_list("work_order_id", flat=True)
    WorkOrder.objects.filter(
        pk__in=work_order_ids,
        approval_status="pending",
        approved_by__isnull=True,
    ).update(approval_status="approved")


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0006_workorder_approval"),
    ]

    operations = [
        migrations.RunPython(
            mark_unread_requests_as_pending,
            restore_automatic_approval,
        ),
    ]
