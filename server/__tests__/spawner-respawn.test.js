// server/__tests__/spawner-respawn.test.js
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

let captured = [];
function setupBroadcastMock() {
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: { broadcast: (type, data) => captured.push({ type, data }), initWebSocket: () => {}, getConnectionCount: () => 0 },
  };
}

function fakeChild() {
  const c = new EventEmitter();
  c.pid = Math.floor(Math.random() * 9999) + 1;
  c.stdin = { writable: true, write(s) { this._last = s; } };
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.killed = false;
  c.kill = () => {
    c.killed = true;
    setImmediate(() => c.emit("exit", 0));
  };
  return c;
}

describe("respawnAgent", () => {
  beforeEach(() => {
    captured = [];
    setupBroadcastMock();
    delete require.cache[require.resolve("../lib/spawner")];
  });

  it("kills the old child, spawns a new one with the new config, returns new handle", async () => {
    const sp = require("../lib/spawner");
    const oldChild = fakeChild();
    const oldHandle = sp.spawnAgent.__injectChildForTest(oldChild, { prompt: "first", cwd: "/tmp" });
    oldHandle.status = "running";

    // Inject a stub spawner so respawn doesn't shell out
    const newChild = fakeChild();
    sp.__setSpawnImplForTest(() => newChild);

    const newHandle = await sp.respawnAgent({
      id: oldHandle.id,
      profile: { model: "opus" },
      perLaunch: { prompt: "next", cwd: "/tmp", resumeSessionId: "s-1" },
    });

    assert.notEqual(newHandle.id, oldHandle.id);
    assert.equal(newHandle.pid, newChild.pid);
    assert.ok(oldChild.killed);
    assert.equal(sp.getAgent(oldHandle.id), undefined);
    assert.equal(sp.getAgent(newHandle.id).id, newHandle.id);

    const respawned = captured.find((c) => c.type === "agent_respawned");
    assert.ok(respawned);
    assert.equal(respawned.data.oldHandleId, oldHandle.id);
    assert.equal(respawned.data.newHandleId, newHandle.id);
  });

  it("throws when the handle id is unknown", async () => {
    const sp = require("../lib/spawner");
    sp.__setSpawnImplForTest(() => fakeChild());
    await assert.rejects(
      () => sp.respawnAgent({ id: "nope", profile: {}, perLaunch: { prompt: "x", cwd: "/tmp" } }),
      /agent not found/,
    );
  });
});
