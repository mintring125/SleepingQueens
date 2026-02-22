// ── 카리바 테이블 컨트롤러 ───────────────────────────────────────

const ANIMALS = {
  1: { name: '생쥐', emoji: '🐭', en: 'Mouse', img: 'Kariba_1_Mouse_00001.png' },
  2: { name: '미어캣', emoji: '🦡', en: 'Meerkat', img: 'Kariba_2_Meerkat_00001.png' },
  3: { name: '얼룩말', emoji: '🦓', en: 'Zebra', img: 'Kariba_3_Zebra_00001.png' },
  4: { name: '기린', emoji: '🦒', en: 'Giraffe', img: 'Kariba_4_Giraffe_00001.png' },
  5: { name: '타조', emoji: '🐦', en: 'Ostrich', img: 'Kariba_5_Ostrich_00001.png' },
  6: { name: '치타', emoji: '🐆', en: 'Cheetah', img: 'Kariba_6_Cheetah_00001.png' },
  7: { name: '코뿔소', emoji: '🦏', en: 'Rhino', img: 'Kariba_7_Rhino_00001.png' },
  8: { name: '코끼리', emoji: '🐘', en: 'Elephant', img: 'Kariba_8_Elephant_00001.png' }
};

let gameState = null;
let reconnectQrSessionId = null;

function getSlotAngle(type) {
  return ((1 - type) * 45 + 360) % 360;
}

document.addEventListener('DOMContentLoaded', () => {
  buildWateringHole();

  karibaSocket.on('connect', () => {
    document.getElementById('connectionStatus').className = 'connection-status connected';
    document.getElementById('createGameBtn').disabled = false;
  });

  karibaSocket.on('disconnect', () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
  });

  karibaSocket.on('gameCreated', (data) => {
    document.getElementById('sessionInfo').textContent = `세션: ${data.sessionId}`;
    karibaSocket.setSession(data.sessionId);
    showQR(data.qrDataUrl, data.joinUrl);
    document.getElementById('setupPanel').classList.add('hidden');
    document.getElementById('qrPanel').classList.remove('hidden');
  });

  karibaSocket.on('playerJoined', (data) => {
    updatePlayerList(data);
    showToast(`${data.playerName} 참가!`, 'success');
  });

  karibaSocket.on('gameState', (data) => {
    gameState = data;
    updateDisplay();
  });

  karibaSocket.on('turnStart', (data) => {
    document.getElementById('currentTurnName').textContent = data.playerName;
    addLog(`⭐ ${data.playerName}의 턴`);
  });

  karibaSocket.on('huntResult', (data) => {
    animateCollectedCardsToPlayer(data);
    showHuntAnimation(data);
    const hunter = ANIMALS[data.hunterType];
    const hunted = ANIMALS[data.huntedType];
    const isSpecial = data.hunterType === 1;
    addLog(
      `${isSpecial ? '⚡' : '🏹'} ${data.hunterName}의 ${hunter.emoji}${hunter.name}이(가) ${hunted.emoji}${hunted.name} ${data.cardCount}장 획득!`,
      isSpecial ? 'special' : 'hunt'
    );
  });

  karibaSocket.on('gameEnd', (data) => {
    showGameEnd(data);
  });

  karibaSocket.on('cardsFlying', (data) => {
    animateFlyingCards(data);
  });

  karibaSocket.on('actionResult', (data) => {
    if (data.message) {
      addLog(data.message, data.success ? '' : 'special');
      if (!data.success) {
        showToast(data.message, 'error');
      }
    }
  });

  karibaSocket.on('restartStatus', (data) => {
    showToast(`재경기 요청: ${data.current}/${data.total}`, 'info');
  });

  document.getElementById('createGameBtn').disabled = true;
  karibaSocket.connect();
});

// ── 게임 생성 / 시작 ──────────────────────────────────────────────
function createGame() {
  const expertMode = document.getElementById('expertModeCheck').checked;
  karibaSocket.emit('createGame', { expertMode });
}

