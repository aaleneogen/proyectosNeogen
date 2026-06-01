"""
Document parsing service.
Supports PDF (native + OCR) and Excel/CSV formats.
"""
import io
import re
import tempfile
from pathlib import Path
from typing import Optional
import logging

import pdfplumber
import pandas as pd
from PIL import Image

from app.schemas.schemas import ParsedRow
from app.core.config import settings

logger = logging.getLogger(__name__)


NUMBER_RE = re.compile(r"[\$\s,]")
QTY_KEYWORDS = {"cantidad", "qty", "quantity", "cant", "units", "unidades"}
PRICE_KEYWORDS = {"precio", "price", "unit price", "p.unit", "valor unitario"}
DESC_KEYWORDS = {"descripcion", "description", "producto", "product", "item", "articulo"}
SKIP_KEYWORDS = {"subtotal", "total", "iva", "descuento", "discount", "tax", "flete", "envio"}


def _clean_number(value: str) -> Optional[float]:
    if not value:
        return None
    cleaned = NUMBER_RE.sub("", str(value).strip())
    cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _is_skip_row(values: list[str]) -> bool:
    combined = " ".join(str(v).lower() for v in values if v)
    return any(kw in combined for kw in SKIP_KEYWORDS)


def _detect_column_mapping(headers: list[str]) -> dict:
    mapping = {"description": None, "quantity": None, "price": None}
    for i, h in enumerate(headers):
        norm = _normalize_text(str(h))
        if any(k in norm for k in DESC_KEYWORDS):
            mapping["description"] = i
        elif any(k in norm for k in QTY_KEYWORDS):
            mapping["quantity"] = i
        elif any(k in norm for k in PRICE_KEYWORDS):
            mapping["price"] = i
    return mapping


def _rows_from_dataframe(df: pd.DataFrame) -> list[ParsedRow]:
    if df.empty:
        return []

    df = df.dropna(how="all")
    headers = [str(c) for c in df.columns]
    mapping = _detect_column_mapping(headers)

    if mapping["description"] is None:
        # Heuristic: first string col = description, first numeric = qty, second numeric = price
        numeric_cols = []
        string_cols = []
        for i, col in enumerate(df.columns):
            sample = df[col].dropna().head(5)
            numeric_count = sum(1 for v in sample if _clean_number(str(v)) is not None)
            if numeric_count >= 3:
                numeric_cols.append(i)
            else:
                string_cols.append(i)
        if string_cols:
            mapping["description"] = string_cols[0]
        if len(numeric_cols) >= 1:
            mapping["quantity"] = numeric_cols[0]
        if len(numeric_cols) >= 2:
            mapping["price"] = numeric_cols[1]

    rows: list[ParsedRow] = []
    for _, row in df.iterrows():
        vals = [str(v) if pd.notna(v) else "" for v in row]

        if _is_skip_row(vals):
            continue

        desc = vals[mapping["description"]].strip() if mapping["description"] is not None else ""
        if not desc or desc.lower() in ("nan", "none", ""):
            continue

        raw_qty = vals[mapping["quantity"]].strip() if mapping["quantity"] is not None else ""
        raw_price = vals[mapping["price"]].strip() if mapping["price"] is not None else ""

        qty = _clean_number(raw_qty)
        price = _clean_number(raw_price)

        rows.append(ParsedRow(
            description=desc,
            quantity=qty,
            unit_price=price,
            raw_quantity=raw_qty,
            raw_price=raw_price,
        ))

    return rows


# ── PDF Parsing ────────────────────────────────────────────────────────────────

def _parse_pdf_native(file_path: str) -> tuple[list[ParsedRow], list[str]]:
    rows: list[ParsedRow] = []
    errors: list[str] = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                if not tables:
                    continue
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    headers = [str(h or "").strip() for h in table[0]]
                    data_rows = table[1:]
                    df = pd.DataFrame(data_rows, columns=headers)
                    page_rows = _rows_from_dataframe(df)
                    rows.extend(page_rows)
    except Exception as e:
        errors.append(f"PDF native parsing error: {e}")

    return rows, errors


