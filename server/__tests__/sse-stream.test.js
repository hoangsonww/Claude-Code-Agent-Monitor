/**
 * @file Tests for the Server-Sent Events mirror of the realtime feed
 * (GET /api/events/stream): frame shape and parity with the WebSocket
 * envelope, server-side `?types=` filtering, the concurrent-client cap,
 * Last-Event-ID replay including the stream_gap signal, client accounting in
 * /api/stats, and teardown that lets the HTTP server actually close.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-sse-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const { broadcast } = require("../websocket");
const { closeAllStreams, getStreamClientCount } = require("../lib/sse");

let server;
let PORT;

/**
 * Open an SSE connection and collect raw frames. Resolves once the response
 * headers arrive so a test can assert on them before any event is broadcast.
 */
function openStream(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, path: pathname, method: "GET", headers },
      (res) => {
        let buffer = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buffer += chunk;
        });
        resolve({
          status: res.statusCode,
          headers: res.headers,
          /** Everything received so far, split into complete SSE frames. */
          frames: () =>
            buffer
              .split("\n\n")
              .filter((f) => f.trim().length > 0)
              .map((f) => f + "\n\n"),
          raw: () => buffer,
          close: () => {
            req.destroy();
            res.destroy();
          },
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: "127.0.0.1", port: PORT, path: pathname }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

/** Let the event loop flush pending socket writes. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 60));

/** Parse one SSE frame into its id / event / data parts. */
function parseFrame(frame) {
  const out = { id: null, event: null, data: null, comment: null };
  for (const line of frame.split("\n")) {
    if (line.startsWith(": ")) out.comment = line.slice(2);
    else if (line.startsWith("id: ")) out.id = parseInt(line.slice(4), 10);
    else if (line.startsWith("event: ")) out.event = line.slice(7);
    else if (line.startsWith("data: ")) out.data = JSON.parse(line.slice(6));
  }
  return out;
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  PORT = server.address().port;
});

beforeEach(() => {
  closeAllStreams();
});