function startGame() {
  karibaSocket.emit('startGame', {});
}

// ── 물웅덩이 보드 초기화 (DOM 생성) ─────────────────────────────
function buildWateringHole() {
  const board = document.getElementById('wateringHole');
  board.innerHTML = '';

  // SVG 물웅덩이 배경
  const svgBg = document.createElement('div');
  svgBg.className = 'watering-hole-bg';
  svgBg.innerHTML = `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="waterGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8" />
          <stop offset="70%" stop-color="#0891b2" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#164e63" stop-opacity="0.1" />
        </radialGradient>
      </defs>
      <!-- 물결 모형 패스 -->
      <path fill="url(#waterGrad)" d="M200,35 C280,45 340,100 360,180 C375,260 310,360 200,370 C90,380 40,300 30,220 C20,130 90,25 200,35 Z" />
      <path fill="rgba(255,255,255,0.1)" d="M200,60 C260,70 300,120 320,180 C330,240 280,310 200,320 C120,330 80,260 70,200 C60,130 130,50 200,60 Z" />
    </svg>
  `;
  board.appendChild(svgBg);

  for (let type = 1; type <= 8; type++) {
    const slot = document.createElement('div');
    slot.className = `animal-slot slot-${type}`;
    slot.id = `slot-${type}`;
    slot.style.cursor = 'pointer';
    slot.onclick = () => {
      const angle = getSlotAngle(type);

      // 터치 시각 피드백
      slot.style.transform = `rotate(${angle}deg) translateY(-205px) scale(0.9)`;
      setTimeout(() => {
        slot.style.transform = `rotate(${angle}deg) translateY(-205px) scale(1)`;
      }, 150);

      console.log(`[Slot Clicked] Type: ${type}`);
      karibaSocket.emit('tableSlotClicked', { slotType: type });
    };
    board.appendChild(slot);
  }

  // 중앙 덱
  const deck = document.createElement('div');
  deck.className = 'deck-center';
  deck.innerHTML = `
    <div class="deck-icon">🃏</div>
    <div class="deck-count" id="deckCountCenter">64</div>
    <div class="deck-label">남은 덱</div>
  `;
  board.appendChild(deck);
}

// ── 화면 업데이트 ─────────────────────────────────────────────────
function updateDisplay() {
  if (!gameState) return;

  const { phase, wateringHole, deckRemaining, players, currentPlayerId, sessionId } = gameState;

  if (phase === 'waiting') return;

  // 게임 뷰로 전환
  if (phase === 'playing' || phase === 'ended') {
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('playingPhase').classList.remove('hidden');
    renderReconnectQr(sessionId);
  }

  // 물웅덩이 슬롯 업데이트
  for (let type = 1; type <= 8; type++) {
    const count = (wateringHole[type] || []).length;
    const slotEl = document.getElementById(`slot-${type}`);
    if (slotEl) {
      if (slotEl.dataset.count !== String(count)) {
        slotEl.dataset.count = count;
        slotEl.innerHTML = '';
        if (count === 0) {
          slotEl.innerHTML = `<div class="empty-placeholder">${type}</div>`;
        } else {
          const a = ANIMALS[type];
          for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.src = `/kariba/assets/images/${a.img}`;
            img.className = 'stacked-card';

            // Generate cascading stack effect so card numbers are visible
            if (i === 0) {
              img.style.transform = `translateY(0)`;
            } else {
              // Offset each card downwards by 25px
              img.style.transform = `translateY(${i * 25}px)`;
            }
            img.style.zIndex = i + 1;

            // Add fallback styling just in case image doesn't load immediately
            img.onerror = () => { img.style.display = 'none'; };
            slotEl.appendChild(img);
          }
        }
      }
    }
  }

  // 덱 카운트
  document.getElementById('deckCount').textContent = deckRemaining;
  const deckCenter = document.getElementById('deckCountCenter');
  if (deckCenter) deckCenter.textContent = deckRemaining;

  // 플레이어 보드
  renderPlayersBoard(players, currentPlayerId);
}

