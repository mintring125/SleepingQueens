/**
 * game.js — Halli Galli Game FSM
 *
 * States:
 *   SETUP → DEAL → PLAYING → WAIT_FOR_FLIP → CARD_REVEALED
 *   → JUDGING → COLLECT | PENALTY → CHECK_WIN → PLAYING | GAME_OVER
 */

const STATE = {
  SETUP:          'SETUP',
  DEAL:           'DEAL',
  WAIT_FOR_FLIP:  'WAIT_FOR_FLIP',
  CARD_REVEALED:  'CARD_REVEALED',
  JUDGING:        'JUDGING',
  COLLECT:        'COLLECT',
  PENALTY:        'PENALTY',
  CHECK_WIN:      'CHECK_WIN',
  ELIMINATED:     'ELIMINATED',
  GAME_OVER:      'GAME_OVER',
};

const PLAYER_COLORS = {
  1: '#FF4757',
  2: '#3742FA',
  3: '#2ED573',
  4: '#A55EEA',
};

const PLAYER_NAMES = {
  1: 'P1 (빨강)',
  2: 'P2 (파랑)',
  3: 'P3 (초록)',
  4: 'P4 (보라)',
};

const DEFAULT_NO_RING_TIMEOUT_MS = 3000;  // auto-advance if no one rings

class HalliGalliGame {
  constructor() {
    this.state       = STATE.SETUP;
    this.playerCount = 4;
    this.players     = [];  // [{id, hand, revealedPile, active}]
    this.turnIndex   = 0;   // index into active players array
    this._noRingTimer = null;
    this._eliminatedOverlayTimer = null;
    this.noRingTimeoutMs = DEFAULT_NO_RING_TIMEOUT_MS;
  }

  // ══════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════

  /** Start a new game with given player count. */
  start(playerCount, options = {}) {
    this.playerCount = playerCount;
    this.noRingTimeoutMs = options.noRingTimeoutMs ?? this.noRingTimeoutMs ?? DEFAULT_NO_RING_TIMEOUT_MS;
    this._transition(STATE.DEAL);
  }

  /** Called by SwipeManager when current player swipes. */
  onSwipe(playerId) {
    if (this.state !== STATE.WAIT_FOR_FLIP) return;
    const player = this._getPlayer(playerId);
    if (!player || !player.active) return;
    if (this._currentPlayer().id !== playerId) return;

    this._flipCard(player);
  }

  /** Called by BellManager when a player rings the bell. */
  onBellRing(playerId) {
    if (this.state !== STATE.CARD_REVEALED) return;
    this._clearNoRingTimer();
    this._transition(STATE.JUDGING, { ringerId: playerId });
  }

  // ══════════════════════════════════════
  // STATE TRANSITIONS
  // ══════════════════════════════════════

  _transition(newState, data = {}) {
    this.state = newState;

    switch (newState) {
      case STATE.DEAL:         return this._doDeal();
      case STATE.WAIT_FOR_FLIP:return this._doWaitForFlip();
      case STATE.CARD_REVEALED:return this._doCardRevealed();
      case STATE.JUDGING:      return this._doJudging(data.ringerId);
      case STATE.COLLECT:      return this._doCollect(data.ringerId);
      case STATE.PENALTY:      return this._doPenalty(data.ringerId);
      case STATE.CHECK_WIN:    return this._doCheckWin();
      case STATE.ELIMINATED:   return this._doEliminated(data.playerId);
      case STATE.GAME_OVER:    return this._doGameOver(data.winnerId);
    }
  }

