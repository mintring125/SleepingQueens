// Kariba Socket 연결 관리 (/kariba 네임스페이스)
class KaribaSocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.sessionId = null;
    this.pendingEmits = [];
    this.backendUrls = [];
    this.currentBackendIndex = 0;
    this.currentBackendFailures = 0;
  }

  connect() {
    const configuredUrls = window.ENV?.BACKEND_URLS || [];
    const fallbackUrl = window.ENV?.BACKEND_URL || window.location.origin;
    this.backendUrls = (configuredUrls.length > 0 ? configuredUrls : [fallbackUrl]).filter(Boolean);
    this.currentBackendIndex = 0;
    this.currentBackendFailures = 0;
    this._wakeUpBackends();
    return this._connectTo(this.backendUrls[0]);
  }

  _connectTo(backendUrl) {
    const namespaceUrl = backendUrl.replace(/\/$/, '') + '/kariba';

    if (this.socket) this.socket.disconnect();

    this.socket = io(namespaceUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    Object.entries(this.handlers).forEach(([event, cb]) => {
      this.socket.on(event, cb);
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      this.currentBackendFailures = 0;
      console.log('[Kariba] 연결됨:', this.socket.id, 'via', backendUrl);
      this._flushPending();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[Kariba] 연결 끊김');
    });

    this.socket.on('connect_error', () => {
      if (this.connected) return;
      this.currentBackendFailures += 1;
      if (this.currentBackendFailures < 3) return;
      if (this.currentBackendIndex >= this.backendUrls.length - 1) return;
      this.currentBackendIndex += 1;
      this.currentBackendFailures = 0;
      const nextUrl = this.backendUrls[this.currentBackendIndex];
      console.warn('[Kariba] 연결 실패, 다음 서버 시도:', nextUrl);
      this._connectTo(nextUrl);
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

  _wakeUpBackends() {
    this.backendUrls.forEach((url) => {
      const wakeUrl = `${url.replace(/\/$/, '')}/health?t=${Date.now()}`;
      fetch(wakeUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    });
  }
}

const karibaSocket = new KaribaSocketManager();
