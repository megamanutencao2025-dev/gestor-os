from django.db import migrations


MODULES = [
    ("dashboard", "Dashboard", "/Dashboard", 10),
    ("ordens_servico", "Ordens de Serviço", "/OrdemServico", 20),
    ("nova_os", "Nova OS", "/NovaOS", 30),
    (
        "planejamento_manutencao",
        "Planejamento de Manutenção",
        "/PlanejamentoManutencao",
        40,
    ),
    ("cadastros", "Cadastros", "/Cadastros", 50),
    ("relatorios", "Relatórios", "/Relatorios", 60),
    ("importar_correntes", "Importar Correntes", "/ImportarCorrentes", 70),
    ("exportar_dados", "Exportar Dados", "/ExportarDados", 80),
    ("notificacoes", "Notificações", "/Notificacoes", 90),
    ("assistente_ia", "Assistente IA", "/AssistenteIA", 100),
    ("configuracoes", "Configurações", "/configuracoes", 110),
]


def seed_modules(apps, schema_editor):
    system_module = apps.get_model("accounts", "SystemModule")
    for key, name, path, order in MODULES:
        system_module.objects.update_or_create(
            key=key,
            defaults={
                "name": name,
                "path": path,
                "order": order,
                "active": True,
            },
        )


def unseed_modules(apps, schema_editor):
    system_module = apps.get_model("accounts", "SystemModule")
    system_module.objects.filter(key__in=[item[0] for item in MODULES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(seed_modules, unseed_modules)]
