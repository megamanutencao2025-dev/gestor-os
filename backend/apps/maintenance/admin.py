from django.contrib import admin

from .models import (
    Attachment,
    CostCenter,
    MaintenanceArea,
    MaintenanceType,
    Notification,
    OtherCost,
    OutsourcedService,
    Priority,
    ServiceMaintainer,
    WorkOrder,
    WorkOrderEquipment,
    WorkOrderMaterial,
    WorkOrderStatus,
    WorkOrderStatusHistory,
    WorkService,
)

admin.site.register(MaintenanceArea)
admin.site.register(MaintenanceType)
admin.site.register(WorkOrderStatus)
admin.site.register(Priority)
admin.site.register(CostCenter)
admin.site.register(WorkOrder)
admin.site.register(WorkOrderEquipment)
admin.site.register(WorkService)
admin.site.register(ServiceMaintainer)
admin.site.register(WorkOrderMaterial)
admin.site.register(OutsourcedService)
admin.site.register(OtherCost)
admin.site.register(WorkOrderStatusHistory)
admin.site.register(Attachment)
admin.site.register(Notification)
