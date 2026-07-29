import uuid

from django.db import models


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LegacyMappedModel(TimeStampedModel):
    legacy_id = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Identificador da entidade no backend legado.",
    )

    class Meta:
        abstract = True
