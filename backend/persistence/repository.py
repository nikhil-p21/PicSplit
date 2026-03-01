import json
import sqlite3
from datetime import date, datetime
from typing import Any

try:
    from backend.categorization import EXPENSE_CATEGORIES
except ModuleNotFoundError:
    from categorization import EXPENSE_CATEGORIES


DEFAULT_CATEGORIES = EXPENSE_CATEGORIES


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    return date.fromisoformat(str(value))


def _safe_float(value: Any, default: Any = 0.0) -> Any:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _effective_total(price_before_tax: float, discount_amount: float, tax_rate: float, quantity: float) -> float:
    return ((price_before_tax * (1 + tax_rate)) - discount_amount) * quantity


def _to_bool(value: Any) -> bool:
    return bool(int(value)) if value is not None else False


def _serialize_split(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "participant_id": row["participant_id"],
        "share_text": row["share_text"],
        "share_value": row["share_value"],
        "allocated_cost": row["allocated_cost"],
    }


def _fetch_splits_by_item(conn: sqlite3.Connection, item_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM item_splits WHERE receipt_item_id = ? ORDER BY id",
        (item_id,),
    ).fetchall()
    return [_serialize_split(row) for row in rows]


def _serialize_item(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "receipt_id": row["receipt_id"],
        "original_name": row["original_name"],
        "normalized_name": row["normalized_name"],
        "quantity": row["quantity"],
        "price_before_tax": row["price_before_tax"],
        "discount_amount": row["discount_amount"],
        "tax_rate": row["tax_rate"],
        "effective_total": row["effective_total"],
        "emoji": row["emoji"],
        "category_name": row["category_name"],
        "category_source": row["category_source"],
        "notes": row["notes"],
        "splits": _fetch_splits_by_item(conn, row["id"]),
    }


def _fetch_items(conn: sqlite3.Connection, receipt_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id",
        (receipt_id,),
    ).fetchall()
    return [_serialize_item(conn, row) for row in rows]


def _fetch_participants(conn: sqlite3.Connection, receipt_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM participants WHERE receipt_id = ? ORDER BY id",
        (receipt_id,),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "receipt_id": row["receipt_id"],
            "name": row["name"],
            "avatar_color": row["avatar_color"],
            "emoji": row["emoji"],
        }
        for row in rows
    ]


