# backend/app.py
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
from google import genai
# from google.genai import types # This wasn't strictly necessary for the original code provided
from pydantic import BaseModel, Field
from datetime import date
from typing import List, Dict, Any, Optional
from fractions import Fraction
import io
import os
import json
import traceback
import logging
from pathlib import Path # Added for robust .env loading

try:
    from backend.categorization import EXPENSE_CATEGORIES, categorize_items, infer_item_category
except ModuleNotFoundError:
    from categorization import EXPENSE_CATEGORIES, categorize_items, infer_item_category

try:
    from backend.persistence.database import DATABASE_URL, init_db, session_scope
    from backend.persistence.repository import (
        DEFAULT_CATEGORIES,
        create_expense,
        create_receipt,
        get_receipt,
        list_expenses,
        list_receipts,
        monthly_category_breakdown,
        update_receipt_item_category,
    )
except ModuleNotFoundError:
    # Fallback when running from the backend directory directly.
    from persistence.database import DATABASE_URL, init_db, session_scope
    from persistence.repository import (
        DEFAULT_CATEGORIES,
        create_expense,
        create_receipt,
        get_receipt,
        list_expenses,
        list_receipts,
        monthly_category_breakdown,
        update_receipt_item_category,
    )

# --- Flask App Setup ---
# Assuming frontend build is in ../frontend/build
app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')
# --- End Flask App Setup ---

# --- Environment Variable Loading ---
from dotenv import load_dotenv
dotenv_path = Path(__file__).resolve().parent / '.env'
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Loaded .env file from: {dotenv_path} (for local development)")

server_api_key = os.getenv("API_KEY")

