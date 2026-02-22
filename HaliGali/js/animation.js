/**
 * animation.js — Animation controller
 * Handles card flip, collect, penalty, particle effects
 */

class AnimationManager {
  constructor() {
    this._particleContainer = null;
  }

  init() {
    this._particleContainer = document.getElementById('particles');
  }

  /**
   * Flip a card element from back to front.
   * @param {HTMLElement} cardEl
   * @returns {Promise} resolves when done
   */
  flipCard(cardEl) {
    return new Promise(resolve => {
      let done = false;
      let fallbackTimer = null;

      const finish = () => {
        if (done) return;
        done = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        cardEl.classList.remove('flipping');
        cardEl.classList.remove('face-down');
        cardEl.classList.add('face-up');
        // Landing bounce
        cardEl.classList.add('landing');
        setTimeout(() => {
          cardEl.classList.remove('landing');
          resolve();
        }, 200);
      };

      cardEl.classList.add('flipping');
      const onEnd = () => {
        finish();
      };
      cardEl.addEventListener('animationend', onEnd, { once: true });

      // Fallback in case CSS animation is missing/cancelled.
      fallbackTimer = setTimeout(finish, 800);
    });
  }

  /**
   * Animate cards flying to winner's pile.
   * @param {HTMLElement[]} cardEls  cards to collect
   * @param {HTMLElement} targetEl  destination element
   * @returns {Promise}
   */
  collectCards(cardEls, targetEl) {
    if (!cardEls || cardEls.length === 0) return Promise.resolve();

    const targetRect = targetEl.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    const promises = cardEls.map((el, i) => {
      return new Promise(resolve => {
        const rect = el.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dx = targetX - startX;
        const dy = targetY - startY;
        const duration = 420 + i * 55;

        // Animate a fixed-position clone so transformed player areas don't break the motion path.
        const ghost = el.cloneNode(true);
        ghost.classList.remove('card-collecting', 'flipping', 'landing');
        ghost.style.position = 'fixed';
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.margin = '0';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '1000';
        ghost.style.transform = 'none';
        ghost.style.opacity = '1';
        document.body.appendChild(ghost);

        // Hide the source card while the ghost flies.
        el.style.opacity = '0';

        if (ghost.animate) {
          const anim = ghost.animate(
            [
              { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
              { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 18}px) scale(1.05)`, opacity: 1, offset: 0.55 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 },
            ],
            {
              duration,
              easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              fill: 'forwards',
            }
          );
          anim.addEventListener('finish', () => {
            ghost.remove();
            resolve();
          }, { once: true });
        } else {
          ghost.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${duration}ms ease`;
          requestAnimationFrame(() => {
            ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
            ghost.style.opacity = '0';
          });
          setTimeout(() => {
            ghost.remove();
            resolve();
          }, duration + 40);
        }
      });
    });

    return Promise.all(promises);
  }

  /**
   * Flash the entire screen.
   * @param {'correct'|'wrong'} type
   */
  screenFlash(type) {
    const overlay = document.createElement('div');
    overlay.className = `flash-overlay flash-${type}`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 700);
  }

  /**
   * Burst particles from a center point.
   * @param {number} x  center X (viewport)
   * @param {number} y  center Y (viewport)
   * @param {{count:number, color:string, size:number}} opts
   */
  burstParticles(x, y, { count = 20, color = '#FFD700', size = 8 } = {}) {
    if (!this._particleContainer) return;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const angle = (i / count) * 360 + Math.random() * 20;
      const dist = 60 + Math.random() * 100;
      const rad = (angle * Math.PI) / 180;
      const dx = Math.cos(rad) * dist;
      const dy = Math.sin(rad) * dist;
      const dur = 0.6 + Math.random() * 0.5;
      const s = size * (0.5 + Math.random() * 1);

      p.className = 'particle';
      if (Math.random() > 0.5) p.classList.add('particle-star');
      p.style.cssText = `
        left: ${x}px;
        top: ${y}px;
        width: ${s}px;
        height: ${s}px;
        background: ${color};
        --dx: ${dx}px;
        --dy: ${dy}px;
        --duration: ${dur}s;
      `;
      this._particleContainer.appendChild(p);
      setTimeout(() => p.remove(), dur * 1000 + 100);
    }
  }

