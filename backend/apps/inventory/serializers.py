from rest_framework import serializers

from .models import Material
from .nfe_import import MAX_NFE_FILES, MAX_NFE_PRODUCTS


class NfePreviewUploadSerializer(serializers.Serializer):
    files = serializers.ListField(
        child=serializers.FileField(),
        min_length=1,
        max_length=MAX_NFE_FILES,
    )


class NfeConfirmItemSerializer(serializers.Serializer):
    preview_id = serializers.CharField(max_length=120)
    selected = serializers.BooleanField()
    action = serializers.ChoiceField(choices=("create", "update", "ignore"))
    internal_code = serializers.CharField(
        max_length=80,
        required=False,
        allow_blank=True,
    )
    name = serializers.CharField(max_length=180, required=False, allow_blank=True)
    unit = serializers.ChoiceField(
        choices=Material.Unit.choices,
        required=False,
        allow_blank=True,
    )
    cost_center_id = serializers.UUIDField(required=False, allow_null=True)
    remember_unit_mapping = serializers.BooleanField(required=False, default=True)


class NfeConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    items = serializers.ListField(
        child=NfeConfirmItemSerializer(),
        min_length=1,
        max_length=MAX_NFE_PRODUCTS,
    )


class NfeImportSummarySerializer(serializers.Serializer):
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    ignored = serializers.IntegerField()
    invoices = serializers.IntegerField()
