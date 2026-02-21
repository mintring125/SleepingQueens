const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const GameManager = require('./game/GameManager');
const KaribaGameManager = require('./game/kariba/KaribaGameManager');

const app = express();
const server = http.createServer(app);
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : '*';

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow non-browser clients and same-origin server calls
  if (corsOrigins === '*') return true;
  if (corsOrigins.includes(origin)) return true;
  // Vercel production/preview domains for this project
  return /^https:\/\/sleeping-queens(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST']
  }
});

// Serve static files - Sleeping Queens
app.use('/shared', express.static(path.join(__dirname, '..', 'client', 'shared')));
app.use('/table', express.static(path.join(__dirname, '..', 'client', 'table')));
app.use('/player', express.static(path.join(__dirname, '..', 'client', 'player')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Serve static files - Kariba
app.use('/kariba/table', express.static(path.join(__dirname, '..', 'client', 'kariba', 'table')));
app.use('/kariba/player', express.static(path.join(__dirname, '..', 'client', 'kariba', 'player')));
app.use('/kariba/shared', express.static(path.join(__dirname, '..', 'client', 'kariba', 'shared')));
app.use('/kariba/assets', express.static(path.join(__dirname, '..', 'client', 'kariba', 'assets')));

// Serve node_modules for client-side libs
app.use('/lib/qrcode', express.static(path.join(__dirname, 'node_modules', 'qrcode', 'build')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'games.html')));
app.get('/join', (req, res) => res.redirect('/player/join.html'));
app.get('/kariba', (req, res) => res.redirect('/kariba/table'));

// QR code API endpoint
const QRCode = require('qrcode');
app.get('/api/qr', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing url param');
    const qrBuffer = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.type('png').send(qrBuffer);
  } catch (err) {
    res.status(500).send('QR generation failed');
  }
});

// Get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
const localIP = getLocalIP();

// Initialize Game Managers
const gameManager = new GameManager(io, getLocalIP, PORT);
const karibaNamespace = io.of('/kariba');
const karibaGameManager = new KaribaGameManager(karibaNamespace, getLocalIP, PORT);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== 테이블 게임 서버 ===`);
  console.log(`게임 선택:     http://${localIP}:${PORT}/`);
  console.log(`슬리핑퀸즈:    http://${localIP}:${PORT}/table`);
  console.log(`카리바 테이블: http://${localIP}:${PORT}/kariba/table`);
  console.log(`카리바 참가:   http://${localIP}:${PORT}/kariba/player`);
  console.log(`====================\n`);
});

module.exports = { io, server, app, getLocalIP, PORT };
