from rest_framework.permissions import BasePermission

from apps.accounts.models import User, UserModulePermission


class DataTransferPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True
        return UserModulePermission.objects.filter(
            user=user,
            module__key="exportar_dados",
            module__active=True,
            can_access=True,
        ).exists()
