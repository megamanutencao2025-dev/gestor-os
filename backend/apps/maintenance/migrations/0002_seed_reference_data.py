from django.db import migrations


def upsert_rows(model, rows):
    for description, defaults in rows:
        model.objects.update_or_create(
            description=description,
            defaults={**defaults, "active": True},
        )


def seed_reference_data(apps, schema_editor):
    maintenance_area = apps.get_model("maintenance", "MaintenanceArea")
    maintenance_type = apps.get_model("maintenance", "MaintenanceType")
    work_order_status = apps.get_model("maintenance", "WorkOrderStatus")
    priority = apps.get_model("maintenance", "Priority")

    upsert_rows(
        maintenance_area,
        [
            ("Mecânica", {}),
            ("Elétrica", {}),
            ("Automação", {}),
        ],
    )
    upsert_rows(
        maintenance_type,
        [
            ("Corretiva", {}),
            ("Preventiva", {}),
            ("Preditiva", {}),
        ],
    )
    upsert_rows(
        work_order_status,
        [
            ("Aberta", {"is_initial": True, "order": 10}),
            ("Em andamento", {"order": 20}),
            ("Aguardando peças", {"order": 30}),
            ("Concluída", {"is_final": True, "order": 40}),
        ],
    )
    upsert_rows(
        priority,
        [
            ("Baixa", {"color": "#10B981", "order": 10}),
            ("Média", {"color": "#F59E0B", "order": 20}),
            ("Alta", {"color": "#EF4444", "order": 30}),
            ("Crítica", {"color": "#7F1D1D", "order": 40}),
        ],
    )


def unseed_reference_data(apps, schema_editor):
    for model_name in [
        "MaintenanceArea",
        "MaintenanceType",
        "WorkOrderStatus",
        "Priority",
    ]:
        apps.get_model("maintenance", model_name).objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("maintenance", "0001_initial")]

    operations = [migrations.RunPython(seed_reference_data, unseed_reference_data)]
