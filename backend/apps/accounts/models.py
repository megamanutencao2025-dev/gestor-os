import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.common.models import TimeStampedModel


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        USER = "user", "Usuario"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=180, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)
    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="created_users",
        null=True,
        blank=True,
    )

    def save(self, *args, **kwargs):
        self.is_staff = self.role == self.Role.ADMIN
        super().save(*args, **kwargs)


class SystemModule(TimeStampedModel):
    key = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=100)
    path = models.CharField(max_length=160)
    description = models.CharField(max_length=255, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class UserModulePermission(TimeStampedModel):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="module_permissions",
    )
    module = models.ForeignKey(
        SystemModule,
        on_delete=models.CASCADE,
        related_name="user_permissions",
    )
    can_access = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "module"],
                name="unique_user_module_permission",
            )
        ]
