import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.assets.models import Equipment, EquipmentFamily, Location
from apps.inventory.models import Material
from apps.maintenance.models import (
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
    WorkOrderSequence,
    WorkOrderStatus,
    WorkService,
)
from apps.maintenance.services import recalculate_work_order_totals
from apps.workforce.models import Maintainer, ServiceProvider

from .contracts import ENTITY_FIELDS

ZERO = Decimal("0")

UNIT_FROM_LEGACY = {
    "kg": Material.Unit.KILOGRAM,
    "unidade": Material.Unit.UNIT,
    "litro": Material.Unit.LITER,
    "metro": Material.Unit.METER,
    "metro quadrado": Material.Unit.SQUARE_METER,
    "metro cúbico": Material.Unit.CUBIC_METER,
    "metro cubico": Material.Unit.CUBIC_METER,
    "hora": Material.Unit.HOUR,
}
UNIT_TO_LEGACY = {value: label for value, label in Material.Unit.choices}


class LegacyDataError(ValueError):
    def __init__(self, errors):
        super().__init__("O arquivo possui dados invalidos.")
        self.errors = errors


@dataclass
class ImportResult:
    entity: str
    total: int = 0
    created: int = 0
    updated: int = 0

    def as_dict(self):
        return {
            "entity": self.entity,
            "total": self.total,
            "created": self.created,
            "updated": self.updated,
        }


def external_id(instance):
    return instance.legacy_id or str(instance.pk)


def base_row(instance):
    return {
        "id": external_id(instance),
        "created_date": instance.created_at.isoformat(),
        "updated_date": instance.updated_at.isoformat(),
    }


def as_text(value):
    return str(value or "").strip()


def as_decimal(value, default=ZERO):
    if value in (None, ""):
        return default
    if isinstance(value, Decimal):
        return value
    text = str(value).strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f'Valor numerico invalido: "{value}".') from exc


def as_int(value, default=0):
    if value in (None, ""):
        return default
    try:
        return int(Decimal(str(value)))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f'Valor inteiro invalido: "{value}".') from exc


def as_bool(value, default=False):
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "sim", "s", "yes"}


def approval_status_from_row(row):
    value = as_text(
        row.get("approval_status")
        or row.get("aprovacao_status")
        or row.get("status_aprovacao")
    ).lower()
    aliases = {
        "pending": WorkOrder.ApprovalStatus.PENDING,
        "pendente": WorkOrder.ApprovalStatus.PENDING,
        "approved": WorkOrder.ApprovalStatus.APPROVED,
        "aprovada": WorkOrder.ApprovalStatus.APPROVED,
        "aprovado": WorkOrder.ApprovalStatus.APPROVED,
        "rejected": WorkOrder.ApprovalStatus.REJECTED,
        "recusada": WorkOrder.ApprovalStatus.REJECTED,
        "recusado": WorkOrder.ApprovalStatus.REJECTED,
    }
    return aliases.get(value, WorkOrder.ApprovalStatus.APPROVED)


def as_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def as_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def as_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        result = value
    else:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if timezone.is_naive(result):
        result = timezone.make_aware(result)
    return result


def combine_legacy_datetime(date_value, time_value):
    parsed_date = as_date(date_value)
    if parsed_date is None:
        return None
    parsed_time = time.min
    if time_value not in (None, ""):
        parsed_time = time.fromisoformat(str(time_value)[:8])
    return timezone.make_aware(datetime.combine(parsed_date, parsed_time))


def split_legacy_datetime(value):
    if value is None:
        return "", ""
    local_value = timezone.localtime(value)
    return local_value.date().isoformat(), local_value.time().strftime("%H:%M")


def find_by_external_id(model, value):
    identifier = as_text(value)
    if not identifier:
        return None

    query = Q(legacy_id=identifier)
    try:
        query |= Q(pk=uuid.UUID(identifier))
    except ValueError:
        pass
    return model.objects.filter(query).first()


def upsert_object(model, row, defaults, natural_query=None):
    identifier = as_text(row.get("id"))
    instance = find_by_external_id(model, identifier)
    if instance is None and natural_query:
        instance = model.objects.filter(**natural_query).first()

    created = instance is None
    if created:
        instance = model()

    for field, value in defaults.items():
        setattr(instance, field, value)
    if identifier and not instance.legacy_id and str(instance.pk) != identifier:
        instance.legacy_id = identifier
    instance.full_clean(exclude=["legacy_id"])
    instance.save()

    timestamp_updates = {}
    created_at = as_datetime(row.get("created_date"))
    updated_at = as_datetime(row.get("updated_date"))
    if created_at:
        timestamp_updates["created_at"] = created_at
    if updated_at:
        timestamp_updates["updated_at"] = updated_at
    if timestamp_updates:
        model.objects.filter(pk=instance.pk).update(**timestamp_updates)
        instance.refresh_from_db()
    return instance, created


