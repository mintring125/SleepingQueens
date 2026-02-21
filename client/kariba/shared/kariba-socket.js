// Kariba Socket 연결 관리 (/kariba 네임스페이스)
class KaribaSocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.sessionId = null;
    this.pendingEmits = [];
  }

  connect() {
    const backendUrl = window.ENV?.BACKEND_URL || window.location.origin;
    const namespaceUrl = backendUrl.replace(/\/$/, '') + '/kariba';

    if (this.socket) this.socket.disconnect();

    this.socket = io(namespaceUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15
    });

    Object.entries(this.handlers).forEach(([event, cb]) => {
      this.socket.on(event, cb);
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      console.log('[Kariba] 연결됨:', this.socket.id);
      this._flushPending();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[Kariba] 연결 끊김');
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

  _flushPending() {
    if (!this.socket || !this.connected) return;
    this.pendingEmits.forEach(({ event, data }) => this.socket.emit(event, data));
    this.pendingEmits = [];
  }
}

const karibaSocket = new KaribaSocketManager();
