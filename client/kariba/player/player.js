// ── 카리바 플레이어 컨트롤러 ─────────────────────────────────────

const ANIMALS = {
  1: { name: '생쥐', emoji: '🐭', img: 'Kariba_1_Mouse_00001.png' },
  2: { name: '미어캣', emoji: '🦡', img: 'Kariba_2_Meerkat_00001.png' },
  3: { name: '얼룩말', emoji: '🦓', img: 'Kariba_3_Zebra_00001.png' },
  4: { name: '기린', emoji: '🦒', img: 'Kariba_4_Giraffe_00001.png' },
  5: { name: '타조', emoji: '🐦', img: 'Kariba_5_Ostrich_00001.png' },
  6: { name: '치타', emoji: '🐆', img: 'Kariba_6_Cheetah_00001.png' },
  7: { name: '코뿔소', emoji: '🦏', img: 'Kariba_7_Rhino_00001.png' },
  8: { name: '코끼리', emoji: '🐘', img: 'Kariba_8_Elephant_00001.png' }
};

let gameState = null;
let myHand = [];
let selectedType = null;   // 선택된 카드 타입 (1~8)
let selectedCount = 1;     // 내려놓을 장수
let isMyTurn = false;
const sessionId = localStorage.getItem('kariba_sessionId');
const playerName = localStorage.getItem('kariba_playerName');

document.addEventListener('DOMContentLoaded', () => {
  if (!sessionId || !playerName) {
    window.location.href = '/kariba/player/join.html';
    return;
  }

  karibaSocket.connect();

  karibaSocket.on('connect', () => {
    document.getElementById('connectionStatus').className = 'connection-status connected';
    document.getElementById('playerHeader').textContent = playerName;
    karibaSocket.emit('rejoin', { sessionId, playerName });
  });

  karibaSocket.on('disconnect', () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
  });

  karibaSocket.on('gameState', (data) => {
    gameState = data;
    updateDisplay();
  });

  karibaSocket.on('playerHand', (data) => {
    myHand = data.cards || [];
    // Reset selection if selected type is no longer in hand
    if (selectedType !== null) {
      const stillHas = myHand.some(c => c.type === selectedType);
      if (!stillHas) { selectedType = null; selectedCount = 1; }
    }
    renderHand();
    updateActionUI();
  });

  karibaSocket.on('turnStart', (data) => {
    isMyTurn = data.playerId === karibaSocket.playerId;
    const turnEl = document.getElementById('turnInfo');

    if (isMyTurn) {
      turnEl.textContent = '⭐ 내 차례!';
      turnEl.classList.add('my-turn');
      showToast('당신의 턴입니다!', 'info');
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      turnEl.textContent = `${data.playerName}의 차례`;
      turnEl.classList.remove('my-turn');
    }
    updateActionUI();
  });

  karibaSocket.on('huntResult', (data) => {
    const hunter = ANIMALS[data.hunterType];
    const hunted = ANIMALS[data.huntedType];
    const isSpecial = data.hunterType === 1 && data.huntedType === 8;
    showToast(
      `${isSpecial ? '⚡' : '🏹'} ${data.hunterName}: ${hunter.emoji}→${hunted.emoji} ${data.cardCount}장!`,
      isSpecial ? 'error' : 'success'
    );
    if (data.hunterId === karibaSocket.playerId && navigator.vibrate) {
      navigator.vibrate([100, 50, 200]);
    }
  });

  karibaSocket.on('actionResult', (data) => {
    if (!data.success && data.message) showToast(data.message, 'error');
  });

  karibaSocket.on('gameEnd', (data) => {
    showGameEnd(data);
  });

  karibaSocket.on('restartStatus', (data) => {
    showToast(`재경기 요청: ${data.current}/${data.total}`, 'info');
  });
});

// ── 화면 업데이트 ─────────────────────────────────────────────────
function updateDisplay() {
  if (!gameState) return;
  const { phase, players, deckRemaining, wateringHole } = gameState;

  if (phase === 'playing') {
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('playingPhase').classList.remove('hidden');
    document.getElementById('endPhase').classList.add('hidden');
  } else if (phase === 'waiting') {
    const count = players?.length || 0;
    document.getElementById('waitPlayerCount').textContent = `${count}/4`;
    return;
  }

  // 덱 / 손패 / 획득 정보
  document.getElementById('deckRemaining').textContent = deckRemaining ?? '-';
  document.getElementById('myHandCount').textContent = myHand.length;

  const me = players?.find(p => p.name === playerName);
  if (me) document.getElementById('myCollected').textContent = me.collectedCount;

  // 물웅덩이 요약
  renderBoardSummary(wateringHole);
}

// ── 손패 렌더링 ────────────────────────────────────────────────────
function renderHand() {
  const container = document.getElementById('handCards');
  container.innerHTML = '';

  if (myHand.length === 0) {
    container.innerHTML = '<div style="color:var(--text-secondary);font-size:14px;text-align:center;padding:16px;">카드 없음</div>';
    return;
  }

  // 카드 타입 순으로 정렬
  const sortedHand = [...myHand].sort((a, b) => a.type - b.type);

  // 현재 선택된 타입의 카드를 렌더링할 때 카운팅할 변수
  let renderedCountForSelectedType = 0;

  sortedHand.forEach((c) => {
    const type = c.type;
    const a = ANIMALS[type];

    const isSelectedType = selectedType === type;
    const isDisabled = !isMyTurn || (selectedType !== null && selectedType !== type);

    let isSelectedCard = false;
    if (isSelectedType && renderedCountForSelectedType < selectedCount) {
      isSelectedCard = true;
      renderedCountForSelectedType++;
    }

    const card = document.createElement('div');
    card.className = `animal-card${isSelectedCard ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`;
    card.onclick = () => toggleCard(type);

    card.innerHTML = `
      <img class="card-img" src="/kariba/assets/images/${a.img}"
           onerror="this.style.display='none'"
           alt="${a.name}">
    `;

    container.appendChild(card);
  });
}

