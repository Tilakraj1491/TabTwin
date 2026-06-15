// Routes TabTwin WebSocket events between hosts, guests, CRDT peers, and the AI agent bridge.
import { publicGuests, safeSend } from './sessionManager.js';

export function createSignalingHandler({ sessions }) {
  function handleConnection(socket) {
    socket.tabTwin = { role: 'unknown', sessionId: null, guestId: null };

    socket.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        safeSend(socket, { event: 'error', payload: { message: 'Invalid JSON message.' } });
        return;
      }

      await routeMessage(socket, message);
    });

    socket.on('close', () => sessions.removeSocket(socket));
  }

  async function routeMessage(socket, { event, payload = {} }) {
    const sessionId = payload.sessionId || socket.tabTwin.sessionId;
    const session = sessionId ? await sessions.getSession(sessionId) : null;

    switch (event) {
      case 'host:connect': {
        const nextSession = await sessions.attachHost(payload.sessionId, socket);
        if (!nextSession) {
          safeSend(socket, { event: 'error', payload: { message: 'Session not found.' } });
          return;
        }

        socket.tabTwin = { role: 'host', sessionId: nextSession.id, guestId: null };
        safeSend(socket, {
          event: 'host:connected',
          payload: { sessionId: nextSession.id, guests: publicGuests(nextSession) }
        });
        return;
      }

      case 'session:join': {
        const safeName = String(payload.name || '').trim().slice(0, 40) || 'Guest';
        const joined = await sessions.addGuest(payload.sessionId, socket, { name: safeName });
        if (!joined) {
          safeSend(socket, { event: 'error', payload: { message: 'Session not found.' } });
          return;
        }

        socket.tabTwin = {
          role: 'guest',
          sessionId: joined.session.id,
          guestId: joined.guest.id
        };

        safeSend(socket, {
          event: 'session:joined',
          payload: {
            sessionId: joined.session.id,
            guest: publicGuest(joined.guest),
            permissions: joined.guest.permissions
          }
        });

        safeSend(joined.session.hostSocket, {
          event: 'session:joined',
          payload: { guest: publicGuest(joined.guest), guests: publicGuests(joined.session) }
        });
        return;
      }

      case 'cursor:move':
      case 'action:request':
      case 'crdt:update':
      case 'webrtc:offer':
      case 'webrtc:answer':
      case 'webrtc:ice-candidate': {
        if (!session) return;
        const target = socket.tabTwin.role === 'host' ? findGuestSocket(session, payload.guestId) : session.hostSocket;
        safeSend(target, { event, payload: withSender(socket, payload) });
        return;
      }

      case 'cursor:update':
      case 'action:approved':
      case 'agent:action':
      case 'control:revoke': {
        if (!session) return;
        broadcastGuests(session, { event, payload: withSender(socket, payload) }, payload.guestId);
        return;
      }

      case 'agent:command': {
        if (!session) return;
        // TODO: Move AI command execution to a queued worker for long-running browser tasks.
        safeSend(session.hostSocket, {
          event: 'agent:action',
          payload: {
            command: payload.command,
            actions: payload.actions || [],
            summary: payload.summary || 'Agent command received.'
          }
        });
        return;
      }

      default:
        safeSend(socket, { event: 'error', payload: { message: `Unknown event: ${event}` } });
    }
  }

  return { handleConnection };
}

function publicGuest(guest) {
  return {
    id: guest.id,
    name: guest.name,
    color: guest.color,
    permissions: guest.permissions
  };
}

function withSender(socket, payload) {
  return {
    ...payload,
    senderRole: socket.tabTwin.role,
    guestId: payload.guestId || socket.tabTwin.guestId
  };
}

function findGuestSocket(session, guestId) {
  return session.guests.find((guest) => guest.id === guestId)?.socket || null;
}

function broadcastGuests(session, message, guestId = null) {
  for (const guest of session.guests) {
    if (!guestId || guest.id === guestId) {
      safeSend(guest.socket, message);
    }
  }
}