  // ── DEAL ──
  _doDeal() {
    bellManager.disable();
    swipeManager.disableAll();

    const deck    = createDeck();
    const shuffled = shuffleDeck(deck);
    const hands   = dealCards(shuffled, this.playerCount);

    // Init player objects
    const seatIds = this._getSeatIdsForPlayerCount();
    this.players = [];
    for (let i = 0; i < this.playerCount; i++) {
      this.players.push({
        id:           seatIds[i],
        hand:         hands[i],
        revealedPile: [],
        active:       true,
      });
    }

    this.turnIndex = 0;
    this._renderAll();
    this._updatePlayerVisibility();
    this._updateBellZones();

    setTimeout(() => {
      this._transition(STATE.WAIT_FOR_FLIP);
    }, 400);
  }

  // ── WAIT FOR FLIP ──
  _doWaitForFlip() {
    bellManager.disable();

    const cur = this._currentPlayer();
    if (!cur) {
      this._transition(STATE.CHECK_WIN);
      return;
    }

    swipeManager.setTurn(cur.id);
    this._showStatus(`P${cur.id} 차례 — 카드를 넘기세요!`, cur.id);
  }

  // ── CARD REVEALED ──
  _doCardRevealed() {
    swipeManager.disableAll();

    // Check if bell SHOULD be rung
    const shouldRing = shouldRingBell(this.players.filter(p => p.active));

    // Enable bell regardless — player must judge
    bellManager.enable();

    // Don't reveal hint text ("ring now") to players.
    this._showStatus('');

    // Auto-advance if no one rings within timeout
    this._noRingTimer = setTimeout(() => {
      if (this.state === STATE.CARD_REVEALED) {
        bellManager.disable();
        animManager.resetZones();
        this._advanceTurn();
        this._transition(STATE.WAIT_FOR_FLIP);
      }
    }, this.noRingTimeoutMs);
  }

  // ── JUDGING ──
  _doJudging(ringerId) {
    bellManager.disable();
    swipeManager.disableAll();

    animManager.ringBell();
    soundManager.playBell();
    hapticFeedback('ring');

    const correct = isBellCorrect(this.players.filter(p => p.active));

    setTimeout(() => {
      animManager.showBellResult(correct);
      animManager.resultZone(ringerId, correct);

      if (correct) {
        soundManager.playCorrect();
        hapticFeedback('success');
        animManager.screenFlash('correct');
        const color = PLAYER_COLORS[ringerId];
        const bellRect = document.getElementById('bell').getBoundingClientRect();
        animManager.correctBurst(
          document.getElementById('bell'),
          color
        );
        animManager.showPopup('🎉 정답!',
          bellRect.left + bellRect.width / 2,
          bellRect.top, color);
        this._transition(STATE.COLLECT, { ringerId });
      } else {
        soundManager.playWrong();
        hapticFeedback('fail');
        animManager.screenFlash('wrong');
        const bellRect = document.getElementById('bell').getBoundingClientRect();
        animManager.showPopup('❌ 오답!',
          bellRect.left + bellRect.width / 2,
          bellRect.top, '#FF4757');
        setTimeout(() => {
          this._transition(STATE.PENALTY, { ringerId });
        }, 600);
      }
    }, 300);
  }

  // ── COLLECT ──
  _doCollect(ringerId) {
    const winner = this._getPlayer(ringerId);
    if (!winner) { this._transition(STATE.CHECK_WIN); return; }

    // Gather all revealed top cards from active players
    const cardsToCollect = [];
    for (const p of this.players.filter(pl => pl.active)) {
      cardsToCollect.push(...p.revealedPile);
      p.revealedPile = [];
    }

    winner.hand.unshift(...cardsToCollect);  // add to bottom of hand

    soundManager.playCollect();
    hapticFeedback('collect');

    // Animate cards flying to winner
    const winnerHandEl = document.getElementById(`hand-${ringerId}`);
    const revealedEls = document.querySelectorAll('.revealed-pile .game-card');

    animManager.collectCards(Array.from(revealedEls), winnerHandEl).then(() => {
      this._renderAll();
      this._showStatus(`P${ringerId} 카드 획득! 🎊`, ringerId);

      setTimeout(() => {
        this._advanceTurnTo(ringerId);  // winner goes next? No — turn after the ringer
        this._transition(STATE.CHECK_WIN);
      }, 800);
    });
  }

