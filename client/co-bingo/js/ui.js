/**
 * UI rendering module — all DOM mutations live here.
 * Functions accept data + handler callbacks; they never import app.js.
 */
import { countBingoLines, isCellInBingoLine, generateRandomBoard, normalizeArray, normalizeBoard } from './game.js';
import { generateQR } from './qr.js';
import { isSpeechSupported, startListening, stopAndProcess } from './speech.js';

const app = () => document.getElementById('app');

// ─── Home ─────────────────────────────────────────────────────────────────────

export function renderHome(session, handlers) {
  app().innerHTML = `
    <div class="screen home-screen">
      <div class="home-hero">
        <div class="logo-wrap">
          <svg class="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="url(#lg)"/>
            <defs><linearGradient id="lg" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#4facfe"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>
            <rect x="6" y="6" width="10" height="10" rx="2" fill="white" opacity=".9"/>
            <rect x="19" y="6" width="10" height="10" rx="2" fill="white" opacity=".5"/>
            <rect x="32" y="6" width="10" height="10" rx="2" fill="white" opacity=".9"/>
            <rect x="6" y="19" width="10" height="10" rx="2" fill="white" opacity=".5"/>
            <rect x="19" y="19" width="10" height="10" rx="2" fill="#ffd700" opacity="1"/>
            <rect x="32" y="19" width="10" height="10" rx="2" fill="white" opacity=".9"/>
            <rect x="6" y="32" width="10" height="10" rx="2" fill="white" opacity=".9"/>
            <rect x="19" y="32" width="10" height="10" rx="2" fill="white" opacity=".5"/>
            <rect x="32" y="32" width="10" height="10" rx="2" fill="white" opacity=".9"/>
          </svg>
          <h1 class="logo-title">Co-Bingo</h1>
        </div>
        <p class="logo-sub">QR 스캔으로 즐기는 실시간 빙고</p>
      </div>

      <div class="home-form glass-card">
        <input id="player-name-input" type="text" class="input-field" placeholder="닉네임 입력 (최대 12자)" maxlength="12" autocomplete="off">

        <button id="create-room-btn" class="btn btn-primary btn-lg">
          🎮 방 만들기
        </button>

        <div class="or-divider"><span>또는</span></div>

        <div class="join-row">
          <input id="room-code-input" type="text" class="input-field code-input" placeholder="방 코드" maxlength="8" autocomplete="off" style="text-transform:uppercase">
          <button id="join-room-btn" class="btn btn-secondary">참가</button>
        </div>
      </div>

      ${session ? `
        <div class="reconnect-banner glass-card" id="reconnect-banner">
          <div class="reconnect-info">
            <span class="reconnect-icon">🔄</span>
            <span>이전 게임이 있습니다</span>
          </div>
          <button id="reconnect-btn" class="btn btn-accent btn-sm">돌아가기</button>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('create-room-btn').onclick = handlers.onCreateRoom;
  document.getElementById('join-room-btn').onclick = handlers.onJoinRoom;
  document.getElementById('room-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handlers.onJoinRoom();
  });
  document.getElementById('player-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const code = document.getElementById('room-code-input').value.trim();
      if (code) handlers.onJoinRoom(); else handlers.onCreateRoom();
    }
  });
  if (session) {
    document.getElementById('reconnect-btn').onclick = handlers.onReconnect;
  }
  document.getElementById('player-name-input').focus();
}

// ─── Join (QR scan arrival) ───────────────────────────────────────────────────

