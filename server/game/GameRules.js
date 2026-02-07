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
      return { valid: false, message: '카드를 선택해주세요' };
    }

    // All must be number cards
    if (cards.some(card => !card.value || typeof card.value !== 'number')) {
      return { valid: false, message: '숫자 카드만 버릴 수 있습니다' };
    }

    const count = cards.length;

    // Single card
    if (count === 1) {
      return { valid: true, message: '유효한 버리기입니다' };
    }

    // Pair: exactly 2 cards with same value
    if (count === 2) {
      if (cards[0].value === cards[1].value) {
        return { valid: true, message: '유효한 쌍입니다' };
      }
      return { valid: false, message: '두 장을 버리려면 숫자가 같아야 합니다' };
    }

    // Equation: 3-5 cards where sum of N-1 cards equals the Nth card
    // Order doesn't matter (e.g., 1, 4, 5 is valid because 1+4=5)
    if (count >= 3 && count <= 5) {
      const totalSum = cards.reduce((acc, card) => acc + card.value, 0);
      const maxVal = Math.max(...cards.map(c => c.value));

      // If sum of parts = Max, then TotalSum = Sum of parts + Max = 2 * Max
      if (totalSum === maxVal * 2) {
        return { valid: true, message: '유효한 식입니다' };
      }
      return { valid: false, message: '식이 올바르지 않습니다. 작은 숫자들의 합이 가장 큰 숫자와 같아야 합니다' };
    }

    return { valid: false, message: '유효하지 않은 카드 장수이거나 조합입니다' };
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
      return { valid: false, message: '유효하지 않은 카드입니다' };
    }

    const { type, targetQueenId, targetPlayerId } = card;

    switch (type) {
      case 'king':
        if (!targetQueenId) {
          return { valid: false, message: '깨울 퀸을 선택해야 합니다' };
        }
        // Check if queen exists in sleepingQueens
        if (!gameState.sleepingQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: '해당 퀸은 잠들어 있지 않습니다' };
        }
        return { valid: true, message: '왕 카드 사용 가능' };

      case 'knight':
        if (!targetPlayerId || !targetQueenId) {
          return { valid: false, message: '대상 플레이어와 퀸을 선택해야 합니다' };
        }
        if (targetPlayerId === playerId) {
          return { valid: false, message: '자신의 퀸은 훔칠 수 없습니다' };
        }
        // Check if target player has that queen
        const targetPlayer = gameState.getPlayer(targetPlayerId);
        if (!targetPlayer) {
          return { valid: false, message: '대상 플레이어를 찾을 수 없습니다' };
        }
        if (!targetPlayer.awakenedQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: '대상 플레이어에게 해당 퀸이 없습니다' };
        }
        return { valid: true, message: '기사 카드 사용 가능' };

      case 'potion':
        if (!targetPlayerId || !targetQueenId) {
          return { valid: false, message: '대상 플레이어와 퀸을 선택해야 합니다' };
        }
        if (targetPlayerId === playerId) {
          return { valid: false, message: '자신의 퀸에게는 사용할 수 없습니다' };
        }
        // Check if target player has that queen
        const potionTarget = gameState.getPlayer(targetPlayerId);
        if (!potionTarget) {
          return { valid: false, message: '대상 플레이어를 찾을 수 없습니다' };
        }
        if (!potionTarget.awakenedQueens.find(q => q.id === targetQueenId)) {
          return { valid: false, message: '대상 플레이어에게 해당 퀸이 없습니다' };
        }
        return { valid: true, message: '물약 카드 사용 가능' };

      case 'dragon':
        // Only valid during counter phase when countering a knight
        if (gameState.turnPhase !== 'counter') {
          return { valid: false, message: '드래곤은 반격 단계에서만 사용할 수 있습니다' };
        }
        if (!gameState.pendingAction || gameState.pendingAction.type !== 'knight') {
          return { valid: false, message: '드래곤은 기사 공격만 막을 수 있습니다' };
        }
        if (gameState.pendingAction.targetPlayerId !== playerId) {
          return { valid: false, message: '자신을 향한 공격만 막을 수 있습니다' };
        }
        return { valid: true, message: '드래곤 카드 사용 가능' };

      case 'wand':
        // Only valid during counter phase when countering a sleeping potion
        if (gameState.turnPhase !== 'counter') {
          return { valid: false, message: '마법봉은 반격 단계에서만 사용할 수 있습니다' };
        }
        if (!gameState.pendingAction || gameState.pendingAction.type !== 'potion') {
          return { valid: false, message: '마법봉은 물약 공격만 막을 수 있습니다' };
        }
        if (gameState.pendingAction.targetPlayerId !== playerId) {
          return { valid: false, message: '자신을 향한 공격만 막을 수 있습니다' };
        }
        return { valid: true, message: '마법봉 카드 사용 가능' };

      default:
        return { valid: false, message: `알 수 없는 카드 타입: ${type}` };
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
      return { conflict: true, message: '고양이 퀸과 강아지 퀸은 함께 가질 수 없습니다' };
    }

    // If trying to get Dog Queen but already has Cat Queen
    if (queenId === DOG_QUEEN && hasCat) {
      return { conflict: true, message: '강아지 퀸과 고양이 퀸은 함께 가질 수 없습니다' };
    }

    return { conflict: false, message: '충돌 없음' };
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
