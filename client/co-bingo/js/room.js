import { createRoom, joinRoom } from './db.js';
import { generatePlayerId, generateRoomId } from './game.js';

export async function createNewRoom(playerName, settings = {}) {
  const playerId = generatePlayerId();
  const roomId = generateRoomId();
  await createRoom(roomId, playerId, playerName, settings);
  return { roomId, playerId };
}

export async function joinExistingRoom(roomCode, playerName) {
  const roomId = roomCode.toUpperCase().trim();
  const playerId = generatePlayerId();
  await joinRoom(roomId, playerId, playerName);
  return { roomId, playerId };
}
