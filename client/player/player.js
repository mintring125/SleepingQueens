// Player controller
let gameState = null;
let myHand = [];
let selectedCards = [];
let isMyTurn = false;
let timerInterval = null;
let counterTimerInterval = null;
let pendingCounter = null;

document.addEventListener('DOMContentLoaded', () => {
  const sessionId = localStorage.getItem('sessionId');
  const playerName = localStorage.getItem('playerName');

  if (!sessionId || !playerName) {
    window.location.href = '/player/join.html';
    return;
  }

  socketManager.connect();

  socketManager.on('connect', () => {
    document.getElementById('connectionStatus').className = 'connection-status connected';
    document.getElementById('playerHeader').textContent = `${playerName}`;
    // Rejoin on reconnect
    socketManager.emit('rejoin', { sessionId, playerName });
  });

  socketManager.on('disconnect', () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
  });

  socketManager.on('gameState', (data) => {
    gameState = data;
    updateDisplay();
  });

  socketManager.on('playerHand', (data) => {
    myHand = data.cards;
    renderHand();
  });

  socketManager.on('turnStart', (data) => {
    isMyTurn = data.playerId === socketManager.playerId;
    if (isMyTurn) {
      showToast('당신의 턴입니다!', 'info');
      document.getElementById('turnInfo').textContent = '내 턴!';
      document.getElementById('turnInfo').classList.add('my-turn');

      // Haptic feedback for my turn
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      const player = gameState?.playersSummary?.find(p => p.id === data.playerId);
      document.getElementById('turnInfo').textContent = `${player?.name || '?'}의 턴`;
      document.getElementById('turnInfo').classList.remove('my-turn');
    }
    startTurnTimer(data.timeLimit);
    updateActionButtons();
  });

  socketManager.on('actionResult', (data) => {
    if (data.success) {
      showToast(data.message, 'success');
      selectedCards = [];
    } else {
      showToast(data.message, 'error');
    }
  });

  socketManager.on('counterRequest', (data) => {
    if (data.targetPlayerId === socketManager.playerId) {
      showCounterModal(data);
      // Haptic feedback for attack (double pulse)
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  });

  socketManager.on('gameEnd', (data) => {
    showGameEnd(data);
  });

  socketManager.on('restartStatus', (data) => {
    const statusEl = document.getElementById('restartStatus');
    if (statusEl) {
      statusEl.textContent = `재경기 투표: ${data.current}/${data.total} 명`;
    }
  });
});

