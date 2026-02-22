/**
 * judge.js — Character sum judgment
 * Rule: ring the bell when any character's total across all top revealed cards = exactly 5
 */

/**
 * Get the current top revealed card for each player.
 * @param {Array<{revealedPile: Array}>} players
 * @returns {Array<{character:string, count:number}>}
 */
function getTopCards(players) {
  return players
    .filter(p => p.revealedPile && p.revealedPile.length > 0)
    .map(p => p.revealedPile[p.revealedPile.length - 1]);
}

/**
 * Check if any character sum equals exactly 5.
 * @param {Array} players  array of player objects with revealedPile
 * @returns {boolean}
 */
function shouldRingBell(players) {
  const topCards = getTopCards(players);
  if (topCards.length === 0) return false;

  const charCount = { kitty: 0, pudding: 0, melody: 0, cinna: 0 };
  for (const card of topCards) {
    if (charCount[card.character] !== undefined) {
      charCount[card.character] += card.count;
    }
  }

  return Object.values(charCount).some(n => n === 5);
}

/**
 * Get details of which characters sum to 5.
 * @param {Array} players
 * @returns {Array<string>}  character names that sum to 5
 */
function getMatchingCharacters(players) {
  const topCards = getTopCards(players);
  const charCount = { kitty: 0, pudding: 0, melody: 0, cinna: 0 };

  for (const card of topCards) {
    if (charCount[card.character] !== undefined) {
      charCount[card.character] += card.count;
    }
  }

  return Object.entries(charCount)
    .filter(([, n]) => n === 5)
    .map(([char]) => char);
}

/**
 * Check if ringing the bell is correct at this moment.
 * (Wrapper for shouldRingBell — same logic, different name for clarity in game flow.)
 */
function isBellCorrect(players) {
  return shouldRingBell(players);
}
