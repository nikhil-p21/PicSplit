# backend/app.py
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
from google import genai
# from google.genai import types # This wasn't strictly necessary for the original code provided
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from fractions import Fraction
import io
import os
import traceback
import logging
from pathlib import Path # Added for robust .env loading

# --- Flask App Setup ---
# Adjust static folder for Render deployment (relative to backend/app.py)
# Assuming frontend build is in ../frontend/build
app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')
# --- End Flask App Setup ---

# --- Environment Variable Loading ---
# Use dotenv only for local development, Render provides env vars directly
from dotenv import load_dotenv
dotenv_path = Path(__file__).resolve().parent / '.env'
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Loaded .env file from: {dotenv_path} (for local development)")

# ---> Get API key directly from environment (THIS IS THE KEY CHANGE) <---
# Render will set this based on your dashboard configuration.
# Locally, load_dotenv will make it available if present in .env
# Use a distinct name to avoid confusion with the variable inside the route
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

# --- REMOVE /get-key endpoint ---
# It's insecure and no longer needed as frontend won't handle the key
# @app.route("/get-key")
# def get_key():
#     return {"key": server_api_key} # DO NOT EXPOSE KEY LIKE THIS
# --- End REMOVE /get-key ---


@app.route('/favicon.ico')
def favicon():
     # Adjust path if your react build structure is different ('static' is common in create-react-app)
    return send_from_directory(os.path.join(app.static_folder, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# --- Pydantic Models and Helper Functions (Keep exactly as original) ---
class BillItem(BaseModel):
    original_name: str
    normalized_name: str
    price_before_tax: float
    discount_amount: float = 0.0
    emoji: Optional[str] = None

class Bill(BaseModel):
    items: List[BillItem]
    total_bill: float

def get_tax_rate(item_name: str) -> float:
    name_lower = item_name.lower()
    if "plastic" in name_lower and "bag" in name_lower:
        return 0.10
    return 0.08

def parse_fraction(s: str) -> Fraction:
    try:
        return Fraction(s)
    except Exception:
        return Fraction(0)

def make_item_keys_unique(bill_data: Dict[str, Any]) -> Dict[str, Any]:
    items = bill_data.get("items", [])
    frequency = {}
    for item in items:
        name = item.get("normalized_name")
        frequency[name] = frequency.get(name, 0) + 1
    occurrence = {}
    for item in items:
        name = item.get("normalized_name")
        if frequency[name] > 1:
            occurrence[name] = occurrence.get(name, 0) + 1
            item["normalized_name"] = f"{name} {occurrence[name]}"
    return bill_data

# Small refinement based on prompt logic: assume discount amount is price_before_tax of discount line
def merge_discount_items(bill_data: Dict[str, Any]) -> Dict[str, Any]:
    items = bill_data.get("items", [])
    merged_items = []
    i = 0
    while i < len(items):
        current_item = items[i]
        # Check if next item exists and is a discount line
        if (i + 1 < len(items)) and ("code128割引" in items[i+1].get("original_name", "").lower()):
            discount_item = items[i+1]
            # Assign the price of the discount line as the discount amount to the item ABOVE it
            discount_value = discount_item.get("price_before_tax", 0.0)
            try:
                current_item["discount_amount"] = float(discount_value)
            except (ValueError, TypeError):
                 logger.warning(f"Could not parse discount amount ({discount_value}) for item {current_item.get('original_name', 'N/A')}. Setting discount to 0.")
                 current_item["discount_amount"] = 0.0

            merged_items.append(current_item)
            i += 2  # Skip the current item and the discount item
        else:
            # Ensure discount_amount exists even if no discount line follows
            if "discount_amount" not in current_item:
                 current_item["discount_amount"] = 0.0
            merged_items.append(current_item)
            i += 1
    bill_data["items"] = merged_items
    return bill_data
# --- End Pydantic Models and Helper Functions ---


# --- Static File Serving (Keep as original, adjusted path in Flask() constructor) ---
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
def process_bill():
    # ---> Check if server API key was loaded correctly <---
    if not server_api_key:
        logger.error("API_KEY environment variable is not set on the server.")
        return jsonify({"error": "Server configuration error. Cannot process request."}), 500

    try:
        # --- REMOVED API key retrieval from request ---
        # api_key = request.form.get('api_key') # REMOVED
        # if not api_key: # REMOVED
        #     return jsonify({"error": "API key is required"}), 400 # REMOVED
        # --- End REMOVED ---

        # Get the uploaded image (Keep as original)
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        image_file = request.files['image']

        # Process the image (Keep as original)
        try:
            image = Image.open(io.BytesIO(image_file.read()))
        except Exception as e:
            logger.error(f"Error opening image: {str(e)}")
            return jsonify({"error": f"Failed to open the image: {str(e)}"}), 400

        # ---> Create Gemini API client using the SERVER's API key <---
        try:
            # Use the server_api_key loaded from environment variable
            client = genai.Client(api_key=server_api_key)
        except Exception as e:
             logger.error(f"Failed to initialize GenAI client: {str(e)}")
             return jsonify({"error": "Failed to initialize AI service."}), 500
        # --- End API Client Creation Change ---


        # Prepare the prompt (Keep as original, maybe refine slightly for discount clarity)
        prompt = """
You are given a supermarket grocery bill in Japanese that may have been OCRed and translated.
The person who has the bill does not know Japanese and needs to translate the bill into English in order to split it manually with friends.
For supermarket bills, note that if an item has a discount, the discount is mentioned on the line immediately below the item and starts with "code128割引". The value shown on the discount line is the amount of the discount. Associate this discount value with the item immediately preceding it.

Extract the following details:

1. For each *actual purchased item* (ignore discount lines in the final item list), output:
   - "original_name": the original text of the item as recognized.
   - "normalized_name": a cleaned-up, common name for the item in plain English. Use your best judgment.
   - "price_before_tax": the base price as a number.
   - "discount_amount": the discount on *that* specific item as a positive number. If there is no discount associated with it, output 0.
   - "emoji": an appropriate emoji that represents this item.

2. Also extract the total bill amount as "total_bill".

Return a JSON object that conforms to this schema:
{
  "items": [
    {
      "original_name": "string",
      "normalized_name": "string",
      "price_before_tax": number,
      "discount_amount": number,
      "emoji": "string"
    },
    ...
  ],
  "total_bill": number
}

Return *only* the JSON object with no additional text or markdown formatting.
"""

        # Use the client to get model response (Keep exactly as original)
        try:
            response = client.models.generate_content(
                # Use a known vision model name
                model="gemini-2.0-flash", # Changed from gemini-2.0-flash
                contents=[prompt, image]
            )
        except Exception as e:
            logger.error(f"GenAI content generation failed: {str(e)}\nTraceback: {traceback.format_exc()}")
            return jsonify({"error": f"AI model processing failed: {str(e)}"}), 500


        # Parse the response (Keep as original)
        try:
            response_text = response.text
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].strip()

            # Use Pydantic (Keep as original)
            bill_data_raw = Bill.parse_raw(response_text).dict()

            # Process the bill data (Keep as original, using refined merge function)
            bill_data_merged = merge_discount_items(bill_data_raw) # Ensure discounts are handled
            bill_data_final = make_item_keys_unique(bill_data_merged)

            return jsonify(bill_data_final)

        except Exception as e:
            # Keep original parsing error handling
            raw_response_text = getattr(response, 'text', 'Response object has no text attribute')
            logger.error(f"Error parsing model response: {str(e)}\nTraceback: {traceback.format_exc()}\nResponse text: {raw_response_text}")
            return jsonify({"error": f"Failed to parse model response: {str(e)}", "raw_response": raw_response_text}), 500

    except Exception as e:
        # Keep original general error handling
        logger.error(f"Unexpected error in /api/process-bill: {str(e)}\nTraceback: {traceback.format_exc()}")
        return jsonify({"error": f"An unexpected server error occurred: {str(e)}"}), 500
# --- End API Endpoint (/api/process-bill) ---


# --- Main Execution ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Set debug=False for production on Render
    app.run(host='0.0.0.0', port=port, debug=False)
# --- End Main Execution ---