  // ── PENALTY ──
  _doPenalty(ringerId) {
    const ringer = this._getPlayer(ringerId);
    if (!ringer) { this._transition(STATE.CHECK_WIN); return; }

    const otherPlayers = this.players.filter(p => p.active && p.id !== ringerId);
    let penaltyCount = 0;

    for (const other of otherPlayers) {
      if (ringer.hand.length > 0) {
        const card = ringer.hand.pop();
        other.hand.unshift(card);
        penaltyCount++;
      }
    }

    this._renderAll();
    this._showStatus(`P${ringerId} 오답! ${penaltyCount}장 패널티 💸`, ringerId, PLAYER_COLORS[ringerId]);

    // Check if ringer is eliminated
    setTimeout(() => {
      if (ringer.hand.length === 0 && ringer.revealedPile.length === 0) {
        ringer.active = false;
        this._transition(STATE.ELIMINATED, { playerId: ringerId });
      } else {
        this._transition(STATE.CHECK_WIN);
      }
    }, 1200);
  }

  // ── CHECK WIN ──
  _doCheckWin() {
    // Eliminate players with no cards
    let justEliminated = null;
    for (const p of this.players) {
      if (p.active && p.hand.length === 0 && p.revealedPile.length === 0) {
        p.active = false;
        justEliminated = p.id;
      }
    }

    const active = this.players.filter(p => p.active);

    if (active.length <= 1) {
      const winnerId = active.length === 1 ? active[0].id : null;
      setTimeout(() => this._transition(STATE.GAME_OVER, { winnerId }), 500);
      return;
    }

    if (justEliminated) {
      this._transition(STATE.ELIMINATED, { playerId: justEliminated });
      return;
    }

    // Make sure turnIndex points to valid active player
    this._normalizeTurnIndex();
    this._renderAll();
    this._updateBellZones();
    this._transition(STATE.WAIT_FOR_FLIP);
  }

  // ── ELIMINATED ──
  _doEliminated(playerId) {
    const overlay = document.getElementById('eliminated-overlay');
    const nameEl  = document.getElementById('eliminated-player-name');
    if (overlay && nameEl) {
      nameEl.textContent = PLAYER_NAMES[playerId];
      overlay.classList.remove('hidden');
      soundManager.playEliminated();
      hapticFeedback('eliminated');

      setTimeout(() => {
        overlay.classList.add('hidden');
        this._updatePlayerVisibility();
        this._updateBellZones();
        this._renderAll();
        this._normalizeTurnIndex();
        this._transition(STATE.CHECK_WIN);
      }, 1800);
    } else {
      this._transition(STATE.CHECK_WIN);
    }
  }

  // ── GAME OVER ──
  _doGameOver(winnerId) {
    bellManager.disable();
    swipeManager.disableAll();
    soundManager.playGameOver();

    const winnerText = document.getElementById('winner-text');
    if (winnerText) {
      winnerText.textContent = winnerId
        ? `${PLAYER_NAMES[winnerId]} 승리! 🏆`
        : '무승부!';
      const c = winnerId ? PLAYER_COLORS[winnerId] : '#FFD700';
      winnerText.style.background = `linear-gradient(135deg, ${c}, ${c}aa)`;
      winnerText.style.webkitBackgroundClip = 'text';
      winnerText.style.webkitTextFillColor = 'transparent';
      winnerText.style.backgroundClip = 'text';
    }

    // Final scores
    const scoresEl = document.getElementById('final-scores');
    if (scoresEl) {
      scoresEl.innerHTML = '';
      for (const p of this.players) {
        const total = p.hand.length + p.revealedPile.length;
        const item = document.createElement('div');
        item.className = 'score-item' + (p.id === winnerId ? ' winner' : '');
        item.innerHTML = `
          <span class="score-player-name" style="color:${PLAYER_COLORS[p.id]}">${PLAYER_NAMES[p.id]}</span>
          <span class="score-cards">${total}장</span>
        `;
        scoresEl.appendChild(item);
      }
    }

    setTimeout(() => {
      document.getElementById('screen-game').classList.add('hidden');
      document.getElementById('screen-gameover').classList.remove('hidden');
      document.getElementById('screen-gameover').classList.add('active');
    }, 600);
  }

