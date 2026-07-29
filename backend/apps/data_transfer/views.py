from datetime import date

from django.http import HttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .contracts import BACKUP_FORMAT_VERSION, LEGACY_ENTITY_NAMES
from .csv_codec import CsvImportError, parse_csv, render_csv
from .legacy_adapter import LegacyDataError, export_entity, import_entity
from .permissions import DataTransferPermission
from .serializers import CsvImportSerializer, ImportResultSerializer


class CsvExportView(GenericAPIView):
    permission_classes = [DataTransferPermission]
    serializer_class = ImportResultSerializer

    @extend_schema(
        responses={
            200: OpenApiResponse(
                description="Arquivo CSV no formato legado.",
                response=bytes,
            )
        }
    )
    def get(self, request, entity_name):
        if entity_name not in LEGACY_ENTITY_NAMES:
            return Response(
                {"message": "Entidade de exportacao invalida."},
                status=status.HTTP_404_NOT_FOUND,
            )
        fields, rows = export_entity(entity_name)
        content = render_csv(fields, rows)
        filename = f"{entity_name}_{date.today().isoformat()}.csv"
        response = HttpResponse(
            content,
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Record-Count"] = str(len(rows))
        response["X-MaintenancePro-Backup-Version"] = BACKUP_FORMAT_VERSION
        return response


class CsvImportView(GenericAPIView):
    permission_classes = [DataTransferPermission]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = CsvImportSerializer

    @extend_schema(
        responses={
            200: ImportResultSerializer,
            400: OpenApiResponse(description="CSV ou dados invalidos."),
        }
    )
    def post(self, request, entity_name):
        if entity_name not in LEGACY_ENTITY_NAMES:
            return Response(
                {"message": "Entidade de importacao invalida."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            rows = parse_csv(serializer.validated_data["file"])
            result = import_entity(entity_name, rows)
        except CsvImportError as exc:
            return Response(
                {"message": str(exc), "errors": []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except LegacyDataError as exc:
            return Response(
                {
                    "message": str(exc),
                    "errors": exc.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = Response(result.as_dict())
        response["X-MaintenancePro-Backup-Version"] = BACKUP_FORMAT_VERSION
        return response