def resolve_named(model, identifier, description, *, required=False):
    instance = find_by_external_id(model, identifier)
    if instance is None and as_text(description):
        instance, _ = model.objects.get_or_create(
            description=as_text(description),
            defaults={"legacy_id": as_text(identifier) or None},
        )
    if required and instance is None:
        raise ValueError(f"Referencia obrigatoria nao encontrada: {description or identifier}.")
    return instance


def attachment_rows(instance, category=None):
    content_type = ContentType.objects.get_for_model(instance)
    queryset = Attachment.objects.filter(
        content_type=content_type,
        object_id=instance.pk,
    )
    if category:
        queryset = queryset.filter(category=category)
    return [
        {
            "url": attachment.url,
            "nome": attachment.original_name,
            "tipo": attachment.media_type,
            "tamanho": attachment.size,
        }
        for attachment in queryset.order_by("created_at")
    ]


def replace_attachments(instance, items, category):
    content_type = ContentType.objects.get_for_model(instance)
    Attachment.objects.filter(
        content_type=content_type,
        object_id=instance.pk,
        category=category,
    ).delete()
    Attachment.objects.bulk_create(
        [
            Attachment(
                content_type=content_type,
                object_id=instance.pk,
                category=category,
                url=as_text(item.get("url")),
                original_name=as_text(item.get("nome") or item.get("name")),
                media_type=as_text(item.get("tipo") or item.get("type")),
                size=max(0, as_int(item.get("tamanho") or item.get("size"), 0)),
            )
            for item in as_list(items)
            if as_text(item.get("url"))
        ]
    )


def delete_attachments(instance):
    content_type = ContentType.objects.get_for_model(instance)
    Attachment.objects.filter(
        content_type=content_type,
        object_id=instance.pk,
    ).delete()


def export_named(queryset):
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
        }
        for instance in queryset
    ]


def export_maintenance_types():
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
            "categoria": instance.category,
        }
        for instance in MaintenanceType.objects.filter(active=True)
    ]


def export_work_order_statuses():
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
            "categoria": instance.category,
            "inicial": instance.is_initial,
            "final": instance.is_final,
            "ordem": instance.order,
        }
        for instance in WorkOrderStatus.objects.filter(active=True)
    ]


def export_locations():
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
            "setor": instance.sector,
            "observacoes": instance.notes,
        }
        for instance in Location.objects.all()
    ]


def export_equipment():
    rows = []
    queryset = Equipment.objects.select_related("location", "family", "parent")
    for instance in queryset:
        rows.append(
            {
                **base_row(instance),
                "codigo": instance.code,
                "descricao": instance.description,
                "marca": instance.brand,
                "modelo": instance.model,
                "fabricante": instance.manufacturer,
                "numero_serie": instance.serial_number,
                "localizacao_id": external_id(instance.location) if instance.location else "",
                "localizacao_celula": instance.location.description if instance.location else "",
                "localizacao_setor": instance.location.sector if instance.location else "",
                "familia_id": external_id(instance.family) if instance.family else "",
                "status": "Ativo" if instance.status == Equipment.Status.ACTIVE else "Inativo",
                "parent_id": external_id(instance.parent) if instance.parent else "",
                "pecas_por_hora": instance.parts_per_hour,
                "imagens": attachment_rows(instance, Attachment.Category.IMAGE),
                "componentes": [],
            }
        )
    return rows


def export_materials():
    return [
        {
            **base_row(instance),
            "codigo": instance.code,
            "codigo_compra": instance.purchase_code,
            "nome": instance.name,
            "unidade_medida": UNIT_TO_LEGACY.get(instance.unit, instance.unit),
            "custo": instance.unit_cost,
            "centro_custo": instance.cost_center.description if instance.cost_center else "",
            "fornecedor": instance.supplier_name,
            "fornecedor_cnpj": instance.supplier_tax_id,
            "data_compra": instance.purchased_on.isoformat() if instance.purchased_on else "",
        }
        for instance in Material.objects.select_related("cost_center")
    ]


def export_maintainers():
    return [
        {
            **base_row(instance),
            "nome": instance.name,
            "cargo": instance.position,
            "custo_hora": instance.hourly_cost,
        }
        for instance in Maintainer.objects.all()
    ]


def export_providers():
    return [
        {
            **base_row(instance),
            "nome_empresa": instance.company_name,
            "cnpj": instance.tax_id,
            "contato1": instance.primary_phone,
            "contato2": instance.secondary_phone,
            "email": instance.email,
            "servicos_prestados": instance.services_description,
        }
        for instance in ServiceProvider.objects.all()
    ]