def _serialize_receipt(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    raw_ocr_json = row["raw_ocr_json"]
    if raw_ocr_json:
        try:
            raw_ocr_json = json.loads(raw_ocr_json)
        except json.JSONDecodeError:
            pass

    return {
        "id": row["id"],
        "merchant_name": row["merchant_name"],
        "receipt_date": row["receipt_date"],
        "currency": row["currency"],
        "total_amount": row["total_amount"],
        "extracted_total": row["extracted_total"],
        "is_shared": _to_bool(row["is_shared"]),
        "split_enabled": _to_bool(row["split_enabled"]),
        "source_type": row["source_type"],
        "image_filename": row["image_filename"],
        "raw_ocr_json": raw_ocr_json,
        "notes": row["notes"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "participants": _fetch_participants(conn, row["id"]),
        "items": _fetch_items(conn, row["id"]),
    }


def list_receipts(conn: sqlite3.Connection, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM receipts ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    return [_serialize_receipt(conn, row) for row in rows]


def get_receipt(conn: sqlite3.Connection, receipt_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM receipts WHERE id = ?",
        (receipt_id,),
    ).fetchone()
    if row is None:
        return None
    return _serialize_receipt(conn, row)


def create_receipt(conn: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    now = _now_iso()
    receipt_date = _parse_date(payload.get("receipt_date"))
    raw_ocr_json = payload.get("raw_ocr_json")
    if isinstance(raw_ocr_json, (dict, list)):
        raw_ocr_json = json.dumps(raw_ocr_json, ensure_ascii=False)
    elif raw_ocr_json is not None:
        raw_ocr_json = str(raw_ocr_json)

    cursor = conn.execute(
        """
        INSERT INTO receipts (
            merchant_name, receipt_date, currency, total_amount, extracted_total,
            is_shared, split_enabled, source_type, image_filename, raw_ocr_json, notes,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.get("merchant_name"),
            receipt_date.isoformat() if receipt_date else None,
            payload.get("currency", "JPY"),
            _safe_float(payload.get("total_amount"), None),
            _safe_float(payload.get("extracted_total"), None),
            1 if payload.get("is_shared", False) else 0,
            1 if payload.get("split_enabled", False) else 0,
            payload.get("source_type", "uploaded_receipt"),
            payload.get("image_filename"),
            raw_ocr_json,
            payload.get("notes"),
            now,
            now,
        ),
    )
    receipt_id = cursor.lastrowid

    participant_name_to_id: dict[str, int] = {}
    for participant_payload in payload.get("participants", []):
        participant_cursor = conn.execute(
            """
            INSERT INTO participants (receipt_id, name, avatar_color, emoji, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                receipt_id,
                participant_payload["name"],
                participant_payload.get("avatar_color"),
                participant_payload.get("emoji"),
                now,
                now,
            ),
        )
        participant_name_to_id[participant_payload["name"]] = participant_cursor.lastrowid

    for item_payload in payload.get("items", []):
        quantity = _safe_float(item_payload.get("quantity"), 1.0)
        price_before_tax = _safe_float(item_payload.get("price_before_tax"), 0.0)
        discount_amount = _safe_float(item_payload.get("discount_amount"), 0.0)
        tax_rate = _safe_float(item_payload.get("tax_rate"), 0.08)
        effective_total = _safe_float(
            item_payload.get("effective_total"),
            _effective_total(price_before_tax, discount_amount, tax_rate, quantity),
        )

        item_cursor = conn.execute(
            """
            INSERT INTO receipt_items (
                receipt_id, original_name, normalized_name, quantity, price_before_tax,
                discount_amount, tax_rate, effective_total, emoji, category_name, category_source, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                receipt_id,
                item_payload.get("original_name", item_payload.get("normalized_name", "Unnamed item")),
                item_payload.get("normalized_name", item_payload.get("original_name", "Unnamed item")),
                quantity,
                price_before_tax,
                discount_amount,
                tax_rate,
                effective_total,
                item_payload.get("emoji"),
                item_payload.get("category_name", "Uncategorized"),
                item_payload.get("category_source", "auto"),
                item_payload.get("notes"),
                now,
                now,
            ),
        )
        item_id = item_cursor.lastrowid

        for split_payload in item_payload.get("splits", []):
            participant_id = split_payload.get("participant_id")
            if participant_id is None and split_payload.get("participant_name"):
                participant_id = participant_name_to_id.get(split_payload["participant_name"])
            if participant_id is None:
                continue

            conn.execute(
                """
                INSERT INTO item_splits (
                    receipt_item_id, participant_id, share_text, share_value, allocated_cost,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id,
                    int(participant_id),
                    str(split_payload.get("share_text", "0")),
                    _safe_float(split_payload.get("share_value"), 0.0),
                    _safe_float(split_payload.get("allocated_cost"), 0.0),
                    now,
                    now,
                ),
            )

    return get_receipt(conn, int(receipt_id))


def update_receipt_item_category(
    conn: sqlite3.Connection,
    receipt_id: int,
    item_id: int,
    category_name: str,
    category_source: str = "manual",
) -> dict[str, Any] | None:
    now = _now_iso()
    cursor = conn.execute(
        """
        UPDATE receipt_items
        SET category_name = ?, category_source = ?, updated_at = ?
        WHERE id = ? AND receipt_id = ?
        """,
        (category_name, category_source, now, item_id, receipt_id),
    )
    if cursor.rowcount == 0:
        return None

    row = conn.execute(
        "SELECT * FROM receipt_items WHERE id = ?",
        (item_id,),
    ).fetchone()
    if row is None:
        return None
    return _serialize_item(conn, row)


def serialize_expense(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "amount": row["amount"],
        "currency": row["currency"],
        "category_name": row["category_name"],
        "expense_date": row["expense_date"],
        "is_shared": _to_bool(row["is_shared"]),
        "notes": row["notes"],
        "receipt_id": row["receipt_id"],
        "receipt_item_id": row["receipt_item_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_expense(conn: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    now = _now_iso()
    expense_date = _parse_date(payload.get("expense_date")) or date.today()

    cursor = conn.execute(
        """
        INSERT INTO expenses (
            title, amount, currency, category_name, expense_date, is_shared, notes,
            receipt_id, receipt_item_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["title"],
            _safe_float(payload.get("amount"), 0.0),
            payload.get("currency", "JPY"),
            payload.get("category_name", "Uncategorized"),
            expense_date.isoformat(),
            1 if payload.get("is_shared", False) else 0,
            payload.get("notes"),
            payload.get("receipt_id"),
            payload.get("receipt_item_id"),
            now,
            now,
        ),
    )
    expense_id = cursor.lastrowid

    row = conn.execute(
        "SELECT * FROM expenses WHERE id = ?",
        (expense_id,),
    ).fetchone()
    return serialize_expense(row)


def list_expenses(
    conn: sqlite3.Connection,
    start_date: date | None = None,
    end_date: date | None = None,
    category_name: str | None = None,
    limit: int = 500,
) -> list[dict[str, Any]]:
    where_clauses: list[str] = []
    params: list[Any] = []

    if start_date:
        where_clauses.append("expense_date >= ?")
        params.append(start_date.isoformat())
    if end_date:
        where_clauses.append("expense_date <= ?")
        params.append(end_date.isoformat())
    if category_name:
        where_clauses.append("category_name = ?")
        params.append(category_name)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    params.append(limit)

    rows = conn.execute(
        f"""
        SELECT * FROM expenses
        {where_sql}
        ORDER BY expense_date DESC, created_at DESC
        LIMIT ?
        """,
        tuple(params),
    ).fetchall()
    return [serialize_expense(row) for row in rows]


def monthly_category_breakdown(conn: sqlite3.Connection, year: int, month: int) -> dict[str, Any]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    rows = conn.execute(
        """
        WITH normalized_expenses AS (
            -- Standalone expense entries (do not double count rows already linked to receipt_items)
            SELECT
                COALESCE(NULLIF(TRIM(e.category_name), ''), 'Uncategorized') AS category_name,
                e.amount AS amount
            FROM expenses e
            WHERE e.expense_date >= ? AND e.expense_date < ?
              AND e.receipt_item_id IS NULL

            UNION ALL

            -- Receipt-ingested item rows
            SELECT
                COALESCE(NULLIF(TRIM(ri.category_name), ''), 'Uncategorized') AS category_name,
                ri.effective_total AS amount
            FROM receipt_items ri
            INNER JOIN receipts r ON r.id = ri.receipt_id
            WHERE DATE(COALESCE(NULLIF(r.receipt_date, ''), SUBSTR(r.created_at, 1, 10))) >= ?
              AND DATE(COALESCE(NULLIF(r.receipt_date, ''), SUBSTR(r.created_at, 1, 10))) < ?
        )
        SELECT
            category_name,
            SUM(amount) AS total_amount,
            COUNT(*) AS expense_count
        FROM normalized_expenses
        GROUP BY category_name
        ORDER BY total_amount DESC
        """,
        (start.isoformat(), end.isoformat(), start.isoformat(), end.isoformat()),
    ).fetchall()

    category_breakdown = [
        {
            "category_name": row["category_name"],
            "amount": float(row["total_amount"] or 0.0),
            "expense_count": int(row["expense_count"] or 0),
        }
        for row in rows
    ]
    total_spend = sum(row["amount"] for row in category_breakdown)
    expense_count = sum(row["expense_count"] for row in category_breakdown)

    return {
        "month": f"{year:04d}-{month:02d}",
        "total_spend": total_spend,
        "expense_count": expense_count,
        "category_breakdown": category_breakdown,
    }
