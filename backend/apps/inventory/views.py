from django.db import IntegrityError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .nfe_import import NfeImportError, build_nfe_preview, confirm_nfe_import
from .permissions import MaterialImportPermission
from .serializers import (
    NfeConfirmSerializer,
    NfeImportSummarySerializer,
    NfePreviewUploadSerializer,
)


class NfeMaterialPreviewView(GenericAPIView):
    permission_classes = [MaterialImportPermission]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = NfePreviewUploadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "upload"

    @extend_schema(
        request=NfePreviewUploadSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            400: OpenApiResponse(description="Arquivos XML invalidos."),
        },
    )
    def post(self, request):
        serializer = self.get_serializer(data={"files": request.FILES.getlist("files")})
        serializer.is_valid(raise_exception=True)
        try:
            result = build_nfe_preview(serializer.validated_data["files"])
        except NfeImportError as exc:
            return Response(
                {"message": str(exc), "errors": []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(result)


class NfeMaterialConfirmView(GenericAPIView):
    permission_classes = [MaterialImportPermission]
    serializer_class = NfeConfirmSerializer

    @extend_schema(
        request=NfeConfirmSerializer,
        responses={
            200: NfeImportSummarySerializer,
            400: OpenApiResponse(description="Confirmacao invalida."),
        },
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = confirm_nfe_import(
                serializer.validated_data["token"],
                serializer.validated_data["items"],
                request.user,
            )
        except NfeImportError as exc:
            return Response(
                {"message": str(exc), "errors": []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            return Response(
                {
                    "message": (
                        "A NF-e ou um dos codigos internos foi gravado por outro processo. "
                        "Atualize a previa e tente novamente."
                    ),
                    "errors": [],
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(result)
