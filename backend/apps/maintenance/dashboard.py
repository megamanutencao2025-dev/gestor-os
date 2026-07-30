from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import (
    Avg,
    Case,
    Count,
    DurationField,
    ExpressionWrapper,
    F,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from .filters import FINAL_STATUS_CATEGORIES, apply_dimension_filters
from .models import WorkOrder, WorkOrderStatus


def _period_bounds(date_from, date_to):
    current_timezone = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(date_from, time.min), current_timezone)
    end = timezone.make_aware(
        datetime.combine(date_to + timedelta(days=1), time.min),
        current_timezone,
    )
    return start, end


def _money(value):
    return float(value or Decimal("0"))


def _duration_hours(value):
    return round(value.total_seconds() / 3600, 1) if value else None


def _series(queryset, start, end):
    days = (end.date() - start.date()).days
    if days <= 31:
        truncator = TruncDay
        bucket = "day"
    elif days <= 93:
        truncator = TruncWeek
        bucket = "week"
    else:
        truncator = TruncMonth
        bucket = "month"

    opened = {
        row["period"].date().isoformat(): row["count"]
        for row in queryset.filter(created_at__gte=start, created_at__lt=end)
        .annotate(period=truncator("created_at"))
        .values("period")
        .annotate(count=Count("id", distinct=True))
        .order_by("period")
    }
    completed = {
        row["period"].date().isoformat(): row["count"]
        for row in queryset.filter(completed_at__gte=start, completed_at__lt=end)
        .annotate(period=truncator("completed_at"))
        .values("period")
        .annotate(count=Count("id", distinct=True))
        .order_by("period")
    }
    labels = sorted(set(opened) | set(completed))
    return {
        "bucket": bucket,
        "items": [
            {
                "period": label,
                "opened": opened.get(label, 0),
                "completed": completed.get(label, 0),
            }
            for label in labels
        ],
    }