function renderReconnectQr(sessionId) {
  const qrEl = document.getElementById('reconnectQrSmall');
  const urlEl = document.getElementById('reconnectUrlSmall');
  if (!qrEl || !urlEl || !sessionId) return;

  const joinUrl = `${window.location.origin}/kariba/player/join.html?session=${sessionId}`;
  urlEl.textContent = joinUrl;

  if (reconnectQrSessionId === sessionId && qrEl.childElementCount > 0) return;

  qrEl.innerHTML = '';
  new QRCode(qrEl, {
    text: joinUrl,
    width: 88,
    height: 88,
    correctLevel: QRCode.CorrectLevel.M
  });
  reconnectQrSessionId = sessionId;
}

function renderPlayersBoard(players, currentPlayerId) {
  const board = document.getElementById('playersBoard');
  if (!players || players.length === 0) { board.innerHTML = ''; return; }

  board.innerHTML = players.map(p => `
    <div class="player-card ${p.id === currentPlayerId ? 'current-turn' : ''}" data-player-id="${p.id}">
      <div class="player-name">${p.name}</div>
      <div class="player-stats">
        <div class="stat-item">
          <div class="stat-value">${p.handCount}</div>
          <div class="stat-label">손패</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${p.collectedCount}</div>
          <div class="stat-label">점수(획득)</div>
        </div>
      </div>
      ${p.id === currentPlayerId ? '<div class="turn-badge">⭐ 내 차례</div>' : ''}
      ${!p.connected ? '<div class="disconnected-badge">연결 끊김</div>' : ''}
    </div>
  `).join('');
}

// ── QR 코드 표시 ───────────────────────────────────────────────────
function showQR(qrDataUrl, joinUrl) {
  const qrDiv = document.getElementById('qrCode');
  qrDiv.innerHTML = '';
  if (qrDataUrl) {
    const img = document.createElement('img');
    img.src = qrDataUrl;
    img.width = 200;
    img.height = 200;
    qrDiv.appendChild(img);
  } else {
    new QRCode(qrDiv, { text: joinUrl, width: 200, height: 200 });
  }
  document.getElementById('joinUrl').textContent = joinUrl;
}

// ── 참가자 목록 ────────────────────────────────────────────────────
function updatePlayerList(data) {
  document.getElementById('playerCount').textContent = data.playerCount;
  // Re-query from gameState on next update; just add to list
  const li = document.createElement('li');
  li.textContent = data.playerName;
  document.getElementById('playerList').appendChild(li);

  // 2명 이상이면 시작 버튼 표시
  if (data.playerCount >= 2) {
    document.getElementById('startGameBtn').classList.remove('hidden');
  }
}

