/**
 * KaribaGameManager.js - Socket.IO 이벤트 핸들러 (네임스페이스: /kariba)
 */
const KaribaGame = require('./KaribaGame');
const KaribaRules = require('./KaribaRules');
const QRCode = require('qrcode');

class KaribaGameManager {
  constructor(io, getLocalIP, port) {
    this.io = io; // /kariba namespace
    this.localIP = getLocalIP();
    this.port = port;
    this.games = new Map();         // sessionId -> KaribaGame
    this.playerSessions = new Map(); // socketId -> { sessionId, playerName }
    this.tableSessions = new Map();  // socketId -> sessionId
    this.setupSocketHandlers();
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[Kariba] 연결: ${socket.id}`);
      socket.emit('serverInfo', { ip: this.localIP, port: this.port });

      socket.on('createGame', (data) => this.handleCreateGame(socket, data));
      socket.on('joinGame', (data) => this.handleJoinGame(socket, data));
      socket.on('startGame', () => this.handleStartGame(socket));
      socket.on('playCards', (data) => this.handlePlayCards(socket, data));
      socket.on('prepareCards', (data) => this.handlePrepareCards(socket, data));
      socket.on('tableSlotClicked', (data) => this.handleTableSlotClicked(socket, data));
      socket.on('rejoin', (data) => this.handleRejoin(socket, data));
      socket.on('requestRestart', () => this.handleRequestRestart(socket));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  // ── 게임 생성 (테이블) ──────────────────────────────────────────
  async handleCreateGame(socket, data) {
    const sessionId = this.generateSessionId();
    const game = new KaribaGame(sessionId);
    if (data?.expertMode) game.expertMode = true;
    this.games.set(sessionId, game);

    socket.join(sessionId);
    this.tableSessions.set(socket.id, sessionId);

    const frontendBase = process.env.FRONTEND_URL || `http://${this.localIP}:${this.port}`;
    const joinUrl = `${frontendBase}/kariba/player/join.html?session=${sessionId}`;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
    } catch (err) {
      console.error('[Kariba] QR 생성 실패:', err);
    }

