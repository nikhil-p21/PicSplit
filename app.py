import streamlit as st
from PIL import Image
from google import genai  # Ensure this is installed and properly configured
from pydantic import BaseModel
from typing import List
from fractions import Fraction

# ------------------ Helper Function for Fraction Parsing ------------------ #
def parse_fraction(s: str) -> Fraction:
    try:
        return Fraction(s)
    except Exception:
        return Fraction(0)

# ------------------ Helper Function for Tax Rate ------------------ #
def get_tax_rate(item_name: str) -> float:
    """Return 0.10 (10% tax) if both 'plastic' and 'bag' are present in the item name; otherwise 0.08 (8% tax)."""
    name_lower = item_name.lower()
    if "plastic" in name_lower and "bag" in name_lower:
        return 0.10
    return 0.08

# ------------------ Pydantic Models for Structured Output ------------------ #
class BillItem(BaseModel):
    original_name: str
    normalized_name: str
    price_after_tax: float
    discount_amount: float  # Model will output 0 if no discount exists.

class Bill(BaseModel):
    items: List[BillItem]
    total_bill: float

# ------------------ Utility Function to Make Item Keys Unique ------------------ #
def make_item_keys_unique(bill_data):
    """
    Ensure that each item's normalized_name is unique.
    If duplicates exist, append a suffix like " 1", " 2", etc.
    """
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

# ------------------ Utility Function to Merge Discount Items ------------------ #
def merge_discount_items(bill_data):
    """
    In supermarket bills, if an item has a discount,
    the discount appears on the line immediately below the item
    and starts with "code128割引". This function merges such discount items
    with the item immediately preceding them.
    """
    items = bill_data.get("items", [])
    merged_items = []
    i = 0
    while i < len(items):
        current_item = items[i]
        if (i + 1 < len(items)) and ("code128割引" in items[i+1]["original_name"].lower()):
            discount_item = items[i+1]
            current_item["discount_amount"] = discount_item["discount_amount"]
            merged_items.append(current_item)
            i += 2  # Skip the discount item.
        else:
            merged_items.append(current_item)
            i += 1
    bill_data["items"] = merged_items
    return bill_data

# ------------------ STEP 1: Extract Bill Data Using Gemini API ------------------ #
def extract_bill(api_key, uploaded_image, prompt):
    if uploaded_image is not None:
        try:
            image = Image.open(uploaded_image)
        except Exception as e:
            st.error("Failed to open the image. Error: " + str(e))
            return None

        client = genai.Client(api_key=api_key)
        schema_dict = Bill.model_json_schema()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, image],
            config={
                'response_mime_type': 'application/json',
                'response_schema': schema_dict,
            }
        )
        bill_obj = response.parsed
        bill_data = bill_obj.dict() if hasattr(bill_obj, "dict") else bill_obj
        bill_data = make_item_keys_unique(bill_data)
        bill_data = merge_discount_items(bill_data)
        st.write("Extracted Bill Data:")
        st.write(bill_data)
        return bill_data

# ------------------ STEP 2: Display Allocation UI ------------------ #
def display_allocation_ui(bill_data, person_names):
    st.subheader("Allocate Items Among Persons")
    allocations = {}
    for idx, item in enumerate(bill_data.get("items", [])):
        item_name = item.get("normalized_name", f"Item {idx+1}")
        unit_price = item.get("price_after_tax", 0)
        discount = item.get("discount_amount", 0)
        # Use the helper function to determine the tax rate.
        tax_rate = get_tax_rate(item_name)
        # Effective price: base price increased by tax, then discount subtracted.
        effective_price = (unit_price * (1 + tax_rate)) - discount
        st.markdown(f"### {item_name}")
        st.write(f"**Base Price:** ${unit_price}")
        st.write(f"**Tax Rate:** {tax_rate*100:.0f}%")
        if discount and discount > 0:
            st.write(f"**Discount:** ${discount}")
        st.write(f"**Effective Price:** ${effective_price:.2f}")
        
        # Input for total quantity (default is 1).
        total_qty = st.number_input(
            f"Enter total quantity for '{item_name}':",
            min_value=0,
            value=1,
            step=1,
            key=f"total_qty_{item_name}"
        )
        
        # "Share Equally" button.
        if st.button("Share Equally", key=f"share_eq_{item_name}"):
            num_persons = len(person_names)
            if num_persons > 0:
                equal_share = Fraction(total_qty, num_persons)
                for person in person_names:
                    st.session_state[f"{item_name}_{person}"] = str(equal_share)
                st.session_state[f"share_version_{item_name}"] = st.session_state.get(f"share_version_{item_name}", 0) + 1
        
        version = st.session_state.get(f"share_version_{item_name}", 0)
        
        # Display share inputs as text inputs for fraction strings.
        share_cols = st.columns(len(person_names))
        item_allocations = {}
        allocation_sum = Fraction(0)
        for i, person in enumerate(person_names):
            key = f"{item_name}_{person}_v{version}"
            default_val = st.session_state.get(f"{item_name}_{person}", "0")
            with share_cols[i]:
                share_str = st.text_input(
                    label=f"{person}'s share (e.g., 1/3)",
                    value=default_val,
                    key=key
                )
                item_allocations[person] = share_str
                allocation_sum += parse_fraction(share_str)
        
        if allocation_sum != Fraction(total_qty):
            st.error(
                f"Allocation error for '{item_name}': Total allocated is {float(allocation_sum):.2f} but should equal {total_qty}."
            )
        allocations[item_name] = {"total_quantity": total_qty, "shares": item_allocations}
        st.markdown("---")
    return allocations

