/**
 * KaribaGame.js - 게임 상태 관리 및 턴 처리
 */
const KaribaDeck = require('./KaribaDeck');
const KaribaRules = require('./KaribaRules');

class KaribaGame {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.phase = 'waiting'; // waiting | playing | ended
    this.players = [];
    this.deck = null;
    this.wateringHole = {};
    this.currentPlayerIndex = 0;
    this.lastAction = null;
    this.expertMode = false;
    this.openCards = [];
    this.restartRequests = new Set();
  }

  addPlayer(socketId, name) {
    if (this.players.length >= 4) return null;
    if (this.players.some(p => p.name === name)) return null;
    const player = { id: socketId, name, hand: [], collected: [], connected: true };
    this.players.push(player);
    return player;
  }

  initGame(expertMode = false) {
    this.expertMode = expertMode;
    this.deck = new KaribaDeck();
    this.wateringHole = {};
    for (let i = 1; i <= 8; i++) this.wateringHole[i] = [];

    for (const player of this.players) {
      player.hand = this.deck.draw(5);
      player.collected = [];
    }

    if (expertMode) {
      this.openCards = this.deck.draw(3);
    } else {
      this.openCards = [];
    }

    this.currentPlayerIndex = 0;
    this.phase = 'playing';
    this.lastAction = null;
  }

  getPlayer(socketId) {
    return this.players.find(p => p.id === socketId);
  }

  getPlayerByName(name) {
    return this.players.find(p => p.name === name);
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  /**
   * 카드 내려놓기 처리
   * @returns { success, huntResult, gameOver, winner, message }
   */
  playCards(playerId, cardType, count) {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: '플레이어를 찾을 수 없습니다' };

    if (this.getCurrentPlayer().id !== playerId) {
      return { success: false, message: '당신의 턴이 아닙니다' };
    }

    if (count < 1) return { success: false, message: '1장 이상 내려놓아야 합니다' };

    const available = player.hand.filter(c => c.type === cardType);
    if (available.length < count) {
      return { success: false, message: '해당 카드가 충분하지 않습니다' };
    }

    // 손에서 카드 제거
    let removed = 0;
    player.hand = player.hand.filter(c => {
      if (c.type === cardType && removed < count) { removed++; return false; }
      return true;
    });

    // 물웅덩이에 추가
    for (let i = 0; i < count; i++) {
      this.wateringHole[cardType].push({ type: cardType });
    }

    // 사냥 처리
    const huntTarget = KaribaRules.getHuntTarget(cardType, this.wateringHole);
    let huntResult = null;
    if (huntTarget !== null) {
      const hunted = this.wateringHole[huntTarget];
      const huntedCount = hunted.length;
      player.collected.push(...hunted);
      this.wateringHole[huntTarget] = [];
      huntResult = {
        hunterType: cardType,
        huntedType: huntTarget,
        cardCount: huntedCount,
        hunterName: player.name,
        hunterId: player.id
      };
    }

    // 카드 보충 (5장 유지)
    const refill = Math.max(0, 5 - player.hand.length);
    if (refill > 0) {
      player.hand.push(...this.deck.draw(refill));
    }

    // 숙련자 모드: 공개 카드 보충
    if (this.expertMode && this.openCards.length < 3) {
      const needed = 3 - this.openCards.length;
      this.openCards.push(...this.deck.draw(needed));
    }

    // 마지막 액션 저장 (애니메이션용)
    this.lastAction = {
      type: 'playCards',
      playerId,
      playerName: player.name,
      cardType,
      count,
      huntResult
    };

    // 게임 종료 체크
    const gameOver = KaribaRules.isGameOver(this.deck, this.players);
    if (gameOver) {
      this.phase = 'ended';
      return {
        success: true,
        huntResult,
        gameOver: true,
        winner: KaribaRules.getWinner(this.players),
        scores: KaribaRules.getScores(this.players)
      };
    }

    // 턴 넘기기
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    return { success: true, huntResult, gameOver: false };
  }

  /**
   * 클라이언트에 전송할 공개 상태 (개인 손패 제외)
   */
  getPublicState() {
    return {
      sessionId: this.sessionId,
      phase: this.phase,
      expertMode: this.expertMode,
      wateringHole: this.wateringHole,
      deckRemaining: this.deck ? this.deck.remaining : 0,
      openCards: this.openCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        collectedCount: p.collected.length,
        connected: p.connected
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.getCurrentPlayer()?.id,
      currentPlayerName: this.getCurrentPlayer()?.name,
      lastAction: this.lastAction
    };
  }
}

module.exports = KaribaGame;
