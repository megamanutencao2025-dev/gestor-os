from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import WorkOrder, WorkOrderEquipment, WorkOrderSequence

ZERO = Decimal("0.00")


@transaction.atomic
def create_work_order(*, equipment=None, **validated_data):
    sequence, _ = WorkOrderSequence.objects.select_for_update().get_or_create(
        key="work_order",
        defaults={"current_value": 0},
    )
    sequence.current_value += 1
    sequence.save(update_fields=["current_value", "updated_at"])

    work_order = WorkOrder.objects.create(
        number=f"OS-{sequence.current_value:06d}",
        **validated_data,
    )

    links = []
    for item in equipment or []:
        location_name = ""
        if item.location_id:
            location_name = item.location.description
        links.append(
            WorkOrderEquipment(
                work_order=work_order,
                equipment=item,
                equipment_name=item.description,
                location_name=location_name,
            )
        )
    WorkOrderEquipment.objects.bulk_create(links)
    return work_order


@transaction.atomic
def recalculate_work_order_totals(work_order):
    work_order = WorkOrder.objects.select_for_update().get(pk=work_order.pk)

    services_total = work_order.services.aggregate(total=Sum("total_amount"))["total"]
    materials_total = work_order.materials.aggregate(total=Sum("total_cost"))["total"]
    outsourced_total = work_order.outsourced_services.aggregate(total=Sum("amount"))["total"]
    other_total = work_order.other_costs.aggregate(total=Sum("total_cost"))["total"]

    work_order.services_total = services_total or ZERO
    work_order.materials_total = materials_total or ZERO
    work_order.outsourced_total = outsourced_total or ZERO
    work_order.other_total = other_total or ZERO
    work_order.grand_total = (
        work_order.services_total
        + work_order.materials_total
        + work_order.outsourced_total
        + work_order.other_total
    )
    work_order.save(
        update_fields=[
            "services_total",
            "materials_total",
            "outsourced_total",
            "other_total",
            "grand_total",
            "updated_at",
        ]
    )
    return work_order
