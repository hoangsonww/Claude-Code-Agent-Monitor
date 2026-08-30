/**
 * @file WebSocket functionalities for real-time communication with clients, including connection management, heartbeat for detecting dead connections, and broadcasting messages to all connected clients. Also exposes the broadcast bus itself via subscribeToBroadcasts(), so other transports (see lib/sse.js) can mirror the same stream without a second set of call sites.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { WebSocketServer } = require("ws");
const { isHostAllowed, isWebSocketAuthorized } = require("./lib/security");

let wss = null;

function initWebSocket(server) {
  // Express middleware doesn't run on WS upgrades, so enforce the same Host
  // allowlist (anti DNS-rebinding) and optional token here (GHSA-gr74-4xfh-6jw9).
  wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 64 * 1024,
    verifyClient(info, done) {
      if (!isHostAllowed(info.req.headers.host)) return done(false, 403, "host not allowed");
      if (!isWebSocketAuthorized(info.req)) return done(false, 401, "unauthorized");
      return done(true);
    },
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("error", (err) => {
      // Log but don't crash — client disconnects are normal
      if (err.code !== "ECONNRESET") {
        console.warn("[WS] client error:", err.code || err.message);
      }
    });
  });

  // Heartbeat every 30s to detect dead connections
  const interval = setInterval(() => {
    if (!wss) {
      clearInterval(interval);
      return;
    }
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  interval.unref();

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

// Non-WebSocket listeners on the same broadcast bus. Kept deliberately generic
// (type + envelope) so a transport can be added without touching any of the
// ~17 broadcast() call sites scattered across routes and lib modules.
const subscribers = new Set();

/**
 * Observe every broadcast. The listener receives `(type, envelope)` where
 * `envelope` is the exact `{ type, data, timestamp }` object WebSocket clients
 * get, so alternative transports stay byte-identical to the WS feed.
 *
 * @param {(type: string, envelope: {type: string, data: unknown, timestamp: string}) => void} fn
 * @returns {() => void} Unsubscribe.
 */
function subscribeToBroadcasts(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function broadcast(type, data) {
  const envelope = { type, data, timestamp: new Date().toISOString() };

  // Fan out to non-WS transports first, and independently of `wss`: SSE clients
  // must still receive events when the WebSocket server was never initialised
  // (e.g. an API-only or test process).
  if (subscribers.size > 0) {
    for (const fn of [...subscribers]) {
      try {
        fn(type, envelope);
      } catch (err) {
        // A misbehaving subscriber must never break the primary WS broadcast.
        console.warn("[WS] broadcast subscriber failed:", err?.message || err);
      }
    }
  }

  if (!wss) return;
  const message = JSON.stringify(envelope);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch {
        // Client closed between readyState check and send — safe to ignore
      }
    }
  });
}

function getConnectionCount() {
  if (!wss) return 0;
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) count++;
  });
  return count;
}

/**
 * Tear down the WebSocket server for a graceful shutdown. Open WS clients keep
 * their underlying TCP sockets alive, which prevents http.Server#close() from
 * ever completing — under `node --watch` that turns every restart into a
 * multi-second "waiting for graceful termination" stall. Terminating the
 * clients first lets the HTTP server drain and close promptly.
 */
function closeWebSocket() {
  if (!wss) return;
  wss.clients.forEach((client) => {
    try {
      client.terminate();
    } catch {
      /* already gone */
    }
  });
  try {
    wss.close();
  } catch {
    /* ignore */
  }
  wss = null;
}

module.exports = {
  initWebSocket,
  broadcast,
  subscribeToBroadcasts,
  getConnectionCount,
  closeWebSocket,
};
