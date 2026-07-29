import csv
import io
import json
import re
import uuid
from datetime import date, datetime
from decimal import Decimal

MAX_CSV_BYTES = 10 * 1024 * 1024
NUMERIC_FIELD_PATTERN = re.compile(
    r"(custo|valor|quantidade|ordem|tempo|total|tamanho|minutos|"
    r"pecas_por_hora|horas)",
    re.IGNORECASE,
)


class CsvImportError(ValueError):
    pass


def parse_cell(header, value):
    text = str(value or "").strip()
    if not text:
        return ""

    if (text.startswith("{") and text.endswith("}")) or (
        text.startswith("[") and text.endswith("]")
    ):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    lowered = text.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False

    normalized = text
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+,\d+", text):
        normalized = text.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d+,\d+", text):
        normalized = text.replace(",", ".")

    if NUMERIC_FIELD_PATTERN.search(header) and re.fullmatch(
        r"-?\d+(\.\d+)?",
        normalized,
    ):
        return Decimal(normalized)
    return text


def parse_csv(uploaded_file):
    if uploaded_file.size > MAX_CSV_BYTES:
        raise CsvImportError("O arquivo excede o limite de 10 MB.")

    raw = uploaded_file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvImportError("O arquivo deve estar codificado em UTF-8.") from exc

    if not text.strip():
        raise CsvImportError("O arquivo CSV esta vazio.")

    sample = text[:8192]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
    except csv.Error:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=delimiter)
    if not reader.fieldnames:
        raise CsvImportError("O CSV nao possui cabecalho.")

    headers = [str(header or "").strip() for header in reader.fieldnames]
    if any(not header for header in headers):
        raise CsvImportError("O CSV possui coluna sem nome.")
    if len(headers) != len(set(headers)):
        raise CsvImportError("O CSV possui colunas duplicadas.")

    rows = []
    for source_row in reader:
        row = {
            header: parse_cell(header, source_row.get(original_header, ""))
            for header, original_header in zip(headers, reader.fieldnames, strict=True)
        }
        if any(value != "" for value in row.values()):
            rows.append(row)

    if not rows:
        raise CsvImportError("Nenhum registro valido foi encontrado no CSV.")
    return rows


def serialize_cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict | list):
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
            default=json_default,
        )
    return str(value)


def json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    raise TypeError(f"{value.__class__.__name__} nao e serializavel em JSON.")


def render_csv(fields, rows):
    output = io.StringIO(newline="")
    output.write(",".join(fields))
    output.write("\n")
    writer = csv.writer(
        output,
        delimiter=",",
        quoting=csv.QUOTE_ALL,
        lineterminator="\n",
    )
    for row in rows:
        writer.writerow([serialize_cell(row.get(field)) for field in fields])
    return output.getvalue()
