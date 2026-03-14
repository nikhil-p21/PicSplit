# PicSplit

PicSplit is a web app that allows users to split bills from images easily. Upload an image of a receipt, and the app extracts and divides the bill among participants.

## Features

- Extracts text from images to identify items and prices.
- Splits bills fairly among participants.
- User-friendly interface powered by Streamlit.
- Uses Poetry for package management.
- Local persistence for receipts and expenses via SQLite.

## Backend Persistence APIs (Phase 2)

The Flask backend now includes local data persistence for receipts, items, and expenses.

- `GET /api/health` - service + persistence health check.
- `GET /api/categories` - default expense categories.
- `POST /api/receipts` - save receipt metadata/items/participants/splits.
- `GET /api/receipts` - list saved receipts.
- `GET /api/receipts/<receipt_id>` - fetch one receipt with nested items/splits.
- `PATCH /api/receipts/<receipt_id>/items/<item_id>/category` - manual category override.
- `POST /api/expenses` - create a standalone expense record.
- `GET /api/expenses` - query expenses by date/category.
- `GET /api/dashboard/monthly?year=YYYY&month=MM` - monthly category breakdown for dashboard.

Local DB file:
- `backend/data/expenses.db` (ignored in git).

## Receipt Ingestion Pipeline (Phase 3)

`POST /api/process-bill` now runs a staged ingestion flow:
1. Validate multipart request and image
2. OCR + translation extraction via `gemini-2.0-flash`
3. Parse/normalize item output
4. Persist receipt + items to local SQLite (enabled by default)

Backward compatibility:
- Existing split flow still receives `items` + `total_bill` in the response.
- Additional metadata is included: `persisted`, `receipt_id`, `ingestion_stage`.

Optional multipart form fields:
- `persist` (`true|false`, default `true`)
- `fail_on_persist_error` (`true|false`, default `false`)
- `split_enabled`, `is_shared` (`true|false`)
- `participants` (JSON array)
- `allocations` (JSON object keyed by normalized item name)
- `merchant_name`, `receipt_date`, `currency`, `notes`, `source_type`

Alias endpoint:
- `POST /api/ingest-receipt` (same behavior as `/api/process-bill`)

## Categorization System (Phase 4)

Automatic categorization:
- OCR-extracted items are now auto-categorized during receipt ingestion.
- `/api/process-bill` response items include:
  - `category_name`
  - `category_source` (`auto` by default)
  - `id` (when persistence succeeds)

Categorization APIs:
- `POST /api/categorize-items` - categorize an array of item objects.
- `PATCH /api/receipts/<receipt_id>/items/<item_id>/category` - manual category override (`category_source` becomes `manual`).

Current split UI support:
- Allocation cards now show a category dropdown.
- Category changes are persisted via the PATCH endpoint when `receipt_id` + `item.id` are available.

## App Navigation (Phase 5)

The frontend now has a multi-view app shell with three primary sections:
- **Dashboard**: monthly spend totals + category visualizations.
- **Receipts**: saved receipt library with detail view and category override controls.
- **Split Bill**: existing 4-step bill-splitting workflow preserved for backward compatibility.

## Optional Split Mode (Phase 6)

The split flow now supports both personal and shared receipt ingestion:
- Step 1/2 includes a personal vs shared toggle.
- When **shared** is enabled:
  - Existing split workflow remains unchanged (`Add People -> Upload Bill -> Allocate Items -> View Split`).
  - Participant metadata is sent to `/api/process-bill` with `split_enabled=true` and `is_shared=true`.
- When **personal** is selected:
  - Receipt is still OCR-processed and persisted.
  - No participant metadata is sent (`participants=[]`, `split_enabled=false`, `is_shared=false`).
  - After success, the UI routes to the **Receipts** tab instead of allocation/split steps.

## Stabilization (Phase 7)

Regression coverage was added for the monthly dashboard aggregation logic:
- `backend/tests/test_monthly_dashboard.py`

What is validated:
- receipt item totals are included in monthly totals
- standalone manual expenses are included
- linked expense rows (`receipt_item_id` present) are excluded to avoid double-counting
- receipts without `receipt_date` still count for the month via `created_at`

Run tests:
```sh
python -m unittest discover -s backend/tests -p "test_*.py"
```

## Prerequisites

Ensure you have **Poetry** installed. If not, install it using:

```sh
pip install poetry
```

Additionally, add the Poetry shell plugin:

```sh
poetry self add poetry-plugin-shell
```

## Installation

Clone the repository and navigate to the project folder:

```sh
git clone https://github.com/nikhil-p21/PicSplit.git
cd PicSplit
```

Install dependencies using Poetry:

```sh
poetry install
```

## Running the Web App

Activate the virtual environment (if not already activated):

```sh
poetry shell
```

Run the Streamlit app:

```sh
streamlit run app.py
```

## Project Structure

```
📦 PicSplit
├── app.py          # Main Streamlit application file
├── pyproject.toml  # Poetry configuration file
├── README.md       # Project documentation
└── ...            # Other project files
```

## Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes and commit (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, feel free to reach out!