def export_priorities():
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
            "cor": instance.color,
            "ordem": instance.order,
            "severidade": instance.severity,
        }
        for instance in Priority.objects.filter(active=True)
    ]


def export_cost_centers():
    return [
        {
            **base_row(instance),
            "descricao": instance.description,
            "codigo": instance.code,
        }
        for instance in CostCenter.objects.all()
    ]


def export_notifications():
    return [
        {
            **base_row(instance),
            "ordem_servico_id": external_id(instance.work_order),
            "tipo_notificacao": instance.notification_type,
            "mensagem": instance.message,
            "foi_lida": instance.is_read,
            "data_leitura": instance.read_at.isoformat() if instance.read_at else "",
        }
        for instance in Notification.objects.select_related("work_order")
    ]


def export_work_orders():
    rows = []
    queryset = (
        WorkOrder.objects.select_related(
            "maintenance_type",
            "status",
            "area",
            "priority",
        )
        .prefetch_related(
            "equipment_links__equipment",
            "services__maintainers__maintainer",
            "materials__material",
            "outsourced_services__provider",
            "outsourced_services__cost_center",
            "other_costs",
        )
        .order_by("created_at")
    )
    for instance in queryset:
        equipment = [
            {
                "equipamento_id": external_id(link.equipment),
                "equipamento_nome": link.equipment_name,
                "localizacao": link.location_name,
                "hierarquia": link.hierarchy,
            }
            for link in instance.equipment_links.all()
        ]
        services = []
        for service in instance.services.all():
            maintainers = []
            hours_by_maintainer = {}
            for assignment in service.maintainers.all():
                maintainer_id = external_id(assignment.maintainer)
                maintainers.append(
                    {
                        "mantenedor_id": maintainer_id,
                        "mantenedor_nome": assignment.maintainer.name,
                        "custo_hora": assignment.hourly_cost,
                    }
                )
                hours_by_maintainer[maintainer_id] = assignment.hours
            start_date, start_time = split_legacy_datetime(service.started_at)
            end_date, end_time = split_legacy_datetime(service.ended_at)
            services.append(
                {
                    "mantenedores": maintainers,
                    "data_inicio": start_date,
                    "hora_inicio": start_time,
                    "data_fim": end_date,
                    "hora_fim": end_time,
                    "defeito_identificado": service.identified_defect,
                    "atividade": service.activity,
                    "total_horas": service.total_hours,
                    "valor_total": service.total_amount,
                    "horas_por_mantenedor": hours_by_maintainer,
                    "anexos": attachment_rows(service, Attachment.Category.IMAGE),
                }
            )
        materials = [
            {
                "material_id": external_id(item.material),
                "codigo": item.material_code,
                "nome": item.material_name,
                "unidade": item.unit,
                "custo_unitario": item.unit_cost,
                "quantidade": item.quantity,
                "custo_total": item.total_cost,
                "anexos": attachment_rows(item, Attachment.Category.IMAGE),
            }
            for item in instance.materials.all()
        ]
        outsourced = []
        for item in instance.outsourced_services.all():
            outsourced.append(
                {
                    "prestadora_id": external_id(item.provider),
                    "prestadora_nome": item.provider.company_name,
                    "data_servico": item.service_date.isoformat() if item.service_date else "",
                    "descricao_servico": item.description,
                    "valor_servico": item.amount,
                    "centro_custo_id": external_id(item.cost_center) if item.cost_center else "",
                    "centro_custo_nome": item.cost_center.description if item.cost_center else "",
                    "anexos": attachment_rows(item, Attachment.Category.IMAGE),
                    "documentos": attachment_rows(
                        item,
                        Attachment.Category.DOCUMENT,
                    ),
                }
            )
        other = [
            {
                "descricao": item.description,
                "unidade": item.unit,
                "custo_unitario": item.unit_cost,
                "quantidade": item.quantity,
                "custo_total": item.total_cost,
                "anexos": attachment_rows(item, Attachment.Category.FILE),
            }
            for item in instance.other_costs.all()
        ]
        scheduled_date, scheduled_time = split_legacy_datetime(instance.scheduled_at)
        due_date, due_time = split_legacy_datetime(instance.due_at)
        completed_date, completed_time = split_legacy_datetime(instance.completed_at)
        first_equipment = equipment[0] if equipment else {}
        rows.append(
            {
                **base_row(instance),
                "numero": instance.number,
                "equipamento_id": first_equipment.get("equipamento_id", ""),
                "equipamento_nome": (
                    first_equipment.get("equipamento_nome", "")
                    or instance.equipment_description
                ),
                "equipamento_descricao_livre": instance.equipment_description,
                "equipamento_nao_cadastrado": bool(instance.equipment_description),
                "equipamentos": equipment,
                "local": first_equipment.get("localizacao", ""),
                "localizacao_celula": first_equipment.get("localizacao", ""),
                "localizacao_setor": "",
                "tipo_id": external_id(instance.maintenance_type),
                "tipo_nome": instance.maintenance_type.description,
                "status_id": external_id(instance.status),
                "status_nome": instance.status.description,
                "area_id": external_id(instance.area) if instance.area else "",
                "area_nome": instance.area.description if instance.area else "",
                "prioridade_id": external_id(instance.priority) if instance.priority else "",
                "prioridade_nome": instance.priority.description if instance.priority else "",
                "solicitante": instance.requester,
                "data_programada": scheduled_date,
                "hora_programada": scheduled_time,
                "data_prazo": due_date,
                "hora_prazo": due_time,
                "data_finalizada": completed_date,
                "hora_finalizada": completed_time,
                "responsavel_id": (
                    external_id(instance.assigned_maintainer)
                    if instance.assigned_maintainer
                    else ""
                ),
                "responsavel_nome": (
                    instance.assigned_maintainer.name
                    if instance.assigned_maintainer
                    else ""
                ),
                "maquina_parada": instance.machine_stopped,
                "tempo_parada_manual": instance.manual_downtime_minutes,
                "observacoes": instance.notes,
                "descricao_defeito": instance.defect_description,
                "servicos": services,
                "materiais": materials,
                "terceirizados": outsourced,
                "outros": other,
                "valor_total_servicos": instance.services_total,
                "valor_total_materiais": instance.materials_total,
                "valor_total_terceirizados": instance.outsourced_total,
                "valor_total_outros": instance.other_total,
                "valor_total_geral": instance.grand_total,
                "tempo_parado_em_minutos": instance.downtime_minutes,
                "aprovacao_status": instance.approval_status,
                "motivo_recusa": instance.rejection_reason,
                "data_aprovacao": (
                    instance.approved_at.isoformat() if instance.approved_at else ""
                ),
                "anexos": attachment_rows(instance),
            }
        )
    return rows