function updateDisplay() {
  if (!gameState) return;

  if (gameState.phase === 'waiting') {
    document.getElementById('waitingScreen').classList.remove('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('endScreen').classList.add('hidden');
  } else if (gameState.phase === 'playing') {
    document.getElementById('waitingScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('endScreen').classList.add('hidden');

    // Update score and queens
    const me = gameState.playersSummary?.find(p => p.id === socketManager.playerId);
    if (me) {
      document.getElementById('scoreInfo').textContent = `점수: ${me.score}`;
      document.getElementById('myQueenCount').textContent = me.queenCount;

      // Render my awakened queens as cards
      renderMyQueens(me.awakenedQueens || []);
    }

    // Update turn status on reconnect
    isMyTurn = gameState.currentPlayerId === socketManager.playerId;
    if (isMyTurn) {
      document.getElementById('turnInfo').textContent = '내 턴!';
      document.getElementById('turnInfo').classList.add('my-turn');
    } else {
      const currentPlayer = gameState.playersSummary?.find(p => p.id === gameState.currentPlayerId);
      document.getElementById('turnInfo').textContent = `${currentPlayer?.name || '?'}의 턴`;
      document.getElementById('turnInfo').classList.remove('my-turn');
    }
    updateActionButtons();
  }
}

function renderMyQueens(queens) {
  const container = document.getElementById('myQueens');
  if (!container) return;

  container.innerHTML = '';

  if (queens.length === 0) {
    container.innerHTML = '<span class="no-queens">아직 깨운 퀸이 없습니다</span>';
    return;
  }

  queens.forEach(queen => {
    const el = createQueenElement(queen, { selectable: false });
    container.appendChild(el);
  });
}

function renderHand() {
  const container = document.getElementById('myHand');
  container.innerHTML = '';

  myHand.forEach(card => {
    const isSelected = selectedCards.includes(card.id);
    const el = createCardElement(card, { selected: isSelected });
    el.addEventListener('click', () => toggleCardSelection(card.id));
    container.appendChild(el);
  });

  updateActionButtons();
}

function toggleCardSelection(cardId) {
  const index = selectedCards.indexOf(cardId);
  if (index === -1) {
    selectedCards.push(cardId);
  } else {
    selectedCards.splice(index, 1);
  }
  renderHand();
}

function updateActionButtons() {
  const playBtn = document.getElementById('playCardBtn');
  const discardBtn = document.getElementById('discardBtn');

  if (!isMyTurn || selectedCards.length === 0) {
    playBtn.disabled = true;
    discardBtn.disabled = true;
    return;
  }

  const selected = myHand.filter(c => selectedCards.includes(c.id));
  const firstCard = selected[0];

  // Can play single action card
  if (selected.length === 1 && ['king', 'knight', 'potion'].includes(firstCard.type)) {
    playBtn.disabled = false;
    discardBtn.disabled = true;
  }
  // Can discard number cards
  else if (selected.every(c => c.type === 'number')) {
    playBtn.disabled = true;
    discardBtn.disabled = false;
  }
  else {
    playBtn.disabled = true;
    discardBtn.disabled = true;
  }
}

function playSelectedCard() {
  if (selectedCards.length !== 1) return;

  const card = myHand.find(c => c.id === selectedCards[0]);
  if (!card) return;

  if (card.type === 'king') {
    showTargetModal('queen', '깨울 퀸을 선택하세요');
  } else if (card.type === 'knight') {
    showTargetModal('steal', '훔칠 퀸을 선택하세요');
  } else if (card.type === 'potion') {
    showTargetModal('sleep', '재울 퀸을 선택하세요');
  }
}

function showTargetModal(type, title) {
  const modal = document.getElementById('targetModal');
  const titleEl = document.getElementById('targetTitle');
  const options = document.getElementById('targetOptions');

  titleEl.textContent = title;
  options.innerHTML = '';

  if (type === 'queen') {
    // Show sleeping queens
    if (gameState.sleepingQueens) {
      gameState.sleepingQueens.forEach(queen => {
        const el = createQueenElement(queen, { selectable: true });
        el.addEventListener('click', () => {
          socketManager.emit('playCard', {
            cardId: selectedCards[0],
            targetQueenId: queen.id
          });
          selectedCards = [];
          closeTargetModal();
        });
        options.appendChild(el);
      });
    }
  } else if (type === 'steal' || type === 'sleep') {
    // Show other players' queens
    if (gameState.playersSummary) {
      gameState.playersSummary
        .filter(p => p.id !== socketManager.playerId && p.queenCount > 0)
        .forEach(player => {
          const div = document.createElement('div');
          div.className = 'target-player';
          div.innerHTML = `<h4>${player.name}의 퀸</h4>`;

          // We need the queen details - emit a request or use cached data
          const btn = document.createElement('button');
          btn.className = 'primary';
          btn.textContent = `${player.name} 선택 (퀸 ${player.queenCount}개)`;
          btn.style.margin = '4px';
          btn.addEventListener('click', () => {
            socketManager.emit('playCard', {
              cardId: selectedCards[0],
              targetPlayerId: player.id,
              targetQueenId: 'first' // Server picks first queen if not specified
            });
            selectedCards = [];
            closeTargetModal();
          });
          div.appendChild(btn);
          options.appendChild(div);
        });
    }
  }

  modal.classList.remove('hidden');
}

function closeTargetModal() {
  document.getElementById('targetModal').classList.add('hidden');
}

function discardSelected() {
  if (selectedCards.length === 0) return;

  // Get selected card objects for validation
  const selectedObjects = myHand.filter(c => selectedCards.includes(c.id));

  // Validate locally before animation/sending
  const validation = validateLocalDiscard(selectedObjects);
  if (!validation.valid) {
    showToast(validation.message, 'error');
    // Do NOT clear selectedCards here so user can correct their selection
    return;
  }

  // Get card elements that are selected
  const container = document.getElementById('myHand');
  const cardElements = container.querySelectorAll('.card.selected');

  // Add fly-up animation to each selected card
  if (cardElements.length > 0) {
    cardElements.forEach((el, index) => {
      el.style.animationDelay = `${index * 0.1}s`;
      el.classList.add('discard-fly-up');
    });
  }

  // Wait for animation to complete, then send discard
  // If no elements (shouldn't happen if validation passed), send immediately
  const animDuration = cardElements.length > 0 ? (500 + (cardElements.length - 1) * 100) : 0;

  setTimeout(() => {
    socketManager.emit('discardCards', { cardIds: selectedCards });
    selectedCards = [];
  }, animDuration);
}

function validateLocalDiscard(cards) {
  if (!cards || cards.length === 0) return { valid: false, message: '카드를 선택해주세요' };

  // All must be number cards
  if (cards.some(c => c.type !== 'number')) {
    return { valid: false, message: '숫자 카드만 버릴 수 있습니다' };
  }

  const count = cards.length;
  // Parse values to ensure they are numbers
  const values = cards.map(c => typeof c.value === 'string' ? parseInt(c.value) : c.value);

  // Single card
  if (count === 1) return { valid: true };

  // Pair
  if (count === 2) {
    if (values[0] === values[1]) return { valid: true };
    return { valid: false, message: '두 장을 버리려면 숫자가 같아야 합니다' };
  }

  // Equation
  if (count >= 3 && count <= 5) {
    const totalSum = values.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...values);
    // Logic: Sum of smaller numbers = Largest number
    // So TotalSum = Sum(smaller) + Max = Max + Max = 2 * Max
    if (totalSum === maxVal * 2) return { valid: true };
    return { valid: false, message: '식이 올바르지 않습니다. 작은 숫자들의 합이 가장 큰 숫자와 같아야 합니다' };
  }

  return { valid: false, message: '유효하지 않은 카드 장수이거나 조합입니다' };
}

function showCounterModal(data) {
  pendingCounter = data;
  const modal = document.getElementById('counterModal');
  const title = document.getElementById('counterTitle');
  const message = document.getElementById('counterMessage');
  const btn = document.getElementById('counterBtn');

  if (data.type === 'dragon') {
    title.textContent = '기사가 공격합니다!';
    message.textContent = '드래곤 카드로 반격하시겠습니까?';
    // Check if player has dragon
    const hasDragon = myHand.some(c => c.type === 'dragon');
    btn.disabled = !hasDragon;
    btn.textContent = hasDragon ? '드래곤 사용' : '드래곤 없음';
  } else if (data.type === 'wand') {
    title.textContent = '수면포션 공격!';
    message.textContent = '마법봉으로 반격하시겠습니까?';
    const hasWand = myHand.some(c => c.type === 'wand');
    btn.disabled = !hasWand;
    btn.textContent = hasWand ? '마법봉 사용' : '마법봉 없음';
  }

  modal.classList.remove('hidden');

  // Counter timer (only if timeLimit > 0)
  const timeLimit = data.timeLimit || 0;
  const fill = document.getElementById('counterTimerFill');

  clearInterval(counterTimerInterval);

  if (timeLimit > 0) {
    let remaining = timeLimit;
    fill.style.width = '100%';
    fill.parentElement.classList.remove('hidden');

    counterTimerInterval = setInterval(() => {
      remaining--;
      fill.style.width = ((remaining / timeLimit) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(counterTimerInterval);
        skipCounter();
      }
    }, 1000);
  } else {
    // No timer - hide the timer bar
    fill.style.width = '0%';
    fill.parentElement.classList.add('hidden');
  }
}

function useCounter() {
  if (!pendingCounter) return;

  const counterType = pendingCounter.type === 'dragon' ? 'dragon' : 'wand';
  const counterCard = myHand.find(c => c.type === counterType);

  if (counterCard) {
    socketManager.emit('counterAction', { cardId: counterCard.id, accept: true });
  }

  clearInterval(counterTimerInterval);
  document.getElementById('counterModal').classList.add('hidden');
  pendingCounter = null;
}

function skipCounter() {
  socketManager.emit('counterAction', { cardId: null, accept: false });
  clearInterval(counterTimerInterval);
  document.getElementById('counterModal').classList.add('hidden');
  pendingCounter = null;
}

function startTurnTimer(timeLimit) {
  clearInterval(timerInterval);
  const fill = document.getElementById('timerFill');
  const timerBar = fill?.parentElement;

  // If no time limit, hide the timer
  if (!timeLimit || timeLimit <= 0) {
    if (timerBar) timerBar.classList.add('hidden');
    return;
  }

  if (timerBar) timerBar.classList.remove('hidden');

  let remaining = timeLimit;
  fill.style.width = '100%';
  fill.className = 'timer-bar-fill';

  timerInterval = setInterval(() => {
    remaining--;
    const percent = (remaining / timeLimit) * 100;
    fill.style.width = percent + '%';

    if (percent <= 20) fill.className = 'timer-bar-fill danger';
    else if (percent <= 50) fill.className = 'timer-bar-fill warning';

    if (remaining <= 0) clearInterval(timerInterval);
  }, 1000);
}

function showGameEnd(data) {
  document.getElementById('waitingScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.remove('hidden');

  const isWinner = data.winnerId === socketManager.playerId;
  const endTitle = document.getElementById('endTitle');
  endTitle.textContent = isWinner ? '축하합니다! 승리!' : '게임 종료';
  endTitle.className = isWinner ? 'winner' : 'loser';

  const resultDiv = document.getElementById('endResult');
  resultDiv.innerHTML = '';

  data.scores.sort((a, b) => b.score - a.score).forEach((s, i) => {
    const row = document.createElement('div');
    const isMe = s.id === socketManager.playerId;
    const hasQueens = s.awakenedQueens && s.awakenedQueens.length > 0;

    row.className = `score-row ${s.id === data.winnerId ? 'winner' : ''} ${isMe ? 'me' : ''} ${hasQueens ? 'has-queens' : ''}`;

    // Header section
    const header = document.createElement('div');
    header.className = 'score-row-header';
    header.innerHTML = `
      <span>${i + 1}. ${s.name} ${isMe ? '(나)' : ''}</span>
      <span>${s.score}점 (${s.queenCount} 퀸)</span>
    `;
    row.appendChild(header);

    // Queens section - Display Awakened Queens
    if (s.awakenedQueens && s.awakenedQueens.length > 0) {
      const queensContainer = document.createElement('div');
      queensContainer.className = 'result-queens-container';

      const queensEl = document.createElement('div');
      queensEl.className = 'result-queens';
      queensEl.style.display = 'flex';
      queensEl.style.gap = '5px';
      queensEl.style.marginTop = '8px';
      queensEl.style.flexWrap = 'wrap';
      queensEl.style.justifyContent = 'center';

      s.awakenedQueens.forEach(queen => {
        const queenEl = createQueenElement(queen);
        // Smaller size for list
        queenEl.style.width = '45px';
        queenEl.style.height = '63px';
        queenEl.style.fontSize = '0.6em';
        queensEl.appendChild(queenEl);
      });

      queensContainer.appendChild(queensEl);
      row.appendChild(queensContainer);
    }

    resultDiv.appendChild(row);
  });

  // Vote Restart Section
  const restartArea = document.createElement('div');
  restartArea.id = 'restartArea';
  restartArea.className = 'restart-area';
  restartArea.style.marginTop = '20px';
  restartArea.style.textAlign = 'center';

  restartArea.innerHTML = `
    <button class="primary" id="voteRestartBtn" onclick="voteRestart()">
      재경기 투표하기
    </button>
    <div id="restartStatus" class="restart-status" style="margin-top: 10px; font-size: 0.9em; color: var(--text-secondary);"></div>
  `;

  resultDiv.appendChild(restartArea);
}

function voteRestart() {
  const btn = document.getElementById('voteRestartBtn');
  btn.disabled = true;
  btn.textContent = '투표 완료 (대기 중...)';
  socketManager.emit('requestRestart');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
