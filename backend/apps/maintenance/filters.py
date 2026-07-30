from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .models import WorkOrder, WorkOrderStatus

FINAL_STATUS_CATEGORIES = (
    WorkOrderStatus.Category.COMPLETED,
    WorkOrderStatus.Category.CANCELLED,
    WorkOrderStatus.Category.REJECTED,
)


class WorkOrderFilterSerializer(serializers.Serializer):
    approval = serializers.ChoiceField(
        choices=[choice[0] for choice in WorkOrder.ApprovalStatus.choices] + ["all"],
        default=WorkOrder.ApprovalStatus.APPROVED,
    )
    status = serializers.UUIDField(required=False)
    equipment = serializers.UUIDField(required=False)
    location = serializers.UUIDField(required=False)
    maintenance_type = serializers.UUIDField(required=False)
    priority = serializers.UUIDField(required=False)
    responsible = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    search = serializers.CharField(required=False, allow_blank=True, max_length=180)
    situation = serializers.ChoiceField(
        required=False,
        choices=[
            "open",
            "overdue",
            "due_today",
            "unassigned",
            "waiting_parts",
            "emergency",
        ],
    )
    ordering = serializers.ChoiceField(
        required=False,
        default="-created_at",
        choices=[
            "created_at",
            "-created_at",
            "number",
            "-number",
            "scheduled_at",
            "-scheduled_at",
            "due_at",
            "-due_at",
            "priority__order",
            "-priority__order",
            "maintenance_type__description",
            "-maintenance_type__description",
            "status__order",
            "-status__order",
            "requester",
            "-requester",
        ],
    )

    def validate(self, attrs):
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")
        if date_from and date_to and date_from > date_to:
            raise serializers.ValidationError(
                {"date_to": "A data final deve ser igual ou posterior a inicial."}
            )
        return attrs


class DashboardFilterSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    equipment = serializers.UUIDField(required=False)
    location = serializers.UUIDField(required=False)
    maintenance_type = serializers.UUIDField(required=False)
    priority = serializers.UUIDField(required=False)
    responsible = serializers.UUIDField(required=False)

    def validate(self, attrs):
        today = timezone.localdate()
        date_to = attrs.get("date_to", today)
        date_from = attrs.get("date_from", date_to - timedelta(days=29))
        if date_from > date_to:
            raise serializers.ValidationError(
                {"date_to": "A data final deve ser igual ou posterior a inicial."}
            )
        if (date_to - date_from).days > 730:
            raise serializers.ValidationError(
                {"date_from": "O periodo maximo para o dashboard e de 731 dias."}
            )
        attrs["date_from"] = date_from
        attrs["date_to"] = date_to
        return attrs


def apply_dimension_filters(queryset, filters):
    if filters.get("equipment"):
        queryset = queryset.filter(equipment=filters["equipment"])
    if filters.get("location"):
        queryset = queryset.filter(equipment__location=filters["location"])
    if filters.get("maintenance_type"):
        queryset = queryset.filter(maintenance_type=filters["maintenance_type"])
    if filters.get("priority"):
        queryset = queryset.filter(priority=filters["priority"])
    if filters.get("responsible"):
        queryset = queryset.filter(assigned_maintainer=filters["responsible"])
    return queryset


def apply_work_order_filters(queryset, filters):
    queryset = apply_dimension_filters(queryset, filters)
    approval = filters.get("approval", WorkOrder.ApprovalStatus.APPROVED)
    if approval != "all":
        queryset = queryset.filter(approval_status=approval)
    if filters.get("status"):
        queryset = queryset.filter(status=filters["status"])

    if filters.get("date_from"):
        queryset = queryset.filter(created_at__date__gte=filters["date_from"])
    if filters.get("date_to"):
        queryset = queryset.filter(created_at__date__lte=filters["date_to"])

    search = filters.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(number__icontains=search)
            | Q(requester__icontains=search)
            | Q(equipment_description__icontains=search)
            | Q(equipment__description__icontains=search)
            | Q(equipment__code__icontains=search)
            | Q(equipment__location__description__icontains=search)
            | Q(assigned_maintainer__name__icontains=search)
        )

    situation = filters.get("situation")
    open_query = ~Q(status__category__in=FINAL_STATUS_CATEGORIES)
    now = timezone.now()
    if situation == "open":
        queryset = queryset.filter(open_query)
    elif situation == "overdue":
        queryset = queryset.filter(open_query, due_at__lt=now)
    elif situation == "due_today":
        queryset = queryset.filter(
            open_query,
            due_at__date=timezone.localdate(),
        )
    elif situation == "unassigned":
        queryset = queryset.filter(open_query, assigned_maintainer__isnull=True)
    elif situation == "waiting_parts":
        queryset = queryset.filter(
            open_query,
            status__category=WorkOrderStatus.Category.WAITING_PARTS,
        )
    elif situation == "emergency":
        queryset = queryset.filter(
            open_query,
            priority__severity__in=("critical", "emergency"),
        )
    return queryset.distinct()
