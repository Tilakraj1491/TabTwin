// Starts the TabTwin Express API and WebSocket signaling server.
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import { createSessionManager } from './sessionManager.js';
import { createSignalingHandler } from './signalingHandler.js';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error(
    '[TabTwin] REDIS_URL is not set.\n' +
    'Start Redis locally and add REDIS_URL=redis://localhost:6379 to your .env file.\n' +
    'Quick start: docker run -p 6379:6379 redis:7-alpine'
  );
  process.exit(1);
}

const redisClient = new Redis(REDIS_URL, {
  // Retry up to 3 times with a 500 ms delay before giving up on startup.
  maxRetriesPerRequest: 3,
  lazyConnect: false
});

redisClient.on('error', (err) => {
  console.error('[TabTwin] Redis connection error:', err.message);
});

const app = express();
const server = http.createServer(app);
const sessions = createSessionManager({ clientUrl: CLIENT_URL, redisClient });

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
