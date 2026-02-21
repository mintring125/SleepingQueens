// Table display controller
let gameState = null;
let timerInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setCreateGameButtonEnabled(false);

  socketManager.on('connect', () => {
    document.getElementById('connectionStatus').className = 'connection-status connected';
    setCreateGameButtonEnabled(true);
  });

  socketManager.on('disconnect', () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
    setCreateGameButtonEnabled(false);
  });

  socketManager.on('connect_error', () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
    setCreateGameButtonEnabled(false);
    showToast('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
  });

  socketManager.connect();

  socketManager.on('serverInfo', (data) => {
    // Store server info for QR generation
    window.serverInfo = data;
  });

  socketManager.on('gameCreated', (data) => {
    document.getElementById('sessionInfo').textContent = `세션: ${data.sessionId}`;
    socketManager.setSession(data.sessionId);
    showQRCode(data.joinUrl);
    document.getElementById('qrPanel').classList.remove('hidden');
    document.getElementById('setupPanel').classList.add('hidden');
  });

  socketManager.on('playerJoined', (data) => {
    updatePlayerList(data);
    showToast(`${data.playerName} 참가!`, 'success');
  });

  socketManager.on('gameState', (data) => {
    gameState = data;
    updateGameDisplay();
  });

  socketManager.on('turnStart', (data) => {
    startTurnTimer(data.timeLimit);
  });

  socketManager.on('actionResult', (data) => {
    addActionLog(data.message);
    if (!data.success) {
      showToast(data.message, 'error');
    }
  });

  socketManager.on('gameEnd', (data) => {
    showGameEnd(data);
  });

  socketManager.on('cardsDiscarded', (data) => {
    showDiscardAnimation(data);
  });
});

function createGame() {
  if (!socketManager.connected) {
    showToast('서버 연결 중입니다. 잠시만 기다려주세요.', 'info');
    return;
  }
  const houseRuleAllQueens = document.getElementById('houseRuleAllQueens')?.checked || false;
  socketManager.emit('createGame', { houseRuleAllQueens });
}

function startGame() {
  socketManager.emit('startGame', {});
}

function showQRCode(joinUrl) {
  const qrContainer = document.getElementById('qrCode');
  qrContainer.innerHTML = '';

  // Use QRCode library if available, otherwise show URL
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: joinUrl,
      width: 200,
      height: 200,
      colorDark: '#2D3436',
      colorLight: '#FFFFFF'
    });
  } else {
    // Fallback: generate QR via canvas API or show URL
    const img = document.createElement('img');
    img.src = `${(window.ENV?.BACKEND_URL || '')}/api/qr?url=${encodeURIComponent(joinUrl)}`;
    img.alt = 'QR 코드';
    img.style.width = '200px';
    img.style.height = '200px';
    img.onerror = () => {
      qrContainer.innerHTML = `<div class="qr-fallback">QR 코드를 표시할 수 없습니다</div>`;
    };
    qrContainer.appendChild(img);
  }

  document.getElementById('joinUrl').textContent = joinUrl;
}

function updatePlayerList(data) {
  document.getElementById('playerCount').textContent = data.playerCount;
  const list = document.getElementById('playerList');

  const li = document.createElement('li');
  li.className = 'player-item fade-in';
  li.textContent = data.playerName;
  list.appendChild(li);

  // Show start button when 2+ players
  if (data.playerCount >= 2) {
    document.getElementById('startGameBtn').classList.remove('hidden');
  }
}

