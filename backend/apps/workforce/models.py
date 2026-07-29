from django.db import models

from apps.common.models import LegacyMappedModel


class Maintainer(LegacyMappedModel):
    name = models.CharField(max_length=180)
    position = models.CharField(max_length=120)
    hourly_cost = models.DecimalField(max_digits=12, decimal_places=2)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServiceProvider(LegacyMappedModel):
    company_name = models.CharField(max_length=180)
    tax_id = models.CharField(max_length=18, unique=True, null=True, blank=True)
    primary_phone = models.CharField(max_length=32, blank=True)
    secondary_phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    services_description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name
