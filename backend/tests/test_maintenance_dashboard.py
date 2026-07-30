from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import SystemModule, UserModulePermission
from apps.assets.models import Equipment
from apps.maintenance.models import (
    MaintenanceType,
    Priority,
    WorkOrderStatus,
)
from apps.maintenance.services import create_work_order
from apps.workforce.models import Maintainer


@pytest.fixture
def dashboard_data():
    user = get_user_model().objects.create_user(
        username="dashboard-user",
        email="dashboard@example.com",
        password="a-secure-test-password",
    )
    module = SystemModule.objects.get(key="dashboard")
    UserModulePermission.objects.create(user=user, module=module, can_access=True)
    user.user_permissions.add(
        Permission.objects.get(
            content_type__app_label="maintenance",
            codename="view_workorder",
        )
    )
    corrective = MaintenanceType.objects.create(
        description="Corretiva dashboard",
        category=MaintenanceType.Category.CORRECTIVE,
    )
    open_status = WorkOrderStatus.objects.create(
        description="Aberta dashboard",
        category=WorkOrderStatus.Category.OPEN,
        is_initial=True,
        order=10,
    )
    completed_status = WorkOrderStatus.objects.create(
        description="Concluida dashboard",
        category=WorkOrderStatus.Category.COMPLETED,
        is_final=True,
        order=40,
    )
    priority = Priority.objects.create(
        description="Critica dashboard",
        severity=Priority.Severity.CRITICAL,
        order=40,
    )
    equipment = Equipment.objects.create(
        code="DASH-001",
        description="Prensa dashboard",
    )
    maintainer = Maintainer.objects.create(
        name="Responsavel dashboard",
        position="Mecanico",
        hourly_cost=Decimal("80.00"),
    )
    return {
        "user": user,
        "corrective": corrective,
        "open_status": open_status,
        "completed_status": completed_status,
        "priority": priority,
        "equipment": equipment,
        "maintainer": maintainer,
    }


@pytest.mark.django_db
def test_dashboard_aggregates_operational_indicators(dashboard_data):
    now = timezone.now()
    overdue = create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["open_status"],
        priority=dashboard_data["priority"],
        assigned_maintainer=dashboard_data["maintainer"],
        due_at=now - timedelta(hours=2),
        created_by=dashboard_data["user"],
        equipment=[dashboard_data["equipment"]],
    )
    overdue.grand_total = Decimal("120.00")
    overdue.materials_total = Decimal("70.00")
    overdue.services_total = Decimal("50.00")
    overdue.save(update_fields=["grand_total", "materials_total", "services_total"])
    completed = create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["completed_status"],
        due_at=now + timedelta(hours=3),
        completed_at=now,
        created_by=dashboard_data["user"],
        equipment=[dashboard_data["equipment"]],
    )
    completed.grand_total = Decimal("30.00")
    completed.save(update_fields=["grand_total"])

    client = APIClient()
    client.force_authenticate(dashboard_data["user"])
    response = client.get("/api/v1/dashboard/maintenance/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["indicators"]["open"] == 1
    assert payload["indicators"]["overdue"] == 1
    assert payload["indicators"]["emergency"] == 1
    assert payload["indicators"]["completed"] == 1
    assert payload["indicators"]["on_time_rate"] == 100.0
    assert payload["attention"][0]["number"] == overdue.number
    assert payload["attention"][0]["situation"] == "overdue"
    assert payload["costs"]["total"] == 150.0
    assert payload["equipment_impact"][0]["count"] == 2
    assert payload["budget"]["available"] is False


@pytest.mark.django_db
def test_dashboard_respects_responsible_filter(dashboard_data):
    create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["open_status"],
        assigned_maintainer=dashboard_data["maintainer"],
        created_by=dashboard_data["user"],
    )
    create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["open_status"],
        created_by=dashboard_data["user"],
    )
    client = APIClient()
    client.force_authenticate(dashboard_data["user"])

    response = client.get(
        "/api/v1/dashboard/maintenance/",
        {"responsible": dashboard_data["maintainer"].id},
    )

    assert response.status_code == 200
    assert response.json()["indicators"]["open"] == 1


@pytest.mark.django_db
def test_dashboard_requires_dashboard_module(dashboard_data):
    user = get_user_model().objects.create_user(
        username="without-dashboard",
        email="without-dashboard@example.com",
        password="a-secure-test-password",
    )
    user.user_permissions.add(
        Permission.objects.get(
            content_type__app_label="maintenance",
            codename="view_workorder",
        )
    )
    client = APIClient()
    client.force_authenticate(user)

    response = client.get("/api/v1/dashboard/maintenance/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_work_order_list_is_paginated_and_filterable(dashboard_data):
    for index in range(3):
        create_work_order(
            maintenance_type=dashboard_data["corrective"],
            status=dashboard_data["open_status"],
            requester=f"Solicitante {index}",
            assigned_maintainer=(dashboard_data["maintainer"] if index == 0 else None),
            created_by=dashboard_data["user"],
        )
    client = APIClient()
    client.force_authenticate(dashboard_data["user"])

    response = client.get(
        "/api/v1/work-orders/",
        {
            "situation": "unassigned",
            "page_size": 1,
            "ordering": "requester",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assert len(payload["results"]) == 1
    assert payload["results"][0]["requester"] == "Solicitante 1"


@pytest.mark.django_db
def test_due_today_uses_application_timezone_and_excludes_completed(dashboard_data):
    now = timezone.localtime()
    future_today = now.replace(hour=23, minute=59, second=0, microsecond=0)
    open_order = create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["open_status"],
        due_at=future_today,
        created_by=dashboard_data["user"],
    )
    create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["completed_status"],
        due_at=now - timedelta(days=1),
        completed_at=now,
        created_by=dashboard_data["user"],
    )
    client = APIClient()
    client.force_authenticate(dashboard_data["user"])

    dashboard = client.get("/api/v1/dashboard/maintenance/")
    due_today = client.get(
        "/api/v1/work-orders/",
        {"situation": "due_today"},
    )
    overdue = client.get(
        "/api/v1/work-orders/",
        {"situation": "overdue"},
    )

    assert dashboard.status_code == 200
    attention = dashboard.json()["attention"]
    assert any(
        item["number"] == open_order.number and item["situation"] == "due_today"
        for item in attention
    )
    assert due_today.json()["count"] == 1
    assert overdue.json()["count"] == 0


@pytest.mark.django_db
def test_dashboard_reports_unavailable_completion_metrics_without_completed_orders(
    dashboard_data,
):
    create_work_order(
        maintenance_type=dashboard_data["corrective"],
        status=dashboard_data["open_status"],
        created_by=dashboard_data["user"],
    )
    client = APIClient()
    client.force_authenticate(dashboard_data["user"])

    response = client.get("/api/v1/dashboard/maintenance/")

    assert response.status_code == 200
    assert response.json()["indicators"]["on_time_rate"] is None
    assert response.json()["indicators"]["mean_completion_hours"] is None