// ── 사냥 애니메이션 ────────────────────────────────────────────────
function showHuntAnimation(data) {
  const hunter = ANIMALS[data.hunterType];
  const hunted = ANIMALS[data.huntedType];
  const isMouseElephant = data.hunterType === 1 && data.huntedType === 8;

  const popup = document.getElementById('huntPopup');
  popup.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px">${hunter.emoji} → ${hunted.emoji}</div>
    <div>${isMouseElephant ? '⚡ 생쥐가 코끼리를 쫓아냈다!' : '🏹 사냥!'}</div>
    <div style="font-size:16px;margin-top:8px;opacity:0.8">${hunter.name}이(가) ${hunted.name} ${data.cardCount}장 획득!</div>
  `;

  // 해당 슬롯 하이라이트
  const hunterSlot = document.getElementById(`slot-${data.hunterType}`);
  const huntedSlot = document.getElementById(`slot-${data.huntedType}`);
  if (hunterSlot) { hunterSlot.classList.add('hunting'); setTimeout(() => hunterSlot.classList.remove('hunting'), 1000); }
  if (huntedSlot) { huntedSlot.classList.add('hunted'); setTimeout(() => huntedSlot.classList.remove('hunted'), 1000); }

  const overlay = document.getElementById('huntOverlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 2200);
}

// ── 카드 날아가는 애니메이션 ───────────────────────────────────────
function animateFlyingCards(data) {
  const { playerId, cardType, count } = data;
  const playerCard = Array.from(document.querySelectorAll('.player-card')).find(el => el.dataset.playerId === playerId);
  const targetSlot = document.getElementById(`slot-${cardType}`);

  if (!playerCard || !targetSlot) return;

  const startRect = playerCard.getBoundingClientRect();
  const endRect = targetSlot.getBoundingClientRect();

  for (let i = 0; i < count; i++) {
    const flyingImg = document.createElement('img');
    flyingImg.src = `/kariba/assets/images/${ANIMALS[cardType].img}`;
    flyingImg.className = 'flying-card';
    document.body.appendChild(flyingImg);

    // Initial position
    flyingImg.style.left = `${startRect.left + startRect.width / 2 - 30}px`;
    flyingImg.style.top = `${startRect.top + startRect.height / 2 - 45}px`;

    // Trigger flying
    setTimeout(() => {
      flyingImg.style.transform = `translate(${endRect.left - startRect.left}px, ${endRect.top - startRect.top}px) scale(0.8) rotate(${Math.random() * 20 - 10}deg)`;
      setTimeout(() => flyingImg.remove(), 450);
    }, i * 150 + 50);
  }
}

function animateCollectedCardsToPlayer(data) {
  const { hunterId, huntedType, cardCount } = data;
  const sourceSlot = document.getElementById(`slot-${huntedType}`);
  const targetPlayerCard = Array.from(document.querySelectorAll('.player-card'))
    .find(el => el.dataset.playerId === hunterId);

  if (!sourceSlot || !targetPlayerCard) return;

  const startRect = sourceSlot.getBoundingClientRect();
  const endRect = targetPlayerCard.getBoundingClientRect();
  const visibleCount = Math.min(cardCount, 10);

  targetPlayerCard.classList.add('gain-highlight');
  setTimeout(() => targetPlayerCard.classList.remove('gain-highlight'), 900);

  for (let i = 0; i < visibleCount; i++) {
    const flyingImg = document.createElement('img');
    flyingImg.src = `/kariba/assets/images/${ANIMALS[huntedType].img}`;
    flyingImg.className = 'flying-card collected';
    document.body.appendChild(flyingImg);

    flyingImg.style.left = `${startRect.left + startRect.width / 2 - 24 + (Math.random() * 20 - 10)}px`;
    flyingImg.style.top = `${startRect.top + startRect.height / 2 - 34 + (Math.random() * 20 - 10)}px`;

    setTimeout(() => {
      const driftX = Math.random() * 36 - 18;
      const driftY = Math.random() * 24 - 12;
      flyingImg.style.transform = `translate(${endRect.left - startRect.left + driftX}px, ${endRect.top - startRect.top + driftY}px) scale(0.65) rotate(${Math.random() * 30 - 15}deg)`;
      setTimeout(() => flyingImg.remove(), 520);
    }, i * 90 + 120);
  }
}

// ── 게임 종료 화면 ─────────────────────────────────────────────────
function showGameEnd(data) {
  document.getElementById('playingPhase').classList.add('hidden');
  document.getElementById('endPhase').classList.remove('hidden');

  document.getElementById('winnerDisplay').innerHTML =
    `🏆 ${data.winnerName || '?'} 승리!`;

  const scoresHtml = (data.scores || []).map((s, i) => `
    <div class="score-row ${i === 0 ? 'rank-1' : ''}">
      <span>${i + 1}위 ${s.name}</span>
      <span>${s.score}점 (획득 ${s.score}장)</span>
    </div>
  `).join('');
  document.getElementById('finalScores').innerHTML = scoresHtml;
}

// ── 게임 로그 ─────────────────────────────────────────────────────
function addLog(message, type = '') {
  const log = document.getElementById('actionLog');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  log.prepend(entry);
  // 최대 50개
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

// ── 토스트 알림 ───────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}
