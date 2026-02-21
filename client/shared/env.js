// Environment detection for dual-mode operation (local vs online)
// Local: localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x (classroom LAN)
// Online: Vercel frontend → Render backend

(function () {
  const _host = window.location.hostname;
  const _origin = window.location.origin;

  const isLocal =
    _host === 'localhost' ||
    _host === '127.0.0.1' ||
    /^192\.168\./.test(_host) ||
    /^10\./.test(_host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(_host);

  const envBackendUrl = window.__ENV__?.BACKEND_URL;
  const onlineFallbacks = [
    envBackendUrl,
    // Render service URL candidates (old/new)
    'https://sleeping-queens-server.onrender.com',
    'https://sleepingqueens-1w2r.onrender.com'
  ].filter(Boolean);

  // If frontend itself is served on Render, try same-origin backend first.
  if (!isLocal && /\.onrender\.com$/.test(_host)) {
    onlineFallbacks.unshift(_origin);
  }

  const BACKEND_URLS = isLocal
    ? [`http://${_host}:3000`]
    : [...new Set(onlineFallbacks)];
  const BACKEND_URL = BACKEND_URLS[0];

  window.ENV = { isLocal, BACKEND_URL, BACKEND_URLS };
})();