EXPORTERS = {
    "OrdemServico": export_work_orders,
    "Equipamento": export_equipment,
    "Material": export_materials,
    "Mantenedor": export_maintainers,
    "TipoManutencao": export_maintenance_types,
    "StatusOS": export_work_order_statuses,
    "AreaManutencao": lambda: export_named(MaintenanceArea.objects.filter(active=True)),
    "FamiliaEquipamento": lambda: export_named(EquipmentFamily.objects.all()),
    "PrestadoraServico": export_providers,
    "Localizacao": export_locations,
    "Prioridade": export_priorities,
    "CentroCusto": export_cost_centers,
    "NotificacaoOS": export_notifications,
}

ENTITY_MODELS = {
    "OrdemServico": WorkOrder,
    "Equipamento": Equipment,
    "Material": Material,
    "Mantenedor": Maintainer,
    "TipoManutencao": MaintenanceType,
    "StatusOS": WorkOrderStatus,
    "AreaManutencao": MaintenanceArea,
    "FamiliaEquipamento": EquipmentFamily,
    "PrestadoraServico": ServiceProvider,
    "Localizacao": Location,
    "Prioridade": Priority,
    "CentroCusto": CostCenter,
    "NotificacaoOS": Notification,
}


def export_entity(entity_name):
    try:
        exporter = EXPORTERS[entity_name]
        fields = ENTITY_FIELDS[entity_name]
    except KeyError as exc:
        raise LegacyDataError([{"entity": "Entidade nao suportada."}]) from exc
    return fields, exporter()


def find_entity_instance(entity_name, identifier):
    try:
        model = ENTITY_MODELS[entity_name]
    except KeyError as exc:
        raise LegacyDataError([{"entity": "Entidade nao suportada."}]) from exc
    return find_by_external_id(model, identifier)


def export_entity_row(entity_name, identifier):
    _, rows = export_entity(entity_name)
    normalized_id = as_text(identifier)
    return next(
        (row for row in rows if as_text(row.get("id")) == normalized_id),
        None,
    )


@transaction.atomic
def reserve_work_order_number():
    sequence, _ = WorkOrderSequence.objects.select_for_update().get_or_create(
        key="work_order",
        defaults={"current_value": 0},
    )
    sequence.current_value += 1
    sequence.save(update_fields=["current_value", "updated_at"])
    return f"OS-{sequence.current_value:06d}"


