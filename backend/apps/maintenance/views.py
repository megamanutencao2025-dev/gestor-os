from rest_framework import mixins, viewsets

from apps.accounts.permissions import ModuleActionPermission

from .models import MaintenanceArea, MaintenanceType, Priority, WorkOrder, WorkOrderStatus
from .serializers import (
    MaintenanceAreaSerializer,
    MaintenanceTypeSerializer,
    PrioritySerializer,
    WorkOrderSerializer,
    WorkOrderStatusSerializer,
)


class ActiveReferenceViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        return super().get_queryset().filter(active=True)


class MaintenanceAreaViewSet(ActiveReferenceViewSet):
    queryset = MaintenanceArea.objects.all()
    serializer_class = MaintenanceAreaSerializer


class MaintenanceTypeViewSet(ActiveReferenceViewSet):
    queryset = MaintenanceType.objects.all()
    serializer_class = MaintenanceTypeSerializer


class WorkOrderStatusViewSet(ActiveReferenceViewSet):
    queryset = WorkOrderStatus.objects.all()
    serializer_class = WorkOrderStatusSerializer


class PriorityViewSet(ActiveReferenceViewSet):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [ModuleActionPermission]
    required_module_keys = (
        "ordens_servico",
        "nova_os",
        "planejamento_manutencao",
    )

    def get_queryset(self):
        queryset = WorkOrder.objects.select_related(
            "maintenance_type",
            "status",
            "area",
            "priority",
            "created_by",
            "approved_by",
        ).prefetch_related("equipment_links")

        status_id = self.request.query_params.get("status")
        equipment_id = self.request.query_params.get("equipment")
        approval = self.request.query_params.get(
            "approval",
            WorkOrder.ApprovalStatus.APPROVED,
        )
        if status_id:
            queryset = queryset.filter(status_id=status_id)
        if equipment_id:
            queryset = queryset.filter(equipment=equipment_id)
        if approval != "all":
            queryset = queryset.filter(approval_status=approval)
        return queryset.distinct()
