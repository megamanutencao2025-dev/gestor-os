import csv
import io
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.assets.models import Equipment, EquipmentFamily, Location
from apps.data_transfer.contracts import ENTITY_FIELDS
from apps.data_transfer.csv_codec import parse_csv, render_csv
from apps.data_transfer.legacy_adapter import (
    LegacyDataError,
    export_entity,
    import_entity,
)
from apps.inventory.models import Material
from apps.maintenance.models import (
    Attachment,
    CostCenter,
    MaintenanceArea,
    MaintenanceType,
    Priority,
    WorkOrder,
    WorkOrderStatus,
)
from apps.workforce.models import Maintainer, ServiceProvider


@pytest.fixture
def admin_client():
    user = get_user_model().objects.create_user(
        username="data-admin",
        password="a-secure-test-password",
        role="admin",
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_legacy_csv_endpoint_imports_and_exports_location(admin_client):
    row = {
        "id": "legacy-location-1",
        "descricao": "Linha 1",
        "setor": "Producao",
        "observacoes": "Importada do backup",
        "created_date": "2025-01-02T10:00:00Z",
        "updated_date": "2025-01-03T11:00:00Z",
    }
    content = render_csv(ENTITY_FIELDS["Localizacao"], [row]).encode()

    imported = admin_client.post(
        "/api/v1/data-transfer/import/Localizacao/",
        {
            "file": SimpleUploadedFile(
                "Localizacao_2025-01-03.csv",
                content,
                content_type="text/csv",
            )
        },
        format="multipart",
    )

    assert imported.status_code == 200
    assert imported.json() == {
        "entity": "Localizacao",
        "total": 1,
        "created": 1,
        "updated": 0,
    }
    location = Location.objects.get(legacy_id="legacy-location-1")
    assert location.description == "Linha 1"

    exported = admin_client.get("/api/v1/data-transfer/export/Localizacao/")
    assert exported.status_code == 200
    assert exported["Content-Type"].startswith("text/csv")
    exported_rows = list(csv.DictReader(io.StringIO(exported.content.decode("utf-8"))))
    assert exported_rows[0]["id"] == "legacy-location-1"
    assert exported_rows[0]["descricao"] == "Linha 1"


@pytest.mark.django_db
def test_import_is_idempotent_and_rolls_back_invalid_file():
    valid_row = {
        "id": "location-valid",
        "descricao": "Celula A",
        "setor": "Montagem",
    }
    first = import_entity("Localizacao", [valid_row])
    second = import_entity(
        "Localizacao",
        [{**valid_row, "observacoes": "Atualizada"}],
    )

    assert first.created == 1
    assert second.updated == 1
    assert Location.objects.filter(legacy_id="location-valid").count() == 1
    assert Location.objects.get(legacy_id="location-valid").notes == "Atualizada"

    with pytest.raises(LegacyDataError):
        import_entity(
            "Localizacao",
            [
                {"id": "must-rollback", "descricao": "Temporaria"},
                {"id": "invalid", "descricao": ""},
            ],
        )

    assert not Location.objects.filter(legacy_id="must-rollback").exists()


@pytest.mark.django_db
def test_work_order_backup_round_trip_preserves_relations_and_totals():
    location = Location.objects.create(
        legacy_id="loc-1",
        description="Celula 1",
        sector="Usinagem",
    )
    family = EquipmentFamily.objects.create(
        legacy_id="family-1",
        description="Prensas",
    )
    Equipment.objects.create(
        legacy_id="equipment-1",
        code="EQ-001",
        description="Prensa principal",
        location=location,
        family=family,
    )
    MaintenanceType.objects.create(
        legacy_id="type-1",
        description="Corretiva teste",
    )
    WorkOrderStatus.objects.create(
        legacy_id="status-1",
        description="Aberta teste",
        is_initial=True,
    )
    Maintainer.objects.create(
        legacy_id="maintainer-1",
        name="Tecnico A",
        position="Mecanico",
        hourly_cost=Decimal("50.00"),
    )
    Material.objects.create(
        legacy_id="material-1",
        code="MAT-001",
        name="Rolamento",
        unit=Material.Unit.UNIT,
        unit_cost=Decimal("20.00"),
    )
    ServiceProvider.objects.create(
        legacy_id="provider-1",
        company_name="Prestadora A",
    )

    legacy_row = {
        "id": "work-order-legacy-1",
        "numero": "OS-000123",
        "equipamento_id": "equipment-1",
        "equipamento_nome": "Prensa principal",
        "equipamentos": [
            {
                "equipamento_id": "equipment-1",
                "equipamento_nome": "Prensa principal",
                "localizacao": "Celula 1",
                "hierarquia": [{"id": "equipment-1", "nome": "Prensa principal"}],
            }
        ],
        "tipo_id": "type-1",
        "tipo_nome": "Corretiva teste",
        "status_id": "status-1",
        "status_nome": "Aberta teste",
        "solicitante": "Operacao",
        "data_programada": "2025-04-10",
        "hora_programada": "08:30",
        "maquina_parada": True,
        "descricao_defeito": "Ruido anormal",
        "servicos": [
            {
                "mantenedores": [
                    {
                        "mantenedor_id": "maintainer-1",
                        "mantenedor_nome": "Tecnico A",
                        "custo_hora": 50,
                    }
                ],
                "defeito_identificado": "Rolamento com folga",
                "atividade": "Inspecao e ajuste",
                "total_horas": 2,
                "valor_total": 100,
                "horas_por_mantenedor": {"maintainer-1": 2},
                "anexos": [
                    {
                        "url": "https://files.example/service.jpg",
                        "nome": "service.jpg",
                        "tipo": "image/jpeg",
                        "tamanho": 1200,
                    }
                ],
            }
        ],
        "materiais": [
            {
                "material_id": "material-1",
                "codigo": "MAT-001",
                "nome": "Rolamento",
                "unidade": "Unidade",
                "custo_unitario": 20,
                "quantidade": 2,
                "custo_total": 40,
            }
        ],
        "terceirizados": [
            {
                "prestadora_id": "provider-1",
                "prestadora_nome": "Prestadora A",
                "descricao_servico": "Analise externa",
                "valor_servico": 75,
            }
        ],
        "outros": [
            {
                "descricao": "Deslocamento",
                "unidade": "Unidade",
                "custo_unitario": 10,
                "quantidade": 1,
                "custo_total": 10,
            }
        ],
        "tempo_parado_em_minutos": 90,
    }

    imported = import_entity("OrdemServico", [legacy_row])
    fields, exported_rows = export_entity("OrdemServico")

    assert imported.created == 1
    assert fields == ENTITY_FIELDS["OrdemServico"]
    assert len(exported_rows) == 1
    exported = exported_rows[0]
    assert exported["id"] == "work-order-legacy-1"
    assert exported["equipamentos"][0]["equipamento_id"] == "equipment-1"
    assert exported["servicos"][0]["mantenedores"][0]["mantenedor_id"] == ("maintainer-1")
    assert exported["servicos"][0]["defeito_identificado"] == "Rolamento com folga"
    assert exported["materiais"][0]["material_id"] == "material-1"
    assert exported["terceirizados"][0]["prestadora_id"] == "provider-1"

    exported_csv = render_csv(fields, exported_rows).encode("utf-8")
    parsed_rows = parse_csv(
        SimpleUploadedFile(
            "OrdemServico_2025-04-10.csv",
            exported_csv,
            content_type="text/csv",
        )
    )
    reimported = import_entity("OrdemServico", parsed_rows)
    work_order = WorkOrder.objects.get(legacy_id="work-order-legacy-1")

    assert reimported.updated == 1
    assert WorkOrder.objects.count() == 1
    assert work_order.services.count() == 1
    assert work_order.services.get().identified_defect == "Rolamento com folga"
    assert work_order.materials.count() == 1
    assert work_order.outsourced_services.count() == 1
    assert work_order.grand_total == Decimal("225.00")


@pytest.mark.django_db
def test_all_reference_and_catalog_entities_round_trip():
    imports = {
        "TipoManutencao": [{"id": "type-csv", "descricao": "Preditiva CSV"}],
        "StatusOS": [{"id": "status-csv", "descricao": "Planejada CSV"}],
        "AreaManutencao": [{"id": "area-csv", "descricao": "Automacao CSV"}],
        "FamiliaEquipamento": [{"id": "family-csv", "descricao": "Motores CSV"}],
        "Prioridade": [
            {
                "id": "priority-csv",
                "descricao": "Urgente CSV",
                "cor": "#AA1122",
                "ordem": 5,
            }
        ],
        "CentroCusto": [
            {
                "id": "center-csv",
                "descricao": "Producao CSV",
                "codigo": "CC-01",
            }
        ],
        "Localizacao": [
            {
                "id": "location-csv",
                "descricao": "Celula CSV",
                "setor": "Montagem",
                "observacoes": "Teste",
            }
        ],
        "Mantenedor": [
            {
                "id": "maintainer-csv",
                "nome": "Tecnico CSV",
                "cargo": "Eletricista",
                "custo_hora": "75,50",
            }
        ],
        "PrestadoraServico": [
            {
                "id": "provider-csv",
                "nome_empresa": "Fornecedor CSV",
                "cnpj": "12.345.678/0001-90",
                "contato1": "11999999999",
                "email": "fornecedor@example.com",
                "servicos_prestados": "Inspecao",
            }
        ],
        "Material": [
            {
                "id": "material-csv",
                "codigo": "MAT-CSV",
                "codigo_compra": "COMPRA-1",
                "nome": "Oleo",
                "unidade_medida": "Litro",
                "custo": "35,90",
                "centro_custo": "Producao CSV",
                "data_compra": "2025-02-01",
            }
        ],
    }

    for entity_name, rows in imports.items():
        result = import_entity(entity_name, rows)
        assert result.created == 1

    equipment_rows = [
        {
            "id": "equipment-parent-csv",
            "codigo": "EQ-PARENT",
            "descricao": "Equipamento pai",
            "familia_id": "family-csv",
            "localizacao_id": "location-csv",
            "status": "Ativo",
            "pecas_por_hora": "100",
            "imagens": [
                {
                    "url": "https://files.example/equipment.jpg",
                    "nome": "equipment.jpg",
                    "tipo": "image/jpeg",
                    "tamanho": 100,
                }
            ],
        },
        {
            "id": "equipment-child-csv",
            "descricao": "Componente",
            "parent_id": "equipment-parent-csv",
            "status": "Inativo",
        },
    ]
    equipment_result = import_entity("Equipamento", equipment_rows)

    assert equipment_result.created == 2
    child = Equipment.objects.get(legacy_id="equipment-child-csv")
    assert child.parent.legacy_id == "equipment-parent-csv"
    assert child.status == Equipment.Status.INACTIVE
    assert Attachment.objects.count() == 1
    assert Material.objects.get(legacy_id="material-csv").cost_center == (
        CostCenter.objects.get(legacy_id="center-csv")
    )
    assert Priority.objects.filter(legacy_id="priority-csv").exists()
    assert MaintenanceArea.objects.filter(legacy_id="area-csv").exists()

    for entity_name in imports:
        fields, rows = export_entity(entity_name)
        assert fields == ENTITY_FIELDS[entity_name]
        assert any(row["id"] == imports[entity_name][0]["id"] for row in rows)

    _, equipment_export = export_entity("Equipamento")
    parent_row = next(row for row in equipment_export if row["id"] == "equipment-parent-csv")
    child_row = next(row for row in equipment_export if row["id"] == "equipment-child-csv")
    assert parent_row["imagens"][0]["nome"] == "equipment.jpg"
    assert child_row["parent_id"] == "equipment-parent-csv"
