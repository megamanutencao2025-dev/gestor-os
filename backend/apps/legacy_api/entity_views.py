import uuid

from django.db import IntegrityError
from django.db.models.deletion import ProtectedError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.data_transfer.legacy_adapter import (
    LegacyDataError,
    export_entity,
    export_entity_row,
    find_entity_instance,
    import_entity,
    reserve_work_order_number,
)
from apps.maintenance.models import WorkOrder

from .permissions import LegacyEntityPermission, get_entity_config
from .serializers import LegacyPayloadSerializer


def sort_rows(rows, sort):
    if not sort:
        return rows
    reverse = sort.startswith("-")
    field = sort.removeprefix("-")
    return sorted(
        rows,
        key=lambda row: (
            row.get(field) is None,
            str(row.get(field) or "").casefold(),
        ),
        reverse=reverse,
    )


def entity_name_from_view(view):
    config = get_entity_config(view.kwargs.get("route"))
    return config["entity"] if config else None


class LegacyEntityCollectionView(GenericAPIView):
    permission_classes = [LegacyEntityPermission]
    serializer_class = LegacyPayloadSerializer

    @extend_schema(
        operation_id="legacy_entity_list",
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request, route):
        entity_name = entity_name_from_view(self)
        if not entity_name:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _, rows = export_entity(entity_name)
        if entity_name == "OrdemServico":
            approval_filter = request.query_params.get(
                "approval",
                WorkOrder.ApprovalStatus.APPROVED,
            )
            if approval_filter != "all":
                rows = [
                    row
                    for row in rows
                    if row.get("aprovacao_status") == approval_filter
                ]
        return Response(sort_rows(rows, request.query_params.get("sort")))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, route):
        entity_name = entity_name_from_view(self)
        if not entity_name:
            return Response(status=status.HTTP_404_NOT_FOUND)
        identifier = str(uuid.uuid4())
        row = {**request.data, "id": identifier}
        if entity_name == "OrdemServico" and not row.get("numero"):
            row["numero"] = reserve_work_order_number()
        try:
            import_entity(entity_name, [row])
        except LegacyDataError as exc:
            return Response(
                {"message": str(exc), "errors": exc.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            export_entity_row(entity_name, identifier),
            status=status.HTTP_201_CREATED,
        )


class LegacyEntityBulkView(GenericAPIView):
    permission_classes = [LegacyEntityPermission]
    serializer_class = LegacyPayloadSerializer

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, route):
        entity_name = entity_name_from_view(self)
        if not entity_name:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not isinstance(request.data, list):
            return Response(
                {"message": "O corpo deve ser uma lista."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        identifiers = [str(uuid.uuid4()) for _ in request.data]
        rows = [
            {**row, "id": identifier}
            for row, identifier in zip(request.data, identifiers, strict=True)
        ]
        if entity_name == "OrdemServico":
            for row in rows:
                if not row.get("numero"):
                    row["numero"] = reserve_work_order_number()
        try:
            import_entity(entity_name, rows)
        except LegacyDataError as exc:
            return Response(
                {"message": str(exc), "errors": exc.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            [export_entity_row(entity_name, identifier) for identifier in identifiers],
            status=status.HTTP_201_CREATED,
        )


class LegacyEntityDetailView(GenericAPIView):
    permission_classes = [LegacyEntityPermission]
    serializer_class = LegacyPayloadSerializer

    def get_instance(self, entity_name, identifier):
        return find_entity_instance(entity_name, identifier)

    @extend_schema(
        operation_id="legacy_entity_retrieve",
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request, route, identifier):
        entity_name = entity_name_from_view(self)
        instance = self.get_instance(entity_name, identifier)
        if instance is None:
            return Response(
                {"message": f"{entity_name} nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(export_entity_row(entity_name, identifier))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def put(self, request, route, identifier):
        entity_name = entity_name_from_view(self)
        instance = self.get_instance(entity_name, identifier)
        if instance is None:
            return Response(
                {"message": f"{entity_name} nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        current = export_entity_row(entity_name, identifier)
        row = {**current, **request.data, "id": identifier}
        try:
            import_entity(entity_name, [row])
        except LegacyDataError as exc:
            return Response(
                {"message": str(exc), "errors": exc.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(export_entity_row(entity_name, identifier))

    def delete(self, request, route, identifier):
        entity_name = entity_name_from_view(self)
        instance = self.get_instance(entity_name, identifier)
        if instance is None:
            return Response(
                {"message": f"{entity_name} nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        row = export_entity_row(entity_name, identifier)
        try:
            instance.delete()
        except (IntegrityError, ProtectedError):
            return Response(
                {"message": "O registro possui vinculos e nao pode ser excluido."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(row)
