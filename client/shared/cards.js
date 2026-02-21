// Card type definitions and rendering
// Image paths for card assets
const CARD_IMAGE_PATH = '/assets/images/cards/';

const CardTypes = {
  king: {
    name: '왕',
    emoji: '👑',
    color: '#FFD700',
    image: 'king.png',
    description: '잠든 퀸 깨우기'
  },
  knight: {
    name: '기사',
    emoji: '⚔️',
    color: '#4A90D9',
    image: 'knight.png',
    description: '상대방 퀸 빼앗기'
  },
  potion: {
    name: '물약',
    emoji: '🧪',
    color: '#9B7ED9',
    image: 'potion.png',
    description: '퀸 재우기'
  },
  wand: {
    name: '마법봉',
    emoji: '✨',
    color: '#E91E63',
    image: 'wand.png',
    description: '수면포션 방어'
  },
  dragon: {
    name: '드래곤',
    emoji: '🐉',
    color: '#E86A33',
    image: 'dragon.png',
    description: '기사 방어'
  },
  number: {
    name: '숫자',
    emoji: '🔢',
    color: '#3498DB',
    image: null,
    description: '버리고 새 카드 받기'
  }
};

const QueenTypes = {
  rose: { name: '장미 여왕', points: 5, color: '#FF6B6B', image: 'queen_rose.png' },
  cat: { name: '고양이 여왕', points: 15, color: '#6B2D5B', image: 'queen_cat.png' },
  dog: { name: '강아지 여왕', points: 15, color: '#8B4513', image: 'queen_dog.png' },
  pancake: { name: '팬케이크 여왕', points: 15, color: '#F4A460', image: 'queen_pancake.png' },
  sunflower: { name: '해바라기 여왕', points: 10, color: '#FFD700', image: 'queen_sunflower.png' },
  rainbow: { name: '무지개 여왕', points: 10, color: '#87CEEB', image: 'queen_rainbow.png' },
  moon: { name: '달 여왕', points: 10, color: '#4169E1', image: 'queen_moon.png' },
  starfish: { name: '불가사리 여왕', points: 5, color: '#FFD700', image: 'queen_starfish.png' },
  heart: { name: '하트 여왕', points: 20, color: '#DC143C', image: 'queen_heart.png' },
  ladybug: { name: '무당벌레 여왕', points: 10, color: '#DC143C', image: 'queen_ladybug.png' },
  cake: { name: '케이크 여왕', points: 5, color: '#98FB98', image: 'queen_cake.png' },
  peacock: { name: '공작 여왕', points: 15, color: '#20B2AA', image: 'queen_peacock.png' }
};

// Fallback emoji display
const QueenDisplay = {
  rose: { name: '장미 여왕', emoji: '🌹', color: '#FF6B6B' },
  cat: { name: '고양이 여왕', emoji: '🐱', color: '#6B2D5B' },
  dog: { name: '강아지 여왕', emoji: '🐶', color: '#8B4513' },
  pancake: { name: '팬케이크 여왕', emoji: '🥞', color: '#F4A460' },
  sunflower: { name: '해바라기 여왕', emoji: '🌻', color: '#FFD700' },
  rainbow: { name: '무지개 여왕', emoji: '🌈', color: '#87CEEB' },
  moon: { name: '달 여왕', emoji: '🌙', color: '#4169E1' },
  starfish: { name: '불가사리 여왕', emoji: '⭐', color: '#FFD700' },
  heart: { name: '하트 여왕', emoji: '❤️', color: '#DC143C' },
  ladybug: { name: '무당벌레 여왕', emoji: '🐞', color: '#DC143C' },
  cake: { name: '케이크 여왕', emoji: '🎂', color: '#98FB98' },
  peacock: { name: '공작 여왕', emoji: '🦚', color: '#20B2AA' },
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
            <div class="queen-points">${queen.points}점</div>
          </div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="queen-inner" style="background-color: ${display.color}20; border-color: ${display.color}">
          <div class="queen-emoji">${display.emoji}</div>
          <div class="queen-name">${queen.name}</div>
          <div class="queen-points">${queen.points}점</div>
        </div>
      `;
    }
  }

  return div;
}