// ── 카드 선택 토글 ─────────────────────────────────────────────────
function toggleCard(type) {
  if (!isMyTurn) { showToast('당신의 차례가 아닙니다', 'error'); return; }

  if (selectedType === type) {
    // 같은 타입 다시 누르면 해제
    selectedType = null;
    selectedCount = 1;
  } else {
    selectedType = type;
    selectedCount = 1;
  }
  renderHand();
  updateActionUI();
}

// ── 수량 변경 ─────────────────────────────────────────────────────
function changeCount(delta) {
  if (selectedType === null) return;
  const max = myHand.filter(c => c.type === selectedType).length;
  selectedCount = Math.max(1, Math.min(max, selectedCount + delta));
  document.getElementById('countDisplay').textContent = selectedCount;
  document.getElementById('countDown').disabled = selectedCount <= 1;
  document.getElementById('countUp').disabled = selectedCount >= max;
}

// ── 액션 UI 업데이트 ──────────────────────────────────────────────
function updateActionUI() {
  const infoEl = document.getElementById('selectedInfo');
  const playBtn = document.getElementById('playBtn');
  const countUpBtn = document.getElementById('countUp');
  const countDownBtn = document.getElementById('countDown');

  if (!isMyTurn || selectedType === null) {
    infoEl.textContent = isMyTurn ? '카드를 선택하세요' : '상대방 턴...';
    infoEl.className = 'selected-info';
    playBtn.disabled = true;
    countUpBtn.disabled = true;
    countDownBtn.disabled = true;
    document.getElementById('countDisplay').textContent = '1';
    return;
  }

  const a = ANIMALS[selectedType];
  const max = myHand.filter(c => c.type === selectedType).length;
  selectedCount = Math.min(selectedCount, max);

  infoEl.textContent = `${a.emoji} ${a.name} ${selectedCount}장 선택`;
  infoEl.className = 'selected-info has-selection';
  document.getElementById('countDisplay').textContent = selectedCount;
  playBtn.disabled = false;
  countDownBtn.disabled = selectedCount <= 1;
  countUpBtn.disabled = selectedCount >= max;
}

// ── 카드 내려놓기 ─────────────────────────────────────────────────
function playCards() {
  if (!isMyTurn || selectedType === null) return;

  karibaSocket.emit('playCards', { cardType: selectedType, count: selectedCount });

  // 낙관적 초기화
  isMyTurn = false;
  selectedType = null;
  selectedCount = 1;
  document.getElementById('turnInfo').textContent = '처리 중...';
  document.getElementById('turnInfo').classList.remove('my-turn');
  updateActionUI();
}

// ── 물웅덩이 요약 ─────────────────────────────────────────────────
function renderBoardSummary(wateringHole) {
  if (!wateringHole) return;
  const container = document.getElementById('boardSummary');
  container.innerHTML = '';

  for (let type = 1; type <= 8; type++) {
    const count = (wateringHole[type] || []).length;
    const a = ANIMALS[type];
    const pill = document.createElement('div');
    pill.style.cssText = `
      display:inline-flex;align-items:center;gap:4px;
      padding:4px 10px;border-radius:50px;font-size:13px;font-weight:700;
      background:rgba(255,255,255,${count >= 3 ? '0.15' : '0.05'});
      border:1px solid rgba(255,200,100,${count >= 3 ? '0.5' : '0.15'});
      color:${count >= 3 ? 'var(--savanna-gold)' : 'rgba(255,255,255,0.5)'};
    `;
    pill.innerHTML = `<span>${a.emoji}</span><span>${count}</span>`;
    container.appendChild(pill);
  }
}

// ── 게임 종료 ─────────────────────────────────────────────────────
function showGameEnd(data) {
  document.getElementById('playingPhase').classList.add('hidden');
  document.getElementById('endPhase').classList.remove('hidden');

  const isWinner = data.winnerId === karibaSocket.playerId;
  document.getElementById('winnerMsg').textContent =
    isWinner ? '🎉 축하합니다! 당신이 이겼습니다!' : `🏆 ${data.winnerName} 승리!`;

  if (navigator.vibrate && isWinner) navigator.vibrate([200, 100, 200, 100, 400]);

  const list = document.getElementById('scoreList');
  list.innerHTML = (data.scores || []).map((s, i) => `
    <div class="score-item ${i === 0 ? 'rank-1' : ''}">
      <span>${i + 1}위 ${s.name}${s.name === playerName ? ' (나)' : ''}</span>
      <span>${s.score}장 획득</span>
    </div>
  `).join('');
}

function requestRestart() {
  karibaSocket.emit('requestRestart', {});
  document.getElementById('restartBtn').textContent = '요청됨...';
  document.getElementById('restartBtn').disabled = true;
}

// ── 토스트 ─────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}
