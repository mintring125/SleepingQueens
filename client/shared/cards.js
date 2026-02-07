// Card type definitions and rendering
// Image paths for card assets
const CARD_IMAGE_PATH = '/assets/images/cards/';

const CardTypes = {
  king: {
    name: 'King',
    emoji: '👑',
    color: '#FFD700',
    image: 'king.png',
    description: 'Wake a sleeping queen'
  },
  knight: {
    name: 'Knight',
    emoji: '⚔️',
    color: '#4A90D9',
    image: 'knight.png',
    description: 'Steal a queen from another player'
  },
  potion: {
    name: 'Potion',
    emoji: '🧪',
    color: '#9B7ED9',
    image: 'potion.png',
    description: 'Put a queen back to sleep'
  },
  wand: {
    name: 'Wand',
    emoji: '✨',
    color: '#E91E63',
    image: 'wand.png',
    description: 'Counter a sleeping potion'
  },
  dragon: {
    name: 'Dragon',
    emoji: '🐉',
    color: '#E86A33',
    image: 'dragon.png',
    description: 'Counter a knight'
  },
  number: {
    name: 'Number',
    emoji: '🔢',
    color: '#3498DB',
    image: null,
    description: 'Discard to draw new cards'
  }
};

const QueenTypes = {
  rose: { name: 'Rose Queen', points: 5, color: '#FF6B6B', image: 'queen_rose.png' },
  cat: { name: 'Cat Queen', points: 15, color: '#6B2D5B', image: 'queen_cat.png' },
  dog: { name: 'Dog Queen', points: 15, color: '#8B4513', image: 'queen_dog.png' },
  pancake: { name: 'Pancake Queen', points: 15, color: '#F4A460', image: 'queen_pancake.png' },
  sunflower: { name: 'Sunflower Queen', points: 10, color: '#FFD700', image: 'queen_sunflower.png' },
  rainbow: { name: 'Rainbow Queen', points: 10, color: '#87CEEB', image: 'queen_rainbow.png' },
  moon: { name: 'Moon Queen', points: 10, color: '#4169E1', image: 'queen_moon.png' },
  starfish: { name: 'Starfish Queen', points: 5, color: '#FFD700', image: 'queen_starfish.png' },
  heart: { name: 'Heart Queen', points: 20, color: '#DC143C', image: 'queen_heart.png' },
  ladybug: { name: 'Ladybug Queen', points: 10, color: '#DC143C', image: 'queen_ladybug.png' },
  cake: { name: 'Cake Queen', points: 5, color: '#98FB98', image: 'queen_cake.png' },
  peacock: { name: 'Peacock Queen', points: 15, color: '#20B2AA', image: 'queen_peacock.png' }
};

// Fallback emoji display
const QueenDisplay = {
  rose: { name: 'Rose Queen', emoji: '🌹', color: '#FF6B6B' },
  cat: { name: 'Cat Queen', emoji: '🐱', color: '#6B2D5B' },
  dog: { name: 'Dog Queen', emoji: '🐶', color: '#8B4513' },
  pancake: { name: 'Pancake Queen', emoji: '🥞', color: '#F4A460' },
  sunflower: { name: 'Sunflower Queen', emoji: '🌻', color: '#FFD700' },
  rainbow: { name: 'Rainbow Queen', emoji: '🌈', color: '#87CEEB' },
  moon: { name: 'Moon Queen', emoji: '🌙', color: '#4169E1' },
  starfish: { name: 'Starfish Queen', emoji: '⭐', color: '#FFD700' },
  heart: { name: 'Heart Queen', emoji: '❤️', color: '#DC143C' },
  ladybug: { name: 'Ladybug Queen', emoji: '🐞', color: '#DC143C' },
  cake: { name: 'Cake Queen', emoji: '🎂', color: '#98FB98' },
  peacock: { name: 'Peacock Queen', emoji: '🦚', color: '#20B2AA' },
  default: { emoji: '👸', color: '#DDA0DD' }
};

// Check if image exists (caches results)
const imageCache = {};
async function checkImageExists(url) {
  if (imageCache[url] !== undefined) return imageCache[url];
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { imageCache[url] = true; resolve(true); };
    img.onerror = () => { imageCache[url] = false; resolve(false); };
    img.src = url;
  });
}

// Create card HTML element
function createCardElement(card, options = {}) {
  const cardType = CardTypes[card.type];
  const div = document.createElement('div');
  div.className = 'card ' + card.type + (options.selected ? ' selected' : '') + (options.disabled ? ' disabled' : '');
  div.dataset.cardId = card.id;
  div.dataset.cardType = card.type;
  if (card.value) div.dataset.cardValue = card.value;

  // Determine image URL
  let imageUrl;
  if (card.type === 'number') {
    imageUrl = CARD_IMAGE_PATH + `number_${card.value}.png`;
  } else if (card.type === 'king' && card.variant) {
    imageUrl = CARD_IMAGE_PATH + `king_${card.variant}.png`;
  } else if (card.type === 'knight' && card.variant) {
    imageUrl = CARD_IMAGE_PATH + `knight_${card.variant}.png`;
  } else {
    // Default fallback
    imageUrl = CARD_IMAGE_PATH + cardType.image;
  }

  // Common structure for all cards
  div.innerHTML = `
    <div class="card-inner card-image-container">
      <img src="${imageUrl}" alt="${card.name || cardType.name}" class="card-image"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="card-fallback" style="display:none;">
        <div class="card-emoji">${card.value || cardType.emoji}</div>
        <div class="card-name">${card.name || cardType.name}</div>
      </div>
    </div>
  `;

  return div;
}

// Create queen HTML element  
function createQueenElement(queen, options = {}) {
  const div = document.createElement('div');
  div.dataset.queenId = queen.id;

  // If queen is hidden (sleeping/face-down), show card back
  if (queen.hidden) {
    div.className = 'queen sleeping' + (options.selectable ? ' selectable' : '');
    div.innerHTML = `
      <div class="queen-back">
        <div class="queen-back-design">
          <span class="queen-back-icon">👑</span>
          <span class="queen-back-text">?</span>
        </div>
      </div>
    `;
  } else {
    // Awakened queen - show full details with image
    const display = QueenDisplay[queen.ability] || QueenDisplay.default;
    const queenType = QueenTypes[queen.ability];
    const imageUrl = queenType ? CARD_IMAGE_PATH + queenType.image : null;

    div.className = 'queen awake' + (options.selectable ? ' selectable' : '');

    if (imageUrl) {
      div.innerHTML = `
        <div class="queen-inner queen-image-container">
          <img src="${imageUrl}" alt="${queen.name}" class="queen-image"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="queen-fallback" style="display:none;">
            <div class="queen-emoji">${display.emoji}</div>
            <div class="queen-name">${queen.name}</div>
            <div class="queen-points">${queen.points}pts</div>
          </div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="queen-inner" style="background-color: ${display.color}20; border-color: ${display.color}">
          <div class="queen-emoji">${display.emoji}</div>
          <div class="queen-name">${queen.name}</div>
          <div class="queen-points">${queen.points}pts</div>
        </div>
      `;
    }
  }

  return div;
}
