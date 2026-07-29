from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import BooleanField, Value
from django.utils import timezone
from django.utils.crypto import get_random_string
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.accounts.models import SystemModule, UserModulePermission
from apps.common.serializers import OkSerializer
from apps.data_transfer.legacy_adapter import (
    export_entity,
    export_entity_row,
    find_entity_instance,
)
from apps.maintenance.models import WorkOrder

from .permissions import AdminRolePermission
from .serializers import (
    AdminPasswordSerializer,
    AdminStatusSerializer,
    AdminUserWriteSerializer,
    LegacyModuleSerializer,
    LegacyUserSerializer,
    ModuleKeysSerializer,
    TemporaryPasswordResponseSerializer,
    WorkOrderApprovalSerializer,
    validate_role_password,
)

User = get_user_model()


def modules_for_user(user):
    modules = SystemModule.objects.all().order_by("order", "name")
    allowed_module_ids = set()
    if user.role == User.Role.ADMIN:
        allowed_module_ids = set(modules.values_list("id", flat=True))
    else:
        allowed_module_ids = set(
            UserModulePermission.objects.filter(
                user=user,
                can_access=True,
            ).values_list("module_id", flat=True)
        )
    return [
        {
            "id": str(module.id),
            "key": module.key,
            "name": module.name,
            "path": module.path,
            "description": module.description,
            "order": module.order,
            "active": module.active,
            "canAccess": module.id in allowed_module_ids,
        }
        for module in modules
    ]


class AdminUserCollectionView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = AdminUserWriteSerializer

    @extend_schema(responses=LegacyUserSerializer(many=True))
    def get(self, request):
        users = User.objects.all().order_by("username")
        return Response(LegacyUserSerializer(users, many=True).data)

    @extend_schema(responses=LegacyUserSerializer)
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            LegacyUserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = AdminUserWriteSerializer

    def put(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(user, data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(LegacyUserSerializer(user).data)


class AdminUserPasswordView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = AdminPasswordSerializer

    @extend_schema(responses=OkSerializer)
    def patch(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(
            data=request.data,
            context={"user": user},
        )
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        return Response({"ok": True})


class AdminUserTemporaryPasswordView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = TemporaryPasswordResponseSerializer

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if user.created_by_id != request.user.id:
            return Response(
                {"message": "Somente o administrador que criou o usuario pode gerar uma senha temporaria."},
                status=status.HTTP_403_FORBIDDEN,
            )

        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+?"
        temporary_password = get_random_string(14, allowed_chars=alphabet)
        validate_role_password(temporary_password, user)
        user.set_password(temporary_password)
        user.save(update_fields=["password"])
        return Response(
            {
                "username": user.username,
                "temporaryPassword": temporary_password,
            }
        )


class AdminWorkOrderSolicitationsView(GenericAPIView):
    permission_classes = [AdminRolePermission]

    def get(self, request):
        _, rows = export_entity("OrdemServico")
        return Response(
            [
                row
                for row in rows
                if row.get("aprovacao_status") == WorkOrder.ApprovalStatus.PENDING
            ]
        )


class AdminWorkOrderApprovalView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = WorkOrderApprovalSerializer

    @transaction.atomic
    def patch(self, request, identifier):
        work_order = find_entity_instance("OrdemServico", identifier)
        if work_order is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if work_order.approval_status != WorkOrder.ApprovalStatus.PENDING:
            return Response(
                {"message": "Esta solicitacao ja foi analisada."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        reason = serializer.validated_data.get("reason", "").strip()
        if action == "reject" and not reason:
            return Response(
                {"message": "Informe o motivo da recusa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        work_order.approval_status = (
            WorkOrder.ApprovalStatus.APPROVED
            if action == "approve"
            else WorkOrder.ApprovalStatus.REJECTED
        )
        work_order.rejection_reason = reason if action == "reject" else ""
        work_order.approved_by = request.user
        work_order.approved_at = timezone.now()
        work_order.save(
            update_fields=[
                "approval_status",
                "rejection_reason",
                "approved_by",
                "approved_at",
                "updated_at",
            ]
        )
        return Response(export_entity_row("OrdemServico", identifier))


class AdminUserStatusView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = AdminStatusSerializer

    @extend_schema(responses=LegacyUserSerializer)
    def patch(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        active = serializer.validated_data["active"]
        if user.pk == request.user.pk and not active:
            return Response(
                {"message": "Voce nao pode desativar seu proprio usuario."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = active
        user.save(update_fields=["is_active"])
        return Response(LegacyUserSerializer(user).data)


class AdminUserModulesView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = ModuleKeysSerializer

    @extend_schema(responses=LegacyModuleSerializer(many=True))
    def get(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(modules_for_user(user))

    @extend_schema(responses=LegacyModuleSerializer(many=True))
    @transaction.atomic
    def put(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        module_keys = set(serializer.validated_data["moduleKeys"])
        modules = SystemModule.objects.all()
        for module in modules:
            UserModulePermission.objects.update_or_create(
                user=user,
                module=module,
                defaults={"can_access": module.key in module_keys},
            )
        return Response(modules_for_user(user))


class AdminModuleListView(GenericAPIView):
    permission_classes = [AdminRolePermission]
    serializer_class = LegacyModuleSerializer

    @extend_schema(responses=LegacyModuleSerializer(many=True))
    def get(self, request):
        modules = SystemModule.objects.annotate(
            can_access=Value(False, output_field=BooleanField())
        ).order_by("order", "name")
        return Response(LegacyModuleSerializer(modules, many=True).data)