after(() => {
  closeAllStreams();
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

describe("SSE event stream", () => {
  it("responds with streaming headers and an immediate connected comment", async () => {
    const stream = await openStream("/api/events/stream");
    assert.equal(stream.status, 200);
    assert.match(stream.headers["content-type"], /text\/event-stream/);
    assert.match(stream.headers["cache-control"], /no-cache/);
    assert.match(stream.headers["cache-control"], /no-transform/);
    assert.equal(stream.headers["x-accel-buffering"], "no");

    await flush();
    assert.match(stream.raw(), /^: connected/);
    stream.close();
  });

  it("delivers a broadcast as an SSE frame carrying the WebSocket envelope", async () => {
    const stream = await openStream("/api/events/stream");
    await flush();

    broadcast("new_event", { id: 42, event_type: "PreToolUse", tool_name: "Bash" });
    await flush();

    const frame = stream
      .frames()
      .map(parseFrame)
      .find((f) => f.event === "new_event");
    assert.ok(frame, "expected a new_event frame");
    assert.ok(Number.isInteger(frame.id) && frame.id > 0);
    // Byte-identical to what a WebSocket client receives.
    assert.equal(frame.data.type, "new_event");
    assert.equal(frame.data.data.id, 42);
    assert.equal(frame.data.data.tool_name, "Bash");
    assert.match(frame.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    stream.close();
  });

  it("filters server-side when ?types= is given", async () => {
    const stream = await openStream("/api/events/stream?types=session_created,session_updated");
    await flush();

    broadcast("new_event", { id: 1 });
    broadcast("session_created", { id: "sess_1" });
    broadcast("agent_updated", { id: "agent_1" });
    broadcast("session_updated", { id: "sess_1" });
    await flush();

    const events = stream
      .frames()
      .map(parseFrame)
      .filter((f) => f.event)
      .map((f) => f.event);
    assert.deepEqual(events, ["session_created", "session_updated"]);
    stream.close();
  });

  it("forwards every type when no filter is given", async () => {
    const stream = await openStream("/api/events/stream");
    await flush();

    broadcast("new_event", { id: 1 });
    broadcast("agent_updated", { id: "agent_1" });
    await flush();

    const events = stream
      .frames()
      .map(parseFrame)
      .filter((f) => f.event)
      .map((f) => f.event);
    assert.deepEqual(events, ["new_event", "agent_updated"]);
    stream.close();
  });

  it("counts attached clients and releases them on disconnect", async () => {
    assert.equal(getStreamClientCount(), 0);

    const a = await openStream("/api/events/stream");
    const b = await openStream("/api/events/stream");
    await flush();
    assert.equal(getStreamClientCount(), 2);

    const stats = await getJson("/api/stats");
    assert.equal(stats.body.sse_connections, 2);

    a.close();
    b.close();
    await flush();
    assert.equal(getStreamClientCount(), 0);
  });

  it("refuses connections past DASHBOARD_SSE_MAX_CLIENTS with a structured error", async () => {
    const previous = process.env.DASHBOARD_SSE_MAX_CLIENTS;
    process.env.DASHBOARD_SSE_MAX_CLIENTS = "1";
    try {
      const first = await openStream("/api/events/stream");
      await flush();
      assert.equal(first.status, 200);

      const second = await openStream("/api/events/stream");
      assert.equal(second.status, 503);
      await flush();
      const body = JSON.parse(second.raw());
      assert.equal(body.error.code, "STREAM_LIMIT");

      first.close();
      await flush();

      // Capacity is returned once the first client leaves.
      const third = await openStream("/api/events/stream");
      assert.equal(third.status, 200);
      third.close();
    } finally {
      if (previous == null) delete process.env.DASHBOARD_SSE_MAX_CLIENTS;
      else process.env.DASHBOARD_SSE_MAX_CLIENTS = previous;
    }
  });

  it("replays missed events for a Last-Event-ID reconnect", async () => {
    const first = await openStream("/api/events/stream");
    await flush();
    broadcast("new_event", { id: 100 });
    await flush();

    const seen = first
      .frames()
      .map(parseFrame)
      .find((f) => f.event === "new_event");
    const lastId = seen.id;
    first.close();
    await flush();

    // Events broadcast while nobody is connected are not buffered — the hub
    // detaches from the bus with its last client — so reconnect first, then
    // verify the replay path with a client that drops mid-stream.
    const live = await openStream("/api/events/stream");
    await flush();
    broadcast("new_event", { id: 101 });
    broadcast("agent_updated", { id: "agent_x" });
    await flush();

    const liveFrames = live.frames().map(parseFrame);
    const firstLiveId = liveFrames.find((f) => f.event === "new_event").id;

    const resumed = await openStream("/api/events/stream", {
      "Last-Event-ID": String(firstLiveId - 1),
    });
    await flush();

    const replayed = resumed
      .frames()
      .map(parseFrame)
      .filter((f) => f.event && f.event !== "stream_gap");
    assert.ok(
      replayed.some((f) => f.event === "new_event" && f.data.data.id === 101),
      "expected the missed new_event to be replayed"
    );
    assert.ok(replayed.every((f) => f.id > firstLiveId - 1));
    assert.ok(lastId > 0);

    live.close();
    resumed.close();
  });

  it("does not replay events broadcast while no client was attached", async () => {
    // The hub detaches from the bus with its last client and discards the ring,
    // so a zero-client period is a permanent gap. This is the documented
    // contract (docs/API.md), not an accident — assert it so a future change to
    // the lazy-subscription behavior has to update the docs too.
    const first = await openStream("/api/events/stream");
    await flush();
    broadcast("new_event", { id: 300 });
    await flush();
    const lastId = first
      .frames()
      .map(parseFrame)
      .find((f) => f.event === "new_event").id;
    first.close();
    await flush();
    assert.equal(getStreamClientCount(), 0);

    // Broadcast into an empty hub — nothing is buffered.
    broadcast("new_event", { id: 301 });
    await flush();

    const resumed = await openStream("/api/events/stream", {
      "Last-Event-ID": String(lastId),
    });
    await flush();

    const frames = resumed.frames().map(parseFrame);
    assert.equal(
      frames.filter((f) => f.event === "new_event").length,
      0,
      "events broadcast with no client attached must not be replayed"
    );
    // And no stream_gap either — the hub has no record of what it missed.
    assert.equal(frames.filter((f) => f.event === "stream_gap").length, 0);
    resumed.close();
  });

  it("signals stream_gap when the requested Last-Event-ID predates the buffer", async () => {
    const live = await openStream("/api/events/stream");
    await flush();
    broadcast("new_event", { id: 200 });
    await flush();

    // Ask to resume from an id far older than anything the hub still holds.
    const resumed = await openStream("/api/events/stream", { "Last-Event-ID": "1" });
    await flush();

    const gap = resumed
      .frames()
      .map(parseFrame)
      .find((f) => f.event === "stream_gap");
    assert.ok(gap, "expected a stream_gap frame");
    assert.equal(gap.data.last_event_id, 1);
    assert.ok(gap.data.oldest_available_id > 2);

    live.close();
    resumed.close();
  });

  it("ignores a malformed Last-Event-ID instead of failing the connection", async () => {
    const stream = await openStream("/api/events/stream", { "Last-Event-ID": "not-a-number" });
    assert.equal(stream.status, 200);
    await flush();
    assert.match(stream.raw(), /^: connected/);
    stream.close();
  });

  it("closeAllStreams() detaches every client", async () => {
    const a = await openStream("/api/events/stream");
    const b = await openStream("/api/events/stream");
    await flush();
    assert.equal(getStreamClientCount(), 2);

    closeAllStreams();
    assert.equal(getStreamClientCount(), 0);

    // Broadcasting after teardown must not throw.
    broadcast("new_event", { id: 1 });
    a.close();
    b.close();
  });
});
