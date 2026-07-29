from rest_framework.permissions import BasePermission

from apps.accounts.models import User, UserModulePermission

ENTITY_ACCESS = {
    "areas-manutencao": {
        "entity": "AreaManutencao",
        "read": {"nova_os", "planejamento_manutencao", "cadastros", "exportar_dados"},
        "write": {"cadastros", "exportar_dados"},
    },
    "centros-custo": {
        "entity": "CentroCusto",
        "read": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
    "equipamentos": {
        "entity": "Equipamento",
        "read": {
            "dashboard",
            "ordens_servico",
            "nova_os",
            "planejamento_manutencao",
            "cadastros",
            "relatorios",
            "exportar_dados",
        },
        "write": {"ordens_servico", "nova_os", "cadastros", "exportar_dados"},
    },
    "familias-equipamento": {
        "entity": "FamiliaEquipamento",
        "read": {"cadastros", "exportar_dados"},
        "write": {"cadastros", "exportar_dados"},
    },
    "localizacoes": {
        "entity": "Localizacao",
        "read": {"cadastros", "nova_os", "ordens_servico", "exportar_dados"},
        "write": {"cadastros", "exportar_dados"},
    },
    "mantenedores": {
        "entity": "Mantenedor",
        "read": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
    "materiais": {
        "entity": "Material",
        "read": {
            "nova_os",
            "ordens_servico",
            "cadastros",
            "relatorios",
            "exportar_dados",
        },
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
    "notificacoes-os": {
        "entity": "NotificacaoOS",
        "read": {"notificacoes", "ordens_servico"},
        "write": {"notificacoes", "ordens_servico"},
    },
    "ordens-servico": {
        "entity": "OrdemServico",
        "read": {
            "dashboard",
            "ordens_servico",
            "nova_os",
            "planejamento_manutencao",
            "relatorios",
            "exportar_dados",
            "notificacoes",
        },
        "write": {
            "ordens_servico",
            "nova_os",
            "planejamento_manutencao",
            "exportar_dados",
        },
    },
    "prestadoras-servico": {
        "entity": "PrestadoraServico",
        "read": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
    "prioridades": {
        "entity": "Prioridade",
        "read": {"nova_os", "planejamento_manutencao", "cadastros", "exportar_dados"},
        "write": {"nova_os", "cadastros", "exportar_dados"},
    },
    "status-os": {
        "entity": "StatusOS",
        "read": {
            "dashboard",
            "ordens_servico",
            "nova_os",
            "planejamento_manutencao",
            "cadastros",
            "exportar_dados",
        },
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
    "tipos-manutencao": {
        "entity": "TipoManutencao",
        "read": {
            "dashboard",
            "ordens_servico",
            "nova_os",
            "planejamento_manutencao",
            "cadastros",
            "exportar_dados",
        },
        "write": {"nova_os", "ordens_servico", "cadastros", "exportar_dados"},
    },
}


def get_entity_config(route):
    return ENTITY_ACCESS.get(route)


class LegacyEntityPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True

        config = get_entity_config(view.kwargs.get("route"))
        if config is None:
            return False
        access_type = "read" if request.method in {"GET", "HEAD", "OPTIONS"} else "write"
        return UserModulePermission.objects.filter(
            user=user,
            module__key__in=config[access_type],
            module__active=True,
            can_access=True,
        ).exists()


class AdminRolePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role == User.Role.ADMIN and user.is_active
        )
