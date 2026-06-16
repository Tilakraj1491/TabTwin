// Starts the TabTwin Express API and WebSocket signaling server.
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import { createSessionManager as createRedisSessionManager } from './sessionManager.js';
import { createSessionManager as createMemorySessionManager } from './sessionManager.inmemory.js';
import { createSignalingHandler } from './signalingHandler.js';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const REDIS_URL = process.env.REDIS_URL;

const app = express();
const server = http.createServer(app);

// Use Redis-backed session manager when REDIS_URL is configured, otherwise
// fall back to the in-memory manager so the server can run without Redis for
// local development and testing. The in-memory store is NOT suitable for
// production: sessions are lost on restart and cannot be shared across
// multiple server instances.
let sessions;
if (REDIS_URL) {
  const redisClient = new Redis(REDIS_URL, {
    // Retry up to 3 times with a 500 ms delay before giving up on startup.
    maxRetriesPerRequest: 3,
    lazyConnect: false
  });
  redisClient.on('error', (err) => {
    console.error('[TabTwin] Redis connection error:', err.message);
  });
  sessions = createRedisSessionManager({ clientUrl: CLIENT_URL, redisClient });
  console.log('[TabTwin] Using Redis session store:', REDIS_URL);
} else {
  console.warn(
    '[TabTwin] REDIS_URL is not set — using in-memory session store.\n' +
    'Sessions will be lost on restart. Set REDIS_URL for production use.\n' +
    'Quick start: docker run -d -p 6379:6379 redis:7-alpine'
  );
  sessions = createMemorySessionManager({ clientUrl: CLIENT_URL });
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

/**
 * Wraps an async route handler so that any rejected promise is forwarded to
 * Express error-handling middleware via next(err), preventing unhandled
 * rejections when Redis or session calls fail.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} fn
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  res.json({ ok: true, service: 'tabtwin-server', sessions: await sessions.count() });
}));

app.post('/api/session/create', asyncHandler(async (req, res) => {
  const hostName = req.body?.hostName || 'Host';
  const session = await sessions.createSession({ hostName });
  res.status(201).json({
    session_id: session.id,
    link: session.link,
    permissions: session.permissions
  });
}));

app.get('/api/session/:id', asyncHandler(async (req, res) => {
  const session = await sessions.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ exists: false, message: 'Session not found or expired.' });
    return;
  }

  res.json({
    exists: true,
    session_id: session.id,
    guests: session.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      color: guest.color,
      permissions: guest.permissions
    })),
    createdAt: session.createdAt
  });
}));

app.delete('/api/session/:id', asyncHandler(async (req, res) => {
  const ended = await sessions.endSession(req.params.id);
  res.status(ended ? 200 : 404).json({ ended });
}));

// Express error-handling middleware: catches errors forwarded by asyncHandler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[TabTwin] Unhandled route error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const wss = new WebSocketServer({ server });
const signaling = createSignalingHandler({ sessions });
wss.on('connection', signaling.handleConnection);

server.listen(PORT, () => {
  console.log(`TabTwin server listening on http://localhost:${PORT}`);
});
