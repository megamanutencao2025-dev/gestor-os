from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.inventory.models import Material, NfeImport, NfeUnitMapping
from apps.inventory.nfe_import import normalize_product_name, resolve_unit

PREVIEW_URL = "/api/v1/inventory/nfe/preview/"
CONFIRM_URL = "/api/v1/inventory/nfe/confirm/"


@pytest.fixture
def nfe_client():
    user = get_user_model().objects.create_user(
        username="nfe-admin",
        password="a-secure-test-password",
        role="admin",
    )
    client = APIClient()
    client.force_authenticate(user)
    return user, client


def nfe_xml(
    *,
    access_key="1" * 44,
    supplier_name="Elétrica São José Ltda",
    supplier_tax_id="12345678000190",
    products=None,
):
    products = products or [
        {
            "code": "FORN-001",
            "name": "  Cabo   flexível 2,5 mm² preto ",
            "unit": "M²",
            "unit_cost": "12.3456",
            "quantity": "2",
            "total": "24.69",
            "ean": "SEM GTIN",
        }
    ]
    details = "".join(
        f"""
        <det nItem="{index}">
          <prod>
            <cProd>{product["code"]}</cProd>
            <cEAN>{product.get("ean", "")}</cEAN>
            <xProd>{product["name"]}</xProd>
            <uCom>{product["unit"]}</uCom>
            <qCom>{product.get("quantity", "1")}</qCom>
            <vUnCom>{product["unit_cost"]}</vUnCom>
            <vProd>{product.get("total", product["unit_cost"])}</vProd>
          </prod>
        </det>
        """
        for index, product in enumerate(products, start=1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
    <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <NFe>
        <infNFe Id="NFe{access_key}">
          <ide><dhEmi>2026-07-30T08:30:00-03:00</dhEmi></ide>
          <emit>
            <CNPJ>{supplier_tax_id}</CNPJ>
            <xNome>{supplier_name}</xNome>
          </emit>
          {details}
        </infNFe>
      </NFe>
    </nfeProc>""".encode()


def upload(name, content):
    return SimpleUploadedFile(name, content, content_type="application/xml")


def preview(client, *files):
    return client.post(PREVIEW_URL, {"files": list(files)}, format="multipart")


def confirmation_item(product, **overrides):
    return {
        "preview_id": product["preview_id"],
        "selected": product["selected"],
        "action": product["action"],
        "internal_code": product["internal_code"],
        "name": product["name"],
        "unit": product["unit"] or "",
        "cost_center_id": None,
        "remember_unit_mapping": True,
        **overrides,
    }


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("PÇ", Material.Unit.UNIT),
        ("quilo", Material.Unit.KILOGRAM),
        ("LTR", Material.Unit.LITER),
        ("mt", Material.Unit.METER),
        ("M²", Material.Unit.SQUARE_METER),
        ("MT3", Material.Unit.CUBIC_METER),
        ("hr", Material.Unit.HOUR),
    ],
)
def test_known_unit_aliases(source, expected):
    assert resolve_unit(source) == expected


def test_product_name_normalization_preserves_technical_symbols():
    assert normalize_product_name("  Conexão   2,5 mm² / peça³  ") == ("CONEXAO 2,5 MM² / PECA³")


@pytest.mark.django_db
def test_preview_reads_namespaced_nfe_supplier_and_multiple_products(nfe_client):
    _, client = nfe_client
    xml = nfe_xml(
        products=[
            {
                "code": "CABO-25",
                "name": "Cabo flexível 2,5 mm² preto",
                "unit": "M²",
                "unit_cost": "12.3456",
                "quantity": "2",
                "total": "24.69",
            },
            {
                "code": "LAMP-1",
                "name": "Lâmpada LED",
                "unit": "UN",
                "unit_cost": "8.90",
                "quantity": "3",
                "total": "26.70",
            },
        ]
    )

    response = preview(client, upload("nota.xml", xml))

    assert response.status_code == 200
    payload = response.json()
    assert payload["product_count"] == 2
    document = payload["documents"][0]
    assert document["supplier_name"] == "Elétrica São José Ltda"
    assert document["supplier_tax_id"] == "12345678000190"
    assert document["issued_on"] == "2026-07-30"
    assert document["products"][0]["name"] == "CABO FLEXIVEL 2,5 MM² PRETO"
    assert document["products"][0]["unit"] == Material.Unit.SQUARE_METER
    assert document["products"][0]["unit_cost"] == "12.3456"
    assert document["products"][0]["purchase_code"] == "CABO-25"
    assert document["products"][1]["name"] == "LAMPADA LED"
    assert document["products"][1]["unit"] == Material.Unit.UNIT


@pytest.mark.django_db
def test_preview_accepts_legacy_demi_date(nfe_client):
    _, client = nfe_client
    xml = nfe_xml().replace(
        b"<dhEmi>2026-07-30T08:30:00-03:00</dhEmi>",
        b"<dEmi>2026-07-29</dEmi>",
    )

    response = preview(client, upload("nota-legada.xml", xml))

    assert response.status_code == 200
    assert response.json()["documents"][0]["issued_on"] == "2026-07-29"


@pytest.mark.django_db
def test_preview_marks_unknown_unit_and_confirmation_requires_correction(nfe_client):
    _, client = nfe_client
    response = preview(
        client,
        upload(
            "caixa.xml",
            nfe_xml(
                products=[
                    {
                        "code": "CX-1",
                        "name": "Conexão elétrica para eletroduto",
                        "unit": "CX",
                        "unit_cost": "10",
                    }
                ]
            ),
        ),
    )
    product = response.json()["documents"][0]["products"][0]

    assert product["status"] == "unknown_unit"
    assert product["original_unit"] == "CX"
    assert product["unit"] is None

    confirmed = client.post(
        CONFIRM_URL,
        {
            "token": response.json()["token"],
            "items": [confirmation_item(product, unit="")],
        },
        format="json",
    )

    assert confirmed.status_code == 400
    assert "unidade" in confirmed.json()["message"].lower()
    assert Material.objects.count() == 0


@pytest.mark.django_db
def test_confirm_saves_selected_products_and_remembers_custom_unit(nfe_client):
    user, client = nfe_client
    response = preview(
        client,
        upload(
            "materiais.xml",
            nfe_xml(
                products=[
                    {
                        "code": "NOVO-1",
                        "name": "Peça única",
                        "unit": "CX",
                        "unit_cost": "15.6789",
                    },
                    {
                        "code": "IGNORAR-1",
                        "name": "Produto não selecionado",
                        "unit": "UN",
                        "unit_cost": "5",
                    },
                ]
            ),
        ),
    )
    payload = response.json()
    first, second = payload["documents"][0]["products"]
    confirmed = client.post(
        CONFIRM_URL,
        {
            "token": payload["token"],
            "items": [
                confirmation_item(
                    first,
                    unit=Material.Unit.UNIT,
                    internal_code="MAT-NFE-001",
                ),
                confirmation_item(second, selected=False),
            ],
        },
        format="json",
    )

    assert confirmed.status_code == 200
    assert confirmed.json() == {
        "created": 1,
        "updated": 0,
        "ignored": 0,
        "invoices": 1,
    }
    material = Material.objects.get()
    assert material.code == "MAT-NFE-001"
    assert material.purchase_code == "NOVO-1"
    assert material.name == "PECA UNICA"
    assert material.unit == Material.Unit.UNIT
    assert material.unit_cost == Decimal("15.68")
    assert material.supplier_name == "Elétrica São José Ltda"
    assert material.supplier_tax_id == "12345678000190"
    assert material.purchased_on.isoformat() == "2026-07-30"
    assert not Material.objects.filter(purchase_code="IGNORAR-1").exists()
    assert NfeUnitMapping.objects.get(source_unit="CX").created_by == user
    assert NfeImport.objects.count() == 1

    mapped_preview = preview(
        client,
        upload(
            "outra-nota.xml",
            nfe_xml(
                access_key="2" * 44,
                products=[
                    {
                        "code": "NOVO-2",
                        "name": "Outra peça",
                        "unit": "CX",
                        "unit_cost": "2",
                    }
                ],
            ),
        ),
    )
    mapped_product = mapped_preview.json()["documents"][0]["products"][0]
    assert mapped_product["unit"] == Material.Unit.UNIT
    assert mapped_product["status"] == "new"


@pytest.mark.django_db
def test_existing_material_is_detected_and_updated_only_after_confirmation(nfe_client):
    _, client = nfe_client
    existing = Material.objects.create(
        code="MAT-EXISTENTE",
        purchase_code="FORN-001",
        name="CABO FLEXIVEL",
        unit=Material.Unit.METER,
        unit_cost=Decimal("5.00"),
        supplier_name="Elétrica São José Ltda",
        supplier_tax_id="12345678000190",
    )
    response = preview(
        client,
        upload(
            "atualizacao.xml",
            nfe_xml(
                products=[
                    {
                        "code": "FORN-001",
                        "name": "Cabo flexível",
                        "unit": "M",
                        "unit_cost": "9.876",
                    }
                ]
            ),
        ),
    )
    product = response.json()["documents"][0]["products"][0]

    assert product["status"] == "existing"
    assert product["action"] == "ignore"
    assert product["existing_material"]["id"] == str(existing.pk)
    existing.refresh_from_db()
    assert existing.unit_cost == Decimal("5.00")

    confirmed = client.post(
        CONFIRM_URL,
        {
            "token": response.json()["token"],
            "items": [confirmation_item(product, action="update")],
        },
        format="json",
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["updated"] == 1
    assert Material.objects.count() == 1
    existing.refresh_from_db()
    assert existing.unit_cost == Decimal("9.88")
    assert existing.purchased_on.isoformat() == "2026-07-30"


@pytest.mark.django_db
def test_imported_invoice_is_flagged_as_duplicate(nfe_client):
    user, client = nfe_client
    xml = nfe_xml()
    first_preview = preview(client, upload("primeira.xml", xml)).json()
    product = first_preview["documents"][0]["products"][0]
    confirmed = client.post(
        CONFIRM_URL,
        {
            "token": first_preview["token"],
            "items": [
                confirmation_item(
                    product,
                    internal_code="MAT-DUPLICATE-NFE",
                )
            ],
        },
        format="json",
    )
    assert confirmed.status_code == 200
    assert NfeImport.objects.get().imported_by == user

    duplicate = preview(client, upload("segunda.xml", xml))
    duplicate_product = duplicate.json()["documents"][0]["products"][0]

    assert duplicate.status_code == 200
    assert duplicate.json()["files"][0]["status"] == "duplicate"
    assert duplicate_product["status"] == "duplicate_invoice"
    assert duplicate_product["selected"] is False


@pytest.mark.django_db
def test_same_invoice_selected_twice_is_rejected_per_file(nfe_client):
    _, client = nfe_client
    xml = nfe_xml()

    response = preview(
        client,
        upload("original.xml", xml),
        upload("copia.xml", xml),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["product_count"] == 1
    assert len(payload["documents"]) == 1
    assert payload["files"][0]["filename"] == "copia.xml"
    assert payload["files"][0]["status"] == "error"
    assert "neste lote" in payload["files"][0]["error"]


@pytest.mark.django_db
def test_invalid_and_xxe_files_do_not_block_valid_file(nfe_client):
    _, client = nfe_client
    unsafe = b"""<?xml version="1.0"?>
    <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
    <nfeProc><NFe><infNFe><emit><xNome>&xxe;</xNome></emit></infNFe></NFe></nfeProc>"""

    response = preview(
        client,
        upload("inseguro.xml", unsafe),
        upload("valido.xml", nfe_xml()),
        upload("texto.txt", b"nao e xml"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["product_count"] == 1
    assert len(payload["documents"]) == 1
    errors = [entry for entry in payload["files"] if entry["status"] == "error"]
    assert len(errors) == 2
    assert any("nao permitidas" in entry["error"] for entry in errors)
    assert any("extensao .xml" in entry["error"] for entry in errors)


@pytest.mark.django_db
def test_manual_material_crud_remains_compatible(nfe_client):
    _, client = nfe_client

    created = client.post(
        "/api/materiais",
        {
            "codigo": "MANUAL-001",
            "codigo_compra": "COMPRA-MANUAL",
            "nome": "Material manual",
            "unidade_medida": "Unidade",
            "custo": 20,
            "fornecedor": "Fornecedor manual",
            "fornecedor_cnpj": "11.111.111/0001-11",
        },
        format="json",
    )

    assert created.status_code == 201
    material = Material.objects.get(code="MANUAL-001")
    assert material.supplier_name == "Fornecedor manual"
    assert material.supplier_tax_id == "11111111000111"
    listed = client.get("/api/materiais")
    assert listed.status_code == 200
    assert listed.json()[0]["fornecedor"] == "Fornecedor manual"
