const QUEENS = [
  { id: 'queen_1', name: 'Rose Queen', points: 5, ability: 'rose' },
  { id: 'queen_2', name: 'Cat Queen', points: 15, ability: 'cat' },
  { id: 'queen_3', name: 'Dog Queen', points: 15, ability: 'dog' },
  { id: 'queen_4', name: 'Pancake Queen', points: 15, ability: 'pancake' },
  { id: 'queen_5', name: 'Sunflower Queen', points: 10, ability: 'sunflower' },
  { id: 'queen_6', name: 'Rainbow Queen', points: 10, ability: 'rainbow' },
  { id: 'queen_7', name: 'Moon Queen', points: 10, ability: 'moon' },
  { id: 'queen_8', name: 'Starfish Queen', points: 5, ability: 'starfish' },
  { id: 'queen_9', name: 'Heart Queen', points: 20, ability: 'heart' },
  { id: 'queen_10', name: 'Ladybug Queen', points: 10, ability: 'ladybug' },
  { id: 'queen_11', name: 'Cake Queen', points: 5, ability: 'cake' },
  { id: 'queen_12', name: 'Peacock Queen', points: 15, ability: 'peacock' },
];

class GameState {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.phase = 'waiting'; // waiting | playing | ended
    this.turnPhase = null; // action | counter | draw
    this.players = []; // max 4
    this.sleepingQueens = []; // initialized from QUEENS
    this.currentPlayerIndex = 0;
    this.turnTimer = null;
    this.turnTimeLimit = 0; // seconds
    this.houseRuleAllQueens = false; // House rule flag
    this.cardDeck = null; // set during init
  }

  addPlayer(id, name) {
    if (this.players.length >= 4) {
      return null;
    }

    if (this.getPlayerByName(name)) {
      return null;
    }

    const player = {
      id,
      name,
      hand: [],
      awakenedQueens: [],
      score: 0,
      connected: true
    };

    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const player = this.getPlayer(id);
    if (player) {
      player.connected = false;
    }
  }

  reconnectPlayer(id, newSocketId) {
    const player = this.getPlayer(id);
    if (player) {
      player.id = newSocketId;
      player.connected = true;
      return player;
    }
    return null;
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  getPlayerByName(name) {
    return this.players.find(p => p.name === name);
  }

  initializeGame(cardDeck) {
    this.cardDeck = cardDeck;

    // Initialize sleeping queens (shuffle them)
    this.sleepingQueens = [...QUEENS].sort(() => Math.random() - 0.5);

    // Deal 5 cards to each player
    this.players.forEach(player => {
      player.hand = [];
      player.awakenedQueens = [];
      player.score = 0;
      for (let i = 0; i < 5; i++) {
        const cards = this.cardDeck.draw(1);
        if (cards.length > 0) {
          player.hand.push(cards[0]);
        }
      }
    });

    this.phase = 'playing';
    this.turnPhase = 'action';
    this.currentPlayerIndex = 0;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // Skip disconnected players
    let attempts = 0;
    while (!this.players[nextIndex].connected && attempts < this.players.length) {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
    }

    this.currentPlayerIndex = nextIndex;
    this.turnPhase = 'action';
  }

  wakeQueen(queenId, playerId) {
    const queenIndex = this.sleepingQueens.findIndex(q => q.id === queenId);
    if (queenIndex === -1) {
      return false;
    }

    const queen = this.sleepingQueens.splice(queenIndex, 1)[0];
    const player = this.getPlayer(playerId);

    if (player) {
      player.awakenedQueens.push(queen);
      this.calculateScore(playerId);
      return true;
    }

    return false;
  }

  sleepQueen(queenId) {
    for (const player of this.players) {
      const queenIndex = player.awakenedQueens.findIndex(q => q.id === queenId);
      if (queenIndex !== -1) {
        const queen = player.awakenedQueens.splice(queenIndex, 1)[0];
        this.sleepingQueens.push(queen);
        this.calculateScore(player.id);
        return true;
      }
    }
    return false;
  }

  stealQueen(queenId, fromPlayerId, toPlayerId) {
    const fromPlayer = this.getPlayer(fromPlayerId);
    const toPlayer = this.getPlayer(toPlayerId);

    if (!fromPlayer || !toPlayer) {
      return false;
    }

    const queenIndex = fromPlayer.awakenedQueens.findIndex(q => q.id === queenId);
    if (queenIndex === -1) {
      return false;
    }

    const queen = fromPlayer.awakenedQueens.splice(queenIndex, 1)[0];
    toPlayer.awakenedQueens.push(queen);

    this.calculateScore(fromPlayerId);
    this.calculateScore(toPlayerId);

    return true;
  }

  calculateScore(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.score = player.awakenedQueens.reduce((sum, queen) => sum + queen.points, 0);
      return player.score;
    }
    return 0;
  }

  checkWinCondition() {
    // House rule: Must wake ALL queens (or be the last player with queens if deck runs out)
    if (this.houseRuleAllQueens) {
      // Check if all queens are awakened (12 queens)
      const totalQueens = QUEENS.length;

      // If one player has ALL 12 queens (impossible? usually max is 5), but let's say they collected all
      // Actually usually it's "Game ends when all queens are awake".

      // Check if any sleeping queens are left
      if (this.sleepingQueens.length === 0) {
        // Find player with highest score
        return this.players.reduce((prev, current) => (prev.score > current.score) ? prev : current).id;
      }

      return null;
    }

    const playerCount = this.players.length;
    const requiredQueens = playerCount === 4 ? 4 : 5;
    const requiredPoints = playerCount === 4 ? 40 : 50;

    for (const player of this.players) {
      if (player.awakenedQueens.length >= requiredQueens || player.score >= requiredPoints) {
        return player.id;
      }
    }

    return null;
  }

  getPublicState() {
    return {
      phase: this.phase,
      turnPhase: this.turnPhase,
      currentPlayerId: this.getCurrentPlayer()?.id,
      houseRuleAllQueens: this.houseRuleAllQueens,
      // Sleeping queens are face-down - only reveal count and IDs for selection
      sleepingQueens: this.sleepingQueens.map((q, index) => ({
        id: q.id,
        index: index,
        // Don't reveal name, points, or ability - they're face down!
        hidden: true
      })),
      sleepingQueenCount: this.sleepingQueens.length,
      deckCount: this.cardDeck?.getDrawCount() || 0,
      discardCount: this.cardDeck?.getDiscardCount() || 0,
      playersSummary: this.players.map(p => ({
        id: p.id,
        name: p.name,
        queenCount: p.awakenedQueens.length,
        awakenedQueens: p.awakenedQueens.map(q => ({
          id: q.id,
          name: q.name,
          points: q.points,
          ability: q.ability
        })),
        score: p.score,
        connected: p.connected,
        handCount: p.hand.length
      }))
    };
  }

  getPlayerState(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { hand: [] };
    }

    return {
      hand: player.hand
    };
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      phase: this.phase,
      turnPhase: this.turnPhase,
      houseRuleAllQueens: this.houseRuleAllQueens,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.hand,
        awakenedQueens: p.awakenedQueens,
        score: p.score,
        connected: p.connected
      })),
      sleepingQueens: this.sleepingQueens,
      currentPlayerIndex: this.currentPlayerIndex,
      turnTimeLimit: this.turnTimeLimit,
      cardDeck: this.cardDeck ? {
        drawPile: this.cardDeck.drawPile,
        discardPile: this.cardDeck.discardPile
      } : null
    };
  }
}

module.exports = GameState;
