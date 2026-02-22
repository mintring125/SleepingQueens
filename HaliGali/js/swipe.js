/**
 * swipe.js — Swipe gesture detection for card flipping
 * Each player swipes "toward the bell" to reveal their top card.
 *
 * P1 (bottom):  swipe UP    (Y decreases)
 * P2 (left):    swipe RIGHT (X increases)   [player is rotated 90°, so from their perspective it's "up"]
 * P3 (top):     swipe DOWN  (Y increases)
 * P4 (right):   swipe LEFT  (X decreases)
 */

const SWIPE_CONFIG = {
  1: { axis: 'Y', sign: -1 },  // ↑
  2: { axis: 'X', sign: +1 },  // →
  3: { axis: 'Y', sign: +1 },  // ↓
  4: { axis: 'X', sign: -1 },  // ←
};

const MIN_SWIPE_DISTANCE = 40;   // pixels
const MIN_SWIPE_RATIO    = 1.5;  // primary axis must be 1.5× the other axis

class SwipeManager {
  constructor() {
    this._handlers = {};
    this._onSwipe = null;
    this._onWrongSwipe = null;
    this._currentTurnId = null;
    this._playerCount = 4;
    this._listenersAttached = false;
  }

  init(playerCount, onSwipe, onWrongSwipe) {
    this._playerCount = playerCount;
    this._onSwipe = onSwipe;
    this._onWrongSwipe = onWrongSwipe;

    if (!this._listenersAttached) {
      for (let pid = 1; pid <= 4; pid++) {
        const pileEl = document.getElementById(`hand-${pid}`);
        if (!pileEl) continue;
        this._attachSwipe(pid, pileEl);
      }
      this._listenersAttached = true;
    }
  }

  _attachSwipe(playerId, pileEl) {
    let touchId = null;
    let startX = 0, startY = 0;
    let isDragging = false;

    const onTouchStart = (e) => {
      if (isDragging) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;
      isDragging = true;
    };

    const onTouchMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      // Optionally show drag feedback here
    };

    const onTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;

      let endX = startX, endY = startY;
      for (let t of e.changedTouches) {
        if (t.identifier === touchId) {
          endX = t.clientX;
          endY = t.clientY;
          break;
        }
      }

      this._evaluate(playerId, startX, startY, endX, endY, pileEl);
      touchId = null;
    };

    // Mouse fallback for desktop testing
    let mouseDown = false;
    let mouseStartX = 0, mouseStartY = 0;

    const onMouseDown = (e) => {
      e.preventDefault();
      mouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
    };

    const onMouseUp = (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      this._evaluate(playerId, mouseStartX, mouseStartY, e.clientX, e.clientY, pileEl);
    };

    pileEl.addEventListener('touchstart',  onTouchStart, { passive: false });
    pileEl.addEventListener('touchmove',   onTouchMove,  { passive: false });
    pileEl.addEventListener('touchend',    onTouchEnd,   { passive: false });
    pileEl.addEventListener('touchcancel', (e) => { isDragging = false; }, { passive: true });

    pileEl.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
  }

  _evaluate(playerId, startX, startY, endX, endY, pileEl) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    const config = SWIPE_CONFIG[playerId];
    if (!config) return;

    const primary = config.axis === 'X' ? deltaX : deltaY;
    const secondary = config.axis === 'X' ? Math.abs(deltaY) : Math.abs(deltaX);
    const dist = primary * config.sign;

    const isCorrectDirection = dist >= MIN_SWIPE_DISTANCE;
    const isPrimary = secondary === 0 || Math.abs(primary) / secondary >= MIN_SWIPE_RATIO;

    if (!isCorrectDirection || !isPrimary) {
      // Small swipe or wrong direction — ignore silently if tiny
      if (dist > 10) {
        this._handleWrongSwipe(playerId, pileEl);
      }
      return;
    }

    // Valid swipe!
    if (this._currentTurnId !== playerId) {
      this._handleWrongSwipe(playerId, pileEl);
      return;
    }

    if (this._onSwipe) {
      this._onSwipe(playerId);
    }
  }

  _handleWrongSwipe(playerId, pileEl) {
    if (playerId !== this._currentTurnId) {
      animManager.shakePile(pileEl);
    }
    if (this._onWrongSwipe) {
      this._onWrongSwipe(playerId);
    }
  }

  /** Set current turn player. Only they can swipe. */
  setTurn(playerId) {
    this._currentTurnId = playerId;
    this._updateTurnVisuals();
  }

  _updateTurnVisuals() {
    for (let pid = 1; pid <= 4; pid++) {
      const pile = document.getElementById(`hand-${pid}`);
      if (!pile) continue;
      if (pid === this._currentTurnId) {
        pile.classList.add('active-turn');
        pile.classList.remove('inactive-turn');
      } else {
        pile.classList.remove('active-turn');
        pile.classList.add('inactive-turn');
      }
    }
  }

  /** Disable all swipes (e.g., during bell processing). */
  disableAll() {
    this._currentTurnId = null;
    for (let pid = 1; pid <= 4; pid++) {
      const pile = document.getElementById(`hand-${pid}`);
      if (pile) {
        pile.classList.remove('active-turn', 'inactive-turn');
      }
    }
  }
}

const swipeManager = new SwipeManager();
