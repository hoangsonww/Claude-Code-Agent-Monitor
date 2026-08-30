/**
 * @file Server-Sent Events hub for the live dashboard feed. Mirrors every
 * WebSocket broadcast onto plain HTTP so any client that cannot (or should not)
 * open a WebSocket — curl, a shell script, a CI job, an automation tool, a
 * browser behind a proxy that strips Upgrade headers — can consume the same
 * real-time stream. Owns the connected-client registry, an optional per-client
 * type filter, a bounded replay buffer for `Last-Event-ID` reconnects, the
 * keep-alive heartbeat, slow-consumer eviction, and shutdown teardown.
 *
 * The subscription is lazy: the hub attaches to the broadcast bus on the first
 * client and detaches on the last, so an unstreamed dashboard does no extra
 * work. The replay ring is bound to that subscription, which means a period
 * with zero clients is a permanent gap — see stopBridge() for the contract.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { subscribeToBroadcasts } = require("../websocket");

// Comment-only heartbeat. Proxies and load balancers commonly reap an idle
// connection after 30-60s; a periodic no-op keeps the stream alive and lets a
// client notice a dead link without waiting for real activity.
const HEARTBEAT_MS = 25_000;

// Replay buffer for reconnects. SSE clients resume with a Last-Event-ID header;
// anything still in the ring is re-sent so a brief network blip does not silently
// drop events. Deliberately small — this is a reconnect cushion, not history.
const REPLAY_BUFFER_SIZE = 500;

// Slow-consumer ceiling. A client that stops reading makes Node buffer writes in
// memory indefinitely; past this many bytes queued on the socket the client is
// dropped rather than allowed to grow the heap without bound.
const MAX_BUFFERED_BYTES = 1 << 20; // 1 MiB

function maxClients() {
  const raw = parseInt(process.env.DASHBOARD_SSE_MAX_CLIENTS, 10);
  if (Number.isInteger(raw) && raw >= 0) return raw;
  return 50;
}

/** @type {Set<{res: import("http").ServerResponse, types: Set<string>|null, heartbeat: NodeJS.Timeout}>} */
const clients = new Set();

/** Monotonic id shared by the replay buffer and the SSE `id:` field. */
let nextEventId = 1;
/** @type {{id: number, type: string, payload: string}[]} */
const replayBuffer = [];

let unsubscribe = null;

/**
 * Serialize one broadcast into an SSE frame. `event:` carries the message type
 * so `EventSource.addEventListener(type, …)` works, and `id:` lets a client
 * resume with Last-Event-ID.
 */
function frame(id, type, envelope) {
  return `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(envelope)}\n\n`;
}

/** Write to one client, evicting it if the socket has stopped draining. */
function writeTo(client, chunk) {
  try {
    if (client.res.writableEnded || client.res.destroyed) {
      dropClient(client);
      return;
    }
    // writableLength counts bytes queued but not yet flushed to the kernel. A
    // healthy consumer keeps this near zero; a stalled one grows without bound.
    if (client.res.writableLength > MAX_BUFFERED_BYTES) {
      console.warn("[SSE] dropping slow consumer (write buffer over 1 MiB)");
      dropClient(client);
      return;
    }
    client.res.write(chunk);
  } catch {
    // Client vanished between the checks and the write — normal on disconnect.
    dropClient(client);
  }
}

function dropClient(client) {
  if (!clients.has(client)) return;
  clients.delete(client);
  clearInterval(client.heartbeat);
  try {
    client.res.end();
  } catch {
    /* already torn down */
  }
  if (clients.size === 0) stopBridge();
}

/**
 * Start mirroring broadcasts onto the SSE clients. Subscribing lazily (and
 * unsubscribing when the last client leaves) keeps the hub inert — and the
 * replay buffer empty — for the common case where nobody is streaming.
 */
function startBridge() {
  if (unsubscribe) return;
  unsubscribe = subscribeToBroadcasts((type, envelope) => {
    const id = nextEventId++;
    const payload = frame(id, type, envelope);

    replayBuffer.push({ id, type, payload });
    if (replayBuffer.length > REPLAY_BUFFER_SIZE) replayBuffer.shift();

    for (const client of [...clients]) {
      if (client.types && !client.types.has(type)) continue;
      writeTo(client, payload);
    }
  });
}

