from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import ModuleActionPermission

from .dashboard import build_maintenance_dashboard
from .filters import (
    DashboardFilterSerializer,
    WorkOrderFilterSerializer,
    apply_work_order_filters,
)
from .models import MaintenanceArea, MaintenanceType, Priority, WorkOrder, WorkOrderStatus
from .pagination import WorkOrderPagination
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
    pagination_class = WorkOrderPagination
    permission_classes = [ModuleActionPermission]
    required_module_keys = (
        "dashboard",
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
            "assigned_maintainer",
        ).prefetch_related(
            "equipment_links",
            "equipment_links__equipment",
            "equipment_links__equipment__location",
        )
        serializer = WorkOrderFilterSerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        queryset = apply_work_order_filters(queryset, serializer.validated_data)
        return queryset.order_by(serializer.validated_data["ordering"])


class MaintenanceDashboardView(APIView):
    permission_classes = [ModuleActionPermission]
    required_module_keys = ("dashboard",)

    def get_queryset(self):
        return WorkOrder.objects.all()

    def get(self, request):
        serializer = DashboardFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response(build_maintenance_dashboard(serializer.validated_data))