def import_named(model, row, result, extra_defaults=None):
    description = as_text(row.get("descricao"))
    if not description:
        raise ValueError("O campo descricao e obrigatorio.")
    defaults = {"description": description, **(extra_defaults or {})}
    if any(field.name == "active" for field in model._meta.fields):
        defaults["active"] = True
    _, created = upsert_object(
        model,
        row,
        defaults,
        natural_query={"description": description},
    )
    result.created += int(created)
    result.updated += int(not created)


def import_location(row, result):
    description = as_text(row.get("descricao"))
    sector = as_text(row.get("setor"))
    if not description:
        raise ValueError("O campo descricao e obrigatorio.")
    _, created = upsert_object(
        Location,
        row,
        {
            "description": description,
            "sector": sector,
            "notes": as_text(row.get("observacoes")),
        },
        natural_query={"description": description, "sector": sector},
    )
    result.created += int(created)
    result.updated += int(not created)


def import_maintainer(row, result):
    name = as_text(row.get("nome"))
    if not name:
        raise ValueError("O campo nome e obrigatorio.")
    _, created = upsert_object(
        Maintainer,
        row,
        {
            "name": name,
            "position": as_text(row.get("cargo")) or "Nao informado",
            "hourly_cost": as_decimal(row.get("custo_hora")),
            "active": True,
        },
    )
    result.created += int(created)
    result.updated += int(not created)


def import_provider(row, result):
    company_name = as_text(row.get("nome_empresa"))
    if not company_name:
        raise ValueError("O campo nome_empresa e obrigatorio.")
    tax_id = as_text(row.get("cnpj")) or None
    _, created = upsert_object(
        ServiceProvider,
        row,
        {
            "company_name": company_name,
            "tax_id": tax_id,
            "primary_phone": as_text(row.get("contato1")),
            "secondary_phone": as_text(row.get("contato2")),
            "email": as_text(row.get("email")),
            "services_description": as_text(row.get("servicos_prestados")),
            "active": True,
        },
        natural_query={"tax_id": tax_id} if tax_id else None,
    )
    result.created += int(created)
    result.updated += int(not created)


def import_material(row, result):
    code = as_text(row.get("codigo"))
    name = as_text(row.get("nome"))
    if not code or not name:
        raise ValueError("Os campos codigo e nome sao obrigatorios.")
    center_name = as_text(row.get("centro_custo"))
    cost_center = None
    if center_name:
        cost_center, _ = CostCenter.objects.get_or_create(description=center_name)
    legacy_unit = as_text(row.get("unidade_medida")).lower()
    unit = UNIT_FROM_LEGACY.get(legacy_unit)
    if not unit:
        raise ValueError(f"Unidade de medida invalida: {row.get('unidade_medida')}.")
    _, created = upsert_object(
        Material,
        row,
        {
            "code": code,
            "purchase_code": as_text(row.get("codigo_compra")),
            "name": name,
            "unit": unit,
            "unit_cost": as_decimal(row.get("custo")),
            "cost_center": cost_center,
            "supplier_name": as_text(row.get("fornecedor")),
            "supplier_tax_id": re.sub(
                r"\D",
                "",
                as_text(row.get("fornecedor_cnpj")),
            )[:14],
            "purchased_on": as_date(row.get("data_compra")),
            "active": True,
        },
        natural_query={"code": code},
    )
    result.created += int(created)
    result.updated += int(not created)


def import_priority(row, result):
    severity = as_text(row.get("severidade"))
    valid_severities = {choice[0] for choice in Priority.Severity.choices}
    import_named(
        Priority,
        row,
        result,
        {
            "color": as_text(row.get("cor")) or "#64748B",
            "order": max(0, as_int(row.get("ordem"), 0)),
            "severity": severity if severity in valid_severities else Priority.Severity.NORMAL,
        },
    )


def import_cost_center(row, result):
    description = as_text(row.get("descricao"))
    if not description:
        raise ValueError("O campo descricao e obrigatorio.")
    _, created = upsert_object(
        CostCenter,
        row,
        {
            "description": description,
            "code": as_text(row.get("codigo")) or None,
            "active": True,
        },
        natural_query={"description": description},
    )
    result.created += int(created)
    result.updated += int(not created)


def import_notification(row, result):
    work_order = find_by_external_id(WorkOrder, row.get("ordem_servico_id"))
    if work_order is None:
        raise ValueError(f"Ordem da notificacao nao encontrada: {row.get('ordem_servico_id')}.")
    message = as_text(row.get("mensagem"))
    if not message:
        raise ValueError("O campo mensagem e obrigatorio.")
    _, created = upsert_object(
        Notification,
        row,
        {
            "work_order": work_order,
            "notification_type": as_text(row.get("tipo_notificacao"))
            or Notification.Type.WORK_ORDER_UPDATED,
            "message": message,
            "is_read": as_bool(row.get("foi_lida")),
            "read_at": as_datetime(row.get("data_leitura")),
        },
    )
    result.created += int(created)
    result.updated += int(not created)


