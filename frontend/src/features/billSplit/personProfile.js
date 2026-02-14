const PERSON_COLORS = [
  '#FF6B6B', '#FF9E7D', '#FFB86F', '#FFD97D',
  '#C4E177', '#7ECE92', '#6FC2D0', '#7AA2E3',
  '#9A91E9', '#B78BE8', '#D187C5', '#E37792',
  '#A56C5D', '#6E7C74', '#4A90A4'
];

const PERSON_EMOJIS = ['🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🦁', '🐯', '🐨', '🐸', '🐵', '🐷'];

export function getRandomColor() {
  return PERSON_COLORS[Math.floor(Math.random() * PERSON_COLORS.length)];
}

export function getRandomEmoji() {
  return PERSON_EMOJIS[Math.floor(Math.random() * PERSON_EMOJIS.length)];
}

export function createPerson(id) {
  return {
    id,
    name: '',
    avatarColor: getRandomColor(),
    emoji: getRandomEmoji()
  };
}
