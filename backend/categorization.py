from typing import Any


EXPENSE_CATEGORIES = [
    "Groceries",
    "Dining",
    "Transport",
    "Utilities",
    "Entertainment",
    "Shopping",
    "Healthcare",
    "Travel",
    "Education",
    "Subscriptions",
    "Miscellaneous",
    "Uncategorized",
]


_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Groceries": [
        "egg", "eggs", "milk", "bread", "rice", "fruit", "vegetable", "meat", "fish", "tofu",
        "apple", "banana", "onion", "potato", "tomato", "carrot", "cucumber", "mushroom",
    ],
    "Dining": [
        "meal", "lunch", "dinner", "bento", "sandwich", "coffee", "tea", "snack", "cookie", "cake",
    ],
    "Transport": [
        "train", "subway", "metro", "bus", "taxi", "uber", "fuel", "gas", "parking", "toll",
    ],
    "Utilities": [
        "electric", "water bill", "internet", "phone bill", "gas bill", "utility",
    ],
    "Entertainment": [
        "movie", "cinema", "game", "music", "book", "streaming", "concert",
    ],
    "Shopping": [
        "clothes", "shirt", "pants", "shoes", "bag", "accessory", "gift", "cosmetic",
    ],
    "Healthcare": [
        "medicine", "vitamin", "supplement", "mask", "clinic", "pharmacy",
    ],
    "Travel": [
        "flight", "hotel", "airbnb", "trip", "travel", "tour",
    ],
    "Education": [
        "tuition", "course", "class", "training", "school", "notebook", "stationery",
    ],
    "Subscriptions": [
        "subscription", "monthly plan", "netflix", "spotify", "prime", "membership",
    ],
    "Miscellaneous": [
        "detergent", "tissue", "paper", "cleaner", "soap", "other",
    ],
}


def infer_item_category(normalized_name: str, original_name: str | None = None) -> str:
    haystack = f"{normalized_name or ''} {original_name or ''}".lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category
    return "Uncategorized"


def categorize_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    categorized_items: list[dict[str, Any]] = []
    for item in items:
        normalized_name = str(item.get("normalized_name", ""))
        original_name = item.get("original_name")
        category_name = infer_item_category(normalized_name, str(original_name) if original_name else None)
        categorized_items.append({
            **item,
            "category_name": category_name,
            "category_source": "auto",
        })
    return categorized_items