def build_maintenance_dashboard(filters):
    date_from = filters["date_from"]
    date_to = filters["date_to"]
    start, end = _period_bounds(date_from, date_to)
    now = timezone.now()

    all_orders = apply_dimension_filters(
        WorkOrder.objects.filter(
            approval_status=WorkOrder.ApprovalStatus.APPROVED,
        ),
        filters,
    ).distinct()
    period_orders = all_orders.filter(created_at__gte=start, created_at__lt=end)
    open_orders = period_orders.exclude(status__category__in=FINAL_STATUS_CATEGORIES)
    completed_orders = period_orders.filter(status__category=WorkOrderStatus.Category.COMPLETED)

    completion_duration = ExpressionWrapper(
        F("completed_at") - F("created_at"),
        output_field=DurationField(),
    )
    completion_average = (
        completed_orders.filter(completed_at__isnull=False)
        .aggregate(value=Avg(completion_duration))
        .get("value")
    )
    due_evaluable = completed_orders.filter(
        completed_at__isnull=False,
        due_at__isnull=False,
    )
    due_total = due_evaluable.count()
    on_time_count = due_evaluable.filter(completed_at__lte=F("due_at")).count()

    attention = (
        open_orders.annotate(
            attention_rank=Case(
                When(due_at__lt=now, then=Value(1)),
                When(due_at__date=timezone.localdate(), then=Value(2)),
                When(priority__severity="emergency", then=Value(3)),
                When(priority__severity="critical", then=Value(4)),
                When(assigned_maintainer__isnull=True, then=Value(5)),
                When(
                    status__category=WorkOrderStatus.Category.WAITING_PARTS,
                    then=Value(6),
                ),
                default=Value(7),
            )
        )
        .select_related("priority", "status", "assigned_maintainer")
        .prefetch_related("equipment_links")
        .order_by("attention_rank", "due_at", "created_at")[:50]
    )
    attention_items = []
    for order in attention:
        first_equipment = next(iter(order.equipment_links.all()), None)
        situation = "open"
        if order.due_at and order.due_at < now:
            situation = "overdue"
        elif order.due_at and timezone.localtime(order.due_at).date() == timezone.localdate():
            situation = "due_today"
        elif order.priority and order.priority.severity in ("critical", "emergency"):
            situation = "emergency"
        elif order.assigned_maintainer_id is None:
            situation = "unassigned"
        elif order.status.category == WorkOrderStatus.Category.WAITING_PARTS:
            situation = "waiting_parts"
        attention_items.append(
            {
                "id": str(order.id),
                "number": order.number,
                "equipment": (
                    first_equipment.equipment_name
                    if first_equipment
                    else order.equipment_description or "Sem equipamento"
                ),
                "status": order.status.description,
                "priority": order.priority.description if order.priority else None,
                "priority_severity": (order.priority.severity if order.priority else None),
                "due_at": order.due_at,
                "responsible": (
                    order.assigned_maintainer.name if order.assigned_maintainer else None
                ),
                "situation": situation,
                "open_hours": round((now - order.created_at).total_seconds() / 3600),
            }
        )

    status_rows = list(
        period_orders.values(
            "status_id",
            "status__description",
            "status__category",
        )
        .annotate(count=Count("id", distinct=True))
        .order_by("-count", "status__order")
    )
    type_rows = list(
        period_orders.values(
            "maintenance_type_id",
            "maintenance_type__description",
            "maintenance_type__category",
        )
        .annotate(count=Count("id", distinct=True))
        .order_by("-count", "maintenance_type__description")
    )
    equipment_rows = list(
        period_orders.filter(maintenance_type__category__in=("corrective", "emergency"))
        .values(
            "equipment_links__equipment_id",
            "equipment_links__equipment_name",
        )
        .annotate(
            count=Count("id", distinct=True),
            downtime_minutes=Coalesce(Sum("downtime_minutes"), 0),
            total_cost=Coalesce(
                Sum("grand_total"),
                Decimal("0"),
            ),
        )
        .order_by("-count", "-downtime_minutes")[:10]
    )
    costs = period_orders.aggregate(
        materials=Coalesce(Sum("materials_total"), Decimal("0")),
        services=Coalesce(Sum("services_total"), Decimal("0")),
        outsourced=Coalesce(Sum("outsourced_total"), Decimal("0")),
        other=Coalesce(Sum("other_total"), Decimal("0")),
        total=Coalesce(Sum("grand_total"), Decimal("0")),
        average=Coalesce(Avg("grand_total"), Decimal("0")),
    )

    return {
        "last_updated": now,
        "period": {
            "date_from": date_from,
            "date_to": date_to,
        },
        "indicators": {
            "open": open_orders.count(),
            "overdue": open_orders.filter(due_at__lt=now).count(),
            "emergency": open_orders.filter(
                priority__severity__in=("critical", "emergency")
            ).count(),
            "waiting_parts": open_orders.filter(
                status__category=WorkOrderStatus.Category.WAITING_PARTS
            ).count(),
            "unassigned": open_orders.filter(assigned_maintainer__isnull=True).count(),
            "completed": completed_orders.count(),
            "on_time_rate": (round(on_time_count * 100 / due_total, 1) if due_total else None),
            "on_time_evaluable": due_total,
            "mean_completion_hours": _duration_hours(completion_average),
        },
        "attention": attention_items,
        "series": _series(all_orders, start, end),
        "statuses": [
            {
                "id": str(row["status_id"]),
                "name": row["status__description"],
                "category": row["status__category"],
                "count": row["count"],
            }
            for row in status_rows
        ],
        "types": [
            {
                "id": str(row["maintenance_type_id"]),
                "name": row["maintenance_type__description"],
                "category": row["maintenance_type__category"],
                "count": row["count"],
            }
            for row in type_rows
        ],
        "equipment_impact": [
            {
                "id": (
                    str(row["equipment_links__equipment_id"])
                    if row["equipment_links__equipment_id"]
                    else None
                ),
                "name": row["equipment_links__equipment_name"] or "Equipamento nao cadastrado",
                "count": row["count"],
                "recurrences": max(row["count"] - 1, 0),
                "downtime_minutes": row["downtime_minutes"],
                "total_cost": _money(row["total_cost"]),
            }
            for row in equipment_rows
        ],
        "costs": {key: _money(value) for key, value in costs.items()},
        "budget": {
            "available": False,
            "message": "Orcamento nao cadastrado para o periodo.",
        },
        "causes": {
            "available": False,
            "message": "Causas padronizadas ainda nao possuem dados suficientes.",
        },
    }