# ------------------ STEP 3: Calculate the Split Based on Allocations ------------------ #
def calculate_split(bill_data, allocations, person_names):
    person_totals = {person: 0.0 for person in person_names}
    for item in bill_data.get("items", []):
        item_name = item.get("normalized_name")
        unit_price = item.get("price_after_tax", 0)
        discount = item.get("discount_amount", 0)
        tax_rate = get_tax_rate(item_name)
        effective_price = (unit_price * (1 + tax_rate)) - discount
        allocation_info = allocations.get(item_name, {})
        total_qty = allocation_info.get("total_quantity", 0)
        shares = allocation_info.get("shares", {})
        if total_qty <= 0:
            continue
        # Compute unit cost: effective price per one item.
        unit_cost = effective_price / total_qty
        for person in person_names:
            share_str = shares.get(person, "0")
            allocated_fraction = parse_fraction(share_str)
            person_totals[person] += float(allocated_fraction) * unit_cost
    return person_totals

# ------------------ STREAMLIT UI SETUP ------------------ #
st.title("PicSplit - Bill Splitter Web App")

api_key = st.text_input("Enter Gemini API Key:")

num_people = st.number_input("Enter the number of people:", min_value=1, max_value=100, value=2, step=1)
person_names = []
if num_people > 0:
    st.write(f"Enter the names of the {num_people} people:")
    for i in range(num_people):
        name = st.text_input(f"Name of person {i+1}:", key=f"name_{i}")
        if name:
            person_names.append(name)

uploaded_image = st.file_uploader("Upload your grocery bill image", type=["jpg", "jpeg", "png"])

# ------------------ Updated Prompt for Structured Output ------------------ #
prompt = """
You are given a supermarket grocery bill in Japanese that may have been OCRed and translated.
The person who has the bill does not know Japanese and needs to translate the bill into English in order to split it manually with his friends.
For supermarket bills, note that if an item has a discount, the discount is mentioned on the line immediately below the item and starts with "code128割引". Associate that discount with the item immediately above it.

Extract the following details:

1. For each item, output:
   - "original_name": the original text of the item as recognized.
   - "normalized_name": a cleaned-up, common name for the item in plain English. Use your best judgment.
     For example, if the item text is "F Mix Tamago 10,657", output a normalized name such as "tamago" or "eggs".
     If the text is "FSL C Bread 0 Garlic,198", output "crisp bread garlic".
     If the text is "FSL Crisp Bread Cheese,198", output "crisp bread cheese".
     If the text is "FM Bifidus Yogurt 400g", output "yogurt".
   - "price_after_tax": the base price as a number.
   - "discount_amount": the discount on that item as a number. If there is no discount, output 0.
2. Also extract the total bill amount as "total_bill".

Return a JSON object that conforms to this schema:
{
  "items": [
    {
      "original_name": "string",
      "normalized_name": "string",
      "price_after_tax": number,
      "discount_amount": number
    },
    ...
  ],
  "total_bill": number
}

Return only the JSON object with no additional text.
"""

if st.button("Process Bill"):
    if api_key and num_people > 0 and len(person_names) == num_people and uploaded_image:
        bill_data = extract_bill(api_key, uploaded_image, prompt)
        if bill_data is not None:
            st.success("Bill data extracted successfully!")
            st.session_state.bill_data = bill_data
            st.session_state.person_names = person_names
    else:
        st.warning("Please fill in all the fields and upload an image before proceeding.")

if "bill_data" in st.session_state and "person_names" in st.session_state:
    bill_data = st.session_state.bill_data
    person_names = st.session_state.person_names
    
    st.header("Step 2: Allocate Items to Each Person")
    allocations = display_allocation_ui(bill_data, person_names)
    
    if st.button("Calculate Split"):
        valid_allocation = True
        for item in bill_data.get("items", []):
            item_name = item.get("normalized_name")
            allocation_info = allocations.get(item_name, {})
            total_qty = allocation_info.get("total_quantity", 0)
            shares = allocation_info.get("shares", {})
            total_allocated = sum(parse_fraction(shares.get(p, "0")) for p in person_names)
            if total_allocated != Fraction(total_qty):
                st.error(
                    f"Allocation error for '{item_name}': Total allocated is {float(total_allocated):.2f} but should equal {total_qty}."
                )
                valid_allocation = False
        
        if valid_allocation:
            person_totals = calculate_split(bill_data, allocations, person_names)
            st.subheader("Split Amounts")
            for person, total in person_totals.items():
                st.write(f"**{person}:** ${total:.2f}")
