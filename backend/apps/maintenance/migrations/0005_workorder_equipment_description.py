from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0004_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="workorder",
            name="equipment_description",
            field=models.TextField(
                blank=True,
                help_text="Descricao livre quando a maquina ainda nao esta cadastrada.",
            ),
        ),
    ]
