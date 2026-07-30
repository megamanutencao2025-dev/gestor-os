from rest_framework.permissions import BasePermission

from apps.accounts.models import User, UserModulePermission
from apps.legacy_api.permissions import get_entity_config


class MaterialImportPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.role == User.Role.ADMIN:
            return True
        config = get_entity_config("materiais")
        return UserModulePermission.objects.filter(
            user=user,
            module__key__in=config["write"],
            module__active=True,
            can_access=True,
        ).exists()
