from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.assets.models import Equipment

from .models import (
    MaintenanceArea,
    MaintenanceType,
    Priority,
    WorkOrder,
    WorkOrderStatus,
)
from .services import create_work_order


class ReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ["id", "description", "active"]


class MaintenanceAreaSerializer(ReferenceSerializer):
    class Meta(ReferenceSerializer.Meta):
        model = MaintenanceArea


class MaintenanceTypeSerializer(ReferenceSerializer):
    class Meta(ReferenceSerializer.Meta):
        model = MaintenanceType
        fields = ReferenceSerializer.Meta.fields + ["category"]


class WorkOrderStatusSerializer(ReferenceSerializer):
    class Meta(ReferenceSerializer.Meta):
        model = WorkOrderStatus
        fields = ReferenceSerializer.Meta.fields + [
            "is_initial",
            "is_final",
            "order",
            "category",
        ]


class PrioritySerializer(ReferenceSerializer):
    class Meta(ReferenceSerializer.Meta):
        model = Priority
        fields = ReferenceSerializer.Meta.fields + ["color", "order", "severity"]


class WorkOrderSerializer(serializers.ModelSerializer):
    equipment_ids = serializers.PrimaryKeyRelatedField(
        source="equipment",
        queryset=Equipment.objects.select_related("location").filter(
            status=Equipment.Status.ACTIVE
        ),
        many=True,
        write_only=True,
        required=False,
    )
    equipment = serializers.SerializerMethodField()
    created_date = serializers.DateTimeField(source="created_at", read_only=True)
    updated_date = serializers.DateTimeField(source="updated_at", read_only=True)
    maintenance_type_name = serializers.CharField(
        source="maintenance_type.description",
        read_only=True,
    )
    status_name = serializers.CharField(source="status.description", read_only=True)
    status_category = serializers.CharField(source="status.category", read_only=True)
    area_name = serializers.CharField(source="area.description", read_only=True)
    priority_name = serializers.CharField(source="priority.description", read_only=True)
    priority_severity = serializers.CharField(source="priority.severity", read_only=True)
    assigned_maintainer_name = serializers.CharField(
        source="assigned_maintainer.name",
        read_only=True,
    )

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "number",
            "maintenance_type",
            "status",
            "area",
            "priority",
            "requester",
            "scheduled_at",
            "due_at",
            "completed_at",
            "assigned_maintainer",
            "machine_stopped",
            "manual_downtime_minutes",
            "downtime_minutes",
            "notes",
            "defect_description",
            "services_total",
            "materials_total",
            "outsourced_total",
            "other_total",
            "grand_total",
            "approval_status",
            "rejection_reason",
            "approved_by",
            "approved_at",
            "equipment",
            "equipment_ids",
            "maintenance_type_name",
            "status_name",
            "status_category",
            "area_name",
            "priority_name",
            "priority_severity",
            "assigned_maintainer_name",
            "created_date",
            "updated_date",
        ]
        read_only_fields = [
            "number",
            "downtime_minutes",
            "services_total",
            "materials_total",
            "outsourced_total",
            "other_total",
            "grand_total",
            "approval_status",
            "rejection_reason",
            "approved_by",
            "approved_at",
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_equipment(self, obj):
        return [
            {
                "id": str(link.equipment_id),
                "description": link.equipment_name,
                "location": link.location_name,
            }
            for link in obj.equipment_links.all()
        ]

    def validate(self, attrs):
        scheduled_at = attrs.get(
            "scheduled_at",
            getattr(self.instance, "scheduled_at", None),
        )
        completed_at = attrs.get(
            "completed_at",
            getattr(self.instance, "completed_at", None),
        )
        if scheduled_at and completed_at and completed_at < scheduled_at:
            raise serializers.ValidationError(
                {"completed_at": "A conclusao nao pode ser anterior ao agendamento."}
            )
        due_at = attrs.get("due_at", getattr(self.instance, "due_at", None))
        if scheduled_at and due_at and due_at < scheduled_at:
            raise serializers.ValidationError(
                {"due_at": "O prazo nao pode ser anterior ao agendamento."}
            )
        return attrs

    def create(self, validated_data):
        equipment = validated_data.pop("equipment", [])
        return create_work_order(
            equipment=equipment,
            created_by=self.context["request"].user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        equipment = validated_data.pop("equipment", None)
        instance = super().update(instance, validated_data)
        if equipment is not None:
            instance.equipment_links.all().delete()
            from .models import WorkOrderEquipment

            WorkOrderEquipment.objects.bulk_create(
                [
                    WorkOrderEquipment(
                        work_order=instance,
                        equipment=item,
                        equipment_name=item.description,
                        location_name=item.location.description if item.location_id else "",
                    )
                    for item in equipment
                ]
            )
        return instance
