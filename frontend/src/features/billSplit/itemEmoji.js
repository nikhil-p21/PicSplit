const EMOJI_MAP = {
  'bread': '🍞', 'milk': '🥛', 'cheese': '🧀', 'egg': '🥚', 'eggs': '🥚', 'tamago': '🥚',
  'yogurt': '🥣', 'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'vegetable': '🥬',
  'vegetables': '🥬', 'fruit': '🍎', 'fruits': '🍎', 'meat': '🥩', 'chicken': '🍗',
  'fish': '🐟', 'rice': '🍚', 'noodle': '🍜', 'noodles': '🍜', 'pasta': '🍝',
  'water': '💧', 'juice': '🧃', 'beer': '🍺', 'wine': '🍷', 'coffee': '☕', 'tea': '🍵',
  'chocolate': '🍫', 'cookie': '🍪', 'cookies': '🍪', 'cake': '🍰', 'icecream': '🍦',
  'ice cream': '🍦', 'candy': '🍬', 'snack': '🍿', 'snacks': '🍿', 'chip': '🍪',
  'chips': '🍪', 'plastic bag': '🛍️', 'bag': '🛍️', 'tissue': '🧻', 'paper': '📄',
  'tofu': '🧊', 'sauce': '🧂', 'oil': '🫗', 'spice': '🌶️', 'spices': '🌶️',
  'seafood': '🦐', 'shrimp': '🦐', 'crab': '🦀', 'onion': '🧅', 'garlic': '🧄',
  'tomato': '🍅', 'potato': '🥔', 'carrot': '🥕', 'cucumber': '🥒', 'avocado': '🥑',
  'corn': '🌽', 'mushroom': '🍄', 'mushrooms': '🍄', 'lemon': '🍋', 'strawberry': '🍓',
  'strawberries': '🍓', 'pineapple': '🍍', 'watermelon': '🍉'
};

export function parseItemEmoji(itemName) {
  const lowerName = itemName.toLowerCase();

  if (EMOJI_MAP[lowerName]) {
    return EMOJI_MAP[lowerName];
  }

  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowerName.includes(key)) {
      return emoji;
    }
  }

  return '🛒';
}
