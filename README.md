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
