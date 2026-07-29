from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.accounts.models import SystemModule, UserModulePermission
from apps.assets.models import Equipment
from apps.maintenance.models import (
    MaintenanceType,
    OtherCost,
    WorkOrderStatus,
    WorkService,
)
from apps.maintenance.services import create_work_order, recalculate_work_order_totals


@pytest.fixture
def work_order_dependencies():
    user = get_user_model().objects.create_user(
        username="planner",
        password="a-secure-test-password",
    )
    maintenance_type = MaintenanceType.objects.create(description="Teste")
    status = WorkOrderStatus.objects.create(
        description="Status de teste",
        is_initial=True,
    )
    equipment = Equipment.objects.create(code="EQ-001", description="Prensa")
    return user, maintenance_type, status, equipment


@pytest.mark.django_db
def test_work_order_number_is_generated_by_backend(work_order_dependencies):
    user, maintenance_type, status, equipment = work_order_dependencies

    first = create_work_order(
        maintenance_type=maintenance_type,
        status=status,
        created_by=user,
        equipment=[equipment],
    )
    second = create_work_order(
        maintenance_type=maintenance_type,
        status=status,
        created_by=user,
    )

    assert first.number == "OS-000001"
    assert second.number == "OS-000002"
    assert list(first.equipment.values_list("id", flat=True)) == [equipment.id]


@pytest.mark.django_db
def test_totals_are_recalculated_from_relational_items(work_order_dependencies):
    user, maintenance_type, status, _ = work_order_dependencies
    work_order = create_work_order(
        maintenance_type=maintenance_type,
        status=status,
        created_by=user,
    )
    WorkService.objects.create(
        work_order=work_order,
        activity="Ajuste",
        total_hours=Decimal("2.00"),
        total_amount=Decimal("150.00"),
    )
    OtherCost.objects.create(
        work_order=work_order,
        description="Deslocamento",
        unit="unidade",
        unit_cost=Decimal("25.00"),
        quantity=Decimal("2.000"),
        total_cost=Decimal("50.00"),
    )

    result = recalculate_work_order_totals(work_order)

    assert result.services_total == Decimal("150.00")
    assert result.other_total == Decimal("50.00")
    assert result.grand_total == Decimal("200.00")


@pytest.mark.django_db
def test_work_order_api_requires_module_and_action_permission(
    work_order_dependencies,
):
    user, maintenance_type, status, equipment = work_order_dependencies
    client = APIClient()
    client.force_authenticate(user)
    payload = {
        "maintenance_type": str(maintenance_type.id),
        "status": str(status.id),
        "equipment_ids": [str(equipment.id)],
    }

    denied = client.post("/api/v1/work-orders/", payload, format="json")
    assert denied.status_code == 403

    module = SystemModule.objects.get(key="nova_os")
    UserModulePermission.objects.create(
        user=user,
        module=module,
        can_access=True,
    )
    user.user_permissions.add(
        Permission.objects.get(
            content_type__app_label="maintenance",
            codename="add_workorder",
        )
    )

    allowed = client.post("/api/v1/work-orders/", payload, format="json")
    assert allowed.status_code == 201
    assert allowed.json()["number"] == "OS-000001"
