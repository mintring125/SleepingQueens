const fs = require('fs');
const CardDeck = require('./CardDeck');
const GameState = require('./GameState');
const GameRules = require('./GameRules');
const QRCode = require('qrcode');

class GameManager {
  constructor(io, getLocalIP, port) {
    this.io = io;
    this.localIP = getLocalIP();
    this.port = port;
    this.games = new Map(); // sessionId -> GameState
    this.playerSessions = new Map(); // socketId -> { sessionId, playerName }
    this.tableSessions = new Map(); // socketId -> sessionId
    this.setupSocketHandlers();
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      socket.emit('serverInfo', { ip: this.localIP, port: this.port });

      socket.on('createGame', (data) => this.handleCreateGame(socket, data));
      socket.on('joinGame', (data) => this.handleJoinGame(socket, data));
      socket.on('startGame', (data) => this.handleStartGame(socket, data));
      socket.on('playCard', (data) => this.handlePlayCard(socket, data));
      socket.on('discardCards', (data) => this.handleDiscardCards(socket, data));
      socket.on('counterAction', (data) => this.handleCounterAction(socket, data));
      socket.on('rejoin', (data) => this.handleRejoin(socket, data));
      socket.on('requestRestart', () => this.handleRequestRestart(socket));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  async handleCreateGame(socket, data) {
    const sessionId = this.generateSessionId();
    const gameState = new GameState(sessionId);
    if (data.houseRuleAllQueens) {
      gameState.houseRuleAllQueens = true;
    }
    gameState.restartRequests = new Set();
    this.games.set(sessionId, gameState);

    socket.join(sessionId);
    this.tableSessions.set(socket.id, sessionId);

    const frontendBase = process.env.FRONTEND_URL || `http://${this.localIP}:${this.port}`;
    const joinUrl = `${frontendBase}/player/join.html?session=${sessionId}`;

    // Generate QR code as data URL
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
    } catch (err) {
      console.error('QR generation failed:', err);
    }

    socket.emit('gameCreated', {
      sessionId,
      joinUrl,
      qrDataUrl
    });

    console.log(`Game created: ${sessionId}`);
  }