export function renderJoin(roomId, handlers) {
  app().innerHTML = `
    <div class="screen home-screen">
      <div class="home-hero">
        <div class="logo-wrap">
          <div class="logo-icon-big">🎯</div>
          <h1 class="logo-title">Co-Bingo</h1>
        </div>
        <p class="logo-sub">방 코드: <strong>${roomId}</strong></p>
      </div>
      <div class="home-form glass-card">
        <p class="join-hint">닉네임을 입력하고 게임에 참가하세요!</p>
        <input id="player-name-input" type="text" class="input-field" placeholder="닉네임 입력" maxlength="12" autocomplete="off">
        <button id="join-direct-btn" class="btn btn-primary btn-lg">🚀 바로 참가!</button>
      </div>
    </div>
  `;
  document.getElementById('join-direct-btn').onclick = handlers.onJoin;
  document.getElementById('player-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handlers.onJoin();
  });
  document.getElementById('player-name-input').focus();
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export function renderLobby(room, myPlayerId, handlers) {
  const isHost = room.host === myPlayerId;
  const players = Object.entries(room.players || {});
  const playerCount = players.length;
  const roomUrl = `${location.origin}${location.pathname}?room=${room.id}`;
  const canStart = playerCount >= 2;

  app().innerHTML = `
    <div class="screen lobby-screen">
      <div class="screen-header">
        <h2>🏠 대기실</h2>
        <span class="room-badge">${room.id}</span>
        ${isHost ? '<button id="close-room-btn" class="btn btn-danger btn-sm" title="방 닫기">✕ 닫기</button>' : ''}
      </div>

      ${isHost ? `
        <div class="qr-card glass-card">
          <p class="qr-label">QR 코드로 친구 초대</p>
          <div id="qr-container" class="qr-wrap"></div>
          <div class="code-row">
            <span class="code-text">${room.id}</span>
            <button id="copy-btn" class="btn btn-ghost btn-sm">📋 복사</button>
          </div>
        </div>
      ` : `
        <div class="glass-card waiting-card">
          <p>방장이 게임 시작을 기다리는 중...</p>
          <div class="dots"><span></span><span></span><span></span></div>
        </div>
      `}

      <div class="glass-card players-card">
        <h3>참가자 <span class="count-badge">${playerCount}/${room.settings?.maxPlayers ?? 12}</span></h3>
        <ul class="players-list">
          ${players.map(([pid, p]) => `
            <li class="player-row ${pid === myPlayerId ? 'is-me' : ''} ${!p.connected ? 'is-offline' : ''}">
              <span class="player-avatar">${pid === room.host ? '👑' : '🎮'}</span>
              <span class="player-name">${escHtml(p.name)}</span>
              ${pid === myPlayerId ? '<span class="me-chip">나</span>' : ''}
              <span class="status-dot ${p.connected ? 'online' : 'offline'}"></span>
            </li>
          `).join('')}
        </ul>
      </div>

      ${isHost ? `
        <div class="glass-card settings-card">
          <h3>⚙️ 설정</h3>
          <div class="setting-row">
            <label>보드 크기</label>
            <div class="seg-ctrl" id="board-size-seg">
              ${[3, 4, 5].map(s => `
                <button class="seg-btn ${(room.settings?.boardSize ?? 5) === s ? 'active' : ''}" data-val="${s}">${s}×${s}</button>
              `).join('')}
            </div>
          </div>
          <div class="setting-row">
            <label>승리 조건 (빙고 줄)</label>
            <div class="num-ctrl">
              <button class="num-btn" id="wc-minus">−</button>
              <span class="num-val" id="wc-val">${room.settings?.winCondition ?? 5}</span>
              <button class="num-btn" id="wc-plus">+</button>
            </div>
          </div>
        </div>

        <button id="start-btn" class="btn btn-primary btn-lg ${canStart ? '' : 'disabled'}" ${canStart ? '' : 'disabled'}>
          ${canStart ? '🚀 게임 시작!' : `최소 2명 필요 (현재 ${playerCount}명)`}
        </button>
      ` : ''}
    </div>
  `;

  if (isHost) {
    generateQR('qr-container', roomUrl);
    document.getElementById('copy-btn').onclick = handlers.onCopyCode;
    document.getElementById('close-room-btn')?.addEventListener('click', handlers.onCloseRoom);

    // Board size segmented control
    document.getElementById('board-size-seg').addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      const size = parseInt(btn.dataset.val);
      const wc = parseInt(document.getElementById('wc-val').textContent);
      handlers.onSettingsChange({ ...(room.settings ?? {}), boardSize: size, winCondition: Math.min(wc, getMaxWc(size)) });
    });

    // Win condition +/−
    document.getElementById('wc-minus').onclick = () => {
      const cur = parseInt(document.getElementById('wc-val').textContent);
      if (cur > 1) handlers.onSettingsChange({ ...(room.settings ?? {}), winCondition: cur - 1 });
    };
    document.getElementById('wc-plus').onclick = () => {
      const cur = parseInt(document.getElementById('wc-val').textContent);
      const size = room.settings?.boardSize ?? 5;
      if (cur < getMaxWc(size)) handlers.onSettingsChange({ ...(room.settings ?? {}), winCondition: cur + 1 });
    };

    if (canStart) {
      document.getElementById('start-btn').onclick = handlers.onStartGame;
    }
  }
}

