import { db } from './firebase-config.js';
import {
  ref, set, get, update, remove, onValue, onDisconnect,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roomRef(roomId) {
  return ref(db, `rooms/${roomId}`);
}

function playerRef(roomId, playerId) {
  return ref(db, `rooms/${roomId}/players/${playerId}`);
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export async function createRoom(roomId, hostId, hostName, settings = {}) {
  const data = {
    id: roomId,
    host: hostId,
    status: 'waiting',
    settings: {
      boardSize: settings.boardSize ?? 5,
      winCondition: settings.winCondition ?? 5,
      maxPlayers: settings.maxPlayers ?? 12,
    },
    players: {
      [hostId]: {
        name: hostName,
        order: 0,
        board: null,
        connected: true,
        bingoLines: 0,
        ready: false,
        lastSeen: Date.now(),
      },
    },
    calledNumbers: [],
    currentTurnIndex: 0,
    turnOrder: [hostId],
    winner: null,
    createdAt: Date.now(),
  };
  await set(roomRef(roomId), data);
  return data;
}

export async function getRoom(roomId) {
  const snap = await get(roomRef(roomId));
  return snap.exists() ? snap.val() : null;
}

export async function deleteRoom(roomId) {
  await remove(roomRef(roomId));
}

export async function joinRoom(roomId, playerId, playerName) {
  const snap = await get(roomRef(roomId));
  if (!snap.exists()) throw new Error('방을 찾을 수 없습니다.');
  const room = snap.val();
  if (room.status !== 'waiting') throw new Error('이미 시작된 게임입니다.');

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= (room.settings?.maxPlayers ?? 12)) throw new Error('방이 가득 찼습니다.');

  const newTurnOrder = [...(room.turnOrder ?? [])];
  if (!newTurnOrder.includes(playerId)) newTurnOrder.push(playerId);

  await update(playerRef(roomId, playerId), {
    name: playerName,
    order: playerCount,
    board: null,
    connected: true,
    bingoLines: 0,
    ready: false,
    lastSeen: Date.now(),
  });

  await update(roomRef(roomId), { turnOrder: newTurnOrder });
  return room;
}

export function onRoomChange(roomId, callback) {
  const unsubscribe = onValue(roomRef(roomId), snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsubscribe;
}

export async function updateRoom(roomId, data) {
  await update(roomRef(roomId), data);
}

export async function updatePlayer(roomId, playerId, data) {
  await update(playerRef(roomId, playerId), data);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export async function submitBoard(roomId, playerId, board) {
  await update(playerRef(roomId, playerId), { board, ready: true });
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export async function startGame(roomId) {
  await update(roomRef(roomId), { status: 'setup' });
}

export async function startPlaying(roomId) {
  await update(roomRef(roomId), { status: 'playing', currentTurnIndex: 0 });
}

export async function callNumber(roomId, number) {
  const snap = await get(ref(db, `rooms/${roomId}/calledNumbers`));
  const current = normalizeDbArray(snap.val());
  if (!current.includes(number)) {
    current.push(number);
    await set(ref(db, `rooms/${roomId}/calledNumbers`), current);
  }
}

export async function advanceTurn(roomId, nextIndex) {
  await update(roomRef(roomId), { currentTurnIndex: nextIndex });
}

export async function setWinner(roomId, playerId) {
  await update(roomRef(roomId), { winner: playerId, status: 'finished' });
}

export async function restartGame(roomId) {
  const snap = await get(roomRef(roomId));
  if (!snap.exists()) return;
  const room = snap.val();

  const resetPlayers = {};
  Object.entries(room.players || {}).forEach(([pid, p]) => {
    resetPlayers[pid] = { ...p, board: null, bingoLines: 0, ready: false };
  });

  await update(roomRef(roomId), {
    status: 'waiting',
    calledNumbers: [],
    currentTurnIndex: 0,
    winner: null,
    players: resetPlayers,
  });
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export function setupOnDisconnect(roomId, playerId) {
  const connRef = ref(db, `rooms/${roomId}/players/${playerId}/connected`);
  const seenRef = ref(db, `rooms/${roomId}/players/${playerId}/lastSeen`);
  onDisconnect(connRef).set(false);
  onDisconnect(seenRef).set(Date.now());
}

export async function reconnectPlayer(roomId, playerId) {
  await update(playerRef(roomId, playerId), {
    connected: true,
    lastSeen: Date.now(),
  });
}

// ─── Util ─────────────────────────────────────────────────────────────────────

export function normalizeDbArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}
