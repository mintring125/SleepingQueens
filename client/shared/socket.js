// Socket connection manager with auto-reconnect
class SocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.sessionId = null;
    this.pendingEmits = [];
    this.backendUrls = [];
    this.currentBackendIndex = 0;
  }

  connect() {
    const configuredUrls = window.ENV?.BACKEND_URLS || [];
    const fallbackUrl = window.ENV?.BACKEND_URL || window.location.origin;
    this.backendUrls = (configuredUrls.length > 0 ? configuredUrls : [fallbackUrl]).filter(Boolean);
    this.currentBackendIndex = 0;
    return this.connectTo(this.backendUrls[this.currentBackendIndex]);
  }

  connectTo(backendUrl) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to backend - uses ENV for dual-mode (local LAN / online Render)
    this.socket = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    // Bind handlers that were registered before connect() was called.
    Object.entries(this.handlers).forEach(([event, callback]) => {
      this.socket.on(event, callback);
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      console.log('Connected:', this.socket.id, 'via', backendUrl);
      // If we had a session, try to rejoin
      if (this.sessionId) {
        this.socket.emit('rejoin', { sessionId: this.sessionId, playerId: this.playerId });
      }
      this.flushPendingEmits();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected');
    });

    this.socket.on('connect_error', () => {
      if (this.connected) return;
      if (this.currentBackendIndex >= this.backendUrls.length - 1) return;
      this.currentBackendIndex += 1;
      const nextUrl = this.backendUrls[this.currentBackendIndex];
      console.warn('Primary backend failed, retrying with fallback:', nextUrl);
      this.connectTo(nextUrl);
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
      return;
    }
    this.pendingEmits.push({ event, data });
  }

  setSession(sessionId) {
    this.sessionId = sessionId;
  }

  flushPendingEmits() {
    if (!this.socket || !this.connected || this.pendingEmits.length === 0) return;
    this.pendingEmits.forEach(({ event, data }) => {
      this.socket.emit(event, data);
    });
    this.pendingEmits = [];
  }
}

// Global instance
const socketManager = new SocketManager();
