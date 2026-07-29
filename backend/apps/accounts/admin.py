from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import SystemModule, User, UserModulePermission


@admin.register(User)
class MaintenanceUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("MaintenancePro", {"fields": ("full_name", "role")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("MaintenancePro", {"fields": ("email", "full_name", "role")}),
    )
    list_display = ("username", "email", "full_name", "role", "is_active")


admin.site.register(SystemModule)
admin.site.register(UserModulePermission)
