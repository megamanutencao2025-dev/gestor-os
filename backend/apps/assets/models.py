from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import LegacyMappedModel


class Location(LegacyMappedModel):
    description = models.CharField(max_length=180)
    sector = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["description"]
        constraints = [
            models.UniqueConstraint(
                fields=["description", "sector"],
                name="unique_location_description_sector",
            )
        ]

    def __str__(self):
        return self.description


class EquipmentFamily(LegacyMappedModel):
    description = models.CharField(max_length=180, unique=True)

    class Meta:
        ordering = ["description"]

    def __str__(self):
        return self.description


class Equipment(LegacyMappedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Ativo"
        INACTIVE = "inactive", "Inativo"

    code = models.CharField(max_length=80, unique=True, null=True, blank=True)
    description = models.CharField(max_length=180)
    brand = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)
    manufacturer = models.CharField(max_length=120, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="equipment",
        null=True,
        blank=True,
    )
    family = models.ForeignKey(
        EquipmentFamily,
        on_delete=models.PROTECT,
        related_name="equipment",
        null=True,
        blank=True,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="components",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    parts_per_hour = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["description"]
        indexes = [
            models.Index(fields=["status", "description"]),
            models.Index(fields=["location", "description"]),
        ]

    def clean(self):
        if self.parent_id == self.id:
            raise ValidationError({"parent": "Um equipamento nao pode ser pai de si mesmo."})

    def __str__(self):
        return f"{self.code} - {self.description}" if self.code else self.description