function stopBridge() {
  if (!unsubscribe) return;
  try {
    unsubscribe();
  } catch {
    /* best effort */
  }
  unsubscribe = null;
  // The buffer only exists to cushion reconnects by live clients. With none
  // connected it is stale by definition, and keeping it would replay ancient
  // events to the next arrival.
  //
  // Documented consequence: events broadcast while zero clients are attached are
  // NOT recoverable, and the first client back gets no `stream_gap` — the hub
  // was not listening, so it has no record of what it missed. A single-consumer
  // integration must refetch current state over REST after a full disconnect
  // rather than assume the stream is contiguous. `stream_gap` covers ring
  // overflow *while listening*; it is not a completeness guarantee across a gap
  // in listening. See docs/API.md → Live Event Stream (SSE).
  replayBuffer.length = 0;
}

/**
 * Attach an HTTP response as an SSE client.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [opts]
 * @param {string[]|null} [opts.types] Message types to forward; null = all.
 * @returns {boolean} false when the connection was refused (client cap reached).
 */
function addClient(req, res, opts = {}) {
  const cap = maxClients();
  if (cap === 0 || clients.size >= cap) return false;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    // no-transform additionally tells intermediaries not to gzip/rechunk the
    // stream, which would otherwise buffer frames until a compression window
    // fills and destroy the "real-time" property.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx-specific opt-out of proxy_buffering; harmless elsewhere.
    "X-Accel-Buffering": "no",
  });

  // Send frames the instant they are written rather than waiting for Nagle to
  // accumulate a full segment, and opt out of the server's socket idle timeout —
  // a long-lived stream is idle by design between events.
  try {
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);
  } catch {
    /* not all socket implementations expose these */
  }

  const client = {
    res,
    types: opts.types && opts.types.length > 0 ? new Set(opts.types) : null,
    heartbeat: setInterval(() => writeTo(client, ": ping\n\n"), HEARTBEAT_MS),
  };
  if (client.heartbeat.unref) client.heartbeat.unref();

  clients.add(client);
  startBridge();

  const cleanup = () => dropClient(client);
  res.on("close", cleanup);
  res.on("error", cleanup);

  // Opening comment: flushes headers immediately so a client knows it is
  // connected before the first real event, which may be minutes away.
  writeTo(client, ": connected\n\n");

  // Reconnect replay. A client that was gone longer than the buffer covers is
  // told so explicitly — silently resuming from a gap would make the stream
  // look complete when it is not.
  const lastId = parseInt(req.headers["last-event-id"], 10);
  if (Number.isInteger(lastId) && lastId > 0) {
    const missed = replayBuffer.filter((entry) => entry.id > lastId);
    const oldestHeld = replayBuffer.length > 0 ? replayBuffer[0].id : nextEventId;
    if (lastId + 1 < oldestHeld) {
      writeTo(
        client,
        `event: stream_gap\ndata: ${JSON.stringify({
          last_event_id: lastId,
          oldest_available_id: oldestHeld,
          message: "Some events were dropped from the replay buffer; refetch via the REST API.",
        })}\n\n`
      );
    }
    for (const entry of missed) {
      if (client.types && !client.types.has(entry.type)) continue;
      writeTo(client, entry.payload);
    }
  }

  return true;
}

/** Number of currently attached SSE clients (surfaced by /api/health). */
function getStreamClientCount() {
  return clients.size;
}

/**
 * Tear down every stream for a graceful shutdown. Open SSE responses hold their
 * sockets open, which would otherwise keep http.Server#close() from ever
 * completing — the same hazard closeWebSocket() exists to avoid.
 */
function closeAllStreams() {
  for (const client of [...clients]) dropClient(client);
  stopBridge();
}

module.exports = {
  addClient,
  closeAllStreams,
  getStreamClientCount,
  // exported for tests
  HEARTBEAT_MS,
  REPLAY_BUFFER_SIZE,
};