function updateGameDisplay() {
  if (!gameState) return;

  if (gameState.phase === 'waiting') {
    document.getElementById('waitingPhase').classList.remove('hidden');
    document.getElementById('playingPhase').classList.add('hidden');
    document.getElementById('endPhase').classList.add('hidden');
  } else if (gameState.phase === 'playing') {
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('playingPhase').classList.remove('hidden');
    document.getElementById('endPhase').classList.add('hidden');

    // Update current turn
    const currentPlayer = gameState.playersSummary.find(p => p.id === gameState.currentPlayerId);
    document.getElementById('currentTurnPlayer').textContent = currentPlayer ? currentPlayer.name : '-';
    document.getElementById('turnPhaseDisplay').textContent = getTurnPhaseText(gameState.turnPhase);
    document.getElementById('deckCount').textContent = gameState.deckCount;

    // Show win condition
    if (gameState.houseRuleAllQueens) {
      document.getElementById('winConditionDisplay').textContent = '목표: 모든 퀸(12개) 깨우기';
    } else {
      const playerCount = gameState.playersSummary.length;
      const requiredQueens = playerCount >= 4 ? 4 : 5;
      const requiredPoints = playerCount >= 4 ? 40 : 50;
      document.getElementById('winConditionDisplay').textContent = `목표: 퀸 ${requiredQueens}개 또는 ${requiredPoints}점`;
    }

    // Update sleeping queens
    renderSleepingQueens();

    // Update players board
    renderPlayersBoard();
  } else if (gameState.phase === 'ended') {
    document.getElementById('waitingPhase').classList.add('hidden');
    document.getElementById('playingPhase').classList.add('hidden');
    document.getElementById('endPhase').classList.remove('hidden');
  }
}

function getTurnPhaseText(phase) {
  const phases = { action: '행동', counter: '반격', draw: '드로우' };
  return phases[phase] || phase;
}

function renderSleepingQueens() {
  const grid = document.getElementById('sleepingQueensGrid');
  grid.innerHTML = '';

  if (gameState.sleepingQueens) {
    gameState.sleepingQueens.forEach(queen => {
      const el = createQueenElement(queen, { selectable: false });
      el.classList.add('sleeping');
      grid.appendChild(el);
    });
  }
}

function renderPlayersBoard() {
  const board = document.getElementById('playersBoard');
  board.innerHTML = '';

  gameState.playersSummary.forEach(player => {
    const isCurrentTurn = player.id === gameState.currentPlayerId;
    const div = document.createElement('div');
    div.className = `panel player-panel ${isCurrentTurn ? 'current-turn' : ''} ${!player.connected ? 'disconnected-player' : ''}`;

    div.innerHTML = `
      <div class="player-header">
        <span class="player-name">${player.name} ${isCurrentTurn ? '← 턴' : ''}</span>
        <span class="badge ${player.connected ? 'active' : 'waiting'}">${player.connected ? '연결됨' : '끊김'}</span>
      </div>
      <div class="player-stats">
        <span>카드: ${player.handCount || 0}</span>
        <span>퀸: ${player.queenCount}</span>
        <span class="player-score">점수: ${player.score}</span>
      </div>
      <div class="player-queens" id="playerQueens_${player.id}"></div>
    `;

    board.appendChild(div);

    // Render awakened queens for this player
    const queensContainer = div.querySelector(`#playerQueens_${player.id}`);
    if (player.awakenedQueens && player.awakenedQueens.length > 0) {
      player.awakenedQueens.forEach(queen => {
        const queenEl = createQueenElement(queen, { selectable: false });
        queenEl.style.width = '70px';
        queenEl.style.height = '70px';
        queensContainer.appendChild(queenEl);
      });
    }
  });
}

