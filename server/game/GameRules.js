/**
 * GameRules.js
 * Static rule validation for Sleeping Queens board game
 */

class GameRules {
  /**
   * Validate number card discard combinations
   * Supports: single, pair, and equation (2-5 cards)
   * @param {Array<Object>} cards - Array of card objects with value property
   * @returns {Object} { valid: boolean, message: string }
   */
  static validateDiscardCards(cards) {
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return { valid: false, message: 'No cards provided' };
    }

    // All must be number cards
    if (cards.some(card => !card.value || typeof card.value !== 'number')) {
      return { valid: false, message: 'All cards must be number cards' };
    }

    const count = cards.length;

    // Single card
    if (count === 1) {
      return { valid: true, message: 'Valid single card' };
    }

    // Pair: exactly 2 cards with same value
    if (count === 2) {
      if (cards[0].value === cards[1].value) {
        return { valid: true, message: 'Valid pair' };
      }
      // Check if it's a valid equation (first + second = second is impossible)
      // Actually check: cards[0] = cards[1] (which is the pair case above)
      // Or equation: cards[0] = cards[1] (e.g., 2 = 2) - no, that's not how equations work
      // Equation with 2 cards: first card = second card value? No.
      // Example: [3, 7] could be valid if 3 = 7? No.
      // Actually for 2 cards: first must equal second (pair), OR first = second (same as pair)
      // Re-reading spec: equation means sum of all except last equals last
      // So [3, 3] → 3 = 3 (valid)
      // [3, 7] → 3 = 7 (invalid)
      return { valid: false, message: 'Two cards must be a pair or valid equation' };
    }

    // Equation: 3-5 cards where sum of N-1 cards equals the Nth card
    // Order doesn't matter (e.g., 1, 4, 5 is valid because 1+4=5)
    if (count >= 3 && count <= 5) {
      const totalSum = cards.reduce((acc, card) => acc + card.value, 0);
      const maxVal = Math.max(...cards.map(c => c.value));

      // If sum of parts = Max, then TotalSum = Sum of parts + Max = 2 * Max
      if (totalSum === maxVal * 2) {
        return { valid: true, message: 'Valid equation' };
      }
      return { valid: false, message: 'Equation invalid: Sum of smaller numbers must equal the largest number' };
    }

