// server/__tests__/spawner-extended.test.js
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

let captured = [];
function setupBroadcastMock() {
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: {
      broadcast: (type, data) => captured.push({ type, data }),
      initWebSocket: () => {},
      getConnectionCount: () => 0,
    },
  };
}

function fakeChild() {
  const c = new EventEmitter();
  c.pid = Math.floor(Math.random() * 9999) + 1;
  c.stdin = { writable: true, write(s) { this._last = s; } };
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kill = () => { c.killed = true; };
  c.killed = false;
  return c;
}

describe("spawner — sendMessage and broadcast", () => {
  beforeEach(() => {
    captured = [];
    setupBroadcastMock();
    delete require.cache[require.resolve("../lib/spawner")];
  });

  it("sendMessage writes a stream-json user message to stdin", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const child = fakeChild();
    const handle = spawnAgent.__injectChildForTest(child, { prompt: "hi" });
    handle.status = "running";
    sendMessage(handle.id, "next message");
    assert.match(child.stdin._last, /"role":"user"/);
    assert.match(child.stdin._last, /"next message"/);
    assert.ok(child.stdin._last.endsWith("\n"));
  });

  it("emits agent_stream WS broadcasts for each parsed JSON line", () => {
    const { spawnAgent } = require("../lib/spawner");
    const child = fakeChild();
    const handle = spawnAgent.__injectChildForTest(child, { prompt: "x" });
    child.stdout.emit("data", '{"type":"assistant","text":"hello"}\n');
    const streams = captured.filter((c) => c.type === "agent_stream");
    assert.equal(streams.length, 1);
    assert.equal(streams[0].data.sessionId, handle.id);
    assert.deepEqual(streams[0].data.chunk, { type: "assistant", text: "hello" });
  });

  it("emits agent_input_ack broadcast when sendMessage succeeds", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const handle = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "x" });
    handle.status = "running";
    sendMessage(handle.id, "follow-up");
    const ack = captured.find((c) => c.type === "agent_input_ack");
    assert.ok(ack);
    assert.equal(ack.data.sessionId, handle.id);
  });

  it("rejects sendMessage when status is not running", () => {
    const { spawnAgent, sendMessage } = require("../lib/spawner");
    const handle = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "x" });
    handle.status = "completed";
    assert.throws(() => sendMessage(handle.id, "late"), /not accepting input/);
  });
});

describe("spawner — concurrency cap", () => {
  beforeEach(() => {
    captured = [];
    setupBroadcastMock();
  });
  it("throws once cap reached", () => {
    process.env.ORCHESTRATOR_MAX_CONCURRENT = "2";
    delete require.cache[require.resolve("../lib/spawner")];
    const { spawnAgent } = require("../lib/spawner");
    const a = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "1" });
    a.status = "running";
    const b = spawnAgent.__injectChildForTest(fakeChild(), { prompt: "2" });
    b.status = "running";
    assert.throws(
      () => spawnAgent({ profile: {}, perLaunch: { prompt: "3", cwd: process.cwd() } }),
      /concurrency limit/,
    );
  });
});
