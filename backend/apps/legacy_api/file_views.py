import base64
import binascii
import uuid
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


class LegacyFileUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=120, required=False, allow_blank=True)
    size = serializers.IntegerField(min_value=0, required=False)
    dataUrl = serializers.CharField()

    def validate_name(self, value):
        extension = Path(value).suffix.lower()
        if extension not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError("Tipo de arquivo nao permitido.")
        return Path(value).name

    def validate_dataUrl(self, value):
        if not value.startswith("data:") or ";base64," not in value:
            raise serializers.ValidationError("Arquivo em formato invalido.")
        return value


class LegacyFileUploadView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LegacyFileUploadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "upload"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data_url = serializer.validated_data["dataUrl"]
        metadata, encoded = data_url.split(";base64,", 1)
        media_type = metadata.removeprefix("data:")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            return Response(
                {"message": "Conteudo base64 invalido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(content) > MAX_UPLOAD_BYTES:
            return Response(
                {"message": "O arquivo excede o limite de 8 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        original_name = serializer.validated_data["name"]
        extension = Path(original_name).suffix.lower()
        relative_name = f"uploads/{date.today():%Y/%m}/{uuid.uuid4().hex}{extension}"
        stored_name = default_storage.save(relative_name, ContentFile(content))
        file_url = request.build_absolute_uri(default_storage.url(stored_name))
        return Response(
            {
                "file_url": file_url,
                "name": original_name,
                "type": serializer.validated_data.get("type") or media_type,
                "size": len(content),
            },
            status=status.HTTP_201_CREATED,
        )