if not server_api_key:
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!! WARNING: API_KEY environment variable not set.     !!!")
    print("!!! '/api/process-bill' endpoint will fail without it. !!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
# --- End Environment Variable Loading ---


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize local persistence at startup.
init_db()
logger.info("Persistence initialized. DATABASE_URL=%s", DATABASE_URL)


@app.route('/favicon.ico')
def favicon():
     # Adjust path if your react build structure is different ('static' is common in create-react-app)
    return send_from_directory(os.path.join(app.static_folder, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# --- Constants ---
MAX_IMAGE_DIMENSION = 1024
IMAGE_QUALITY = 85


# --- Image Optimization ---
def _optimize_image_for_ocr(image: Image.Image) -> Image.Image:
    """Resize and compress the image to reduce API token usage while
    preserving OCR quality.  The longest edge is capped at
    MAX_IMAGE_DIMENSION pixels."""
    width, height = image.size
    if max(width, height) > MAX_IMAGE_DIMENSION:
        scale = MAX_IMAGE_DIMENSION / max(width, height)
        new_size = (int(width * scale), int(height * scale))
        image = image.resize(new_size, Image.LANCZOS)

    # Convert RGBA / palette images to RGB so we can save as JPEG.
    if image.mode in ("RGBA", "P", "LA"):
        image = image.convert("RGB")

    # Re-encode as JPEG in-memory to trim file size.
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=IMAGE_QUALITY)
    buf.seek(0)
    return Image.open(buf)


# --- Pydantic Models ---
class BillItem(BaseModel):
    original_name: str = Field(description="The original text of the item exactly as printed on the receipt.")
    normalized_name: str = Field(description="A cleaned-up, common English name for the item.")
    quantity: float = Field(description="The quantity purchased. Output 1 if not listed.")
    price_before_tax: float = Field(description="The unit price before tax for one unit of this item.")
    discount_amount: float = Field(description="The discount applied to this item as a positive number. Output 0 if none.")
    tax_rate: float = Field(description="The tax rate applied to this item as a decimal (e.g. 0.08 for 8%). Output 0 if unknown.")
    category_suggestion: str = Field(description="A suggested expense category for this item. One of: Groceries, Dining, Transport, Utilities, Entertainment, Shopping, Healthcare, Travel, Education, Subscriptions, Miscellaneous, Uncategorized.")
    emoji: str = Field(description="An appropriate emoji representing this item.")


class Bill(BaseModel):
    merchant_name: str = Field(description="The name of the store or restaurant. Output empty string if not visible.")
    receipt_date: str = Field(description="The date on the receipt in YYYY-MM-DD format. Output empty string if not visible.")
    currency: str = Field(description="The ISO 4217 currency code (e.g. USD, EUR, JPY).")
    items: List[BillItem]
    tax_amount: float = Field(description="The total tax amount shown on the receipt. Output 0 if unknown.")
    tip_amount: float = Field(description="The tip amount if shown. Output 0 if none or not applicable.")
    total_bill: float = Field(description="The final total amount on the receipt.")


PROCESS_BILL_PROMPT = """
You are an expert AI system for extracting structured data from photos of receipts, invoices, and bills.

Analyze the provided receipt image carefully. The receipt may be in *any* language.

For each purchased item on the receipt:
- "original_name": copy the item text exactly as printed.
- "normalized_name": translate / clean up the name into simple, everyday English.
- "quantity": the quantity purchased (default 1 if not listed).
- "price_before_tax": the unit price before tax.
- "discount_amount": the discount on this specific item as a positive number. Discounts may appear as negative line items, percentage reductions, or separate discount lines right below an item. Associate each discount with the correct item. If none, output 0.
- "tax_rate": the tax rate for this item as a decimal (e.g. 0.10 for 10%). If the receipt does not show per-item tax, output 0.
- "category_suggestion": suggest exactly ONE of these categories: Groceries, Dining, Transport, Utilities, Entertainment, Shopping, Healthcare, Travel, Education, Subscriptions, Miscellaneous, Uncategorized.
- "emoji": an appropriate emoji for this item.

Also extract receipt-level information:
- "merchant_name": the store / restaurant name, if visible.
- "receipt_date": the date on the receipt in YYYY-MM-DD format, if visible.
- "currency": the ISO 4217 currency code (e.g. USD, EUR, JPY).
- "tax_amount": the total tax shown on the receipt (0 if not shown).
- "tip_amount": the tip if present (0 if none).
- "total_bill": the final total amount.

IMPORTANT:
- Do NOT include discount lines, subtotal lines, tax lines, or tip lines as items.
- Only include actual purchased products or services.
- If a discount line (e.g. a coupon, "割引", or negative value) appears directly below an item, apply it as that item's discount_amount and do NOT output it as a separate item.
"""


def _parse_bool_form_value(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_json_form_value(field_name: str, default: Any) -> Any:
    raw = request.form.get(field_name)
    if raw in (None, ""):
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON for form field '{field_name}': {str(e)}")





def _parse_share_value(share_text: Any) -> float:
    parsed = parse_fraction(str(share_text).strip()) if share_text is not None else Fraction(0)
    try:
        value = float(parsed)
    except Exception:
        return 0.0
    return value if value > 0 else 0.0


def _add_auto_categories_to_bill_data(bill_data: Dict[str, Any]) -> Dict[str, Any]:
    items = bill_data.get("items", [])
    bill_data["items"] = categorize_items(items)
    return bill_data


def _build_receipt_payload_from_ingestion(
    bill_data: Dict[str, Any],
    image_filename: Optional[str],
    metadata: Dict[str, Any],
    raw_ocr_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Transform the LLM-extracted bill_data into the persistence-layer
    receipt payload.  Uses LLM-extracted tax_rate, quantity, and
    category_suggestion instead of hardcoded values."""
    participants = metadata.get("participants") or []
    allocations = metadata.get("allocations") or {}

    payload_items: List[Dict[str, Any]] = []
    for item in bill_data.get("items", []):
        item_name = item.get("normalized_name", "Unnamed item")
        item_allocation = allocations.get(item_name, {})
        total_quantity = float(item_allocation.get("totalQuantity", 0) or 0)
        if total_quantity <= 0:
            total_quantity = float(item.get("quantity", 1) or 1)
        shares = item_allocation.get("shares", {})

        # Use the LLM-extracted tax rate; fall back to 0 if missing.
        tax_rate = float(item.get("tax_rate", 0.0))
        price_before_tax = float(item.get("price_before_tax", 0.0))
        discount_amount = float(item.get("discount_amount", 0.0))
        effective_total = (price_before_tax * total_quantity * (1 + tax_rate)) - discount_amount

        split_rows: List[Dict[str, Any]] = []
        if isinstance(shares, dict) and participants:
            unit_cost = effective_total / total_quantity if total_quantity > 0 else 0.0
            for participant in participants:
                participant_name = participant.get("name")
                if not participant_name:
                    continue

                share_text = shares.get(str(participant.get("id")))
                if share_text is None and participant.get("id") is not None:
                    share_text = shares.get(participant.get("id"))
                if share_text is None:
                    continue

                share_value = _parse_share_value(share_text)
                if share_value <= 0:
                    continue

                split_rows.append({
                    "participant_name": participant_name,
                    "share_text": str(share_text),
                    "share_value": share_value,
                    "allocated_cost": share_value * unit_cost,
                })

        # Prefer the LLM's category suggestion; fall back to keyword matcher.
        llm_category = item.get("category_suggestion")
        category_name = (
            item.get("category_name")
            or (llm_category if llm_category and llm_category != "Uncategorized" else None)
            or infer_item_category(item_name, item.get("original_name"))
        )

        payload_items.append({
            "original_name": item.get("original_name", item_name),
            "normalized_name": item_name,
            "quantity": total_quantity,
            "price_before_tax": price_before_tax,
            "discount_amount": discount_amount,
            "tax_rate": tax_rate,
            "effective_total": effective_total,
            "emoji": item.get("emoji"),
            "category_name": category_name,
            "category_source": item.get("category_source", "auto"),
            "splits": split_rows,
        })

    # Use LLM-extracted merchant / date / currency if the user didn't
    # manually supply them in the form data.
    return {
        "merchant_name": metadata.get("merchant_name") or bill_data.get("merchant_name"),
        "receipt_date": metadata.get("receipt_date") or bill_data.get("receipt_date"),
        "currency": metadata.get("currency") or bill_data.get("currency", "USD"),
        "total_amount": bill_data.get("total_bill"),
        "extracted_total": bill_data.get("total_bill"),
        "is_shared": metadata.get("is_shared", False),
        "split_enabled": metadata.get("split_enabled", False),
        "source_type": metadata.get("source_type", "uploaded_receipt"),
        "image_filename": image_filename,
        "raw_ocr_json": raw_ocr_payload,
        "notes": metadata.get("notes"),
        "participants": [
            {
                "name": participant.get("name"),
                "avatar_color": participant.get("avatar_color", participant.get("avatarColor")),
                "emoji": participant.get("emoji"),
            }
            for participant in participants
            if participant.get("name")
        ],
        "items": payload_items,
    }


def parse_fraction(s: str) -> Fraction:
    try:
        return Fraction(s)
    except Exception:
        return Fraction(0)


def make_item_keys_unique(bill_data: Dict[str, Any]) -> Dict[str, Any]:
    items = bill_data.get("items", [])
    frequency: Dict[str, int] = {}
    for item in items:
        name = item.get("normalized_name")
        frequency[name] = frequency.get(name, 0) + 1
    occurrence: Dict[str, int] = {}
    for item in items:
        name = item.get("normalized_name")
        if frequency[name] > 1:
            occurrence[name] = occurrence.get(name, 0) + 1
            item["normalized_name"] = f"{name} {occurrence[name]}"
    return bill_data
# --- End Pydantic Models and Helper Functions ---


def _parse_int_query_param(name: str, default: int) -> int:
    raw_value = request.args.get(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        raise ValueError(f"Invalid '{name}' query parameter.")


def _parse_iso_date(value: Optional[str], field_name: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid '{field_name}' date format. Use YYYY-MM-DD.")


# --- Persistence API Endpoints ---
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "database_url": DATABASE_URL,
    })


@app.route('/api/categories', methods=['GET'])
def categories():
    return jsonify({"categories": DEFAULT_CATEGORIES})


@app.route('/api/categorize-items', methods=['POST'])
def categorize_items_endpoint():
    try:
        payload = request.get_json(silent=True) or {}
        items = payload.get("items")
        if not isinstance(items, list):
            return jsonify({"error": "'items' must be an array."}), 400

        categorized = categorize_items(items)
        return jsonify({"items": categorized, "categories": EXPENSE_CATEGORIES})
    except Exception as e:
        logger.error("Failed to categorize items: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to categorize items: {str(e)}"}), 500


@app.route('/api/receipts', methods=['POST'])
def create_receipt_record():
    try:
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "Invalid JSON payload."}), 400

        with session_scope() as session:
            created = create_receipt(session, payload)

        return jsonify(created), 201
    except Exception as e:
        logger.error("Failed to create receipt: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to create receipt: {str(e)}"}), 500


@app.route('/api/receipts', methods=['GET'])
def get_receipt_records():
    try:
        limit = max(1, min(_parse_int_query_param("limit", 100), 500))
        offset = max(0, _parse_int_query_param("offset", 0))

        with session_scope() as session:
            receipts = list_receipts(session, limit=limit, offset=offset)

        return jsonify({"receipts": receipts, "limit": limit, "offset": offset})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error("Failed to list receipts: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to list receipts: {str(e)}"}), 500


@app.route('/api/receipts/<int:receipt_id>', methods=['GET'])
def get_receipt_record(receipt_id: int):
    try:
        with session_scope() as session:
            receipt = get_receipt(session, receipt_id)
        if receipt is None:
            return jsonify({"error": "Receipt not found."}), 404
        return jsonify(receipt)
    except Exception as e:
        logger.error("Failed to fetch receipt %s: %s\n%s", receipt_id, str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to fetch receipt: {str(e)}"}), 500


@app.route('/api/receipts/<int:receipt_id>/items/<int:item_id>/category', methods=['PATCH'])
def patch_receipt_item_category(receipt_id: int, item_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        category_name = payload.get("category_name")
        if not category_name:
            return jsonify({"error": "'category_name' is required."}), 400

        category_source = payload.get("category_source", "manual")
        with session_scope() as session:
            item = update_receipt_item_category(
                conn=session,
                receipt_id=receipt_id,
                item_id=item_id,
                category_name=category_name,
                category_source=category_source,
            )
        if item is None:
            return jsonify({"error": "Receipt item not found."}), 404
        return jsonify(item)
    except Exception as e:
        logger.error(
            "Failed to update category for receipt=%s item=%s: %s\n%s",
            receipt_id,
            item_id,
            str(e),
            traceback.format_exc(),
        )
        return jsonify({"error": f"Failed to update category: {str(e)}"}), 500


@app.route('/api/expenses', methods=['POST'])
def create_expense_record():
    try:
        payload = request.get_json(silent=True) or {}
        if not payload.get("title"):
            return jsonify({"error": "'title' is required."}), 400
        if payload.get("amount") is None:
            return jsonify({"error": "'amount' is required."}), 400

        with session_scope() as session:
            expense = create_expense(session, payload)
        return jsonify(expense), 201
    except Exception as e:
        logger.error("Failed to create expense: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to create expense: {str(e)}"}), 500


@app.route('/api/expenses', methods=['GET'])
def get_expense_records():
    try:
        limit = max(1, min(_parse_int_query_param("limit", 500), 2000))
        start_date = _parse_iso_date(request.args.get("start_date"), "start_date")
        end_date = _parse_iso_date(request.args.get("end_date"), "end_date")
        category_name = request.args.get("category_name")

        with session_scope() as session:
            expenses = list_expenses(
                conn=session,
                start_date=start_date,
                end_date=end_date,
                category_name=category_name,
                limit=limit,
            )
        return jsonify({"expenses": expenses, "limit": limit})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error("Failed to list expenses: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to list expenses: {str(e)}"}), 500


@app.route('/api/dashboard/monthly', methods=['GET'])
def monthly_dashboard():
    try:
        today = date.today()
        year = _parse_int_query_param("year", today.year)
        month = _parse_int_query_param("month", today.month)
        if month < 1 or month > 12:
            return jsonify({"error": "'month' must be between 1 and 12."}), 400

        with session_scope() as session:
            report = monthly_category_breakdown(session, year=year, month=month)
        return jsonify(report)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error("Failed to build monthly dashboard: %s\n%s", str(e), traceback.format_exc())
        return jsonify({"error": f"Failed to build monthly dashboard: {str(e)}"}), 500
# --- End Persistence API Endpoints ---


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    full_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(full_path):
         if os.path.isfile(full_path):
             return send_from_directory(app.static_folder, path)
    # Fallback for SPA routing
    return send_from_directory(app.static_folder, 'index.html')
# --- End Static File Serving ---


# --- API Endpoint (/api/process-bill) ---
@app.route('/api/process-bill', methods=['POST'])
@app.route('/api/ingest-receipt', methods=['POST'])
def process_bill():
    # ---> Check if server API key was loaded correctly <---
    if not server_api_key:
        logger.error("API_KEY environment variable is not set on the server.")
        return jsonify({"error": "Server configuration error. Cannot process request."}), 500

    try:
        # Stage 1: Validate request + get uploaded image
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        image_file = request.files['image']
        image_filename = image_file.filename

        should_persist = _parse_bool_form_value(request.form.get("persist"), default=True)
        fail_on_persist_error = _parse_bool_form_value(request.form.get("fail_on_persist_error"), default=False)
        split_enabled = _parse_bool_form_value(request.form.get("split_enabled"), default=False)
        is_shared = _parse_bool_form_value(request.form.get("is_shared"), default=split_enabled)

        try:
            participants = _parse_json_form_value("participants", default=[])
            allocations = _parse_json_form_value("allocations", default={})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # Stage 2: Load and optimize image
        try:
            image_bytes = image_file.read()
            image = Image.open(io.BytesIO(image_bytes))
            image = _optimize_image_for_ocr(image)
            logger.info(
                "Image optimized: %s -> %dx%d",
                image_filename,
                image.size[0],
                image.size[1],
            )
        except Exception as e:
            logger.error(f"Error opening image: {str(e)}")
            return jsonify({"error": f"Failed to open the image: {str(e)}"}), 400

        # Stage 3: Initialize AI client
        try:
            client = genai.Client(api_key=server_api_key)
        except Exception as e:
             logger.error(f"Failed to initialize GenAI client: {str(e)}")
             return jsonify({"error": "Failed to initialize AI service."}), 500

        # Stage 4: OCR + extraction with Gemini (structured output)
        try:
            from google.genai import types as genai_types

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[PROCESS_BILL_PROMPT, image],
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Bill,
                ),
            )
        except Exception as e:
            logger.error(f"GenAI content generation failed: {str(e)}\nTraceback: {traceback.format_exc()}")
            return jsonify({"error": f"AI model processing failed: {str(e)}"}), 500

        # Stage 5: Parse and normalize extraction output
        raw_response_text = getattr(response, 'text', '')
        try:
            bill_data_raw = json.loads(raw_response_text)

            # Validate through Pydantic and convert to dict
            bill_validated = Bill.model_validate(bill_data_raw)
            bill_data_final = bill_validated.model_dump()

            bill_data_final = make_item_keys_unique(bill_data_final)
            raw_ocr_payload = {
                "model": "gemini-2.0-flash",
                "response_text": raw_response_text,
            }

            # Stage 6: Persist extracted receipt (optional, enabled by default)
            receipt_id = None
            created_receipt = None
            persistence_warning = None
            if should_persist:
                receipt_metadata = {
                    "merchant_name": request.form.get("merchant_name"),
                    "receipt_date": request.form.get("receipt_date"),
                    "currency": request.form.get("currency"),
                    "source_type": request.form.get("source_type") or "uploaded_receipt",
                    "notes": request.form.get("notes"),
                    "split_enabled": split_enabled,
                    "is_shared": is_shared,
                    "participants": participants if isinstance(participants, list) else [],
                    "allocations": allocations if isinstance(allocations, dict) else {},
                }

                try:
                    receipt_payload = _build_receipt_payload_from_ingestion(
                        bill_data=bill_data_final,
                        image_filename=image_filename,
                        metadata=receipt_metadata,
                        raw_ocr_payload=raw_ocr_payload,
                    )
                    with session_scope() as session:
                        created_receipt = create_receipt(session, receipt_payload)
                    receipt_id = created_receipt.get("id")
                except Exception as e:
                    logger.error("Receipt persistence failed: %s\n%s", str(e), traceback.format_exc())
                    if fail_on_persist_error:
                        return jsonify({"error": f"Failed to persist processed receipt: {str(e)}"}), 500
                    persistence_warning = f"Receipt processed but not saved: {str(e)}"

            response_payload = {**bill_data_final}
            response_payload["persisted"] = bool(receipt_id)
            response_payload["receipt_id"] = receipt_id
            response_payload["ingestion_stage"] = "complete"

            if receipt_id:
                persisted_items_by_name = {
                    persisted_item.get("normalized_name"): persisted_item
                    for persisted_item in (created_receipt or {}).get("items", [])
                }
                for item in response_payload.get("items", []):
                    persisted_item = persisted_items_by_name.get(item.get("normalized_name"))
                    if persisted_item:
                        item["id"] = persisted_item.get("id")
                        item["category_name"] = persisted_item.get("category_name", item.get("category_name"))
                        item["category_source"] = persisted_item.get("category_source", item.get("category_source"))

            if persistence_warning:
                response_payload["persistence_warning"] = persistence_warning

            return jsonify(response_payload)

        except Exception as e:
            logger.error(f"Error parsing model response: {str(e)}\nTraceback: {traceback.format_exc()}\nResponse text: {raw_response_text}")
            return jsonify({"error": f"Failed to parse model response: {str(e)}", "raw_response": raw_response_text}), 500

    except Exception as e:
        logger.error(f"Unexpected error in /api/process-bill: {str(e)}\nTraceback: {traceback.format_exc()}")
        return jsonify({"error": f"An unexpected server error occurred: {str(e)}"}), 500
# --- End API Endpoint (/api/process-bill) ---


# --- Main Execution ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Set debug=False for production on Render
    app.run(host='0.0.0.0', port=port, debug=False)
# --- End Main Execution ---
