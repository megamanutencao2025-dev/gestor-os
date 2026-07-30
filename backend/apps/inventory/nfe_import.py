import hashlib
import re
import unicodedata
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from django.core import signing
from django.db import transaction
from django.db.models import Q

from apps.maintenance.models import CostCenter

from .models import Material, NfeImport, NfeUnitMapping

MAX_NFE_FILES = 10
MAX_NFE_FILE_BYTES = 2 * 1024 * 1024
MAX_NFE_TOTAL_BYTES = 10 * 1024 * 1024
MAX_NFE_PRODUCTS = 500
PREVIEW_TOKEN_MAX_AGE_SECONDS = 60 * 60
PREVIEW_TOKEN_SALT = "inventory.nfe-material-preview.v1"

UNIT_ALIASES = {
    "UN": Material.Unit.UNIT,
    "UND": Material.Unit.UNIT,
    "UNID": Material.Unit.UNIT,
    "PC": Material.Unit.UNIT,
    "PCA": Material.Unit.UNIT,
    "PECA": Material.Unit.UNIT,
    "KG": Material.Unit.KILOGRAM,
    "KILO": Material.Unit.KILOGRAM,
    "QUILO": Material.Unit.KILOGRAM,
    "L": Material.Unit.LITER,
    "LT": Material.Unit.LITER,
    "LTR": Material.Unit.LITER,
    "LITRO": Material.Unit.LITER,
    "M": Material.Unit.METER,
    "MT": Material.Unit.METER,
    "MTR": Material.Unit.METER,
    "METRO": Material.Unit.METER,
    "M2": Material.Unit.SQUARE_METER,
    "MT2": Material.Unit.SQUARE_METER,
    "METROQUADRADO": Material.Unit.SQUARE_METER,
    "M3": Material.Unit.CUBIC_METER,
    "MT3": Material.Unit.CUBIC_METER,
    "METROCUBICO": Material.Unit.CUBIC_METER,
    "H": Material.Unit.HOUR,
    "HR": Material.Unit.HOUR,
    "HORA": Material.Unit.HOUR,
}
UNIT_LABELS = dict(Material.Unit.choices)


class NfeImportError(ValueError):
    pass


def remove_accents(value):
    normalized = unicodedata.normalize("NFD", str(value or ""))
    return "".join(character for character in normalized if not unicodedata.combining(character))


def normalize_product_name(value):
    compact = re.sub(r"\s+", " ", str(value or "").strip())
    return remove_accents(compact).upper()


def normalize_source_unit(value):
    normalized = str(value or "").strip().upper().replace("²", "2").replace("³", "3")
    normalized = remove_accents(normalized)
    return re.sub(r"[^A-Z0-9]", "", normalized)


def resolve_unit(source_unit, custom_mappings=None):
    normalized = normalize_source_unit(source_unit)
    if not normalized:
        return None
    official = UNIT_ALIASES.get(normalized)
    if official:
        return official
    return (custom_mappings or {}).get(normalized)


def _local_name(tag):
    return str(tag).rsplit("}", 1)[-1]


def _child(element, name):
    if element is None:
        return None
    return next((child for child in element if _local_name(child.tag) == name), None)


def _child_text(element, name):
    child = _child(element, name)
    return str(child.text or "").strip() if child is not None else ""


def _descendant(element, name):
    if element is None:
        return None
    return next((item for item in element.iter() if _local_name(item.tag) == name), None)


def _decimal(value, field_name, *, required=False):
    text = str(value or "").strip()
    if not text and not required:
        return None
    try:
        parsed = Decimal(text)
    except InvalidOperation as exc:
        raise NfeImportError(f"{field_name} invalido: {text or 'vazio'}.") from exc
    if parsed < 0:
        raise NfeImportError(f"{field_name} nao pode ser negativo.")
    return parsed


def _issue_date(ide):
    value = _child_text(ide, "dhEmi") or _child_text(ide, "dEmi")
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise NfeImportError("Data de emissao da NF-e invalida.") from exc


