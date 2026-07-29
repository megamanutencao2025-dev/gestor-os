import uuid

from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.data_transfer.legacy_adapter import (
    LegacyDataError,
    export_entity,
    export_entity_row,
    import_entity,
    reserve_work_order_number,
)
from apps.maintenance.models import WorkOrder

from .serializers import LegacyPayloadSerializer


def exported(entity_name):
    return export_entity(entity_name)[1]


class PublicReferenceView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LegacyPayloadSerializer

    def get(self, request):
        return Response(
            {
                "equipamentos": exported("Equipamento"),
                "tipos": exported("TipoManutencao"),
                "areas": exported("AreaManutencao"),
                "prioridades": exported("Prioridade"),
                "status": exported("StatusOS"),
            }
        )


class PublicWorkOrderView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LegacyPayloadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_submission"

    def get(self, request):
        return Response(
            [
                {
                    "id": row["id"],
                    "numero": row["numero"],
                    "created_date": row["created_date"],
                }
                for row in exported("OrdemServico")
                if row.get("aprovacao_status") == WorkOrder.ApprovalStatus.APPROVED
            ]
        )

    def post(self, request):
        identifier = str(uuid.uuid4())
        payload = {
            **request.data,
            "id": identifier,
            "numero": reserve_work_order_number(),
            "approval_status": WorkOrder.ApprovalStatus.PENDING,
        }
        try:
            import_entity("OrdemServico", [payload])
        except LegacyDataError as exc:
            return Response(
                {"message": str(exc), "errors": exc.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            export_entity_row("OrdemServico", identifier),
            status=status.HTTP_201_CREATED,
        )


class PublicNotificationView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LegacyPayloadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_submission"

    def post(self, request):
        identifier = str(uuid.uuid4())
        payload = {**request.data, "id": identifier}
        if not WorkOrder.objects.exists():
            return Response(
                {"message": "Nao existe ordem para vincular a notificacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            import_entity("NotificacaoOS", [payload])
        except LegacyDataError as exc:
            return Response(
                {"message": str(exc), "errors": exc.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            export_entity_row("NotificacaoOS", identifier),
            status=status.HTTP_201_CREATED,
        )
