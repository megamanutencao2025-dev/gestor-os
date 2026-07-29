from django.db import models

from apps.common.models import LegacyMappedModel


class Material(LegacyMappedModel):
    class Unit(models.TextChoices):
        KILOGRAM = "kg", "Kg"
        UNIT = "unit", "Unidade"
        LITER = "liter", "Litro"
        METER = "meter", "Metro"
        SQUARE_METER = "square_meter", "Metro quadrado"
        CUBIC_METER = "cubic_meter", "Metro cubico"
        HOUR = "hour", "Hora"

    code = models.CharField(max_length=80, unique=True)
    purchase_code = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=180)
    unit = models.CharField(max_length=24, choices=Unit.choices)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    cost_center = models.ForeignKey(
        "maintenance.CostCenter",
        on_delete=models.PROTECT,
        related_name="materials",
        null=True,
        blank=True,
    )
    purchased_on = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["active", "name"])]

    def __str__(self):
        return f"{self.code} - {self.name}"