function addActionLog(message) {
  const log = document.getElementById('actionLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry fade-in';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  log.insertBefore(entry, log.firstChild);

  // Keep max 20 entries
  while (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

function startTurnTimer(timeLimit) {
  clearInterval(timerInterval);
  let remaining = timeLimit;
  const fill = document.getElementById('timerFill');

  fill.style.width = '100%';
  fill.className = 'timer-bar-fill';

  timerInterval = setInterval(() => {
    remaining--;
    const percent = (remaining / timeLimit) * 100;
    fill.style.width = percent + '%';

    if (percent <= 20) fill.className = 'timer-bar-fill danger';
    else if (percent <= 50) fill.className = 'timer-bar-fill warning';

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

function showGameEnd(data) {
  gameState = { ...gameState, phase: 'ended' };
  updateGameDisplay();

  const winnerDisplay = document.getElementById('winnerDisplay');
  const winner = data.scores.find(s => s.id === data.winnerId);
  winnerDisplay.innerHTML = `<h3>${winner ? winner.name : '?'} 승리!</h3>`;

  const scoresDiv = document.getElementById('finalScores');
  scoresDiv.innerHTML = '';

  data.scores.sort((a, b) => b.score - a.score).forEach((s, i) => {
    const row = document.createElement('div');
    const hasQueens = s.awakenedQueens && s.awakenedQueens.length > 0;
    row.className = `score-row ${s.id === data.winnerId ? 'winner' : ''} ${hasQueens ? 'has-queens' : ''}`;

    // Header section (Name & Score)
    const header = document.createElement('div');
    header.className = 'score-row-header';
    header.innerHTML = `
      <span>${i + 1}. ${s.name}</span>
      <span>퀸 ${s.queenCount}개 / ${s.score}점</span>
    `;
    row.appendChild(header);

    // Queens section
    if (s.awakenedQueens && s.awakenedQueens.length > 0) {
      const queensContainer = document.createElement('div');
      queensContainer.className = 'result-queens-container';

      const queensEl = document.createElement('div');
      queensEl.className = 'result-queens';
      queensEl.style.display = 'flex';
      queensEl.style.gap = '5px';
      queensEl.style.marginTop = '10px';
      queensEl.style.flexWrap = 'wrap';

      s.awakenedQueens.forEach(queen => {
        const queenEl = createQueenElement(queen);
        // Style adjustments for result view
        queenEl.style.width = '60px';
        queenEl.style.height = '84px';
        queenEl.style.fontSize = '0.7em';
        queensEl.appendChild(queenEl);
      });

      queensContainer.appendChild(queensEl);
      row.appendChild(queensContainer);
    }

    scoresDiv.appendChild(row);
  });

  // Add Restart Button
  const restartDiv = document.createElement('div');
  restartDiv.style.marginTop = '20px';
  restartDiv.innerHTML = '<button class="primary" onclick="startGame()">재게임 (같은 멤버)</button>';
  scoresDiv.appendChild(restartDiv);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showDiscardAnimation(data) {
  const { playerIndex, cardCount, cards, playerName } = data;

  // Get or create discard animation container
  let animContainer = document.getElementById('discardAnimationContainer');
  if (!animContainer) {
    animContainer = document.createElement('div');
    animContainer.id = 'discardAnimationContainer';
    animContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      pointer-events: none;
      display: flex;
      gap: 10px;
    `;
    document.body.appendChild(animContainer);
  }

  // Determine animation direction based on player index
  const directions = ['top', 'right', 'bottom', 'left'];
  const direction = directions[playerIndex % 4];

  // Create card elements for animation
  for (let i = 0; i < cardCount; i++) {
    const cardData = cards[i] || { type: 'number', value: '?' };
    const typeKo = { king: '왕', knight: '기사', potion: '물약', wand: '마법봉', dragon: '드래곤', number: '숫자' };

    const cardEl = document.createElement('div');
    cardEl.className = 'card number';
    cardEl.style.cssText = `
      width: 70px;
      height: 98px;
      opacity: 0;
    `;

    cardEl.innerHTML = `
      <div class="card-inner" style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border: 3px solid #7DD3FC; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div class="card-emoji" style="font-size: 28px; font-weight: 800; color: #7C3AED;">${cardData.value || '?'}</div>
        <div class="card-name" style="font-size: 9px; font-weight: 700;">${typeKo[cardData.type] || cardData.type}</div>
      </div>
    `;

    // Add animation with stagger delay
    cardEl.style.animationDelay = `${i * 0.15}s`;
    cardEl.classList.add(`discard-fly-in-${direction}`);

    animContainer.appendChild(cardEl);

    // Remove after animation
    setTimeout(() => {
      cardEl.remove();
    }, 800 + i * 150);
  }

  // Clear container after all animations
  setTimeout(() => {
    if (animContainer && animContainer.children.length === 0) {
      animContainer.remove();
    }
  }, 1500);
}

function setCreateGameButtonEnabled(enabled) {
  const btn = document.getElementById('createGameBtn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.6';
  btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
}
