/**
 * deck.js — Card deck creation, shuffle, and deal
 * 56 cards: 4 characters × (3×1 + 3×2 + 3×3 + 3×4 + 2×5) = 4 × 14 = 56
 */

const CHARACTERS = ['kitty', 'pudding', 'melody', 'cinna'];

const CHAR_EMOJIS = {
  kitty:   '🐱',
  pudding: '🐶',
  melody:  '🐰',
  cinna:   '🐕',
};

const CARD_COMPOSITION = [
  { count: 1, copies: 3 },
  { count: 2, copies: 3 },
  { count: 3, copies: 3 },
  { count: 4, copies: 3 },
  { count: 5, copies: 2 },
];

/**
 * Creates a full 56-card deck (unshuffled).
 * @returns {Array<{id:number, character:string, count:number}>}
 */
function createDeck() {
  const deck = [];
  let id = 0;

  for (const char of CHARACTERS) {
    for (const { count, copies } of CARD_COMPOSITION) {
      for (let c = 0; c < copies; c++) {
        deck.push({ id: id++, character: char, count });
      }
    }
  }

  return deck;
}

/**
 * Fisher-Yates shuffle — returns new shuffled array.
 * @param {Array} deck
 * @returns {Array}
 */
function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deal cards as evenly as possible to players.
 * @param {Array} deck  shuffled deck
 * @param {number} playerCount  2-4
 * @returns {Array<Array>}  array of hands, one per player (index 0 = P1)
 */
function dealCards(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);

  deck.forEach((card, i) => {
    hands[i % playerCount].push(card);
  });

  return hands;
}

/**
 * Returns the image path for a card.
 * @param {{character:string, count:number}} card
 * @returns {string}
 */
function getCardImagePath(card) {
  return `card/${card.character}-${card.count}.png`;
}

/**
 * Returns emoji for character.
 */
function getCharEmoji(character) {
  return CHAR_EMOJIS[character] || '?';
}
