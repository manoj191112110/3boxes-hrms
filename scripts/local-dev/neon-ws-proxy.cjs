/**
 * Local Neon WebSocket proxy for development inside Cloud Agents.
 *
 * The application talks to Postgres exclusively through the Neon serverless
 * driver (`@prisma/adapter-neon`), which speaks the Postgres wire protocol over
 * a WebSocket. In production that WebSocket terminates at Neon's own proxy. For
 * local development (against a plain local PostgreSQL server) we run this tiny
 * byte-piping proxy instead: it accepts a WebSocket connection, reads the
 * `address=host:port` query parameter, opens a raw TCP socket to that address,
 * and relays bytes in both directions.
 *
 * This file is only used for local/dev setups and has no effect on production,
 * which never connects to it.
 */
const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.NEON_WS_PROXY_PORT || '5433', 10);
// Only allow tunnelling to loopback targets so this dev proxy can't be abused.
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('neon-ws-proxy: ok\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  let target;
  try {
    const url = new URL(req.url, 'http://localhost');
    const address = url.searchParams.get('address') || '';
    const [host, portStr] = address.split(':');
    const port = parseInt(portStr, 10);
    if (!host || !ALLOWED_HOSTS.has(host) || !Number.isInteger(port)) {
      ws.close(1008, 'invalid address');
      return;
    }
    target = { host, port };
  } catch {
    ws.close(1008, 'bad request');
    return;
  }

  if (process.env.NEON_WS_PROXY_DEBUG === '1') {
    console.log(`[neon-ws-proxy] connection -> ${target.host}:${target.port}`);
  }

  const tcp = net.connect(target.port, target.host);
  const pending = [];
  let tcpReady = false;

  tcp.on('connect', () => {
    tcpReady = true;
    for (const chunk of pending) tcp.write(chunk);
    pending.length = 0;
  });
  tcp.on('data', (data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  tcp.on('close', () => {
    if (process.env.NEON_WS_PROXY_DEBUG === '1') console.log('[neon-ws-proxy] tcp closed');
    try { ws.close(); } catch {}
  });
  tcp.on('error', (err) => {
    if (process.env.NEON_WS_PROXY_DEBUG === '1') console.log('[neon-ws-proxy] tcp error', err && err.message);
    try { ws.close(1011, 'tcp error'); } catch {}
  });

  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (tcpReady) tcp.write(buf);
    else pending.push(buf);
  });
  ws.on('close', () => {
    try { tcp.end(); } catch {}
  });
  ws.on('error', () => {
    try { tcp.destroy(); } catch {}
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[neon-ws-proxy] listening on ws://127.0.0.1:${PORT} (dev only)`);
});