    return { valid: false, message: 'Invalid card count or combination' };
  }

  /**
   * Validate playing an action card
   * @param {Object} card - The action card being played
   * @param {Object} gameState - Current game state
   * @param {String} playerId - ID of player playing the card
   * @returns {Object} { valid: boolean, message: string }
   */
  static validatePlayCard(card, gameState, playerId) {
    if (!card || !card.type) {
      return { valid: false, message: 'Invalid card' };
    }

    const { type, targetQueenId, targetPlayerId } = card;

    switch (type) {
      case 'king':
        if (!targetQueenId) {
          return { valid: false, message: 'King requires targetQueenId' };
        }
        // Check if queen exists in sleepingQueens
        if (!gameState.sleepingQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: 'Target queen is not sleeping' };
        }
        return { valid: true, message: 'Valid king play' };

      case 'knight':
        if (!targetPlayerId || !targetQueenId) {
          return { valid: false, message: 'Knight requires targetPlayerId and targetQueenId' };
        }
        if (targetPlayerId === playerId) {
          return { valid: false, message: 'Cannot steal from yourself' };
        }
        // Check if target player has that queen
        const targetPlayer = gameState.getPlayer(targetPlayerId);
        if (!targetPlayer) {
          return { valid: false, message: 'Target player not found' };
        }
        if (!targetPlayer.awakenedQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: 'Target player does not have that queen' };
        }
        return { valid: true, message: 'Valid knight play' };

      case 'potion':
        if (!targetPlayerId || !targetQueenId) {
          return { valid: false, message: 'Sleeping potion requires targetPlayerId and targetQueenId' };
        }
        if (targetPlayerId === playerId) {
          return { valid: false, message: 'Cannot use potion on yourself' };
        }
        // Check if target player has that queen
        const potionTarget = gameState.getPlayer(targetPlayerId);
        if (!potionTarget) {
          return { valid: false, message: 'Target player not found' };
        }
        if (!potionTarget.awakenedQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: 'Target player does not have that queen' };
        }
        return { valid: true, message: 'Valid sleeping potion play' };

      case 'dragon':
        // Only valid during counter phase when countering a knight
        if (gameState.turnPhase !== 'counter') {
          return { valid: false, message: 'Dragon can only be played during counter phase' };
        }
        if (!gameState.pendingAction || gameState.pendingAction.type !== 'knight') {
          return { valid: false, message: 'Dragon can only counter knight attacks' };
        }
        if (gameState.pendingAction.targetPlayerId !== playerId) {
          return { valid: false, message: 'Dragon can only counter attacks against you' };
        }
        return { valid: true, message: 'Valid dragon counter' };

      case 'wand':
        // Only valid during counter phase when countering a sleeping potion
        if (gameState.turnPhase !== 'counter') {
          return { valid: false, message: 'Wand can only be played during counter phase' };
        }
        if (!gameState.pendingAction || gameState.pendingAction.type !== 'potion') {
          return { valid: false, message: 'Wand can only counter sleeping potion attacks' };
        }
        if (gameState.pendingAction.targetPlayerId !== playerId) {
          return { valid: false, message: 'Wand can only counter attacks against you' };
        }
        return { valid: true, message: 'Valid wand counter' };

      default:
        return { valid: false, message: `Unknown card type: ${type}` };
    }
  }

  /**
   * Check if acquiring a queen would violate Cat/Dog rule
   * @param {String} queenId - ID of queen being acquired
   * @param {String} playerId - ID of player acquiring queen
   * @param {Object} gameState - Current game state
   * @returns {Object} { conflict: boolean, message: string }
   */
  static checkCatDogConflict(queenId, playerId, gameState) {
    const player = gameState.getPlayer(playerId);
    if (!player) {
      return { conflict: false, message: 'Player not found' };
    }

    const CAT_QUEEN = 'queen_2'; // Cat Queen
    const DOG_QUEEN = 'queen_3'; // Dog Queen

    const playerQueens = player.awakenedQueens;
    const hasCat = playerQueens.some(q => q.id === CAT_QUEEN);
    const hasDog = playerQueens.some(q => q.id === DOG_QUEEN);

    // If trying to get Cat Queen but already has Dog Queen
    if (queenId === CAT_QUEEN && hasDog) {
      return { conflict: true, message: 'Cannot own both Cat Queen and Dog Queen' };
    }

    // If trying to get Dog Queen but already has Cat Queen
    if (queenId === DOG_QUEEN && hasCat) {
      return { conflict: true, message: 'Cannot own both Cat Queen and Dog Queen' };
    }

    return { conflict: false, message: 'No conflict' };
  }

  /**
   * Get win conditions based on player count
   * @param {Number} playerCount - Number of players in game
   * @returns {Object} { queens: number, points: number }
   */
  static getWinCondition(playerCount) {
    if (playerCount >= 2 && playerCount <= 3) {
      return { queens: 5, points: 50 };
    }
    if (playerCount === 4) {
      return { queens: 4, points: 40 };
    }
    // Default to 4-player rules if invalid count
    return { queens: 4, points: 40 };
  }

  /**
   * Check if queen is the Rose Queen
   * @param {String} queenId - ID of queen to check
   * @returns {Boolean} true if Rose Queen
   */
  static isRoseQueen(queenId) {
    return queenId === 'queen_1';
  }

  /**
   * Get number of cards player should draw after discarding
   * @param {Number} discardedCount - Number of cards discarded
   * @returns {Number} Number of cards to draw
   */
  static getRequiredDrawCount(discardedCount) {
    return discardedCount;
  }

  /**
   * Check if player can act (their turn and correct phase)
   * @param {String} playerId - ID of player
   * @param {Object} gameState - Current game state
   * @returns {Boolean} true if player can act
   */
  static canPlayerAct(playerId, gameState) {
    if (!gameState || !gameState.getCurrentPlayer) {
      return false;
    }
    const currentPlayer = gameState.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return false;
    }
    // Player can act during 'action' phase, not during 'counter' or 'draw' phases
    // Actually, during counter phase, the DEFENDER acts (plays counter card)
    // Let's allow action during 'action' and 'counter' phases
    // Counter phase: targeted player can play counter
    // So this method checks if it's their turn, specific phase validation is per-action
    return gameState.turnPhase === 'action' || gameState.turnPhase === 'counter';
  }
}

module.exports = GameRules;