def _access_key(root, inf_nfe):
    identifier = str(inf_nfe.attrib.get("Id") or "").strip()
    if identifier.startswith("NFe"):
        identifier = identifier[3:]
    if re.fullmatch(r"\d{44}", identifier):
        return identifier
    protocol = _descendant(root, "chNFe")
    protocol_value = str(protocol.text or "").strip() if protocol is not None else ""
    return protocol_value if re.fullmatch(r"\d{44}", protocol_value) else None


def _suggest_internal_code(access_key, document_hash, item_number):
    reference = access_key[-8:] if access_key else document_hash[:8].upper()
    safe_item = re.sub(r"\D", "", str(item_number or ""))[-3:] or "001"
    return f"NFE-{reference}-{safe_item}"


def parse_nfe_document(raw, filename, custom_mappings=None):
    if not raw:
        raise NfeImportError("O arquivo XML esta vazio.")
    if len(raw) > MAX_NFE_FILE_BYTES:
        raise NfeImportError("O arquivo excede o limite de 2 MB.")
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise NfeImportError("O XML possui declaracoes externas nao permitidas.")
    try:
        root = ElementTree.fromstring(
            raw,
            forbid_dtd=True,
            forbid_entities=True,
            forbid_external=True,
        )
    except (DefusedXmlException, ElementTree.ParseError) as exc:
        raise NfeImportError("XML invalido ou inseguro.") from exc

    inf_nfe = root if _local_name(root.tag) == "infNFe" else _descendant(root, "infNFe")
    if inf_nfe is None:
        raise NfeImportError("O arquivo nao contem uma NF-e valida.")

    emit = _child(inf_nfe, "emit")
    ide = _child(inf_nfe, "ide")
    supplier_name = _child_text(emit, "xNome")
    if not supplier_name:
        raise NfeImportError("A razao social do fornecedor nao foi encontrada.")
    supplier_tax_id = re.sub(r"\D", "", _child_text(emit, "CNPJ"))[:14]
    document_hash = hashlib.sha256(raw).hexdigest()
    access_key = _access_key(root, inf_nfe)
    issued_on = _issue_date(ide)

    products = []
    details = [item for item in inf_nfe if _local_name(item.tag) == "det"]
    if not details:
        raise NfeImportError("A NF-e nao possui produtos.")

    for index, detail in enumerate(details, start=1):
        product = _child(detail, "prod")
        item_number = str(detail.attrib.get("nItem") or index)
        purchase_code = _child_text(product, "cProd")
        raw_name = _child_text(product, "xProd")
        original_unit = _child_text(product, "uCom")
        errors = []
        try:
            unit_cost = _decimal(_child_text(product, "vUnCom"), "Custo unitario", required=True)
        except NfeImportError as exc:
            unit_cost = None
            errors.append(str(exc))
        try:
            quantity = _decimal(_child_text(product, "qCom"), "Quantidade")
        except NfeImportError as exc:
            quantity = None
            errors.append(str(exc))
        try:
            total_amount = _decimal(_child_text(product, "vProd"), "Valor total")
        except NfeImportError as exc:
            total_amount = None
            errors.append(str(exc))
        normalized_name = normalize_product_name(raw_name)
        if not purchase_code:
            errors.append("Codigo de compra nao informado no XML.")
        elif len(purchase_code) > Material._meta.get_field("purchase_code").max_length:
            errors.append("Codigo de compra excede 80 caracteres.")
        if not normalized_name:
            errors.append("Nome do produto nao informado no XML.")
        elif len(normalized_name) > Material._meta.get_field("name").max_length:
            errors.append("Nome do produto excede 180 caracteres.")
        resolved_unit = resolve_unit(original_unit, custom_mappings)
        products.append(
            {
                "preview_id": f"{document_hash[:12]}:{item_number}:{index}",
                "item_number": item_number,
                "purchase_code": purchase_code,
                "name": normalized_name,
                "original_unit": original_unit,
                "normalized_source_unit": normalize_source_unit(original_unit),
                "unit": resolved_unit,
                "unit_label": UNIT_LABELS.get(resolved_unit),
                "unit_cost": str(unit_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
                if unit_cost is not None
                else None,
                "quantity": str(quantity) if quantity is not None else None,
                "total_amount": str(total_amount) if total_amount is not None else None,
                "barcode": _child_text(product, "cEAN"),
                "internal_code": _suggest_internal_code(
                    access_key,
                    document_hash,
                    item_number,
                ),
                "errors": errors,
            }
        )

    return {
        "filename": filename[:255],
        "document_hash": document_hash,
        "access_key": access_key,
        "supplier_name": supplier_name[:180],
        "supplier_tax_id": supplier_tax_id,
        "issued_on": issued_on.isoformat() if issued_on else None,
        "products": products,
    }


def _candidate_materials(documents):
    purchase_codes = {
        product["purchase_code"]
        for document in documents
        for product in document["products"]
        if product["purchase_code"]
    }
    if not purchase_codes:
        return []
    return list(
        Material.objects.filter(purchase_code__in=purchase_codes).select_related("cost_center")
    )


def _find_existing_material(document, product, candidates):
    same_code = [
        material for material in candidates if material.purchase_code == product["purchase_code"]
    ]
    tax_id = document["supplier_tax_id"]
    if tax_id:
        exact_tax = [material for material in same_code if material.supplier_tax_id == tax_id]
        if exact_tax:
            return exact_tax[0]
    supplier_name = document["supplier_name"].casefold()
    exact_supplier = [
        material
        for material in same_code
        if material.supplier_name and material.supplier_name.casefold() == supplier_name
    ]
    if exact_supplier:
        return exact_supplier[0]
    normalized_name = product["name"]
    return next(
        (
            material
            for material in same_code
            if normalize_product_name(material.name) == normalized_name
        ),
        None,
    )


def _imported_invoice_query(document):
    query = Q(document_hash=document["document_hash"])
    if document.get("access_key"):
        query |= Q(access_key=document["access_key"])
    return query


def build_nfe_preview(uploaded_files):
    files = list(uploaded_files)
    if not files:
        raise NfeImportError("Selecione ao menos um arquivo XML.")
    if len(files) > MAX_NFE_FILES:
        raise NfeImportError(f"Selecione no maximo {MAX_NFE_FILES} arquivos por vez.")
    if sum(file.size for file in files) > MAX_NFE_TOTAL_BYTES:
        raise NfeImportError("Os arquivos excedem o limite total de 10 MB.")

    custom_mappings = dict(NfeUnitMapping.objects.values_list("source_unit", "unit"))
    documents = []
    file_results = []
    product_count = 0
    seen_document_hashes = set()
    seen_access_keys = set()
    for uploaded_file in files:
        filename = str(uploaded_file.name or "")
        if not filename.lower().endswith(".xml"):
            file_results.append(
                {
                    "filename": filename,
                    "status": "error",
                    "error": "O arquivo deve possuir extensao .xml.",
                }
            )
            continue
        try:
            document = parse_nfe_document(
                uploaded_file.read(),
                filename,
                custom_mappings,
            )
        except NfeImportError as exc:
            file_results.append(
                {
                    "filename": filename,
                    "status": "error",
                    "error": str(exc),
                }
            )
            continue
        duplicate_in_batch = document["document_hash"] in seen_document_hashes or (
            document["access_key"] and document["access_key"] in seen_access_keys
        )
        if duplicate_in_batch:
            file_results.append(
                {
                    "filename": filename,
                    "status": "error",
                    "error": "Esta NF-e ja foi selecionada neste lote.",
                }
            )
            continue
        seen_document_hashes.add(document["document_hash"])
        if document["access_key"]:
            seen_access_keys.add(document["access_key"])
        product_count += len(document["products"])
        if product_count > MAX_NFE_PRODUCTS:
            raise NfeImportError(f"Os arquivos excedem o limite de {MAX_NFE_PRODUCTS} produtos.")
        documents.append(document)

    candidates = _candidate_materials(documents)
    used_codes = set(Material.objects.values_list("code", flat=True))
    for document in documents:
        duplicate_invoice = NfeImport.objects.filter(_imported_invoice_query(document)).exists()
        document["duplicate_invoice"] = duplicate_invoice
        for product in document["products"]:
            existing = _find_existing_material(document, product, candidates)
            product["existing_material"] = (
                {
                    "id": str(existing.pk),
                    "code": existing.code,
                    "name": existing.name,
                    "unit": existing.unit,
                    "unit_label": existing.get_unit_display(),
                    "unit_cost": str(existing.unit_cost),
                }
                if existing
                else None
            )
            if product["internal_code"] in used_codes:
                product["internal_code"] = (
                    f"{product['internal_code']}-{product['preview_id'][:4].upper()}"
                )[:80]
            used_codes.add(product["internal_code"])
            if duplicate_invoice:
                product["status"] = "duplicate_invoice"
                product["selected"] = False
                product["action"] = "ignore"
            elif product["errors"]:
                product["status"] = "invalid"
                product["selected"] = False
                product["action"] = "ignore"
            elif not product["unit"]:
                product["status"] = "unknown_unit"
                product["selected"] = True
                product["action"] = "create"
            elif existing:
                product["status"] = "existing"
                product["selected"] = True
                product["action"] = "ignore"
            else:
                product["status"] = "new"
                product["selected"] = True
                product["action"] = "create"
        file_results.append(
            {
                "filename": document["filename"],
                "status": "duplicate" if duplicate_invoice else "ready",
                "error": None,
                "access_key": document["access_key"],
                "supplier_name": document["supplier_name"],
                "product_count": len(document["products"]),
                "duplicate_invoice": duplicate_invoice,
            }
        )

    if not documents:
        return {"token": None, "files": file_results, "documents": [], "product_count": 0}
    token = signing.dumps(
        {"version": 1, "documents": documents},
        salt=PREVIEW_TOKEN_SALT,
        compress=True,
    )
    return {
        "token": token,
        "files": file_results,
        "documents": documents,
        "product_count": product_count,
    }


def load_preview_token(token):
    try:
        payload = signing.loads(
            token,
            salt=PREVIEW_TOKEN_SALT,
            max_age=PREVIEW_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.SignatureExpired as exc:
        raise NfeImportError("A previa expirou. Processe os XMLs novamente.") from exc
    except signing.BadSignature as exc:
        raise NfeImportError("A previa da importacao e invalida.") from exc
    if payload.get("version") != 1 or not isinstance(payload.get("documents"), list):
        raise NfeImportError("A previa da importacao possui formato invalido.")
    return payload["documents"]


def _preview_index(documents):
    return {
        product["preview_id"]: (document, product)
        for document in documents
        for product in document["products"]
    }


def _current_existing(document, product):
    return _find_existing_material(
        document,
        product,
        _candidate_materials([document]),
    )


@transaction.atomic
def confirm_nfe_import(token, submitted_items, user):
    documents = load_preview_token(token)
    product_index = _preview_index(documents)
    seen_ids = set()
    selected_by_document = {}
    normalized_items = []

    for submitted in submitted_items:
        preview_id = submitted["preview_id"]
        if preview_id in seen_ids:
            raise NfeImportError("A confirmacao possui produtos duplicados.")
        seen_ids.add(preview_id)
        source = product_index.get(preview_id)
        if source is None:
            raise NfeImportError("Um produto nao pertence a previa processada.")
        document, product = source
        if not submitted.get("selected"):
            continue
        if product["errors"]:
            raise NfeImportError(f"{product['name'] or preview_id}: dados invalidos.")
        if (
            document.get("duplicate_invoice")
            or NfeImport.objects.filter(_imported_invoice_query(document)).exists()
        ):
            raise NfeImportError(f"A NF-e do arquivo {document['filename']} ja foi importada.")
        name = normalize_product_name(submitted.get("name"))
        if not name:
            raise NfeImportError(f"{product['purchase_code']}: informe o nome do produto.")
        unit = submitted.get("unit")
        if unit not in Material.Unit.values:
            raise NfeImportError(f"{name}: selecione uma unidade de medida valida.")
        cost_center = None
        if submitted.get("cost_center_id"):
            cost_center = CostCenter.objects.filter(
                pk=submitted["cost_center_id"],
                active=True,
            ).first()
            if cost_center is None:
                raise NfeImportError(f"{name}: centro de custo invalido.")
        selected_by_document.setdefault(document["document_hash"], []).append(preview_id)
        normalized_items.append(
            {
                "submitted": submitted,
                "document": document,
                "product": product,
                "name": name,
                "unit": unit,
                "cost_center": cost_center,
            }
        )

    if not normalized_items:
        raise NfeImportError("Selecione ao menos um produto para salvar.")

    summary = {"created": 0, "updated": 0, "ignored": 0, "invoices": 0}
    for item in normalized_items:
        submitted = item["submitted"]
        document = item["document"]
        product = item["product"]
        existing = _current_existing(document, product)
        action = submitted["action"]
        if action == "ignore":
            summary["ignored"] += 1
        elif action == "update":
            if existing is None:
                raise NfeImportError(f"{item['name']}: o material existente nao foi localizado.")
            existing.unit_cost = Decimal(product["unit_cost"]).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
            existing.supplier_name = document["supplier_name"]
            existing.supplier_tax_id = document["supplier_tax_id"]
            existing.purchased_on = (
                date.fromisoformat(document["issued_on"]) if document["issued_on"] else None
            )
            existing.save(
                update_fields=[
                    "unit_cost",
                    "supplier_name",
                    "supplier_tax_id",
                    "purchased_on",
                    "updated_at",
                ]
            )
            summary["updated"] += 1
        elif action == "create":
            internal_code = str(submitted.get("internal_code") or "").strip()
            if not internal_code:
                raise NfeImportError(f"{item['name']}: informe o codigo interno.")
            if Material.objects.filter(code__iexact=internal_code).exists():
                raise NfeImportError(f"{item['name']}: o codigo interno {internal_code} ja existe.")
            Material.objects.create(
                code=internal_code,
                purchase_code=product["purchase_code"],
                name=item["name"],
                unit=item["unit"],
                unit_cost=Decimal(product["unit_cost"]).quantize(
                    Decimal("0.01"),
                    rounding=ROUND_HALF_UP,
                ),
                cost_center=item["cost_center"],
                supplier_name=document["supplier_name"],
                supplier_tax_id=document["supplier_tax_id"],
                purchased_on=(
                    date.fromisoformat(document["issued_on"]) if document["issued_on"] else None
                ),
                active=True,
            )
            summary["created"] += 1
        else:
            raise NfeImportError(f"{item['name']}: acao de importacao invalida.")

        normalized_source = product["normalized_source_unit"]
        if (
            submitted.get("remember_unit_mapping")
            and normalized_source
            and normalized_source not in UNIT_ALIASES
        ):
            NfeUnitMapping.objects.update_or_create(
                source_unit=normalized_source,
                defaults={"unit": item["unit"], "created_by": user},
            )

    documents_by_hash = {document["document_hash"]: document for document in documents}
    for document_hash, preview_ids in selected_by_document.items():
        document = documents_by_hash[document_hash]
        NfeImport.objects.create(
            access_key=document["access_key"],
            document_hash=document_hash,
            filename=document["filename"],
            supplier_name=document["supplier_name"],
            supplier_tax_id=document["supplier_tax_id"],
            issued_on=(
                date.fromisoformat(document["issued_on"]) if document["issued_on"] else None
            ),
            product_count=len(preview_ids),
            imported_by=user,
        )
        summary["invoices"] += 1
    return summary
