import importlib
import os
import tempfile
import unittest
from datetime import date


class MonthlyDashboardRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_db_path = os.environ.get("DATABASE_PATH")
        self._tmp_dir = tempfile.TemporaryDirectory()
        os.environ["DATABASE_PATH"] = os.path.join(self._tmp_dir.name, "test_expenses.db")

        from backend.persistence import database, repository

        self.database = importlib.reload(database)
        self.repository = importlib.reload(repository)
        self.database.init_db()

    def tearDown(self) -> None:
        if self._previous_db_path is None:
            os.environ.pop("DATABASE_PATH", None)
        else:
            os.environ["DATABASE_PATH"] = self._previous_db_path
        self._tmp_dir.cleanup()

    def test_monthly_breakdown_includes_receipt_items_and_standalone_expenses(self):
        today = date.today()

        receipt_payload = {
            "merchant_name": "Test Mart",
            "receipt_date": today.isoformat(),
            "currency": "JPY",
            "total_amount": 180.0,
            "extracted_total": 180.0,
            "is_shared": False,
            "split_enabled": False,
            "source_type": "uploaded_receipt",
            "participants": [],
            "items": [
                {
                    "original_name": "Milk",
                    "normalized_name": "Milk",
                    "quantity": 1,
                    "price_before_tax": 0,
                    "discount_amount": 0,
                    "tax_rate": 0.08,
                    "effective_total": 100.0,
                    "category_name": "Groceries",
                    "category_source": "auto",
                    "splits": [],
                },
                {
                    "original_name": "Sandwich",
                    "normalized_name": "Sandwich",
                    "quantity": 1,
                    "price_before_tax": 0,
                    "discount_amount": 0,
                    "tax_rate": 0.08,
                    "effective_total": 80.0,
                    "category_name": "Dining",
                    "category_source": "auto",
                    "splits": [],
                },
            ],
        }

        with self.database.session_scope() as conn:
            created_receipt = self.repository.create_receipt(conn, receipt_payload)
            linked_item_id = created_receipt["items"][0]["id"]

            # Standalone expense row: should be counted.
            self.repository.create_expense(
                conn,
                {
                    "title": "Train ticket",
                    "amount": 280.0,
                    "currency": "JPY",
                    "category_name": "Transport",
                    "expense_date": today.isoformat(),
                    "is_shared": False,
                },
            )

            # Linked expense row: should be ignored to avoid double-counting receipt items.
            self.repository.create_expense(
                conn,
                {
                    "title": "Linked duplicate",
                    "amount": 999.0,
                    "currency": "JPY",
                    "category_name": "Groceries",
                    "expense_date": today.isoformat(),
                    "is_shared": False,
                    "receipt_id": created_receipt["id"],
                    "receipt_item_id": linked_item_id,
                },
            )

        with self.database.session_scope() as conn:
            report = self.repository.monthly_category_breakdown(conn, year=today.year, month=today.month)

        by_category = {
            row["category_name"]: row
            for row in report["category_breakdown"]
        }

        self.assertAlmostEqual(report["total_spend"], 460.0)
        self.assertEqual(report["expense_count"], 3)
        self.assertAlmostEqual(by_category["Groceries"]["amount"], 100.0)
        self.assertAlmostEqual(by_category["Dining"]["amount"], 80.0)
        self.assertAlmostEqual(by_category["Transport"]["amount"], 280.0)

    def test_monthly_breakdown_uses_created_at_when_receipt_date_missing(self):
        today = date.today()

        receipt_payload = {
            "merchant_name": "No Date Store",
            "receipt_date": None,
            "currency": "JPY",
            "total_amount": 320.0,
            "extracted_total": 320.0,
            "is_shared": False,
            "split_enabled": False,
            "source_type": "uploaded_receipt",
            "participants": [],
            "items": [
                {
                    "original_name": "Soap",
                    "normalized_name": "Soap",
                    "quantity": 1,
                    "price_before_tax": 0,
                    "discount_amount": 0,
                    "tax_rate": 0.08,
                    "effective_total": 320.0,
                    "category_name": "Shopping",
                    "category_source": "auto",
                    "splits": [],
                }
            ],
        }

        with self.database.session_scope() as conn:
            self.repository.create_receipt(conn, receipt_payload)

        with self.database.session_scope() as conn:
            report = self.repository.monthly_category_breakdown(conn, year=today.year, month=today.month)

        by_category = {
            row["category_name"]: row
            for row in report["category_breakdown"]
        }
        self.assertIn("Shopping", by_category)
        self.assertAlmostEqual(by_category["Shopping"]["amount"], 320.0)


if __name__ == "__main__":
    unittest.main()