function getMaxWc(size) {
  // rows + cols + 2 diags
  return size * 2 + 2;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Persistent local state for board setup across re-renders
let _setup = { board: null, size: 5, selectedIdx: null };

export function resetSetupState() {
  _setup = { board: null, size: 5, selectedIdx: null };
}

export function renderSetup(room, myPlayerId, handlers) {
  const size = room.settings?.boardSize ?? 5;
  const total = size * size;
  const players = Object.entries(room.players || {});
  const myPlayer = room.players?.[myPlayerId];
  const readyCount = players.filter(([, p]) => p.ready).length;

  // Init local board from DB if available and we haven't started locally
  if (!_setup.board || _setup.size !== size) {
    _setup.size = size;
    if (myPlayer?.board) {
      _setup.board = normalizeBoard(myPlayer.board);
    } else {
      _setup.board = Array.from({ length: size }, () => Array(size).fill(null));
    }
    _setup.selectedIdx = null;
  }

  const placedSet = new Set(_setup.board.flat().filter(n => n !== null));
  const isAllPlaced = placedSet.size === total;
  const isReady = myPlayer?.ready === true;

  app().innerHTML = `
    <div class="screen setup-screen">
      <div class="screen-header">
        <h2>📋 보드 배치</h2>
        <span class="ready-badge">${readyCount}/${players.length} 준비</span>
        ${room.host === myPlayerId ? '<button id="close-room-btn" class="btn btn-danger btn-sm" title="방 닫기">✕ 닫기</button>' : ''}
      </div>

      <p class="setup-hint">
        ${isReady ? '✅ 준비 완료! 다른 플레이어를 기다리는 중...' : '숫자를 탭하여 보드에 배치하세요'}
      </p>

      <div class="glass-card board-wrap" id="board-wrap">
        <div class="board-grid" style="--size:${size}" id="setup-board">
          ${renderSetupGrid(size)}
        </div>
      </div>

      ${!isReady ? `
        <div class="setup-btns">
          <button id="random-btn" class="btn btn-secondary">🎲 랜덤</button>
          <button id="ready-btn" class="btn btn-primary ${isAllPlaced ? '' : 'disabled'}" ${isAllPlaced ? '' : 'disabled'}>
            ✅ 준비 완료
          </button>
        </div>
        <div class="number-pool" id="number-pool">
          ${renderNumberPool(size, placedSet)}
        </div>
      ` : `
        <div class="waiting-others glass-card">
          <div class="dots"><span></span><span></span><span></span></div>
          <p>다른 플레이어 대기 중...</p>
        </div>
      `}

      <div class="glass-card ready-list">
        ${players.map(([pid, p]) => `
          <div class="ready-row ${p.ready ? 'is-ready' : ''}">
            <span>${escHtml(p.name)}</span>
            <span>${p.ready ? '✅' : '⏳'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (isReady) {
    document.getElementById('close-room-btn')?.addEventListener('click', handlers.onCloseRoom);
    return;
  }

  document.getElementById('close-room-btn')?.addEventListener('click', handlers.onCloseRoom);
  bindSetupEvents(size, total, placedSet, handlers);
}

function renderSetupGrid(size) {
  return _setup.board.flat().map((num, idx) => `
    <div class="board-cell setup-cell ${num ? 'filled' : 'empty'} ${idx === _setup.selectedIdx ? 'selected' : ''}"
         data-idx="${idx}">
      ${num ?? ''}
    </div>
  `).join('');
}

function renderNumberPool(size, placedSet) {
  const total = size * size;
  return Array.from({ length: total }, (_, i) => i + 1).map(n => `
    <button class="num-chip ${placedSet.has(n) ? 'used' : ''}" data-num="${n}" ${placedSet.has(n) ? 'disabled' : ''}>
      ${n}
    </button>
  `).join('');
}

function bindSetupEvents(size, total, placedSet, handlers) {
  // Refresh only updates innerHTML — no re-binding needed because we use event delegation
  function refresh() {
    const ps = new Set(_setup.board.flat().filter(n => n !== null));
    document.getElementById('setup-board').innerHTML = renderSetupGrid(size);
    document.getElementById('number-pool').innerHTML = renderNumberPool(size, ps);
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
      const done = ps.size === total;
      readyBtn.disabled = !done;
      readyBtn.classList.toggle('disabled', !done);
    }
  }

  // Event delegation: bind once on containers — survives innerHTML updates
  document.getElementById('setup-board')?.addEventListener('click', e => {
    const cell = e.target.closest('.board-cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.idx);
    const row = Math.floor(idx / size);
    const col = idx % size;

    if (_setup.board[row][col] !== null) {
      _setup.board[row][col] = null;
      _setup.selectedIdx = null;
    } else {
      _setup.selectedIdx = idx;
    }
    refresh();
  });

  document.getElementById('number-pool')?.addEventListener('click', e => {
    const chip = e.target.closest('.num-chip');
    if (!chip || chip.disabled) return;
    const num = parseInt(chip.dataset.num);

    let targetIdx = _setup.selectedIdx;
    if (targetIdx === null) {
      outer: for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (_setup.board[r][c] === null) { targetIdx = r * size + c; break outer; }
        }
      }
    }
    if (targetIdx === null) return;

    const r = Math.floor(targetIdx / size);
    const c = targetIdx % size;
    _setup.board[r][c] = num;
    _setup.selectedIdx = null;
    refresh();
  });

  document.getElementById('random-btn')?.addEventListener('click', () => {
    _setup.board = generateRandomBoard(size);
    _setup.selectedIdx = null;
    refresh();
  });

  document.getElementById('ready-btn')?.addEventListener('click', () => {
    const ps = new Set(_setup.board.flat().filter(n => n !== null));
    if (ps.size === total) handlers.onBoardReady(_setup.board);
  });
}

