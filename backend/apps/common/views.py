from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import HealthSerializer, ReadinessSerializer


class HealthView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = HealthSerializer

    @extend_schema(responses=HealthSerializer)
    def get(self, request):
        return Response({"ok": True, "service": "MaintenancePro API v2"})


class ReadinessView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = ReadinessSerializer

    @extend_schema(responses=ReadinessSerializer)
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"ok": True, "database": "available"})
