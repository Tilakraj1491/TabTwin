# TabTwin

Real-time browser tab collaboration with ghost cursors, annotations, and an AI agent that can act inside the host's Chrome tabs.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss&logoColor=white)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285f4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT111827)

## Why TabTwin Exists

Screen sharing lets teammates watch, but it does not let them naturally point, highlight, annotate, or help operate the browser. TabTwin lets a guest or AI agent appear inside the host's real browser tab as a live ghost collaborator while the host stays in control.

## For Hosts

Hosts install the Chrome extension, start a session, share the generated link, and can revoke control at any time. The extension injects the cursor and annotation overlay, manages WebRTC signaling, and executes approved actions.

## For Guests

Guests open the session link in any modern browser. There is nothing to install. They enter a name, join the session, move a ghost cursor, annotate, highlight, scroll, and request click/type actions when the host grants permission.

## Guest Browser Compatibility

| Browser | Guest support | Install required |
| ------- | ------------- | ---------------- |
| Chrome  | Yes           | No               |
| Firefox | Yes           | No               |
| Edge    | Yes           | No               |
| Safari  | Yes           | No               |

## How It Works

- The Chrome extension starts a host session and injects cursor, annotation, and action scripts into tabs.
- The server handles REST session creation plus WebSocket signaling for WebRTC, cursor events, actions, and Yjs-style updates.
- The guest web app joins by link and sends cursor/actions over WebRTC data channels with WebSocket fallback.

## Installation

1. Clone the repo.

```bash
git clone https://github.com/itzzavdhesh/TabTwin.git
cd TabTwin
npm install
```

2. Run the signaling server.

```bash
cp .env.example .env
npm run server
```

> **No Redis?** The server starts with a built-in in-memory store if `REDIS_URL` is not set — ideal for local exploration. Sessions are lost on restart. See the [Redis](#redis) section to enable persistence.

3. Run the guest web app.

```bash
npm run dev:web
```

4. Load the unpacked extension in Chrome from the `extension/` folder.

## Host Setup

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension/` folder.
5. Pin TabTwin, open the popup, and click Start Session.

## Guest Setup

Open the link the host shares. That is it.

## Environment Variables

| Variable            | Required                                                 | Description                                                                          |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | No (optional) | Claude API key used by the AI agent. Required for Claude-powered actions; falls back to a read-only plan without it. |
| `PORT`              | No            | Server port. Defaults to `3001`.                                                                                     |
| `CLIENT_URL`        | No            | Web app origin used when generating join links. Defaults to `http://localhost:5173`.                                 |
| `REDIS_URL`         | No (recommended for production) | ioredis connection URL. If omitted, the server uses an in-memory store (dev only). Example: `redis://localhost:6379`. |

## Redis

TabTwin supports two session store modes:

### In-memory (zero setup — dev only)

If `REDIS_URL` is not set, the server automatically uses the built-in in-memory store. No Redis installation required.

```bash
# Simply omit REDIS_URL from your .env and run:
npm run server
```

> **Warning:** Sessions are lost every time the server restarts and cannot be shared across multiple server instances. Do not use in-memory mode in production.

### Redis (recommended for production)

Set `REDIS_URL` to enable persistent, multi-instance session storage with automatic 24-hour TTL.

**Local development with Docker**

```bash
docker run -d -p 6379:6379 --name tabtwin-redis redis:7-alpine
```

Then add to your `.env`:

```env
REDIS_URL=redis://localhost:6379
```

## Loading The Extension Locally

Screenshot placeholder: `docs/screenshots/chrome-extensions-developer-mode.png`

Screenshot placeholder: `docs/screenshots/load-unpacked-extension-folder.png`

Screenshot placeholder: `docs/screenshots/tabtwin-popup-start-session.png`

## Browser Compatibility Notice

The host extension is Chrome-only for the MVP because it depends on Chrome Manifest V3 extension APIs. Guests can join from Chrome, Firefox, Edge, or Safari through the web app.

## License

MIT
