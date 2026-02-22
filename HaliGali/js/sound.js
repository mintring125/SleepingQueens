/**
 * sound.js — Web Audio API sound effects
 * No external audio files required — all sounds synthesized.
 */

class SoundManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._volume = 0.7;
  }

  _getCtx() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this._enabled = false;
      }
    }
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /**
   * Play a tone with given parameters.
   */
  _playTone({ freq = 440, type = 'sine', duration = 0.3, gain = 0.5,
               attack = 0.01, decay = 0.1, sustain = 0.3, release = 0.1,
               freqEnd = null, delay = 0 }) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const masterGain = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
    }

    const vol = gain * this._volume;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(vol, start + attack);
    gainNode.gain.linearRampToValueAtTime(vol * sustain, start + attack + decay);
    gainNode.gain.setValueAtTime(vol * sustain, start + duration - release);
    gainNode.gain.linearRampToValueAtTime(0, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** 🔔 Bell ring */
  playBell() {
    // Metallic bell: multiple harmonics
    this._playTone({ freq: 880, type: 'sine',    duration: 1.2, gain: 0.5, attack: 0.005, decay: 0.05, sustain: 0.8, release: 0.3 });
    this._playTone({ freq: 1320, type: 'sine',   duration: 0.8, gain: 0.25, attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.3 });
    this._playTone({ freq: 2200, type: 'sine',   duration: 0.4, gain: 0.12, attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.2 });
    this._playTone({ freq: 440, type: 'triangle',duration: 0.6, gain: 0.2, attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.2 });
  }

  /** 🃏 Card flip whoosh */
  playCardFlip() {
    this._playTone({ freq: 800, type: 'sine', freqEnd: 200, duration: 0.15, gain: 0.2, attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.05 });
  }

  /** 🎉 Correct! fanfare */
  playCorrect() {
    // Ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      this._playTone({ freq, type: 'sine', duration: 0.25, gain: 0.4, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1, delay: i * 0.1 });
    });
    // Final chord sustain
    [523, 659, 784].forEach(freq => {
      this._playTone({ freq, type: 'sine', duration: 0.6, gain: 0.25, attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.2, delay: 0.4 });
    });
  }

  /** 😣 Wrong buzz */
  playWrong() {
    this._playTone({ freq: 150, type: 'sawtooth', freqEnd: 80, duration: 0.4, gain: 0.4, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1 });
    this._playTone({ freq: 200, type: 'square',   freqEnd: 100, duration: 0.3, gain: 0.2, attack: 0.01, delay: 0.05 });
  }

  /** 💨 Card collect swoosh */
  playCollect() {
    this._playTone({ freq: 600, type: 'sine', freqEnd: 1200, duration: 0.3, gain: 0.25, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 });
  }

  /** 🃏 Card land tap */
  playCardLand() {
    this._playTone({ freq: 300, type: 'triangle', freqEnd: 200, duration: 0.1, gain: 0.3, attack: 0.005, decay: 0.08, sustain: 0.0, release: 0.02 });
  }

  /** 💀 Player eliminated */
  playEliminated() {
    this._playTone({ freq: 400, type: 'sine', freqEnd: 100, duration: 0.8, gain: 0.4, attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 });
  }

  /** 🏆 Game over fanfare */
  playGameOver() {
    const notes = [523, 784, 1047, 784, 1047, 1319];
    const times = [0, 0.15, 0.3, 0.5, 0.65, 0.8];
    notes.forEach((freq, i) => {
      this._playTone({ freq, type: 'sine', duration: 0.3, gain: 0.4, attack: 0.01, sustain: 0.7, release: 0.15, delay: times[i] });
    });
  }

  setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); }
  setEnabled(b) { this._enabled = b; }
  toggle() { this._enabled = !this._enabled; return this._enabled; }
}

const soundManager = new SoundManager();
