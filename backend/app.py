# app.py
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from fractions import Fraction
import io
import os
import traceback
import logging

app = Flask(__name__, static_folder='./build', static_url_path='/')

from dotenv import load_dotenv
import os

load_dotenv()  # Loads from .env

api_key = os.getenv("API_KEY")
# print(api_key)
@app.route("/get-key")
def get_key():
    return {"key": api_key}

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.static_folder, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# Define Pydantic models for structured output
class BillItem(BaseModel):
    original_name: str
    normalized_name: str
    price_before_tax: float
    discount_amount: float = 0.0  # Default to 0 if no discount
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

def merge_discount_items(bill_data: Dict[str, Any]) -> Dict[str, Any]:
    items = bill_data.get("items", [])
    merged_items = []
    i = 0
    while i < len(items):
        current_item = items[i]
        if (i + 1 < len(items)) and ("code128割引" in items[i+1]["original_name"].lower()):
            discount_item = items[i+1]
            current_item["discount_amount"] = discount_item.get("discount_amount", 0)
            merged_items.append(current_item)
            i += 2  # Skip the discount item.
        else:
            merged_items.append(current_item)
            i += 1
    bill_data["items"] = merged_items
    return bill_data

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return app.send_static_file(path)
    else:
        return app.send_static_file('index.html')

@app.route('/api/process-bill', methods=['POST'])
def process_bill():
    try:
        # Get API key from request
        api_key = request.form.get('api_key')
        if not api_key:
            return jsonify({"error": "API key is required"}), 400

        # Get the uploaded image
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400

        image_file = request.files['image']

        # Process the image
        try:
            image = Image.open(io.BytesIO(image_file.read()))
        except Exception as e:
            logger.error(f"Error opening image: {str(e)}")
            return jsonify({"error": f"Failed to open the image: {str(e)}"}), 400

        # Create Gemini API client using your API key
        client = genai.Client(api_key=api_key)

        # Prepare the prompt
        prompt = """
You are given a supermarket grocery bill in Japanese that may have been OCRed and translated.
The person who has the bill does not know Japanese and needs to translate the bill into English in order to split it manually with friends.
For supermarket bills, note that if an item has a discount, the discount is mentioned on the line immediately below the item and starts with "code128割引". Associate that discount with the item immediately above it.

Extract the following details:

1. For each item, output:
   - "original_name": the original text of the item as recognized.
   - "normalized_name": a cleaned-up, common name for the item in plain English. Use your best judgment.
   - "price_before_tax": the base price as a number.
   - "discount_amount": the discount on that item as a number. If there is no discount, output 0.
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

Return only the JSON object with no additional text.
"""

        # Use the client to get model response
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, image]  # Using the PIL Image object directly
        )

        # Parse the response
        try:
            response_text = response.text
            # Sometimes the model might wrap the JSON in code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].strip()

            # Use Pydantic to validate and parse the JSON
            bill_data = Bill.parse_raw(response_text).dict()

            # Process the bill data
            bill_data = make_item_keys_unique(bill_data)
            bill_data = merge_discount_items(bill_data)

            return jsonify(bill_data)

        except Exception as e:
            logger.error(f"Error parsing model response: {str(e)}\nTraceback: {traceback.format_exc()}\nResponse: {response.text}")
            return jsonify({"error": f"Failed to parse model response: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}\nTraceback: {traceback.format_exc()}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