def import_equipment(rows, result):
    pending_parents = []
    for row in rows:
        description = as_text(row.get("descricao"))
        if not description:
            raise ValueError("O campo descricao e obrigatorio.")
        location = find_by_external_id(Location, row.get("localizacao_id"))
        if location is None and as_text(row.get("localizacao_celula")):
            location, _ = Location.objects.get_or_create(
                description=as_text(row.get("localizacao_celula")),
                sector=as_text(row.get("localizacao_setor")),
            )
        family = find_by_external_id(EquipmentFamily, row.get("familia_id"))
        code = as_text(row.get("codigo")) or None
        status = (
            Equipment.Status.INACTIVE
            if as_text(row.get("status")).lower() == "inativo"
            else Equipment.Status.ACTIVE
        )
        instance, created = upsert_object(
            Equipment,
            row,
            {
                "code": code,
                "description": description,
                "brand": as_text(row.get("marca")),
                "model": as_text(row.get("modelo")),
                "manufacturer": as_text(row.get("fabricante")),
                "serial_number": as_text(row.get("numero_serie")),
                "location": location,
                "family": family,
                "parent": None,
                "status": status,
                "parts_per_hour": as_decimal(
                    row.get("pecas_por_hora"),
                    default=None,
                ),
            },
            natural_query={"code": code} if code else None,
        )
        replace_attachments(
            instance,
            row.get("imagens"),
            Attachment.Category.IMAGE,
        )
        pending_parents.append((instance, row.get("parent_id")))
        result.created += int(created)
        result.updated += int(not created)

    for instance, parent_id in pending_parents:
        if not as_text(parent_id):
            continue
        parent = find_by_external_id(Equipment, parent_id)
        if parent is None:
            raise ValueError(f"Equipamento pai nao encontrado: {parent_id}.")
        if parent.pk == instance.pk:
            raise ValueError("Um equipamento nao pode ser pai de si mesmo.")
        instance.parent = parent
        instance.full_clean()
        instance.save(update_fields=["parent", "updated_at"])


def get_or_create_maintainer(item):
    instance = find_by_external_id(Maintainer, item.get("mantenedor_id"))
    if instance:
        return instance
    name = as_text(item.get("mantenedor_nome"))
    if not name:
        raise ValueError("Mantenedor da OS sem nome ou identificador.")
    return Maintainer.objects.create(
        legacy_id=as_text(item.get("mantenedor_id")) or None,
        name=name,
        position="Importado",
        hourly_cost=as_decimal(item.get("custo_hora")),
    )


def get_or_create_material(item):
    instance = find_by_external_id(Material, item.get("material_id"))
    if instance:
        return instance
    code = as_text(item.get("codigo")) or f"IMPORT-{uuid.uuid4().hex[:10]}"
    unit_label = as_text(item.get("unidade")).lower()
    return Material.objects.create(
        legacy_id=as_text(item.get("material_id")) or None,
        code=code,
        name=as_text(item.get("nome")) or code,
        unit=UNIT_FROM_LEGACY.get(unit_label, Material.Unit.UNIT),
        unit_cost=as_decimal(item.get("custo_unitario")),
    )


def get_or_create_provider(item):
    instance = find_by_external_id(ServiceProvider, item.get("prestadora_id"))
    if instance:
        return instance
    name = as_text(item.get("prestadora_nome"))
    if not name:
        raise ValueError("Prestadora da OS sem nome ou identificador.")
    return ServiceProvider.objects.create(
        legacy_id=as_text(item.get("prestadora_id")) or None,
        company_name=name,
    )


def clear_work_order_children(work_order):
    delete_attachments(work_order)
    for service in work_order.services.all():
        delete_attachments(service)
    for material in work_order.materials.all():
        delete_attachments(material)
    for outsourced in work_order.outsourced_services.all():
        delete_attachments(outsourced)
    for other in work_order.other_costs.all():
        delete_attachments(other)
    work_order.services.all().delete()
    work_order.materials.all().delete()
    work_order.outsourced_services.all().delete()
    work_order.other_costs.all().delete()
    work_order.equipment_links.all().delete()


