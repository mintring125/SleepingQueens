/**
 * Pure bingo game logic (no Firebase, no DOM)
 */

// Normalize Firebase value (may be array or object)
export function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

// Normalize 2D board from Firebase (array of arrays or object of objects)
export function normalizeBoard(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val.map(row => normalizeArray(row));
  if (typeof val === 'object') {
    return Object.values(val).map(row => normalizeArray(row));
  }
  return null;
}

/**
 * Returns all completed bingo lines on a board given called numbers.
 * Each line: { type: 'row'|'col'|'diag', index: number }
 */
export function getBingoLines(board, calledNumbers) {
  const b = normalizeBoard(board);
  if (!b) return [];
  const called = new Set(normalizeArray(calledNumbers));
  const size = b.length;
  const lines = [];

  // Rows
  for (let r = 0; r < size; r++) {
    if (b[r].every(n => called.has(n))) {
      lines.push({ type: 'row', index: r });
    }
  }

  // Columns
  for (let c = 0; c < size; c++) {
    if (b.every(row => called.has(row[c]))) {
      lines.push({ type: 'col', index: c });
    }
  }

  // Diagonal top-left → bottom-right
  if (Array.from({ length: size }, (_, i) => b[i][i]).every(n => called.has(n))) {
    lines.push({ type: 'diag', index: 0 });
  }

  // Diagonal top-right → bottom-left
  if (Array.from({ length: size }, (_, i) => b[i][size - 1 - i]).every(n => called.has(n))) {
    lines.push({ type: 'diag', index: 1 });
  }

  return lines;
}

export function countBingoLines(board, calledNumbers) {
  return getBingoLines(board, calledNumbers).length;
}

/**
 * Returns whether a specific cell (row, col) is part of any completed bingo line.
 */
export function isCellInBingoLine(board, calledNumbers, row, col) {
  const b = normalizeBoard(board);
  if (!b) return false;
  const size = b.length;
  const lines = getBingoLines(board, calledNumbers);

  return lines.some(line => {
    if (line.type === 'row') return line.index === row;
    if (line.type === 'col') return line.index === col;
    if (line.type === 'diag' && line.index === 0) return row === col;
    if (line.type === 'diag' && line.index === 1) return row + col === size - 1;
    return false;
  });
}

/**
 * Generate a random board of given size (numbers 1 to size*size shuffled).
 */
export function generateRandomBoard(size) {
  const total = size * size;
  const nums = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  const board = [];
  for (let r = 0; r < size; r++) {
    board.push(nums.slice(r * size, (r + 1) * size));
  }
  return board;
}

/**
 * Generate a unique player ID.
 */
export function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate a unique room ID (8 uppercase alphanumeric chars).
 */
export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
