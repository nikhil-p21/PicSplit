import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def _default_db_path() -> Path:
    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "expenses.db"


DB_PATH = Path(os.getenv("DATABASE_PATH", str(_default_db_path())))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                merchant_name TEXT,
                receipt_date TEXT,
                currency TEXT NOT NULL DEFAULT 'JPY',
                total_amount REAL,
                extracted_total REAL,
                is_shared INTEGER NOT NULL DEFAULT 0,
                split_enabled INTEGER NOT NULL DEFAULT 0,
                source_type TEXT NOT NULL DEFAULT 'uploaded_receipt',
                image_filename TEXT,
                raw_ocr_json TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS receipt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id INTEGER NOT NULL,
                original_name TEXT NOT NULL,
                normalized_name TEXT NOT NULL,
                quantity REAL NOT NULL DEFAULT 1.0,
                price_before_tax REAL NOT NULL DEFAULT 0.0,
                discount_amount REAL NOT NULL DEFAULT 0.0,
                tax_rate REAL NOT NULL DEFAULT 0.08,
                effective_total REAL NOT NULL DEFAULT 0.0,
                emoji TEXT,
                category_name TEXT NOT NULL DEFAULT 'Uncategorized',
                category_source TEXT NOT NULL DEFAULT 'auto',
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);

            CREATE TABLE IF NOT EXISTS participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                avatar_color TEXT,
                emoji TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_participants_receipt_id ON participants(receipt_id);

            CREATE TABLE IF NOT EXISTS item_splits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_item_id INTEGER NOT NULL,
                participant_id INTEGER NOT NULL,
                share_text TEXT NOT NULL DEFAULT '0',
                share_value REAL NOT NULL DEFAULT 0.0,
                allocated_cost REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(receipt_item_id) REFERENCES receipt_items(id) ON DELETE CASCADE,
                FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_item_splits_receipt_item_id ON item_splits(receipt_item_id);
            CREATE INDEX IF NOT EXISTS idx_item_splits_participant_id ON item_splits(participant_id);

            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'JPY',
                category_name TEXT NOT NULL DEFAULT 'Uncategorized',
                expense_date TEXT NOT NULL,
                is_shared INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                receipt_id INTEGER,
                receipt_item_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE SET NULL,
                FOREIGN KEY(receipt_item_id) REFERENCES receipt_items(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
            CREATE INDEX IF NOT EXISTS idx_expenses_category_name ON expenses(category_name);
            """
        )


@contextmanager
def session_scope():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
