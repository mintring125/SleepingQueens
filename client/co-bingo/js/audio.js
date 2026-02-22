let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, type = 'sine', volume = 0.3, startAt = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
  } catch (_) {}
}

export function playMark() {
  tone(440, 0.08, 'sine', 0.25);
  tone(660, 0.12, 'sine', 0.18, 0.05);
}

export function playBingo() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.25, 'sine', 0.3, i * 0.1));
}

export function playWin() {
  const melody = [523, 659, 784, 523, 659, 784, 1047];
  melody.forEach((f, i) => tone(f, 0.3, 'triangle', 0.35, i * 0.12));
}

export function playTurn() {
  tone(880, 0.1, 'sine', 0.2);
}

export function playJoin() {
  tone(440, 0.1, 'sine', 0.2);
  tone(550, 0.15, 'sine', 0.2, 0.1);
}
