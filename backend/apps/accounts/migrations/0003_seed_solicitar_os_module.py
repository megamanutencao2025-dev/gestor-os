from django.db import migrations


def seed_solicitar_os_module(apps, schema_editor):
    system_module = apps.get_model("accounts", "SystemModule")
    system_module.objects.update_or_create(
        key="solicitar_os",
        defaults={
            "name": "Solicitar OS",
            "path": "/solicitar-os",
            "description": "Permite abrir solicitações de ordem de serviço.",
            "order": 15,
            "active": True,
        },
    )


def remove_solicitar_os_module(apps, schema_editor):
    system_module = apps.get_model("accounts", "SystemModule")
    system_module.objects.filter(key="solicitar_os").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_seed_system_modules"),
    ]

    operations = [
        migrations.RunPython(seed_solicitar_os_module, remove_solicitar_os_module),
    ]
