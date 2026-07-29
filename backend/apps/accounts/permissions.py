from rest_framework.permissions import BasePermission

from .models import User, UserModulePermission


class ModuleActionPermission(BasePermission):
    action_permissions = {
        "GET": "view",
        "HEAD": "view",
        "OPTIONS": "view",
        "POST": "add",
        "PUT": "change",
        "PATCH": "change",
        "DELETE": "delete",
    }

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True

        module_keys = getattr(view, "required_module_keys", ())
        if not module_keys:
            return False

        has_module = UserModulePermission.objects.filter(
            user=user,
            module__key__in=module_keys,
            module__active=True,
            can_access=True,
        ).exists()
        if not has_module:
            return False

        action = self.action_permissions.get(request.method)
        queryset = view.get_queryset()
        model = queryset.model
        permission = f"{model._meta.app_label}.{action}_{model._meta.model_name}"
        return user.has_perm(permission)
