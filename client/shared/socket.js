// Socket connection manager with auto-reconnect
class SocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.sessionId = null;
  }

  connect() {
    // Connect to backend - uses ENV for dual-mode (local LAN / online Render)
    const backendUrl = window.ENV?.BACKEND_URL || window.location.origin;
    this.socket = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      console.log('Connected:', this.socket.id);
      if (this.handlers.onConnect) this.handlers.onConnect();
      // If we had a session, try to rejoin
      if (this.sessionId) {
        this.socket.emit('rejoin', { sessionId: this.sessionId, playerId: this.playerId });
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected');
      if (this.handlers.onDisconnect) this.handlers.onDisconnect();
    });

    return this.socket;
  }

  on(event, callback) {
    if (this.socket) this.socket.on(event, callback);
    this.handlers[event] = callback;
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  setSession(sessionId) {
    this.sessionId = sessionId;
  }
}

// Global instance
const socketManager = new SocketManager();
