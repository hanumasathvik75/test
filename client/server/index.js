/**
 * Milo WhatsApp Agent & Operations Backend Server
 * Express + WebSockets on port 3001
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const path = require('path');
const routes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend build if present
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// Mount API routes
app.use('/api', routes);
app.use('/', routes); // Also allow /webhook/whatsapp and /webhook/twilio at root

// Create HTTP and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to Milo Live WebSocket' }));

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Broadcast helper function
function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Inject broadcaster into routes
routes.setBroadcaster(broadcast);

// Fallback for SPA routing (Express 5 compatible)
app.use((req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      name: 'Milo WhatsApp Agent Backend',
      status: 'online',
      port: PORT,
      docs: '/api/config'
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Milo WhatsApp Agent Backend running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket server active for real-time live chat & dashboard synchronization\n`);
});

module.exports = { app, server, broadcast };
