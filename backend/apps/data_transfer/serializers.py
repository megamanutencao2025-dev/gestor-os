from rest_framework import serializers

from .contracts import LEGACY_ENTITY_NAMES


class CsvImportSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.lower().endswith(".csv"):
            raise serializers.ValidationError("Selecione um arquivo com extensao .csv.")
        return value


class ImportResultSerializer(serializers.Serializer):
    entity = serializers.ChoiceField(choices=LEGACY_ENTITY_NAMES)
    total = serializers.IntegerField(min_value=0)
    created = serializers.IntegerField(min_value=0)
    updated = serializers.IntegerField(min_value=0)


class ImportErrorSerializer(serializers.Serializer):
    row = serializers.IntegerField(allow_null=True)
    message = serializers.CharField()