def _parse_pdf_ocr(file_path: str) -> tuple[list[ParsedRow], list[str]]:
    """Fallback OCR parsing for scanned PDFs."""
    rows: list[ParsedRow] = []
    errors: list[str] = []

    try:
        import pytesseract
        from pdf2image import convert_from_path

        images = convert_from_path(file_path, dpi=300)
        full_text = ""
        for img in images:
            text = pytesseract.image_to_string(img, lang="spa+eng")
            full_text += text + "\n"

        # Simple line-based extraction for OCR output
        lines = full_text.split("\n")
        for line in lines:
            line = line.strip()
            if not line or len(line) < 5:
                continue
            if _is_skip_row([line]):
                continue

            # Look for pattern: description ... number ... number
            parts = re.split(r"\s{2,}", line)
            if len(parts) >= 2:
                desc = parts[0].strip()
                numbers = []
                for p in parts[1:]:
                    n = _clean_number(p)
                    if n is not None:
                        numbers.append(n)
                if desc and len(numbers) >= 1:
                    rows.append(ParsedRow(
                        description=desc,
                        quantity=numbers[0] if numbers else None,
                        unit_price=numbers[1] if len(numbers) > 1 else None,
                        raw_quantity=str(numbers[0]) if numbers else "",
                        raw_price=str(numbers[1]) if len(numbers) > 1 else "",
                    ))

    except ImportError:
        errors.append("pytesseract not available for OCR fallback")
    except Exception as e:
        errors.append(f"OCR parsing error: {e}")

    return rows, errors


def parse_pdf(file_path: str) -> tuple[list[ParsedRow], list[str]]:
    rows, errors = _parse_pdf_native(file_path)
    if not rows:
        logger.info("No rows from native PDF, trying OCR")
        rows, ocr_errors = _parse_pdf_ocr(file_path)
        errors.extend(ocr_errors)
    return rows, errors


# ── Excel / CSV Parsing ────────────────────────────────────────────────────────

def parse_excel(file_path: str) -> tuple[list[ParsedRow], list[str]]:
    rows: list[ParsedRow] = []
    errors: list[str] = []

    try:
        xl = pd.ExcelFile(file_path)
        for sheet in xl.sheet_names:
            df = xl.parse(sheet, header=None)
            # Find the header row (first row with non-numeric content)
            header_row = 0
            for i, row in df.iterrows():
                non_empty = [v for v in row if pd.notna(v) and str(v).strip()]
                if len(non_empty) >= 2:
                    header_row = i
                    break
            df = xl.parse(sheet, header=header_row)
            sheet_rows = _rows_from_dataframe(df)
            rows.extend(sheet_rows)
    except Exception as e:
        errors.append(f"Excel parsing error: {e}")

    return rows, errors


def parse_csv(file_path: str) -> tuple[list[ParsedRow], list[str]]:
    rows: list[ParsedRow] = []
    errors: list[str] = []

    try:
        for sep in [",", ";", "\t"]:
            try:
                df = pd.read_csv(file_path, sep=sep, encoding="utf-8-sig")
                if len(df.columns) >= 2:
                    rows = _rows_from_dataframe(df)
                    if rows:
                        break
            except Exception:
                continue
    except Exception as e:
        errors.append(f"CSV parsing error: {e}")

    return rows, errors


def parse_document(file_path: str, file_type: str) -> tuple[list[ParsedRow], list[str]]:
    ext = file_type.lower().lstrip(".")
    if ext == "pdf":
        return parse_pdf(file_path)
    elif ext in ("xlsx", "xls"):
        return parse_excel(file_path)
    elif ext == "csv":
        return parse_csv(file_path)
    else:
        return [], [f"Unsupported file type: {ext}"]