def import_work_order_children(work_order, row):
    equipment_items = as_list(row.get("equipamentos"))
    if not equipment_items and as_text(row.get("equipamento_id")):
        equipment_items = [
            {
                "equipamento_id": row.get("equipamento_id"),
                "equipamento_nome": row.get("equipamento_nome"),
                "localizacao": row.get("localizacao_celula") or row.get("local"),
            }
        ]
    for item in equipment_items:
        equipment = find_by_external_id(Equipment, item.get("equipamento_id"))
        if equipment is None:
            raise ValueError(f"Equipamento da OS nao encontrado: {item.get('equipamento_id')}.")
        WorkOrderEquipment.objects.create(
            work_order=work_order,
            equipment=equipment,
            equipment_name=as_text(item.get("equipamento_nome")) or equipment.description,
            location_name=as_text(item.get("localizacao")),
            hierarchy=as_list(item.get("hierarquia")),
        )

    for item in as_list(row.get("servicos")):
        service = WorkService.objects.create(
            work_order=work_order,
            identified_defect=as_text(item.get("defeito_identificado")),
            activity=as_text(item.get("atividade")) or "Atividade importada",
            started_at=combine_legacy_datetime(
                item.get("data_inicio"),
                item.get("hora_inicio"),
            ),
            ended_at=combine_legacy_datetime(
                item.get("data_fim"),
                item.get("hora_fim"),
            ),
            total_hours=as_decimal(item.get("total_horas")),
            total_amount=as_decimal(item.get("valor_total")),
        )
        hours_by_maintainer = item.get("horas_por_mantenedor")
        if not isinstance(hours_by_maintainer, dict):
            hours_by_maintainer = {}
        for maintainer_item in as_list(item.get("mantenedores")):
            maintainer = get_or_create_maintainer(maintainer_item)
            maintainer_id = as_text(maintainer_item.get("mantenedor_id"))
            hours = as_decimal(hours_by_maintainer.get(maintainer_id, item.get("total_horas")))
            hourly_cost = as_decimal(maintainer_item.get("custo_hora"))
            ServiceMaintainer.objects.create(
                service=service,
                maintainer=maintainer,
                hourly_cost=hourly_cost,
                hours=hours,
                amount=hours * hourly_cost,
            )
        replace_attachments(
            service,
            item.get("anexos"),
            Attachment.Category.IMAGE,
        )

    for item in as_list(row.get("materiais")):
        material = get_or_create_material(item)
        usage = WorkOrderMaterial.objects.create(
            work_order=work_order,
            material=material,
            material_code=as_text(item.get("codigo")) or material.code,
            material_name=as_text(item.get("nome")) or material.name,
            unit=as_text(item.get("unidade")) or UNIT_TO_LEGACY.get(material.unit),
            unit_cost=as_decimal(item.get("custo_unitario")),
            quantity=as_decimal(item.get("quantidade")),
            total_cost=as_decimal(item.get("custo_total")),
        )
        replace_attachments(
            usage,
            item.get("anexos"),
            Attachment.Category.IMAGE,
        )

    for item in as_list(row.get("terceirizados")):
        provider = get_or_create_provider(item)
        cost_center = resolve_named(
            CostCenter,
            item.get("centro_custo_id"),
            item.get("centro_custo_nome"),
        )
        outsourced = OutsourcedService.objects.create(
            work_order=work_order,
            provider=provider,
            service_date=as_date(item.get("data_servico")),
            description=as_text(item.get("descricao_servico")) or "Servico importado",
            amount=as_decimal(item.get("valor_servico")),
            cost_center=cost_center,
        )
        replace_attachments(
            outsourced,
            item.get("anexos"),
            Attachment.Category.IMAGE,
        )
        replace_attachments(
            outsourced,
            item.get("documentos"),
            Attachment.Category.DOCUMENT,
        )

    other_items = row.get("outros")
    if not as_list(other_items):
        other_items = row.get("outrosCustos")
    for item in as_list(other_items):
        other = OtherCost.objects.create(
            work_order=work_order,
            description=as_text(item.get("descricao")) or "Custo importado",
            unit=as_text(item.get("unidade")),
            unit_cost=as_decimal(item.get("custo_unitario")),
            quantity=as_decimal(item.get("quantidade")),
            total_cost=as_decimal(item.get("custo_total")),
        )
        replace_attachments(
            other,
            item.get("anexos"),
            Attachment.Category.FILE,
        )

    replace_attachments(work_order, row.get("anexos"), Attachment.Category.FILE)