  handleJoinGame(socket, data) {
    const { sessionId, playerName } = data;
    const game = this.games.get(sessionId);

    if (!game) {
      socket.emit('joinResult', { success: false, message: '\uc138\uc158\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    if (game.phase !== 'waiting') {
      socket.emit('joinResult', { success: false, message: '\uc774\ubbf8 \uc2dc\uc791\ub41c \uac8c\uc784\uc785\ub2c8\ub2e4' });
      return;
    }

    const player = game.addPlayer(socket.id, playerName);
    if (!player) {
      socket.emit('joinResult', {
        success: false,
        message: game.players.length >= 4 ? '\uc778\uc6d0\uc774 \uac00\ub4dd \ucc3c\uc2b5\ub2c8\ub2e4' : '\uc911\ubcf5\ub41c \uc774\ub984\uc785\ub2c8\ub2e4'
      });
      return;
    }

    this.playerSessions.set(socket.id, { sessionId, playerName });
    socket.join(sessionId);

    socket.emit('joinResult', {
      success: true,
      playerId: socket.id,
      playerName,
      sessionId
    });

    // Notify all in session
    this.io.to(sessionId).emit('playerJoined', {
      playerId: socket.id,
      playerName,
      playerCount: game.players.length
    });

    console.log(`${playerName} joined game ${sessionId} (${game.players.length}/4)`);
  }

  handleStartGame(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;

    const { game, sessionId } = session;

    if (game.players.length < 2) {
      socket.emit('actionResult', { success: false, message: '\ucd5c\uc18c 2\uba85\uc774 \ud544\uc694\ud569\ub2c8\ub2e4' });
      return;
    }

    if (game.phase !== 'waiting' && game.phase !== 'ended') {
      socket.emit('actionResult', { success: false, message: '이미 시작된 게임입니다' });
      return;
    }

    // Initialize game
    const deck = new CardDeck();
    game.initializeGame(deck);

    // Send game state to all
    this.broadcastGameState(sessionId);

    // Send individual hands
    game.players.forEach(player => {
      this.io.to(player.id).emit('playerHand', { cards: player.hand });
    });

    // Start first turn
    this.startTurn(sessionId);

    console.log(`Game ${sessionId} started with ${game.players.length} players`);
  }

  handlePlayCard(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;

    const { game, sessionId } = session;
    const player = game.getPlayer(socket.id);

    if (!player) return;

    // Check it's this player's turn
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('actionResult', { success: false, message: '\ub2f9\uc2e0\uc758 \ud134\uc774 \uc544\ub2d9\ub2c8\ub2e4' });
      return;
    }

    if (game.turnPhase !== 'action') {
      socket.emit('actionResult', { success: false, message: '\ud589\ub3d9 \ub2e8\uacc4\uac00 \uc544\ub2d9\ub2c8\ub2e4' });
      return;
    }

    const { cardId, targetQueenId, targetPlayerId } = data;
    const card = player.hand.find(c => c.id === cardId);

    if (!card) {
      socket.emit('actionResult', { success: false, message: '\uce74\ub4dc\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    // Handle based on card type
    switch (card.type) {
      case 'king':
        this.handleKingPlay(socket, game, sessionId, player, card, targetQueenId);
        break;
      case 'knight':
        this.handleKnightPlay(socket, game, sessionId, player, card, targetPlayerId, targetQueenId);
        break;
      case 'potion':
        this.handlePotionPlay(socket, game, sessionId, player, card, targetPlayerId, targetQueenId);
        break;
      default:
        socket.emit('actionResult', { success: false, message: '\uc774 \uce74\ub4dc\ub294 \uc9c1\uc811 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
    }
  }

  handleKingPlay(socket, game, sessionId, player, card, targetQueenId) {
    if (!targetQueenId) {
      socket.emit('actionResult', { success: false, message: '\uae68\uc6b8 \ud038\uc744 \uc120\ud0dd\ud558\uc138\uc694' });
      return;
    }

    const queen = game.sleepingQueens.find(q => q.id === targetQueenId);
    if (!queen) {
      socket.emit('actionResult', { success: false, message: '\ud574\ub2f9 \ud038\uc774 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    // Check Cat/Dog conflict
    if (queen.ability === 'cat' || queen.ability === 'dog') {
      const hasCat = player.awakenedQueens.some(q => q.ability === 'cat');
      const hasDog = player.awakenedQueens.some(q => q.ability === 'dog');
      if ((queen.ability === 'cat' && hasDog) || (queen.ability === 'dog' && hasCat)) {
        socket.emit('actionResult', { success: false, message: '\uace0\uc591\uc774 \ud038\uacfc \uac15\uc544\uc9c0 \ud038\uc744 \ub3d9\uc2dc\uc5d0 \uc18c\uc720\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
        return;
      }
    }

    // Remove card from hand, discard it
    this.removeCardFromHand(player, card.id);
    game.cardDeck.discard(card);

    // Wake the queen
    game.wakeQueen(targetQueenId, player.id);

    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}\uc774(\uac00) ${queen.name}\uc744(\ub97c) \uae68\uc6e0\uc2b5\ub2c8\ub2e4!`
    });

    // Rose Queen bonus: wake another queen immediately
    if (queen.ability === 'rose' && game.sleepingQueens.length > 0) {
      // Auto-wake random queen for Rose bonus
      const bonusQueen = game.sleepingQueens[0]; // first available

      // Check Cat/Dog for bonus too
      const hasCatNow = player.awakenedQueens.some(q => q.ability === 'cat');
      const hasDogNow = player.awakenedQueens.some(q => q.ability === 'dog');
      let canWakeBonus = true;
      if ((bonusQueen.ability === 'cat' && hasDogNow) || (bonusQueen.ability === 'dog' && hasCatNow)) {
        canWakeBonus = false;
      }

      if (canWakeBonus) {
        game.wakeQueen(bonusQueen.id, player.id);
        this.io.to(sessionId).emit('actionResult', {
          success: true,
          message: `\uc7a5\ubbf8 \ud038 \ubcf4\ub108\uc2a4! ${bonusQueen.name}\ub3c4 \uae68\uc5b4\ub0ac\uc2b5\ub2c8\ub2e4!`
        });
      }
    }

    // Check win condition
    const winnerId = game.checkWinCondition();
    if (winnerId) {
      this.endGame(sessionId, winnerId);
      return;
    }

    // Draw a replacement card
    this.drawCardsForPlayer(player, 1, game);

    // Advance turn
    this.endTurn(sessionId);
  }

  handleKnightPlay(socket, game, sessionId, player, card, targetPlayerId, targetQueenId) {
    if (!targetPlayerId) {
      socket.emit('actionResult', { success: false, message: '\ub300\uc0c1 \ud50c\ub808\uc774\uc5b4\ub97c \uc120\ud0dd\ud558\uc138\uc694' });
      return;
    }

    const targetPlayer = game.getPlayer(targetPlayerId);
    if (!targetPlayer || targetPlayer.awakenedQueens.length === 0) {
      socket.emit('actionResult', { success: false, message: '\ub300\uc0c1 \ud50c\ub808\uc774\uc5b4\uc5d0\uac8c \ud038\uc774 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    // Resolve target queen
    let queen;
    if (targetQueenId === 'first' || !targetQueenId) {
      queen = targetPlayer.awakenedQueens[0];
    } else {
      queen = targetPlayer.awakenedQueens.find(q => q.id === targetQueenId);
    }

    if (!queen) {
      socket.emit('actionResult', { success: false, message: '\ud574\ub2f9 \ud038\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    // Remove card from hand
    this.removeCardFromHand(player, card.id);
    game.cardDeck.discard(card);

    // Set pending action for counter phase
    game.pendingAction = {
      type: 'knight',
      playerId: player.id,
      targetPlayerId,
      targetQueenId: queen.id,
      card
    };

    game.turnPhase = 'counter';

    // Ask target player if they want to counter with dragon
    this.io.to(targetPlayerId).emit('counterRequest', {
      type: 'dragon',
      targetPlayerId: targetPlayerId,
      attackerName: player.name,
      queenName: queen.name,
      timeLimit: 0
    });

    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}\uc774(\uac00) \uae30\uc0ac\ub85c ${targetPlayer.name}\uc758 ${queen.name}\uc744(\ub97c) \ud6d4\uce58\ub824 \ud569\ub2c8\ub2e4!`
    });

    this.broadcastGameState(sessionId);

    // Set counter timeout (0 = no timeout for classroom)
    this.setCounterTimeout(sessionId, 0);
  }

  handlePotionPlay(socket, game, sessionId, player, card, targetPlayerId, targetQueenId) {
    if (!targetPlayerId) {
      socket.emit('actionResult', { success: false, message: '\ub300\uc0c1 \ud50c\ub808\uc774\uc5b4\ub97c \uc120\ud0dd\ud558\uc138\uc694' });
      return;
    }

    const targetPlayer = game.getPlayer(targetPlayerId);
    if (!targetPlayer || targetPlayer.awakenedQueens.length === 0) {
      socket.emit('actionResult', { success: false, message: '\ub300\uc0c1 \ud50c\ub808\uc774\uc5b4\uc5d0\uac8c \ud038\uc774 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    let queen;
    if (targetQueenId === 'first' || !targetQueenId) {
      queen = targetPlayer.awakenedQueens[0];
    } else {
      queen = targetPlayer.awakenedQueens.find(q => q.id === targetQueenId);
    }

    if (!queen) {
      socket.emit('actionResult', { success: false, message: '\ud574\ub2f9 \ud038\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4' });
      return;
    }

    this.removeCardFromHand(player, card.id);
    game.cardDeck.discard(card);

    game.pendingAction = {
      type: 'potion',
      playerId: player.id,
      targetPlayerId,
      targetQueenId: queen.id,
      card
    };

    game.turnPhase = 'counter';

    this.io.to(targetPlayerId).emit('counterRequest', {
      type: 'wand',
      targetPlayerId: targetPlayerId,
      attackerName: player.name,
      queenName: queen.name,
      timeLimit: 0
    });

    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}\uc774(\uac00) \uc218\uba74\ud3ec\uc158\uc73c\ub85c ${targetPlayer.name}\uc758 ${queen.name}\uc744(\ub97c) \uc7ac\uc6b0\ub824 \ud569\ub2c8\ub2e4!`
    });

    this.broadcastGameState(sessionId);
    this.setCounterTimeout(sessionId, 0);
  }

  handleDiscardCards(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;

    const { game, sessionId } = session;
    const player = game.getPlayer(socket.id);

    if (!player) return;

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('actionResult', { success: false, message: '\ub2f9\uc2e0\uc758 \ud134\uc774 \uc544\ub2d9\ub2c8\ub2e4' });
      return;
    }

    if (game.turnPhase !== 'action') {
      socket.emit('actionResult', { success: false, message: '\ud589\ub3d9 \ub2e8\uacc4\uac00 \uc544\ub2d9\ub2c8\ub2e4' });
      return;
    }

    const { cardIds } = data;
    const cards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);

    if (cards.length === 0 || cards.length !== cardIds.length) {
      socket.emit('actionResult', { success: false, message: '\uc720\ud6a8\ud558\uc9c0 \uc54a\uc740 \uce74\ub4dc\uc785\ub2c8\ub2e4' });
      return;
    }

    // Validate discard combination
    const validation = GameRules.validateDiscardCards(cards);
    if (!validation.valid) {
      socket.emit('actionResult', { success: false, message: validation.message });
      return;
    }

    // Remove cards from hand and discard
    cards.forEach(card => {
      this.removeCardFromHand(player, card.id);
    });
    game.cardDeck.discard(cards);

    // Draw replacement cards
    this.drawCardsForPlayer(player, cards.length, game);

    // Broadcast discard event for table animation
    const playerIndex = game.players.findIndex(p => p.id === player.id);
    this.io.to(sessionId).emit('cardsDiscarded', {
      playerId: player.id,
      playerName: player.name,
      playerIndex: playerIndex,
      cardCount: cards.length,
      cards: cards.map(c => ({ type: c.type, value: c.value }))
    });

    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}이(가) 카드 ${cards.length}장을 버리고 새로 뽑았습니다`
    });

    this.endTurn(sessionId);
  }

  handleCounterAction(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;

    const { game, sessionId } = session;

    if (game.turnPhase !== 'counter' || !game.pendingAction) {
      return;
    }

    const { cardId, accept } = data;

    // Clear counter timeout
    if (game.counterTimeout) {
      clearTimeout(game.counterTimeout);
      game.counterTimeout = null;
    }

    if (!accept) {
      // No counter - resolve the pending action
      this.resolvePendingAction(sessionId);
      return;
    }

    // Counter with card
    const player = game.getPlayer(socket.id);
    if (!player) return;

    const counterCard = player.hand.find(c => c.id === cardId);
    if (!counterCard) return;

    const pending = game.pendingAction;

    if (pending.type === 'knight' && counterCard.type === 'dragon') {
      // Dragon blocks knight
      this.removeCardFromHand(player, counterCard.id);
      game.cardDeck.discard(counterCard);

      this.io.to(sessionId).emit('actionResult', {
        success: true,
        message: `${player.name}\uc774(\uac00) \ub4dc\ub798\uace4\uc73c\ub85c \uae30\uc0ac\ub97c \ub9c9\uc558\uc2b5\ub2c8\ub2e4!`
      });

      // Draw replacement for defender who used dragon
      this.drawCardsForPlayer(player, 1, game);

      // Draw replacement for attacker who used knight
      const attacker = game.getPlayer(pending.playerId);
      if (attacker) {
        this.drawCardsForPlayer(attacker, 1, game);
      }

      game.pendingAction = null;
      this.endTurn(sessionId);

    } else if (pending.type === 'potion' && counterCard.type === 'wand') {
      // Wand blocks potion
      this.removeCardFromHand(player, counterCard.id);
      game.cardDeck.discard(counterCard);

      this.io.to(sessionId).emit('actionResult', {
        success: true,
        message: `${player.name}\uc774(\uac00) \ub9c8\ubc95\ubd09\uc73c\ub85c \uc218\uba74\ud3ec\uc158\uc744 \ub9c9\uc558\uc2b5\ub2c8\ub2e4!`
      });

      // Draw replacement for defender who used wand
      this.drawCardsForPlayer(player, 1, game);

      // Draw replacement for attacker who used potion
      const attacker = game.getPlayer(pending.playerId);
      if (attacker) {
        this.drawCardsForPlayer(attacker, 1, game);
      }

      game.pendingAction = null;
      this.endTurn(sessionId);
    }
  }

  resolvePendingAction(sessionId) {
    const game = this.games.get(sessionId);
    if (!game || !game.pendingAction) {
      console.log('[resolvePendingAction] No game or pendingAction, returning early');
      return;
    }

    const pending = game.pendingAction;
    const attacker = game.getPlayer(pending.playerId);
    const targetPlayer = game.getPlayer(pending.targetPlayerId);

    console.log(`[resolvePendingAction] Type: ${pending.type}, Attacker: ${attacker?.name}, Hand before: ${attacker?.hand?.length}`);

    if (pending.type === 'knight') {
      // Knight steals queen
      // Check Cat/Dog conflict before stealing
      const queen = targetPlayer.awakenedQueens.find(q => q.id === pending.targetQueenId);
      if (queen) {
        const hasCat = attacker.awakenedQueens.some(q => q.ability === 'cat');
        const hasDog = attacker.awakenedQueens.some(q => q.ability === 'dog');
        if ((queen.ability === 'cat' && hasDog) || (queen.ability === 'dog' && hasCat)) {
          this.io.to(sessionId).emit('actionResult', {
            success: false,
            message: '고양이/강아지 퀸 충돌로 훔치기가 실패했습니다'
          });
        } else {
          game.stealQueen(pending.targetQueenId, pending.targetPlayerId, pending.playerId);
          this.io.to(sessionId).emit('actionResult', {
            success: true,
            message: `${attacker.name}이(가) ${targetPlayer.name}의 퀸을 훔쳤습니다!`
          });
        }
      }
    } else if (pending.type === 'potion') {
      // Potion puts queen to sleep
      game.sleepQueen(pending.targetQueenId);
      this.io.to(sessionId).emit('actionResult', {
        success: true,
        message: `${targetPlayer.name}의 퀸이 다시 잠들었습니다!`
      });
    }

    // Draw card for attacker
    if (attacker) {
      console.log(`[resolvePendingAction] Drawing 1 card for ${attacker.name}`);
      this.drawCardsForPlayer(attacker, 1, game);
      console.log(`[resolvePendingAction] Hand after draw: ${attacker.hand.length}`);
    } else {
      console.log('[resolvePendingAction] ERROR: attacker is null/undefined!');
    }

    game.pendingAction = null;

    // Check win
    const winnerId = game.checkWinCondition();
    if (winnerId) {
      this.endGame(sessionId, winnerId);
      return;
    }

    this.endTurn(sessionId);
  }

  handleRejoin(socket, data) {
    const { sessionId, playerName } = data;
    const game = this.games.get(sessionId);

    if (!game) return;

    const player = game.getPlayerByName(playerName);
    if (player) {
      // Update old mapping
      this.playerSessions.delete(player.id);

      // Reconnect
      player.id = socket.id;
      player.connected = true;
      this.playerSessions.set(socket.id, { sessionId, playerName });
      socket.join(sessionId);

      // Send current state
      socket.emit('gameState', game.getPublicState());
      socket.emit('playerHand', { cards: player.hand });

      this.io.to(sessionId).emit('actionResult', {
        success: true,
        message: `${playerName}\uc774(\uac00) \uc7ac\uc811\uc18d\ud588\uc2b5\ub2c8\ub2e4`
      });

      this.broadcastGameState(sessionId);
      console.log(`${playerName} rejoined game ${sessionId}`);
    }
  }

  handleDisconnect(socket) {
    const sessionInfo = this.playerSessions.get(socket.id);
    if (sessionInfo) {
      const game = this.games.get(sessionInfo.sessionId);
      if (game) {
        game.removePlayer(socket.id);
        this.io.to(sessionInfo.sessionId).emit('actionResult', {
          success: true,
          message: `${sessionInfo.playerName}\uc758 \uc5f0\uacb0\uc774 \ub04a\uacbc\uc2b5\ub2c8\ub2e4`
        });
        this.broadcastGameState(sessionInfo.sessionId);
      }
      // Don't delete from playerSessions yet - for reconnection
    }
    if (this.tableSessions.has(socket.id)) {
      this.tableSessions.delete(socket.id);
    }
    console.log(`Client disconnected: ${socket.id}`);
  }

  // Helper methods

  removeCardFromHand(player, cardId) {
    const index = player.hand.findIndex(c => c.id === cardId);
    if (index !== -1) {
      player.hand.splice(index, 1);
    }
  }

  drawCardsForPlayer(player, count, game) {
    const drawn = game.cardDeck.draw(count);
    console.log(`[drawCardsForPlayer] Drew ${drawn.length} cards for ${player.name}, hand was ${player.hand.length}`);
    player.hand.push(...drawn);
    console.log(`[drawCardsForPlayer] Hand is now ${player.hand.length} cards`);
    // Send updated hand
    this.io.to(player.id).emit('playerHand', { cards: player.hand });
  }

  canPlayerDoAnything(player, game) {
    const hand = player.hand;

    // 숫자 카드가 있으면 항상 버릴 수 있음
    if (hand.some(c => c.type === 'number')) return true;

    // king 카드가 있고 잠든 퀸이 있으면 사용 가능
    if (hand.some(c => c.type === 'king') && game.sleepingQueens.length > 0) return true;

    // knight/potion 카드가 있고 다른 연결된 플레이어에게 퀸이 있으면 사용 가능
    const othersHaveQueens = game.players.some(p =>
      p.id !== player.id && p.connected && p.awakenedQueens.length > 0
    );
    if ((hand.some(c => c.type === 'knight') || hand.some(c => c.type === 'potion')) && othersHaveQueens) return true;

    // dragon/wand는 action 단계에서 사용 불가
    return false;
  }

  startTurn(sessionId) {
    const game = this.games.get(sessionId);
    if (!game || game.phase !== 'playing') return;

    const currentPlayer = game.getCurrentPlayer();
    game.turnPhase = 'action';
    game.pendingAction = null;

    // 아무것도 할 수 없으면 자동으로 턴 넘기기
    if (!this.canPlayerDoAnything(currentPlayer, game)) {
      game.consecutiveSkips = (game.consecutiveSkips || 0) + 1;
      const connectedCount = game.players.filter(p => p.connected).length;

      if (game.consecutiveSkips < connectedCount) {
        this.io.to(sessionId).emit('actionResult', {
          success: true,
          message: `${currentPlayer.name}은(는) 사용 가능한 카드가 없어 턴이 자동으로 넘어갑니다`
        });
        this.broadcastGameState(sessionId);
        game.nextTurn();
        setTimeout(() => this.startTurn(sessionId), 400);
        return;
      }
      // 모든 플레이어가 연속으로 스킵되면 무한루프 방지 후 강제 진행
      game.consecutiveSkips = 0;
    } else {
      game.consecutiveSkips = 0;
    }

    this.io.to(sessionId).emit('turnStart', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      timeLimit: game.turnTimeLimit
    });

    this.broadcastGameState(sessionId);

    // Set turn timeout (only if timer is enabled)
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (game.turnTimeLimit > 0) {
      game.turnTimer = setTimeout(() => {
        this.handleTurnTimeout(sessionId);
      }, game.turnTimeLimit * 1000);
    }
  }

  endTurn(sessionId) {
    const game = this.games.get(sessionId);
    if (!game) return;

    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    game.nextTurn();

    // Send updated hands and state
    game.players.forEach(p => {
      this.io.to(p.id).emit('playerHand', { cards: p.hand });
    });

    this.broadcastGameState(sessionId);
    this.startTurn(sessionId);
  }

  handleTurnTimeout(sessionId) {
    const game = this.games.get(sessionId);
    if (!game || game.phase !== 'playing') return;

    const currentPlayer = game.getCurrentPlayer();

    this.io.to(sessionId).emit('actionResult', {
      success: false,
      message: `${currentPlayer.name}\uc758 \ud134 \uc2dc\uac04\uc774 \ucd08\uacfc\ub418\uc5c8\uc2b5\ub2c8\ub2e4`
    });

    // Auto-discard: skip turn (just advance to next)
    this.endTurn(sessionId);
  }

  setCounterTimeout(sessionId, seconds) {
    const game = this.games.get(sessionId);
    if (!game) return;

    // Only set timeout if seconds > 0 (timer enabled)
    if (seconds > 0) {
      game.counterTimeout = setTimeout(() => {
        // No counter used - resolve action
        this.resolvePendingAction(sessionId);
      }, seconds * 1000);
    }
    // If seconds is 0, no auto-timeout - player must respond manually
  }

  endGame(sessionId, winnerId) {
    const game = this.games.get(sessionId);
    if (!game) return;

    game.phase = 'ended';

    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    const scores = game.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      queenCount: p.awakenedQueens.length,
      hand: p.hand,
      awakenedQueens: p.awakenedQueens
    }));

    const winner = game.getPlayer(winnerId);

    this.io.to(sessionId).emit('gameEnd', { winnerId, scores });
    this.broadcastGameState(sessionId);

    // Record result (file for local, console for Render/serverless)
    try {
      const date = new Date().toLocaleString();
      let resultText = `\n## Game ${sessionId} (${date})\n`;
      resultText += `- **Winner**: ${winner?.name || 'Unknown'}\n`;
      resultText += `- **Players**: ${game.players.length}\n`;

      resultText += `\n### Final Standings\n`;
      scores.sort((a, b) => b.score - a.score).forEach((p, i) => {
        resultText += `${i + 1}. **${p.name}** - Queens: ${p.queenCount}, Score: ${p.score}\n`;
        const queensStr = p.awakenedQueens.map(q => q.name).join(', ');
        resultText += `   - Queens: ${queensStr}\n`;
      });
      resultText += `\n---\n`;

      // Try local file first; fall back to console (Render/Vercel compatible)
      try {
        fs.appendFileSync('../result.md', resultText);
      } catch {
        console.log('[GAME RESULT]', resultText);
      }
    } catch (err) {
      console.error('Failed to record result:', err);
    }

    console.log(`Game ${sessionId} ended. Winner: ${winner?.name}`);
  }

  broadcastGameState(sessionId) {
    const game = this.games.get(sessionId);
    if (!game) return;
    this.io.to(sessionId).emit('gameState', game.getPublicState());
  }

  findGameBySocket(socketId) {
    const sessionInfo = this.playerSessions.get(socketId);
    if (!sessionInfo) {
      // Check if it's a table display
      const tableSessionId = this.tableSessions.get(socketId);
      if (tableSessionId) {
        const game = this.games.get(tableSessionId);
        return game ? { game, sessionId: tableSessionId } : null;
      }
      // Could be the table display - check all games
      for (const [sessionId, game] of this.games) {
        if (game.getPlayer(socketId)) {
          return { game, sessionId };
        }
      }
      return null;
    }
    const game = this.games.get(sessionInfo.sessionId);
    return game ? { game, sessionId: sessionInfo.sessionId } : null;
  }

  handleRequestRestart(socket) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;

    const { game, sessionId } = session;
    const player = game.getPlayer(socket.id);

    if (!player || game.phase !== 'ended') return;

    if (!game.restartRequests) {
      game.restartRequests = new Set();
    }

    game.restartRequests.add(player.id);

    // Broadcast status
    const currentVotes = game.restartRequests.size;
    const totalPlayers = game.players.length;

    this.io.to(sessionId).emit('restartStatus', {
      current: currentVotes,
      total: totalPlayers
    });

    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}님이 재경기를 요청했습니다 (${currentVotes}/${totalPlayers})`
    });

    if (currentVotes >= totalPlayers) {
      this.restartGame(sessionId);
    }
  }

  restartGame(sessionId) {
    const game = this.games.get(sessionId);
    if (!game) return;

    // Reset game state but keep players
    // Reuse initializeGame logic
    const deck = new CardDeck();
    game.initializeGame(deck);
    game.restartRequests.clear();

    // Notify everyone
    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: '모든 플레이어가 동의하여 게임을 다시 시작합니다!'
    });

    // Send game state to all
    this.broadcastGameState(sessionId);

    // Send individual hands
    game.players.forEach(player => {
      this.io.to(player.id).emit('playerHand', { cards: player.hand });
    });

    // Start first turn
    this.startTurn(sessionId);

    console.log(`Game ${sessionId} restarted`);
  }
}
module.exports = GameManager;
