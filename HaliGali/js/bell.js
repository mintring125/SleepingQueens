/**
 * bell.js — Multi-touch bell ring detection
 * Collects all touches within 200ms and picks the first.
 */

class BellManager {
  constructor() {
    this._touches = [];
    this._timeout = null;
    this._windowMs = 200;
    this._active = false;
    this._processing = false;
    this._onRing = null;
    this._playerCount = 4;
    this._listenersAttached = false;
  }

  /**
   * Initialize and attach event listeners (only once).
   * @param {number} playerCount
   * @param {Function} onRing  called with (playerId: 1-4)
   */
  init(playerCount, onRing) {
    this._playerCount = playerCount;
    this._onRing = onRing;
    if (!this._listenersAttached) {
      this._attachListeners();
      this._listenersAttached = true;
    }
  }

  _attachListeners() {
    const zoneMap = {
      1: document.getElementById('zone-1'),
      2: document.getElementById('zone-2'),
      3: document.getElementById('zone-3'),
      4: document.getElementById('zone-4'),
    };

    for (const [pid, zone] of Object.entries(zoneMap)) {
      if (!zone) continue;
      const playerId = parseInt(pid, 10);

      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this._active || this._processing) return;
        this._recordTouch(playerId, e.timeStamp);
      }, { passive: false });

      // Mouse fallback for desktop testing
      zone.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!this._active || this._processing) return;
        this._recordTouch(playerId, performance.now());
      }, { passive: false });
    }
  }

  _recordTouch(playerId, timestamp) {
    // Immediately light up the zone
    animManager.activateZone(playerId);

    this._touches.push({ playerId, timestamp });

    if (!this._timeout) {
      // Start 200ms collection window
      this._timeout = setTimeout(() => this._resolve(), this._windowMs);
    }
  }

  _resolve() {
    this._timeout = null;
    if (this._touches.length === 0) return;

    // Sort by timestamp, pick earliest
    this._touches.sort((a, b) => a.timestamp - b.timestamp);
    const winner = this._touches[0];
    this._touches = [];

    this._processing = true;

    // Trigger callback
    if (this._onRing) {
      this._onRing(winner.playerId);
    }

    // Re-enable after result animation
    setTimeout(() => { this._processing = false; }, 1500);
  }

  /** Enable bell ringing (called when a card is revealed). */
  enable() {
    this._active = true;
    this._touches = [];
    this._processing = false;
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    const bellCenter = document.getElementById('bell-center');
    if (bellCenter) bellCenter.classList.add('ringable');
  }

  /** Disable bell ringing. */
  disable() {
    this._active = false;
    this._touches = [];
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    const bellCenter = document.getElementById('bell-center');
    if (bellCenter) bellCenter.classList.remove('ringable');
  }

  /** Update player count (for 2/3 player games). */
  setPlayerCount(n) {
    this._playerCount = n;
  }
}

const bellManager = new BellManager();
