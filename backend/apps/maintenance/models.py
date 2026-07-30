from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from apps.common.models import LegacyMappedModel, TimeStampedModel

money_validators = [MinValueValidator(0)]
color_validator = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="Use uma cor hexadecimal no formato #RRGGBB.",
)


class NamedReference(LegacyMappedModel):
    description = models.CharField(max_length=180, unique=True)
    active = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ["description"]

    def __str__(self):
        return self.description


class MaintenanceArea(NamedReference):
    pass


class MaintenanceType(NamedReference):
    class Category(models.TextChoices):
        CORRECTIVE = "corrective", "Corretiva"
        PREVENTIVE = "preventive", "Preventiva"
        PREDICTIVE = "predictive", "Preditiva"
        EMERGENCY = "emergency", "Emergencial"
        IMPROVEMENT = "improvement", "Melhoria"
        RELOCATION = "relocation", "Realocacao"
        OUTSOURCED = "outsourced", "Terceirizada"
        OTHER = "other", "Outra"

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
        db_index=True,
    )


class WorkOrderStatus(NamedReference):
    class Category(models.TextChoices):
        OPEN = "open", "Aberta"
        IN_PROGRESS = "in_progress", "Em andamento"
        WAITING_PARTS = "waiting_parts", "Aguardando pecas"
        WAITING_DOCUMENT = "waiting_document", "Aguardando documento"
        COMPLETED = "completed", "Concluida"
        CANCELLED = "cancelled", "Cancelada"
        REJECTED = "rejected", "Reprovada"
        OTHER = "other", "Outra"

    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    category = models.CharField(
        max_length=24,
        choices=Category.choices,
        default=Category.OTHER,
        db_index=True,
    )

    class Meta:
        ordering = ["order", "description"]


class Priority(NamedReference):
    class Severity(models.TextChoices):
        LOW = "low", "Baixa"
        NORMAL = "normal", "Normal"
        HIGH = "high", "Alta"
        CRITICAL = "critical", "Critica"
        EMERGENCY = "emergency", "Emergencia"

    color = models.CharField(
        max_length=7,
        default="#64748B",
        validators=[color_validator],
    )
    order = models.PositiveSmallIntegerField(default=0)
    severity = models.CharField(
        max_length=16,
        choices=Severity.choices,
        default=Severity.NORMAL,
        db_index=True,
    )

    class Meta:
        ordering = ["order", "description"]


class CostCenter(NamedReference):
    code = models.CharField(max_length=80, unique=True, null=True, blank=True)


class WorkOrderSequence(models.Model):
    key = models.CharField(max_length=32, primary_key=True)
    current_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key}: {self.current_value}"


class WorkOrder(LegacyMappedModel):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovada"
        REJECTED = "rejected", "Recusada"

    number = models.CharField(max_length=32, unique=True)
    maintenance_type = models.ForeignKey(
        MaintenanceType,
        on_delete=models.PROTECT,
        related_name="work_orders",
    )
    status = models.ForeignKey(
        WorkOrderStatus,
        on_delete=models.PROTECT,
        related_name="work_orders",
    )
    area = models.ForeignKey(
        MaintenanceArea,
        on_delete=models.PROTECT,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    priority = models.ForeignKey(
        Priority,
        on_delete=models.PROTECT,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    requester = models.CharField(max_length=180, blank=True)
    equipment_description = models.TextField(
        blank=True,
        help_text="Descricao livre quando a maquina ainda nao esta cadastrada.",
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    assigned_maintainer = models.ForeignKey(
        "workforce.Maintainer",
        on_delete=models.PROTECT,
        related_name="assigned_work_orders",
        null=True,
        blank=True,
    )
    machine_stopped = models.BooleanField(default=True)
    manual_downtime_minutes = models.PositiveIntegerField(null=True, blank=True)
    downtime_minutes = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    defect_description = models.TextField(blank=True)
    services_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    materials_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    outsourced_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    other_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    grand_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    approval_status = models.CharField(
        max_length=16,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.APPROVED,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_work_orders",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_work_orders",
        null=True,
        blank=True,
    )
    equipment = models.ManyToManyField(
        "assets.Equipment",
        through="WorkOrderEquipment",
        related_name="work_orders",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["scheduled_at"]),
            models.Index(fields=["priority", "status"]),
            models.Index(fields=["approval_status", "due_at"]),
            models.Index(fields=["assigned_maintainer", "status"]),
        ]

    def __str__(self):
        return self.number


class WorkOrderEquipment(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="equipment_links",
    )
    equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.PROTECT,
        related_name="work_order_links",
    )
    equipment_name = models.CharField(max_length=180)
    location_name = models.CharField(max_length=180, blank=True)
    hierarchy = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["work_order", "equipment"],
                name="unique_work_order_equipment",
            )
        ]


class WorkService(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="services",
    )
    identified_defect = models.TextField(blank=True)
    activity = models.TextField()
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    total_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=money_validators,
    )


class ServiceMaintainer(TimeStampedModel):
    service = models.ForeignKey(
        WorkService,
        on_delete=models.CASCADE,
        related_name="maintainers",
    )
    maintainer = models.ForeignKey(
        "workforce.Maintainer",
        on_delete=models.PROTECT,
        related_name="service_assignments",
    )
    hourly_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=money_validators,
    )
    hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=money_validators,
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["service", "maintainer"],
                name="unique_service_maintainer",
            )
        ]


class WorkOrderMaterial(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    material = models.ForeignKey(
        "inventory.Material",
        on_delete=models.PROTECT,
        related_name="work_order_usage",
    )
    material_code = models.CharField(max_length=80)
    material_name = models.CharField(max_length=180)
    unit = models.CharField(max_length=24)
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=money_validators,
    )
    total_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )


class OutsourcedService(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="outsourced_services",
    )
    provider = models.ForeignKey(
        "workforce.ServiceProvider",
        on_delete=models.PROTECT,
        related_name="work_order_services",
    )
    service_date = models.DateField(null=True, blank=True)
    description = models.TextField()
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.PROTECT,
        related_name="outsourced_services",
        null=True,
        blank=True,
    )


class OtherCost(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="other_costs",
    )
    description = models.CharField(max_length=255)
    unit = models.CharField(max_length=40, blank=True)
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=money_validators,
    )
    total_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=money_validators,
    )


class WorkOrderStatusHistory(TimeStampedModel):
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    status = models.ForeignKey(
        WorkOrderStatus,
        on_delete=models.PROTECT,
        related_name="history_entries",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="work_order_status_changes",
        null=True,
        blank=True,
    )
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at"]


class Notification(LegacyMappedModel):
    class Type(models.TextChoices):
        NEW_REQUEST = "nova_solicitacao", "Nova solicitacao"
        WORK_ORDER_UPDATED = "os_atualizada", "OS atualizada"

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=Type.choices)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["is_read", "-created_at"])]


class Attachment(TimeStampedModel):
    class Category(models.TextChoices):
        IMAGE = "image", "Imagem"
        DOCUMENT = "document", "Documento"
        FILE = "file", "Arquivo"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey("content_type", "object_id")
    category = models.CharField(
        max_length=16,
        choices=Category.choices,
        default=Category.FILE,
    )
    url = models.URLField(max_length=1000)
    original_name = models.CharField(max_length=255, blank=True)
    media_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveBigIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
        ]