// ─── Game ─────────────────────────────────────────────────────────────────────

let _prevCalledLen = 0;

export function renderGame(room, myPlayerId, handlers) {
  const players = room.players ?? {};
  const myPlayer = players[myPlayerId];
  const board = myPlayer?.board ? normalizeBoard(myPlayer.board) : null;
  const calledNumbers = normalizeArray(room.calledNumbers);
  const size = room.settings?.boardSize ?? 5;
  const turnOrder = normalizeArray(room.turnOrder);
  const turnIdx = room.currentTurnIndex ?? 0;
  const currentTurnId = turnOrder[turnIdx % (turnOrder.length || 1)];
  const isMyTurn = currentTurnId === myPlayerId;
  const winCondition = room.settings?.winCondition ?? 5;
  const myBingo = board ? countBingoLines(board, calledNumbers) : 0;

  const ranked = Object.entries(players)
    .map(([pid, p]) => {
      const b = p.board ? normalizeBoard(p.board) : null;
      return { pid, name: p.name, bingo: b ? countBingoLines(b, calledNumbers) : 0, isMe: pid === myPlayerId };
    })
    .sort((a, b) => b.bingo - a.bingo);

  app().innerHTML = `
    <div class="screen game-screen">
      <div class="game-top">
        <div class="turn-pill ${isMyTurn ? 'my-turn' : ''}">
          ${isMyTurn ? '🎯 내 차례!' : `${escHtml(players[currentTurnId]?.name ?? '')}님 차례`}
        </div>
        <div class="bingo-pill">🎊 ${myBingo}/${winCondition}</div>
        <button id="game-qr-btn" class="btn btn-ghost btn-sm game-qr-btn" title="초대 QR">📱</button>
        ${room.host === myPlayerId ? '<button id="close-room-btn" class="btn btn-danger btn-sm btn-close-game" title="방 닫기">✕</button>' : ''}
      </div>

      <div class="called-strip" id="called-strip">
        ${calledNumbers.length === 0
      ? '<span class="no-calls">아직 호출 없음</span>'
      : calledNumbers.map((n, i) => `
              <span class="called-num ${i === calledNumbers.length - 1 ? 'latest' : ''}">${n}</span>
            `).join('')}
      </div>

      <div class="board-wrap">
        ${board ? `
          <div class="board-grid game-board ${isMyTurn ? 'my-turn-glow' : ''}" style="--size:${size}">
            ${board.flat().map((num, idx) => {
        const r = Math.floor(idx / size);
        const c = idx % size;
        const marked = calledNumbers.includes(num);
        const inLine = marked && isCellInBingoLine(board, calledNumbers, r, c);
        return `<div class="board-cell game-cell ${marked ? 'marked' : ''} ${inLine ? 'bingo' : ''}" data-num="${num}">${num}</div>`;
      }).join('')}
          </div>
        ` : '<div class="no-board">보드 없음</div>'}
      </div>

      ${isMyTurn ? `
        <div class="turn-hint">✨ 위 빙고판에서 부를 숫자를 터치하세요!</div>
        ${isSpeechSupported() ? `
          <div class="mic-row">
            <button id="mic-btn" class="btn-mic" title="음성으로 숫자 부르기">
              <span class="mic-icon">🎤</span>
              <span class="mic-label">누르고 말하기</span>
            </button>
          </div>
        ` : ''}
      ` : ''}

      <div class="rank-list glass-card">
        ${ranked.map((p, i) => `
          <div class="rank-row ${p.isMe ? 'is-me' : ''}">
            <span class="rank-medal">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}위`}</span>
            <span class="rank-name">${escHtml(p.name)}</span>
            <span class="rank-score">${p.bingo}줄</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Scroll called strip to end
  const strip = document.getElementById('called-strip');
  if (strip) strip.scrollLeft = strip.scrollWidth;

  if (isMyTurn) {
    document.querySelector('.game-board')?.addEventListener('click', e => {
      const cell = e.target.closest('.game-cell');
      if (cell && !cell.classList.contains('marked')) {
        handlers.onCallNumber(parseInt(cell.dataset.num));
      }
    });

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
      const resetBtn = () => {
        micBtn.classList.remove('listening');
        micBtn.querySelector('.mic-label').textContent = '누르고 말하기';
      };

      micBtn.addEventListener('contextmenu', e => e.preventDefault());
      micBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); // prevent text selection / context menu on long-press
        micBtn.classList.add('listening');
        micBtn.querySelector('.mic-label').textContent = '듣는 중...';
        startListening(
          (num) => { resetBtn(); handlers.onCallNumber(num); },
          (msg)  => { resetBtn(); if (msg) showToast(msg); },
        );
      });

      const onRelease = () => { stopAndProcess(); resetBtn(); };
      micBtn.addEventListener('pointerup',     onRelease);
      micBtn.addEventListener('pointercancel', onRelease);
    }
  }

  document.getElementById('close-room-btn')?.addEventListener('click', handlers.onCloseRoom);
  document.getElementById('game-qr-btn')?.addEventListener('click', () => showQrOverlay(room.id));

  _prevCalledLen = calledNumbers.length;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export function renderResult(room, myPlayerId, handlers) {
  const players = room.players ?? {};
  const winnerName = players[room.winner]?.name ?? '?';
  const calledNumbers = normalizeArray(room.calledNumbers);
  const isWinner = room.winner === myPlayerId;
  const isHost = room.host === myPlayerId;

  const ranked = Object.entries(players)
    .map(([pid, p]) => {
      const b = p.board ? normalizeBoard(p.board) : null;
      return { pid, name: p.name, bingo: b ? countBingoLines(b, calledNumbers) : 0, isMe: pid === myPlayerId };
    })
    .sort((a, b) => b.bingo - a.bingo);

  app().innerHTML = `
    <div class="screen result-screen">
      <div class="result-hero ${isWinner ? 'is-winner' : ''}">
        ${isWinner ? '<div class="crown-anim">👑</div>' : '<div class="crown-anim">🏁</div>'}
        <h2 class="winner-title">${escHtml(winnerName)}</h2>
        <p class="winner-sub">${isWinner ? '🎊 빙고 달성! 축하합니다!' : '빙고 완료!'}</p>
      </div>

      <div class="glass-card final-rank">
        <h3>최종 순위</h3>
        ${ranked.map((p, i) => `
          <div class="final-row ${p.isMe ? 'is-me' : ''} ${p.pid === room.winner ? 'is-winner' : ''}">
            <span class="final-medal">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}위`}</span>
            <span>${escHtml(p.name)}</span>
            <span>${p.bingo}줄</span>
          </div>
        `).join('')}
      </div>

      <div class="result-btns">
        ${isHost ? `<button id="restart-btn" class="btn btn-primary btn-lg">🔄 다시 하기</button>` : ''}
        <button id="home-btn" class="btn btn-secondary btn-lg">🏠 홈으로</button>
      </div>
    </div>
  `;

  document.getElementById('restart-btn')?.addEventListener('click', handlers.onRestart);
  document.getElementById('home-btn').addEventListener('click', handlers.onHome);

  if (isWinner) spawnConfetti();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(msg, duration = 3000) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function spawnConfetti() {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${6 + Math.random() * 8}px;
      height:${6 + Math.random() * 8}px;
      background:${colors[i % colors.length]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay:${Math.random() * 2}s;
      animation-duration:${2.5 + Math.random() * 2}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

// ─── QR Overlay ───────────────────────────────────────────────────────────────

function showQrOverlay(roomId) {
  document.getElementById('qr-overlay')?.remove();
  const roomUrl = `${location.origin}${location.pathname}?room=${roomId}`;
  const el = document.createElement('div');
  el.id = 'qr-overlay';
  el.className = 'qr-overlay';
  el.innerHTML = `
    <div class="qr-overlay-card glass-card">
      <div class="qr-overlay-header">
        <span class="qr-overlay-title">게임 참가 QR</span>
        <button id="qr-overlay-close" class="btn btn-ghost btn-sm">✕</button>
      </div>
      <div id="qr-overlay-container" class="qr-overlay-container"></div>
      <div class="qr-overlay-code">${roomId}</div>
    </div>
  `;
  document.body.appendChild(el);
  generateQR('qr-overlay-container', roomUrl);
  document.getElementById('qr-overlay-close').onclick = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