  // ══════════════════════════════════════
  // CARD FLIP
  // ══════════════════════════════════════

  _flipCard(player) {
    if (player.hand.length === 0) {
      // No cards — skip turn
      this._advanceTurn();
      this._transition(STATE.WAIT_FOR_FLIP);
      return;
    }

    swipeManager.disableAll();

    const card = player.hand.pop();
    
    // Randomize orientation for revealed pile
    card.rz = Math.random() * 24 - 12; // -12deg to +12deg
    card.tx = Math.random() * 10 - 5;  // -5px to +5px
    card.ty = Math.random() * 10 - 5;

    player.revealedPile.push(card);

    // Create card element and animate flip
    const cardEl = this._createCardElement(card);
    const revealedEl = document.getElementById(`revealed-${player.id}`);

    if (revealedEl) {
      revealedEl.appendChild(cardEl);
      cardEl.classList.add('face-down');
      soundManager.playCardFlip();
      hapticFeedback('deal');

      animManager.flipCard(cardEl).then(() => {
        soundManager.playCardLand();
        this._updateHandPile(player);
        this._transition(STATE.CARD_REVEALED);
      });
    } else {
      this._updateHandPile(player);
      this._transition(STATE.CARD_REVEALED);
    }
  }

  // ══════════════════════════════════════
  // TURN MANAGEMENT
  // ══════════════════════════════════════

  _currentPlayer() {
    const active = this.players.filter(p => p.active);
    if (active.length === 0) return null;
    return active[this.turnIndex % active.length];
  }

  _advanceTurn() {
    const active = this.players.filter(p => p.active);
    if (active.length === 0) return;
    this.turnIndex = (this.turnIndex + 1) % active.length;
  }

