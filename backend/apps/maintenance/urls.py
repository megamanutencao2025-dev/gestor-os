from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MaintenanceAreaViewSet,
    MaintenanceDashboardView,
    MaintenanceTypeViewSet,
    PriorityViewSet,
    WorkOrderStatusViewSet,
    WorkOrderViewSet,
)

router = DefaultRouter()
router.register("work-orders", WorkOrderViewSet, basename="work-order")
router.register("maintenance-areas", MaintenanceAreaViewSet)
router.register("maintenance-types", MaintenanceTypeViewSet)
router.register("work-order-statuses", WorkOrderStatusViewSet)
router.register("priorities", PriorityViewSet)

urlpatterns = [
    path(
        "dashboard/maintenance/",
        MaintenanceDashboardView.as_view(),
        name="maintenance-dashboard",
    ),
    *router.urls,
]
