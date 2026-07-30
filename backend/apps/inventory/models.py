from django.db import models

from apps.common.models import LegacyMappedModel, TimeStampedModel


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
    supplier_name = models.CharField(max_length=180, blank=True)
    supplier_tax_id = models.CharField(max_length=14, blank=True)
    purchased_on = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["active", "name"])]

    def __str__(self):
        return f"{self.code} - {self.name}"


class NfeUnitMapping(TimeStampedModel):
    source_unit = models.CharField(max_length=32, unique=True)
    unit = models.CharField(max_length=24, choices=Material.Unit.choices)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="nfe_unit_mappings",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["source_unit"]

    def __str__(self):
        return f"{self.source_unit} -> {self.get_unit_display()}"


class NfeImport(TimeStampedModel):
    access_key = models.CharField(max_length=44, unique=True, null=True, blank=True)
    document_hash = models.CharField(max_length=64, unique=True)
    filename = models.CharField(max_length=255)
    supplier_name = models.CharField(max_length=180)
    supplier_tax_id = models.CharField(max_length=14, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    product_count = models.PositiveIntegerField(default=0)
    imported_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="nfe_imports",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.access_key or self.filename