  /**
   * Burst particles for a correct ring.
   * @param {HTMLElement} bellEl
   * @param {string} playerColor
   */
  correctBurst(bellEl, playerColor) {
    const rect = bellEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    this.burstParticles(cx, cy, { count: 30, color: playerColor, size: 10 });
    this.burstParticles(cx, cy, { count: 15, color: '#FFD700', size: 6 });
    // Ripple
    this._addRipple(cx, cy, playerColor);
  }

  _addRipple(cx, cy, color) {
    const bellCenter = document.getElementById('bell-center');
    if (!bellCenter) return;
    const ripple = document.createElement('div');
    ripple.className = 'ring-ripple';
    ripple.style.borderColor = color;
    // Position relative to bell-center
    bellCenter.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  }

  /**
   * Show a floating score/message popup.
   * @param {string} text
   * @param {number} x  viewport X
   * @param {number} y  viewport Y
   * @param {string} color
   */
  showPopup(text, x, y, color = '#FFD700') {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.cssText = `left: ${x}px; top: ${y}px; color: ${color};`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1300);
  }

  /**
   * Bell ring animation + sound trigger point.
   */
  ringBell() {
    const bell = document.getElementById('bell');
    if (!bell) return;
    bell.classList.add('ringing');
    bell.addEventListener('animationend', () => {
      bell.classList.remove('ringing');
    }, { once: true });
  }

  /**
   * Zone lit animation.
   * @param {number} playerId 1-4
   */
  activateZone(playerId) {
    const zone = document.getElementById(`zone-${playerId}`);
    if (!zone) return;
    zone.classList.add('active');
  }

  /**
   * Mark zone as correct/wrong result.
   */
  resultZone(playerId, isCorrect) {
    const zone = document.getElementById(`zone-${playerId}`);
    if (!zone) return;
    zone.classList.remove('active');
    zone.classList.add(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => {
      zone.classList.remove('correct', 'wrong', 'active');
    }, 800);
  }

  /**
   * Reset all zones.
   */
  resetZones() {
    document.querySelectorAll('.bell-zone').forEach(z => {
      z.classList.remove('active', 'correct', 'wrong');
    });
  }

  /**
   * Show bell result emoji (✅ or ❌).
   */
  showBellResult(isCorrect) {
    const el = document.getElementById('bell-result');
    if (!el) return;
    el.textContent = isCorrect ? '✅' : '❌';
    el.className = `bell-result show-${isCorrect ? 'correct' : 'wrong'}`;
    setTimeout(() => {
      el.className = 'bell-result hidden';
    }, 1000);
  }

  /**
   * Animate a card being "dealt" to a pile.
   * @param {HTMLElement} cardEl
   * @param {number} delay ms
   */
  dealCard(cardEl, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        cardEl.classList.add('card-dealing');
        cardEl.addEventListener('animationend', () => {
          cardEl.classList.remove('card-dealing');
          resolve();
        }, { once: true });
      }, delay);
    });
  }

  /**
   * Shake a pile element (wrong swipe attempt).
   * @param {HTMLElement} pileEl
   */
  shakePile(pileEl) {
    pileEl.classList.add('wrong-swipe');
    pileEl.addEventListener('animationend', () => {
      pileEl.classList.remove('wrong-swipe');
    }, { once: true });
  }

  /**
   * Update card count display with animation.
   */
  updateCardCount(playerEl, newCount, delta) {
    const countEl = playerEl.querySelector('.card-count');
    if (!countEl) return;
    countEl.textContent = `${newCount}장`;
    const cls = delta > 0 ? 'increase' : 'decrease';
    countEl.classList.add(cls);
    setTimeout(() => countEl.classList.remove(cls), 450);
  }
}

const animManager = new AnimationManager();