    socket.emit('gameCreated', { sessionId, joinUrl, qrDataUrl });
    console.log(`[Kariba] 게임 생성: ${sessionId}`);
  }

  // ── 참가 ────────────────────────────────────────────────────────
  handleJoinGame(socket, data) {
    const { sessionId, playerName } = data;
    const game = this.games.get(sessionId);

    if (!game) {
      socket.emit('joinResult', { success: false, message: '세션을 찾을 수 없습니다' });
      return;
    }
    if (game.phase !== 'waiting') {
      socket.emit('joinResult', { success: false, message: '이미 시작된 게임입니다' });
      return;
    }

    const player = game.addPlayer(socket.id, playerName);
    if (!player) {
      socket.emit('joinResult', {
        success: false,
        message: game.players.length >= 4 ? '인원이 가득 찼습니다' : '중복된 이름입니다'
      });
      return;
    }

    this.playerSessions.set(socket.id, { sessionId, playerName });
    socket.join(sessionId);

    socket.emit('joinResult', { success: true, playerId: socket.id, playerName, sessionId });
    this.io.to(sessionId).emit('playerJoined', {
      playerId: socket.id,
      playerName,
      playerCount: game.players.length
    });

    console.log(`[Kariba] ${playerName} 참가 → ${sessionId} (${game.players.length}/4)`);
  }

  // ── 게임 시작 (테이블) ──────────────────────────────────────────
  handleStartGame(socket) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;
    const { game, sessionId } = session;

    if (game.players.length < 2) {
      socket.emit('actionResult', { success: false, message: '최소 2명이 필요합니다' });
      return;
    }
    if (game.phase !== 'waiting') return;

    game.initGame(game.expertMode);
    this._broadcastState(sessionId);
    this._sendHands(sessionId);

    const cur = game.getCurrentPlayer();
    this.io.to(sessionId).emit('turnStart', { playerId: cur.id, playerName: cur.name });
    console.log(`[Kariba] 게임 시작: ${sessionId}`);
  }

  // ── 카드 내려놓기 ────────────────────────────────────────────────
  handlePlayCards(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;
    const { game, sessionId } = session;

    if (game.phase !== 'playing') {
      socket.emit('actionResult', { success: false, message: '게임 진행 중이 아닙니다' });
      return;
    }

    const cardType = parseInt(data.cardType);
    const count = parseInt(data.count);

    if (isNaN(cardType) || cardType < 1 || cardType > 8 || isNaN(count) || count < 1) {
      socket.emit('actionResult', { success: false, message: '유효하지 않은 요청입니다' });
      return;
    }

    const result = game.playCards(socket.id, cardType, count);
    if (!result.success) {
      socket.emit('actionResult', { success: false, message: result.message });
      return;
    }

    this._broadcastState(sessionId);
    this._sendHands(sessionId);

    if (result.huntResult) {
      this.io.to(sessionId).emit('huntResult', result.huntResult);
    }

    if (result.gameOver) {
      this.io.to(sessionId).emit('gameEnd', {
        winnerId: result.winner?.id,
        winnerName: result.winner?.name,
        scores: result.scores
      });
      console.log(`[Kariba] 게임 종료 ${sessionId}. 승자: ${result.winner?.name}`);
    } else {
      const cur = game.getCurrentPlayer();
      this.io.to(sessionId).emit('turnStart', { playerId: cur.id, playerName: cur.name });
    }
  }

  // ── 카드 준비 (플레이어) ──────────────────────────────────────────
  handlePrepareCards(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;
    const { game, sessionId } = session;

    const player = game.getPlayer(socket.id);
    if (!player) return;

    if (data.cardType === null) {
      player.prepared = null;
    } else {
      player.prepared = { cardType: parseInt(data.cardType), count: parseInt(data.count) };
    }

    this.io.to(sessionId).emit('playerPrepared', {
      playerId: player.id,
      cardType: player.prepared?.cardType || null,
      count: player.prepared?.count || 0
    });
  }

  // ── 테이블 슬롯 클릭 ─────────────────────────────────────────────
  handleTableSlotClicked(socket, data) {
    const session = this.findGameBySocket(socket.id);
    if (!session) {
      console.log(`[Kariba] handleTableSlotClicked: 세션을 찾을 수 없음 (socket.id: ${socket.id})`);
      socket.emit('actionResult', { success: false, message: '게임 세션을 찾을 수 없습니다.' });
      return;
    }
    const { game, sessionId } = session;

    if (!this.tableSessions.has(socket.id)) {
      console.log(`[Kariba] handleTableSlotClicked: 테이블 호스트 아님 (socket.id: ${socket.id})`);
      socket.emit('actionResult', { success: false, message: '테이블 호스트만 클릭할 수 있습니다.' });
      return;
    }
    if (game.phase !== 'playing') {
      console.log(`[Kariba] handleTableSlotClicked: 게임 진행 중 아님 (sessionId: ${sessionId}, phase: ${game.phase})`);
      socket.emit('actionResult', { success: false, message: '게임 진행 중이 아닙니다.' });
      return;
    }

    const cur = game.getCurrentPlayer();
    if (!cur.prepared || !cur.prepared.cardType) {
      console.log(`[Kariba] handleTableSlotClicked: 플레이어 카드 준비 안됨 (playerId: ${cur.id}, playerName: ${cur.name})`);
      socket.emit('actionResult', { success: false, message: `${cur.name}님이 플레이어 화면에서 카드를 아직 선택하지 않았습니다.` });
      return;
    }

    const slotType = parseInt(data.slotType);
    if (slotType !== cur.prepared.cardType) {
      console.log(`[Kariba] handleTableSlotClicked: 슬롯 타입 불일치 (playerId: ${cur.id}, prepared: ${cur.prepared.cardType}, clicked: ${slotType})`);
      socket.emit('actionResult', { success: false, message: `선택한 카드(${cur.prepared.cardType}번)와 다른 동물 칸(${slotType}번)입니다.` });
      return;
    }

    const { cardType, count } = cur.prepared;
    const result = game.playCards(cur.id, cardType, count);
    if (!result.success) {
      console.log(`[Kariba] handleTableSlotClicked: playCards 실패 (playerId: ${cur.id}, cardType: ${cardType}, count: ${count}, message: ${result.message})`);
      socket.emit('actionResult', { success: false, message: result.message });
      return;
    }

    cur.prepared = null;

    // Notify clients for flying animation
    this.io.to(sessionId).emit('cardsFlying', {
      playerId: cur.id,
      cardType: cardType,
      count: count
    });

    this._broadcastState(sessionId);
    this._sendHands(sessionId);

    if (result.huntResult) {
      // Delay hunt animation slightly so flying can start
      setTimeout(() => {
        this.io.to(sessionId).emit('huntResult', result.huntResult);
      }, 600);
    }

    if (result.gameOver) {
      setTimeout(() => {
        this.io.to(sessionId).emit('gameEnd', {
          winnerId: result.winner?.id,
          winnerName: result.winner?.name,
          scores: result.scores
        });
      }, 1000);
    } else {
      const nextCur = game.getCurrentPlayer();
      this.io.to(sessionId).emit('turnStart', { playerId: nextCur.id, playerName: nextCur.name });
    }
  }

  // ── 재접속 ──────────────────────────────────────────────────────
  handleRejoin(socket, data) {
    const { sessionId, playerName } = data;
    const game = this.games.get(sessionId);
    if (!game) return;

    const player = game.getPlayerByName(playerName);
    if (player) {
      this.playerSessions.delete(player.id);
      player.id = socket.id;
      player.connected = true;
      this.playerSessions.set(socket.id, { sessionId, playerName });
      socket.join(sessionId);

      socket.emit('gameState', game.getPublicState());
      socket.emit('playerHand', { cards: player.hand });

      if (game.phase === 'playing') {
        const cur = game.getCurrentPlayer();
        socket.emit('turnStart', { playerId: cur.id, playerName: cur.name });
      }
      this._broadcastState(sessionId);
      console.log(`[Kariba] ${playerName} 재접속 → ${sessionId}`);
    }
  }

  // ── 재경기 ──────────────────────────────────────────────────────
  handleRequestRestart(socket) {
    const session = this.findGameBySocket(socket.id);
    if (!session) return;
    const { game, sessionId } = session;

    const player = game.getPlayer(socket.id);
    if (!player || game.phase !== 'ended') return;

    game.restartRequests.add(player.id);
    const current = game.restartRequests.size;
    const total = game.players.length;

    this.io.to(sessionId).emit('restartStatus', { current, total });
    this.io.to(sessionId).emit('actionResult', {
      success: true,
      message: `${player.name}님이 재경기를 요청했습니다 (${current}/${total})`
    });

    if (current >= total) {
      game.initGame(game.expertMode);
      game.restartRequests.clear();
      this.io.to(sessionId).emit('actionResult', { success: true, message: '게임을 다시 시작합니다!' });
      this._broadcastState(sessionId);
      this._sendHands(sessionId);
      const cur = game.getCurrentPlayer();
      this.io.to(sessionId).emit('turnStart', { playerId: cur.id, playerName: cur.name });
    }
  }

  // ── 연결 끊김 ────────────────────────────────────────────────────
  handleDisconnect(socket) {
    const info = this.playerSessions.get(socket.id);
    if (info) {
      const game = this.games.get(info.sessionId);
      if (game) {
        const p = game.getPlayer(socket.id);
        if (p) p.connected = false;
        this._broadcastState(info.sessionId);
      }
    }
    if (this.tableSessions.has(socket.id)) this.tableSessions.delete(socket.id);
    console.log(`[Kariba] 연결 해제: ${socket.id}`);
  }

  // ── 헬퍼 ─────────────────────────────────────────────────────────
  _broadcastState(sessionId) {
    const game = this.games.get(sessionId);
    if (!game) return;
    this.io.to(sessionId).emit('gameState', game.getPublicState());
  }

  _sendHands(sessionId) {
    const game = this.games.get(sessionId);
    if (!game) return;
    game.players.forEach(p => {
      this.io.to(p.id).emit('playerHand', { cards: p.hand });
    });
  }

  findGameBySocket(socketId) {
    const info = this.playerSessions.get(socketId);
    if (info) {
      const game = this.games.get(info.sessionId);
      return game ? { game, sessionId: info.sessionId } : null;
    }
    const tableId = this.tableSessions.get(socketId);
    if (tableId) {
      const game = this.games.get(tableId);
      return game ? { game, sessionId: tableId } : null;
    }
    return null;
  }
}

module.exports = KaribaGameManager;