  _advanceTurnTo(playerId) {
    const active = this.players.filter(p => p.active);
    const idx = active.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      this.turnIndex = (idx + 1) % active.length;
    } else {
      this._advanceTurn();
    }
  }

  _normalizeTurnIndex() {
    const active = this.players.filter(p => p.active);
    if (active.length === 0) return;
    this.turnIndex = this.turnIndex % active.length;
  }

  _clearNoRingTimer() {
    if (this._noRingTimer) {
      clearTimeout(this._noRingTimer);
      this._noRingTimer = null;
    }
  }

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════

  _renderAll() {
    for (const p of this.players) {
      this._updateHandPile(p);
      this._updateRevealedPile(p);
    }
  }

  _updateHandPile(player) {
    const pileEl = document.getElementById(`hand-${player.id}`);
    if (!pileEl) return;

    const countEl = pileEl.querySelector('.pile-count');
    if (countEl) {
      countEl.textContent = player.hand.length > 0 ? `${player.hand.length}장` : '';
    }

    // Update player info card count
    const playerEl = document.getElementById(`player-${player.id}`);
    if (playerEl) {
      const cardCountEl = playerEl.querySelector('.card-count');
      if (cardCountEl) {
        const total = player.hand.length + player.revealedPile.length;
        cardCountEl.textContent = `${total}장`;
      }
    }

    // Show/hide pile visual
    const stack = pileEl.querySelector('.pile-stack');
    if (stack) {
      stack.style.opacity = player.hand.length > 0 ? '1' : '0.2';
    }
  }

  _updateRevealedPile(player) {
    const pileEl = document.getElementById(`revealed-${player.id}`);
    if (!pileEl) return;

    // Keep only last 3 card elements (for visual stacking)
    const existing = pileEl.querySelectorAll('.game-card:not(.card-collecting)');
    const toKeep = player.revealedPile.slice(-3);

    // Clear and re-render top cards
    // Only update if the pile count changed
    if (existing.length !== toKeep.length) {
      pileEl.innerHTML = '';
      toKeep.forEach(card => {
        const el = this._createCardElement(card);
        el.classList.add('face-up');
        pileEl.appendChild(el);
      });
    }
  }

  _createCardElement(card) {
    const template = document.getElementById('card-template');
    let cardEl;

    if (template) {
      cardEl = template.content.cloneNode(true).querySelector('.game-card');
    } else {
      cardEl = document.createElement('div');
      cardEl.className = 'game-card';
      cardEl.innerHTML = `
        <div class="card-face card-front"></div>
        <div class="card-face card-back">
          <img class="card-img" src="card/back.png" alt="뒷면">
        </div>
      `;
    }

    cardEl.dataset.cardId = card.id;
    cardEl.dataset.character = card.character;
    cardEl.dataset.count = card.count;

    if (card.rz !== undefined) {
      cardEl.style.setProperty('--rz', `${card.rz}deg`);
      cardEl.style.setProperty('--tx', `${card.tx}px`);
      cardEl.style.setProperty('--ty', `${card.ty}px`);
    }

    // Set front image
    const frontFace = cardEl.querySelector('.card-front');
    if (frontFace) {
      const imgPath = getCardImagePath(card);
      const img = frontFace.querySelector('.card-img') || document.createElement('img');
      img.className = 'card-img';
      img.src = imgPath;
      img.alt = `${card.character} ${card.count}`;

      // Fallback if image not found
      img.onerror = () => {
        frontFace.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'card-placeholder';
        placeholder.innerHTML = `
          <span class="char-emoji">${getCharEmoji(card.character)}</span>
          <span class="char-count">${card.count}</span>
        `;
        frontFace.appendChild(placeholder);
      };

      if (!frontFace.querySelector('.card-img')) {
        frontFace.appendChild(img);
      }
    }

    return cardEl;
  }

  // ══════════════════════════════════════
  // UI HELPERS
  // ══════════════════════════════════════

  _updatePlayerVisibility() {
    const visibleIds = new Set(
      this.players.length > 0
        ? this.players.map(p => p.id)
        : this._getSeatIdsForPlayerCount()
    );

    for (let pid = 1; pid <= 4; pid++) {
      const el = document.getElementById(`player-${pid}`);
      if (!el) continue;

      if (visibleIds.has(pid)) {
        el.classList.remove('hidden-player');
      } else {
        el.classList.add('hidden-player');
      }
    }
  }

  _updateBellZones() {
    const bellCenter = document.getElementById('bell-center');
    if (bellCenter) {
      bellCenter.setAttribute('data-active-players', this.playerCount);
    }

    // Show/hide zone per active players
    for (let pid = 1; pid <= 4; pid++) {
      const zone = document.getElementById(`zone-${pid}`);
      if (!zone) continue;

      const player = this._getPlayer(pid);
      const shouldShow = player && player.active;
      zone.style.display = shouldShow ? '' : 'none';
    }
  }

  _showStatus(msg, highlightPlayerId = null, color = null) {
    const el = document.getElementById('status-msg');
    if (!el) return;
    el.textContent = msg;
    if (highlightPlayerId) {
      el.style.color = color || PLAYER_COLORS[highlightPlayerId];
    } else if (color) {
      el.style.color = color;
    } else {
      el.style.color = '';
    }
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  _getPlayer(id) {
    return this.players.find(p => p.id === id) || null;
  }

  _getSeatIdsForPlayerCount() {
    if (this.playerCount === 2) return [1, 3]; // face-to-face layout
    if (this.playerCount === 3) return [1, 2, 3];
    return [1, 2, 3, 4];
  }
}

const game = new HalliGalliGame();