def import_work_order(row, result):
    number = as_text(row.get("numero"))
    if not number:
        raise ValueError("O campo numero e obrigatorio.")
    maintenance_type = resolve_named(
        MaintenanceType,
        row.get("tipo_id"),
        row.get("tipo_nome"),
        required=True,
    )
    status = resolve_named(
        WorkOrderStatus,
        row.get("status_id"),
        row.get("status_nome"),
        required=True,
    )
    area = resolve_named(
        MaintenanceArea,
        row.get("area_id"),
        row.get("area_nome"),
    )
    priority = resolve_named(
        Priority,
        row.get("prioridade_id"),
        row.get("prioridade_nome"),
    )
    assigned_maintainer = find_by_external_id(
        Maintainer,
        row.get("responsavel_id"),
    )
    if assigned_maintainer is None and as_text(row.get("responsavel_nome")):
        assigned_maintainer = Maintainer.objects.filter(
            name__iexact=as_text(row.get("responsavel_nome"))
        ).first()
    work_order, created = upsert_object(
        WorkOrder,
        row,
        {
            "number": number,
            "maintenance_type": maintenance_type,
            "status": status,
            "area": area,
            "priority": priority,
            "requester": as_text(row.get("solicitante")),
            "equipment_description": as_text(row.get("equipamento_descricao_livre")) or "",
            "scheduled_at": combine_legacy_datetime(
                row.get("data_programada"),
                row.get("hora_programada"),
            ),
            "due_at": combine_legacy_datetime(
                row.get("data_prazo"),
                row.get("hora_prazo"),
            ),
            "completed_at": combine_legacy_datetime(
                row.get("data_finalizada"),
                row.get("hora_finalizada"),
            ),
            "assigned_maintainer": assigned_maintainer,
            "machine_stopped": as_bool(row.get("maquina_parada"), True),
            "manual_downtime_minutes": (
                as_int(row.get("tempo_parada_manual"))
                if row.get("tempo_parada_manual") not in (None, "")
                else None
            ),
            "downtime_minutes": max(
                0,
                as_int(row.get("tempo_parado_em_minutos"), 0),
            ),
            "notes": as_text(row.get("observacoes")),
            "defect_description": as_text(row.get("descricao_defeito")),
            "approval_status": approval_status_from_row(row),
            "rejection_reason": as_text(
                row.get("motivo_recusa") or row.get("rejection_reason")
            ),
            "approved_at": as_datetime(
                row.get("data_aprovacao") or row.get("approved_at")
            ),
        },
        natural_query={"number": number},
    )
    clear_work_order_children(work_order)
    import_work_order_children(work_order, row)
    recalculate_work_order_totals(work_order)

    match = re.fullmatch(r"OS-(\d+)", number, re.IGNORECASE)
    if match:
        sequence, _ = WorkOrderSequence.objects.select_for_update().get_or_create(key="work_order")
        imported_value = int(match.group(1))
        if imported_value > sequence.current_value:
            sequence.current_value = imported_value
            sequence.save(update_fields=["current_value", "updated_at"])

    result.created += int(created)
    result.updated += int(not created)


ROW_IMPORTERS = {
    "Material": import_material,
    "Mantenedor": import_maintainer,
    "TipoManutencao": lambda row, result: import_named(
        MaintenanceType,
        row,
        result,
        {
            "category": (
                as_text(row.get("categoria"))
                if as_text(row.get("categoria"))
                in {choice[0] for choice in MaintenanceType.Category.choices}
                else MaintenanceType.Category.OTHER
            )
        },
    ),
    "StatusOS": lambda row, result: import_named(
        WorkOrderStatus,
        row,
        result,
        {
            "category": (
                as_text(row.get("categoria"))
                if as_text(row.get("categoria"))
                in {choice[0] for choice in WorkOrderStatus.Category.choices}
                else WorkOrderStatus.Category.OTHER
            ),
            "is_initial": as_bool(row.get("inicial")),
            "is_final": as_bool(row.get("final")),
            "order": max(0, as_int(row.get("ordem"), 0)),
        },
    ),
    "AreaManutencao": lambda row, result: import_named(
        MaintenanceArea,
        row,
        result,
    ),
    "FamiliaEquipamento": lambda row, result: import_named(
        EquipmentFamily,
        row,
        result,
    ),
    "PrestadoraServico": import_provider,
    "Localizacao": import_location,
    "Prioridade": import_priority,
    "CentroCusto": import_cost_center,
    "OrdemServico": import_work_order,
    "NotificacaoOS": import_notification,
}


@transaction.atomic
def import_entity(entity_name, rows):
    if entity_name not in ENTITY_FIELDS:
        raise LegacyDataError([{"entity": "Entidade nao suportada."}])

    result = ImportResult(entity=entity_name, total=len(rows))
    errors = []
    if entity_name == "Equipamento":
        try:
            import_equipment(rows, result)
        except (DjangoValidationError, IntegrityError, ValueError, TypeError) as exc:
            errors.append({"row": None, "message": str(exc)})
    else:
        importer = ROW_IMPORTERS[entity_name]
        for index, row in enumerate(rows, start=2):
            try:
                importer(row, result)
            except (
                DjangoValidationError,
                IntegrityError,
                ValueError,
                TypeError,
            ) as exc:
                errors.append({"row": index, "message": str(exc)})

    if errors:
        raise LegacyDataError(errors)
    return result
