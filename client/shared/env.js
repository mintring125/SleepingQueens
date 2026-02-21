// Environment detection for dual-mode operation (local vs online)
// Local: localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x (classroom LAN)
// Online: Vercel frontend → Render backend

(function () {
  const _host = window.location.hostname;

  const isLocal =
    _host === 'localhost' ||
    _host === '127.0.0.1' ||
    /^192\.168\./.test(_host) ||
    /^10\./.test(_host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(_host);

  // Online: use injected env or fallback to Render URL
  const BACKEND_URL = isLocal
    ? `http://${_host}:3000`
    : (window.__ENV__?.BACKEND_URL || 'https://sleepingqueens-1w2r.onrender.com');

  window.ENV = { isLocal, BACKEND_URL };
})();
