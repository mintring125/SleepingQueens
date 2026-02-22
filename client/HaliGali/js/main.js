/**
 * main.js — App entry point
 * Initializes all managers and wires up the UI.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Init animation manager ──
  animManager.init();

  // ── Setup screen: player count selection ──
  let selectedPlayerCount = 4;
  let selectedNoRingTimeoutMs = 3000;

  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlayerCount = parseInt(btn.dataset.count, 10);
    });
  });

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedNoRingTimeoutMs = parseInt(btn.dataset.timeout, 10);
    });
  });

  // ── Start button ──
  document.getElementById('btn-start').addEventListener('click', () => {
    startGame(selectedPlayerCount, { noRingTimeoutMs: selectedNoRingTimeoutMs });
  });

  // ── Restart / Menu ──
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    resetToGame(selectedPlayerCount, { noRingTimeoutMs: selectedNoRingTimeoutMs });
  });

  document.getElementById('btn-menu-main')?.addEventListener('click', () => {
    showSetupScreen();
  });

  document.getElementById('btn-menu')?.addEventListener('click', () => {
    if (confirm('게임을 종료하고 메인 메뉴로 돌아가시겠습니까?')) {
      showSetupScreen();
    }
  });

  // ── Fullscreen on first interaction ──
  document.addEventListener('touchstart', tryFullscreen, { once: true });
  document.addEventListener('click', tryFullscreen, { once: true });

  // ── Screen Wake Lock ──
  requestWakeLock();

  // ── Unlock audio context ──
  document.addEventListener('touchstart', () => {
    soundManager._getCtx();
  }, { once: true });
});

function startGame(playerCount, options = {}) {
  // Switch screens
  document.getElementById('screen-setup').classList.remove('active');
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('screen-gameover').classList.remove('active');
  document.getElementById('screen-game').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('active');

  // Init subsystems
  bellManager.init(playerCount, (playerId) => {
    game.onBellRing(playerId);
  });

  swipeManager.init(
    playerCount,
    (playerId) => { game.onSwipe(playerId); },
    (playerId) => { /* wrong swipe feedback handled in swipe.js */ }
  );

  // Start game FSM
  game.start(playerCount, options);
}

function resetToGame(playerCount, options = {}) {
  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('screen-gameover').classList.remove('active');
  document.getElementById('screen-game').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('active');

  // Clear revealed piles in DOM
  for (let pid = 1; pid <= 4; pid++) {
    const revealed = document.getElementById(`revealed-${pid}`);
    if (revealed) revealed.innerHTML = '';
  }

  // Re-init
  bellManager.init(playerCount, (playerId) => {
    game.onBellRing(playerId);
  });

  swipeManager.init(
    playerCount,
    (playerId) => { game.onSwipe(playerId); },
    () => {}
  );

  game.start(playerCount, options);
}

function showSetupScreen() {
  bellManager.disable();
  swipeManager.disableAll();

  document.getElementById('screen-game').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('active');
  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('screen-gameover').classList.remove('active');
  document.getElementById('screen-setup').classList.remove('hidden');
  document.getElementById('screen-setup').classList.add('active');
}

// ── Fullscreen ──
function tryFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}

// ── Wake Lock ──
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    await navigator.wakeLock.request('screen');
  } catch (e) {
    // Not critical
  }
}
