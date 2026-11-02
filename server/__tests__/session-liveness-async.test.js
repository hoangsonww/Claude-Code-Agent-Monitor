/**
 * @file Checks asynchronous liveness decisions against delayed process censuses:
 * light HTTP remains responsive, concurrent checks share work, and intervening
 * hooks, ownership changes or agent activity prevent stale session completion.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-async-reap-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
const { db } = require("../db");
const liveness = require("../lib/session-liveness");
const hooks = require("../routes/hooks");
const http = require("node:http");
const { once } = require("node:events");
const original = liveness.probeLiveCwdsAsync;
const originalRollouts = liveness.probeLiveCodexRolloutsAsync;
let sequence = 0;
function seed() {
  const id = `async-${++sequence}`;
  db.prepare("INSERT INTO sessions(id,name,cwd,provider,updated_at) VALUES(?,?,?,'claude',?)").run(
    id,
    id,
    "/tmp/no-live-cli",
    "2020-01-01T00:00:00Z"
  );
  db.prepare("INSERT INTO agents(id,session_id,name,status) VALUES(?,?,?,'waiting')").run(
    id + "-main",
    id,
    id
  );
  return id;
}
function delayed() {
  let resolve,
    calls = 0;
  const answer = new Promise((r) => {
    resolve = r;
  });
  liveness.probeLiveCwdsAsync = () => {
    calls++;
    return answer;
  };
  return {
    complete: (value = { available: true, cwds: new Set() }) => resolve(value),
    calls: () => calls,
  };
}
beforeEach(() => {
  db.exec("DELETE FROM events; DELETE FROM agents; DELETE FROM sessions;");
});
afterEach(() => {
  liveness.probeLiveCwdsAsync = original;
  liveness.probeLiveCodexRolloutsAsync = originalRollouts;
});
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
it("a delayed census leaves HTTP usable and concurrent reap requests share one decision", async () => {
  const id = seed(),
    probe = delayed();
  const first = hooks.livenessReapAsync({ ignoreIdleGate: true });
  assert.equal(hooks.livenessReapAsync({ ignoreIdleGate: true }), first);
  const server = http.createServer((_req, res) => res.end("healthy"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    assert.equal(
      await (await fetch(`http://127.0.0.1:${server.address().port}`)).text(),
      "healthy"
    );
    assert.equal(probe.calls(), 1);
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
    probe.complete();
    await first;
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "completed");
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});
for (const [label, change] of [
  [
    "session activity",
    (id) =>
      db.prepare("UPDATE sessions SET updated_at=? WHERE id=?").run(new Date().toISOString(), id),
  ],
  [
    "new event without session timestamp",
    (id) =>
      db.prepare("INSERT INTO events(session_id,event_type)VALUES(?,'UserPromptSubmit')").run(id),
  ],
  [
    "agent-only activity",
    (id) =>
      db
        .prepare("UPDATE agents SET status='working',current_tool='Bash' WHERE session_id=?")
        .run(id),
  ],
  [
    "agent timestamp without session or event activity",
    (id) =>
      db
        .prepare("UPDATE agents SET updated_at=? WHERE session_id=?")
        .run(new Date().toISOString(), id),
  ],
  [
    "remote ownership",
    (id) => db.prepare("UPDATE sessions SET source='src_other' WHERE id=?").run(id),
  ],
  [
    "provider ownership",
    (id) => db.prepare("UPDATE sessions SET provider='codex' WHERE id=?").run(id),
  ],
  [
    "transcript replacement",
    (id) => {
      const file = path.join(root, "new.jsonl");
      fs.writeFileSync(file, "{}\n");
      db.prepare("UPDATE sessions SET transcript_path=?WHERE id=?").run(file, id);
    },
  ],
])
  it(`intervening ${label} fences a boot decision even when the idle gate is bypassed`, async () => {
    const id = seed(),
      probe = delayed();
    const pending = hooks.livenessReapAsync({ ignoreIdleGate: true });
    change(id);
    probe.complete();
    await pending;
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS n FROM events WHERE session_id=?AND event_type='SessionEnd'")
        .get(id).n,
      0
    );
  });
it("a boot reap is not served by an already pending idle-gated reap", async () => {
  const id = seed(),
    probe = delayed();
  const gated = hooks.livenessReapAsync();
  const boot = hooks.livenessReapAsync({ ignoreIdleGate: true });
  const joined = hooks.livenessReapAsync({ ignoreIdleGate: true });
  probe.complete();
  await Promise.all([gated, boot]);
  assert.notEqual(boot, gated, "the boot pass bypasses the idle gate, so it runs its own census");
  assert.equal(joined, boot);
  assert.equal(probe.calls(), 2);
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "completed");
});

it("unavailable census changes nothing and a later check starts a fresh census", async () => {
  const id = seed(),
    probe = delayed();
  const pending = hooks.livenessReapAsync();
  probe.complete({ available: false, cwds: new Set() });
  await pending;
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
  let calls = 0;
  liveness.probeLiveCwdsAsync = async () => {
    calls++;
    return { available: true, cwds: new Set() };
  };
  await hooks.livenessReapAsync();
  assert.equal(calls, 1);
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "completed");
});
it("a transcript appended at the same path fences an in-flight decision", async () => {
  const id = seed(),
    probe = delayed();
  const file = path.join(root, "growing.jsonl");
  fs.writeFileSync(file, "{}\n");
  db.prepare("UPDATE sessions SET transcript_path=? WHERE id=?").run(file, id);
  const pending = hooks.livenessReapAsync({ ignoreIdleGate: true });
  fs.appendFileSync(file, '{"activity":true}\n');
  probe.complete();
  await pending;
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
});
it("an unreadable transcript never counts as an unchanged missing transcript", async () => {
  const id = seed(),
    probe = delayed();
  const file = path.join(root, "unreadable.jsonl");
  db.prepare("UPDATE sessions SET transcript_path=? WHERE id=?").run(file, id);
  const originalStat = fs.statSync;
  fs.statSync = (candidate, ...options) => {
    if (candidate === file) throw Object.assign(new Error("denied"), { code: "EACCES" });
    return originalStat(candidate, ...options);
  };
  try {
    const pending = hooks.livenessReapAsync({ ignoreIdleGate: true });
    probe.complete();
    await pending;
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
  } finally {
    fs.statSync = originalStat;
  }
});
it("a session arriving during the census is deferred to a fresh census", async () => {
  seed();
  const probe = delayed();
  const pending = hooks.livenessReapAsync({ ignoreIdleGate: true });
  const id = seed();
  probe.complete();
  await pending;
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
});
it("Codex boot reaping starts its own census after an older discovery has begun", async () => {
  let resolveDiscovery,
    calls = 0;
  const discovery = new Promise((resolve) => {
    resolveDiscovery = resolve;
  });
  const file = path.join(root, "rollout-active.jsonl");
  fs.writeFileSync(file, "{}\n");
  liveness.probeLiveCodexRolloutsAsync = () => {
    calls++;
    return calls === 1 ? discovery : Promise.resolve({ available: true, paths: new Set([file]) });
  };
  const older = liveness.probeLiveCodexRolloutsAsync();
  const id = seed();
  db.prepare("UPDATE sessions SET provider='codex',transcript_path=? WHERE id=?").run(file, id);
  liveness.probeLiveCwdsAsync = async () => ({ available: true, cwds: new Set() });
  await hooks.livenessReapAsync({ provider: "codex", ignoreIdleGate: true });
  resolveDiscovery({ available: true, paths: new Set() });
  await older;
  assert.equal(calls, 2);
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
});
