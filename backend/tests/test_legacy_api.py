import base64
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.assets.models import Equipment
from apps.maintenance.models import MaintenanceType, WorkOrder, WorkOrderStatus


@pytest.fixture
def legacy_admin():
    user = get_user_model().objects.create_user(
        username="legacy-admin",
        password="a-secure-test-password",
        role="admin",
    )
    client = APIClient()
    client.force_authenticate(user)
    return user, client


@pytest.mark.django_db
def test_legacy_entity_crud_contract(legacy_admin):
    _, client = legacy_admin

    created = client.post(
        "/api/areas-manutencao",
        {"descricao": "Instrumentacao"},
        format="json",
    )
    assert created.status_code == 201
    identifier = created.json()["id"]

    listed = client.get("/api/areas-manutencao?sort=descricao")
    assert listed.status_code == 200
    assert isinstance(listed.json(), list)
    assert any(item["id"] == identifier for item in listed.json())

    updated = client.put(
        f"/api/areas-manutencao/{identifier}",
        {"descricao": "Instrumentacao atualizada"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.json()["descricao"] == "Instrumentacao atualizada"

    detail = client.get(f"/api/areas-manutencao/{identifier}")
    assert detail.status_code == 200

    deleted = client.delete(f"/api/areas-manutencao/{identifier}")
    assert deleted.status_code == 200
    assert client.get(f"/api/areas-manutencao/{identifier}").status_code == 404


@pytest.mark.django_db
def test_legacy_admin_user_and_module_contract(legacy_admin):
    admin, client = legacy_admin
    created = client.post(
        "/api/users",
        {
            "username": "operator",
            "email": "operator@example.com",
            "full_name": "Operador",
            "role": "user",
            "active": True,
            "password": "a-strong-operator-password",
        },
        format="json",
    )
    assert created.status_code == 201
    user_id = created.json()["id"]
    assert created.json()["created_by_id"] == str(admin.id)

    temporary_password = client.post(
        f"/api/users/{user_id}/temporary-password",
        format="json",
    )
    assert temporary_password.status_code == 200
    assert temporary_password.json()["username"] == "operator"
    assert len(temporary_password.json()["temporaryPassword"]) == 14

    other_admin = get_user_model().objects.create_user(
        username="another-admin",
        email="another-admin@example.com",
        password="another-admin-password",
        role="admin",
    )
    other_admin_client = APIClient()
    other_admin_client.force_authenticate(other_admin)
    forbidden_temporary_password = other_admin_client.post(
        f"/api/users/{user_id}/temporary-password",
        format="json",
    )
    assert forbidden_temporary_password.status_code == 403

    modules = client.get(f"/api/users/{user_id}/modules")
    assert modules.status_code == 200
    assert modules.json()

    updated_modules = client.put(
        f"/api/users/{user_id}/modules",
        {"moduleKeys": ["dashboard", "ordens_servico"]},
        format="json",
    )
    assert updated_modules.status_code == 200
    assert {item["key"] for item in updated_modules.json() if item["canAccess"]} == {
        "dashboard",
        "ordens_servico",
    }

    password = client.patch(
        f"/api/users/{user_id}/password",
        {"password": "another-strong-password"},
        format="json",
    )
    assert password.status_code == 200

    status_response = client.patch(
        f"/api/users/{user_id}/status",
        {"active": False},
        format="json",
    )
    assert status_response.status_code == 200
    assert status_response.json()["active"] is False

    cannot_disable_self = client.patch(
        f"/api/users/{admin.id}/status",
        {"active": False},
        format="json",
    )
    assert cannot_disable_self.status_code == 400


@pytest.mark.django_db
def test_common_user_password_policy_is_shorter_than_admin(legacy_admin):
    _, client = legacy_admin
    common_user = client.post(
        "/api/users",
        {
            "username": "operator-short-password",
            "email": "operator-short@example.com",
            "full_name": "Operador",
            "role": "user",
            "password": "Ab3!xy",
        },
        format="json",
    )
    assert common_user.status_code == 201

    admin_user = client.post(
        "/api/users",
        {
            "username": "admin-short-password",
            "email": "admin-short@example.com",
            "full_name": "Administrador",
            "role": "admin",
            "password": "Ab3!xy",
        },
        format="json",
    )
    assert admin_user.status_code == 400


@pytest.mark.django_db
def test_public_work_order_and_notification_contract():
    maintenance_type = MaintenanceType.objects.create(
        legacy_id="public-type",
        description="Corretiva publica",
    )
    status_entry = WorkOrderStatus.objects.create(
        legacy_id="public-status",
        description="Aberta publica",
        is_initial=True,
    )
    equipment = Equipment.objects.create(
        legacy_id="public-equipment",
        code="PUBLIC-1",
        description="Equipamento publico",
    )
    client = APIClient()

    reference = client.get("/api/public/solicitar-os/reference")
    assert reference.status_code == 200
    assert reference.json()["equipamentos"]

    created = client.post(
        "/api/public/solicitar-os/ordens",
        {
            "numero": "IGNORADO-PELO-SERVIDOR",
            "equipamento_id": "public-equipment",
            "equipamento_nome": equipment.description,
            "tipo_id": "public-type",
            "tipo_nome": maintenance_type.description,
            "status_id": "public-status",
            "status_nome": status_entry.description,
            "area_id": "",
            "area_nome": "",
            "prioridade_id": "",
            "prioridade_nome": "",
            "data_programada": "2026-07-29",
            "hora_programada": "11:00",
            "localizacao_celula": "Celula",
            "localizacao_setor": "Setor",
            "equipamento_descricao_livre": "",
            "equipamento_nao_cadastrado": False,
            "maquina_parada": True,
            "parada_completa": True,
            "observacoes": "",
            "servicos": [],
            "materiais": [],
            "terceirizados": [],
            "outros": [],
            "valor_total_servicos": 0,
            "valor_total_materiais": 0,
            "valor_total_outros": 0,
            "valor_total_geral": 0,
            "is_solicitacao": True,
            "descricao_defeito": "Falha reportada",
        },
        format="json",
    )
    assert created.status_code == 201
    assert created.json()["numero"] == "OS-000001"
    assert created.json()["aprovacao_status"] == "pending"

    notification = client.post(
        "/api/public/solicitar-os/notificacoes",
        {
            "ordem_servico_id": created.json()["id"],
            "tipo_notificacao": "nova_solicitacao",
            "mensagem": "Nova solicitacao publica",
        },
        format="json",
    )
    assert notification.status_code == 201
    assert notification.json()["foi_lida"] is False


@pytest.mark.django_db
def test_work_order_solicitation_requires_admin_approval(legacy_admin):
    _, client = legacy_admin
    maintenance_type = MaintenanceType.objects.create(
        legacy_id="approval-type",
        description="Tipo para aprovacao",
    )
    status_entry = WorkOrderStatus.objects.create(
        legacy_id="approval-status",
        description="Aberta para aprovacao",
        is_initial=True,
    )

    pending = WorkOrder.objects.create(
        legacy_id="approval-pending",
        number="OS-APPROVAL-001",
        maintenance_type=maintenance_type,
        status=status_entry,
        requester="Solicitante",
        defect_description="Falha de teste",
        approval_status=WorkOrder.ApprovalStatus.PENDING,
    )

    listed = client.get("/api/ordens-servico")
    assert listed.status_code == 200
    assert all(row["id"] != str(pending.legacy_id) for row in listed.json())

    solicitations = client.get("/api/ordens-servico/solicitacoes-pendentes")
    assert solicitations.status_code == 200
    assert any(row["id"] == str(pending.legacy_id) for row in solicitations.json())

    missing_reason = client.patch(
        f"/api/ordens-servico/{pending.legacy_id}/aprovacao",
        {"action": "reject", "reason": ""},
        format="json",
    )
    assert missing_reason.status_code == 400

    rejected = client.patch(
        f"/api/ordens-servico/{pending.legacy_id}/aprovacao",
        {"action": "reject", "reason": "Equipamento nao identificado."},
        format="json",
    )
    assert rejected.status_code == 200
    assert rejected.json()["aprovacao_status"] == "rejected"
    assert rejected.json()["motivo_recusa"] == "Equipamento nao identificado."

    approved = WorkOrder.objects.create(
        legacy_id="approval-approved",
        number="OS-APPROVAL-002",
        maintenance_type=maintenance_type,
        status=status_entry,
        requester="Solicitante 2",
        approval_status=WorkOrder.ApprovalStatus.PENDING,
    )
    approved_response = client.patch(
        f"/api/ordens-servico/{approved.legacy_id}/aprovacao",
        {"action": "approve"},
        format="json",
    )
    assert approved_response.status_code == 200
    assert approved_response.json()["aprovacao_status"] == "approved"
    assert any(row["id"] == str(approved.legacy_id) for row in client.get("/api/ordens-servico").json())


@pytest.mark.django_db
def test_public_work_order_accepts_unregistered_equipment():
    maintenance_type = MaintenanceType.objects.create(
        legacy_id="free-equipment-type",
        description="Corretiva sem cadastro",
    )
    status_entry = WorkOrderStatus.objects.create(
        legacy_id="free-equipment-status",
        description="Aberta sem cadastro",
        is_initial=True,
    )
    client = APIClient()

    created = client.post(
        "/api/public/solicitar-os/ordens",
        {
            "tipo_id": "free-equipment-type",
            "tipo_nome": maintenance_type.description,
            "status_id": "free-equipment-status",
            "status_nome": status_entry.description,
            "equipamento_nao_cadastrado": True,
            "equipamento_descricao_livre": "Prensa azul da linha 2, ao lado do painel",
            "descricao_defeito": "Nao liga",
        },
        format="json",
    )

    assert created.status_code == 201
    work_order = WorkOrder.objects.get(number=created.json()["numero"])
    assert work_order.equipment_description == "Prensa azul da linha 2, ao lado do painel"


@pytest.mark.django_db
def test_upload_and_extract_contract(legacy_admin, tmp_path):
    _, client = legacy_admin
    csv_content = b"codigo,nome,custo\nMAT-1,Rolamento,12.50\n"
    encoded = base64.b64encode(csv_content).decode()

    with override_settings(MEDIA_ROOT=tmp_path):
        uploaded = client.post(
            "/files",
            {
                "name": "materiais.csv",
                "type": "text/csv",
                "size": len(csv_content),
                "dataUrl": f"data:text/csv;base64,{encoded}",
            },
            format="json",
        )
        assert uploaded.status_code == 201

        extracted = client.post(
            "/integrations/extract",
            {
                "file_url": uploaded.json()["file_url"],
                "json_schema": {
                    "items": {
                        "properties": {
                            "codigo": {"type": "string"},
                            "nome": {"type": "string"},
                            "custo": {"type": "number"},
                        }
                    }
                },
            },
            format="json",
        )
        assert extracted.status_code == 200, extracted.json()
        assert extracted.json()["status"] == "success"
        assert extracted.json()["output"][0]["custo"] == 12.5


@pytest.mark.django_db
@override_settings(
    AI_DEFAULT_PROVIDER="gemini",
    AI_PROVIDERS={
        "gemini": {"api_key": "test-key", "model": "test-model"},
    },
)
def test_llm_contract_uses_configured_python_provider(legacy_admin):
    _, client = legacy_admin
    with patch(
        "apps.legacy_api.integration_views.call_gemini",
        return_value=("Resposta tecnica", 42),
    ):
        response = client.post(
            "/integrations/llm",
            {
                "prompt": "Analise este componente",
                "sessionId": "session-test",
            },
            format="json",
        )

    assert response.status_code == 200
    assert response.json()["response"] == "Resposta tecnica"
    assert response.json()["provider"] == "gemini"
    assert response.json()["usage"]["tokens"] == 42
