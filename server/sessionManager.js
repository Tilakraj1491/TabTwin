// Owns session state for the TabTwin signaling server.
// Serialisable session data lives in Redis (ioredis); WebSocket socket
// references that cannot cross process boundaries are kept in an in-process
// socketStore Map keyed by sessionId.
import crypto from 'node:crypto';

const SESSION_TTL_SECONDS = 86_400; // 24 hours
const MAX_ID_ATTEMPTS = 10;

const DEFAULT_PERMISSIONS = {
  canHighlight: true,
  canAnnotate: true,
  canScroll: true,
  canClick: false,
  canType: false,
  canNavigate: false
};

const GUEST_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

/** @param {string} id */
function redisKey(id) {
  return `tabtwin:session:${id}`;
}

/**
 * Creates the session manager backed by the supplied ioredis client.
 *
 * @param {{ clientUrl: string, redisClient: import('ioredis').Redis }} options
 */
export function createSessionManager({ clientUrl, redisClient }) {
  // In-process store for socket references only.
  // Shape: Map<sessionId, { hostSocket: WebSocket|null, guests: Array<{ id, socket }> }>
  const socketStore = new Map();

  // ---------- helpers ----------

  function _logActivity(data, message) {
    data.activityLog.unshift({ at: Date.now(), message });
    if (data.activityLog.length > 20) data.activityLog.length = 20;
  }

  async function _save(session) {
    await redisClient.set(redisKey(session.id), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  }

  async function _load(id) {
    const raw = await redisClient.get(redisKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  /** Merge serialisable session data with the live socket references. */
  function _hydrate(data) {
    if (!data) return null;
    const sockets = socketStore.get(data.id) || { hostSocket: null, guests: [] };
    return {
      ...data,
      hostSocket: sockets.hostSocket,
      guests: data.guests.map((g) => {
        const live = sockets.guests.find((s) => s.id === g.id);
        return { ...g, socket: live?.socket ?? null };
      })
    };
  }

  function _socketEntry(sessionId) {
    if (!socketStore.has(sessionId)) {
      socketStore.set(sessionId, { hostSocket: null, guests: [] });
    }
    return socketStore.get(sessionId);
  }

  // ---------- public API ----------

  async function createSession({ hostName = 'Host' } = {}) {
    let id;
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const candidate = crypto.randomBytes(4).toString('hex');
      // SET NX EX: atomically write only if the key does not already exist.
      // Returns 'OK' on success, null if the key was already present (collision).
      const placeholder = JSON.stringify({ _reserved: true });
      const result = await redisClient.set(
        redisKey(candidate),
        placeholder,
        'EX',
        SESSION_TTL_SECONDS,
        'NX'
      );
      if (result === 'OK') {
        id = candidate;
        break;
      }
    }
    if (!id) {
      throw new Error('Failed to generate a unique session ID after maximum attempts.');
    }

    const session = {
      id,
      hostName,
      link: `${clientUrl.replace(/\/$/, '')}/join/${id}`,
      createdAt: new Date().toISOString(),
      // hostSocket is NOT stored in Redis — it lives only in socketStore.
      guests: [],
      permissions: { ...DEFAULT_PERMISSIONS },
      activityLog: []
    };

    // Overwrite the placeholder with the full session object.
    await _save(session);
    socketStore.set(id, { hostSocket: null, guests: [] });
    return _hydrate(session);
  }

  async function getSession(id) {
    const data = await _load(id);
    return _hydrate(data);
  }

  async function endSession(id) {
    const data = await _load(id);
    if (!data) return false;

    const sockets = socketStore.get(id);
    if (sockets) {
      for (const { socket } of sockets.guests) {
        safeSend(socket, { event: 'control:revoke', payload: { reason: 'session-ended' } });
        socket?.close?.(1000, 'Session ended');
      }
      safeSend(sockets.hostSocket, { event: 'session:ended', payload: { sessionId: id } });
      sockets.hostSocket?.close?.(1000, 'Session ended');
    }

    await redisClient.del(redisKey(id));
    socketStore.delete(id);
    return true;
  }

  async function attachHost(sessionId, socket) {
    const data = await _load(sessionId);
    if (!data) return null;

    _logActivity(data, 'Host connected');
    await _save(data);

    const entry = _socketEntry(sessionId);
    entry.hostSocket = socket;

    return _hydrate(data);
  }

  async function addGuest(sessionId, socket, { name = 'Guest' } = {}) {
    const data = await _load(sessionId);
    if (!data) return null;

    const guestId = crypto.randomBytes(6).toString('hex');
    const guestData = {
      id: guestId,
      name,
      color: GUEST_COLORS[data.guests.length % GUEST_COLORS.length],
      permissions: { ...DEFAULT_PERMISSIONS }
      // socket is NOT stored in Redis.
    };

    data.guests.push(guestData);
    _logActivity(data, 'Host connected');
    await _save(data);

    const entry = _socketEntry(sessionId);
    entry.guests.push({ id: guestId, socket });

    const session = _hydrate(data);
    const guest = session.guests.find((g) => g.id === guestId);
    return { session, guest };
  }

  async function removeSocket(socket) {
    for (const [sessionId, sockets] of socketStore) {
      let changed = false;

      if (sockets.hostSocket === socket) {
        sockets.hostSocket = null;
        const data = await _load(sessionId);
        if (data) {
          _logActivity(data, 'Host connected');
          await _save(data);
        }
        changed = true;
      }

      // Identify the guest that just left before the local list is filtered.
      const disconnectedIds = new Set(
        sockets.guests
          .filter((g) => g.socket === socket)
          .map((g) => g.id)
      );
      sockets.guests = sockets.guests.filter((g) => g.socket !== socket);

      if (disconnectedIds.size > 0) {
        const data = await _load(sessionId);
        if (data) {
          // Remove only the specific guest(s) that disconnected from this instance.
          // Using the disconnected ID rather than a local-socket allowlist avoids
          // wiping guests whose sockets live on other server instances.
          data.guests = data.guests.filter((g) => !disconnectedIds.has(g.id));
          _logActivity(data, 'Host connected');
          await _save(data);
        }

        const hostSocket = sockets.hostSocket;
        const updatedData = await _load(sessionId);
        if (updatedData) {
          safeSend(hostSocket, {
            event: 'session:guest-left',
            payload: { guests: publicGuests(_hydrate(updatedData)) }
          });
        }
        changed = true;
      }

      // Reclaim the in-process entry when no sockets remain.
      // The Redis key is intentionally kept — the session stays valid for reconnections.
      if (sockets.hostSocket === null && sockets.guests.length === 0) {
        socketStore.delete(sessionId);
      }
    }
  }

  async function count() {
    // Count keys matching the session namespace.
    const keys = await redisClient.keys('tabtwin:session:*');
    return keys.length;
  }

  return {
    createSession,
    getSession,
    endSession,
    attachHost,
    addGuest,
    removeSocket,
    count
  };
}

export function publicGuests(session) {
  return session.guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    color: guest.color,
    permissions: guest.permissions
  }));
}

export function safeSend(socket, message) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify(message));
}
