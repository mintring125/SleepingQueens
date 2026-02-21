const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : '*';
const io = new Server(server, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST'] }
});

// Serve static files
app.use('/shared', express.static(path.join(__dirname, '..', 'client', 'shared')));
app.use('/table', express.static(path.join(__dirname, '..', 'client', 'table')));
app.use('/player', express.static(path.join(__dirname, '..', 'client', 'player')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Serve node_modules for client-side libs
app.use('/lib/qrcode', express.static(path.join(__dirname, 'node_modules', 'qrcode', 'build')));

// Routes
app.get('/', (req, res) => res.redirect('/table'));
app.get('/join', (req, res) => res.redirect('/player/join.html'));

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

// Initialize Game Manager
const gameManager = new GameManager(io, getLocalIP, PORT);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Sleeping Queens Server ===`);
  console.log(`Table:  http://${localIP}:${PORT}/table`);
  console.log(`Player: http://${localIP}:${PORT}/player`);
  console.log(`==============================\n`);
});

module.exports = { io, server, app, getLocalIP, PORT };
