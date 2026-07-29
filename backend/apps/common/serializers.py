from rest_framework import serializers


class OkSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class HealthSerializer(OkSerializer):
    service = serializers.CharField()


class ReadinessSerializer(OkSerializer):
    database = serializers.CharField()
