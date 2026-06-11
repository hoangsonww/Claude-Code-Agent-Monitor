/**
 * @file run.test.js
 * @description Tests for the Run feature: spawner injection, route
 * validation, same-origin guard, cwd suggestions, resume validation,
 * envelope storage / attach, and end-to-end handle lifecycle. Uses a fake
 * child (PassThrough streams + EventEmitter) so we never invoke the real
 * `claude` binary.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const { PassThrough } = require("node:stream");
const { EventEmitter } = require("node:events");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "run-test-"));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");

const { createApp } = require("../index");
const runs = require("../lib/run-spawner");
const runRoute = require("../routes/run");

let server;
let BASE;

function fetchJson(p, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, BASE);
    const headers = { ...(opts.headers || {}) };
    let body;
    if (opts.body !== undefined) {
      body = Buffer.from(JSON.stringify(opts.body));
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = body.length;
    }
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: opts.method || "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.killed = false;
  child.kill = function (sig) {
    this.killed = true;
    setImmediate(() => this.emit("exit", sig === "SIGTERM" ? 143 : 0, sig || null));
  };
  return child;
}

describe("/api/run", () => {
  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    BASE = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    // The SQLite DB lives under TMP and better-sqlite3 holds it open, so on
    // Windows rmSync hits EPERM (can't remove a dir with an open handle).
    // maxRetries covers transient locks; the try/catch makes the rest
    // best-effort — a leftover temp dir must not fail the suite (the OS
    // reclaims os.tmpdir()).
    try {
      fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      /* best-effort temp cleanup */
    }
  });

  beforeEach(() => {
    runs.__reset();
  });

  it("rejects cross-origin browser requests", async () => {
    const { status, body } = await fetchJson("/api/run", {
      headers: { Origin: "http://evil.example.com" },
    });
    assert.equal(status, 403);
    assert.equal(body.error.code, "EBADORIGIN");
  });

  it("allows requests with no Origin (CLI/curl)", async () => {
    const { status, body } = await fetchJson("/api/run");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
  });

  it("allows localhost Origin", async () => {
    const { status } = await fetchJson("/api/run", {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(status, 200);
  });

  it("POST / requires prompt", async () => {
    const { status, body } = await fetchJson("/api/run", { method: "POST", body: {} });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADPROMPT");
  });

  it("POST / rejects non-existent cwd", async () => {
    const { status, body } = await fetchJson("/api/run", {
      method: "POST",
      body: { prompt: "hi", mode: "headless", cwd: "/nope/does/not/exist" },
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADCWD");
  });

  it("POST / rejects relative cwd", async () => {
    const { status, body } = await fetchJson("/api/run", {
      method: "POST",
      body: { prompt: "hi", mode: "headless", cwd: "./relative" },
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADCWD");
  });

  it("GET /:id returns 404 for unknown id", async () => {
    const { status, body } = await fetchJson("/api/run/does-not-exist");
    assert.equal(status, 404);
    assert.equal(body.error.code, "ENOTFOUND");
  });

  it("DELETE /:id returns 404 for unknown id", async () => {
    const { status } = await fetchJson("/api/run/does-not-exist", { method: "DELETE" });
    assert.equal(status, 404);
  });

  it("POST /:id/message rejects empty text", async () => {
    const { status, body } = await fetchJson("/api/run/x/message", {
      method: "POST",
      body: {},
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADINPUT");
  });

  // ── /api/run/cwds suggestions ─────────────────────────────────────

  it("GET /cwds returns dashboard + home suggestions with absolute paths", async () => {
    const { status, body } = await fetchJson("/api/run/cwds");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
    const kinds = body.items.map((i) => i.kind);
    assert.ok(kinds.includes("dashboard"), "dashboard cwd present");
    assert.ok(kinds.includes("home"), "home present");
    for (const it of body.items) {
      assert.equal(typeof it.path, "string");
      // path.isAbsolute is platform-aware: "/x" on POSIX, "C:\\x" on Windows.
      assert.ok(path.isAbsolute(it.path), "absolute path");
      assert.equal(typeof it.label, "string");
    }
  });

  // ── /api/run/binary probe ─────────────────────────────────────────

  it("GET /binary returns shape { found, path }", async () => {
    const { status, body } = await fetchJson("/api/run/binary");
    assert.equal(status, 200);
    assert.equal(typeof body.found, "boolean");
    if (body.found) assert.equal(typeof body.path, "string");
  });

  // ── Resume validation ─────────────────────────────────────────────

  it("POST / rejects bad resumeSessionId format", async () => {
    const { status, body } = await fetchJson("/api/run", {
      method: "POST",
      body: { prompt: "hi", mode: "conversation", resumeSessionId: "x" },
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADSESSION");
  });

  it("POST / rejects unknown effort level", async () => {
    const { status, body } = await fetchJson("/api/run", {
      method: "POST",
      body: { prompt: "hi", mode: "conversation", effort: "ludicrous" },
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADEFFORT");
  });

  it("POST / rejects resumeSessionId with headless mode", async () => {
    const { status, body } = await fetchJson("/api/run", {
      method: "POST",
      body: {
        prompt: "hi",
        mode: "headless",
        resumeSessionId: "deadbeef-cafe-1234-5678-feedfacefeed",
      },
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADMODE");
  });

  // ── HTTP GET /:id?envelopes=1 (attach payload) ────────────────────

  it("GET /:id?envelopes=1 returns the in-memory envelope log", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(`{"type":"system","subtype":"init","session_id":"sX"}\n`);
    await new Promise((r) => setImmediate(r));
    const { status, body } = await fetchJson(`/api/run/${handle.id}?envelopes=1`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.envelopes));
    assert.equal(body.envelopes.length, 1);
    assert.equal(body.envelopes[0].type, "system");
  });

  it("GET /files returns paths matching q, skipping node_modules", async () => {
    // Build a tiny fixture under tmp so the test is hermetic.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-files-"));
    fs.mkdirSync(path.join(tmp, "src"));
    fs.mkdirSync(path.join(tmp, "node_modules", "leftover-pkg"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "README.md"), "x");
    fs.writeFileSync(path.join(tmp, "src", "index.ts"), "x");
    fs.writeFileSync(path.join(tmp, "node_modules", "leftover-pkg", "x.js"), "x");
    try {
      const { status, body } = await fetchJson(
        `/api/run/files?cwd=${encodeURIComponent(tmp)}&q=index`
      );
      assert.equal(status, 200);
      assert.deepEqual(body.items.sort(), ["src/index.ts"]);
      // No q → returns top-level files (excluding node_modules)
      const all = await fetchJson(`/api/run/files?cwd=${encodeURIComponent(tmp)}`);
      assert.ok(all.body.items.includes("README.md"));
      assert.ok(!all.body.items.some((p) => p.startsWith("node_modules")));
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        /* best-effort temp cleanup (Windows may hold a handle) */
      }
    }
  });

  it("GET /files rejects missing/invalid cwd", async () => {
    const { status, body } = await fetchJson("/api/run/files?cwd=/does/not/exist");
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADCWD");
  });

  it("GET /:id without ?envelopes returns metadata only", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(`{"type":"system","subtype":"init"}\n`);
    await new Promise((r) => setImmediate(r));
    const { body } = await fetchJson(`/api/run/${handle.id}`);
    assert.equal(body.envelopes, undefined);
    assert.equal(body.envelopeCount, 1);
  });
});

describe("run-spawner unit", () => {
  beforeEach(() => {
    runs.__reset();
  });

  it("injected child parses stream-json envelopes and broadcasts", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(
      `{"type":"system","subtype":"init","session_id":"sess-abc","model":"opus"}\n`
    );
    fake.stdout.write(`{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n`);
    // Allow the line parser to flush
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.equal(live.status, "running");
    assert.equal(live.sessionId, "sess-abc");
    assert.equal(live.envelopeCount, 2);
  });

  it("sendInput writes a stream-json envelope to stdin", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    // Force into running state via a parsed envelope first
    fake.stdout.write(`{"type":"system","subtype":"init","session_id":"s1"}\n`);
    await new Promise((r) => setImmediate(r));
    const chunks = [];
    fake.stdin.on("data", (c) => chunks.push(c.toString()));
    runs.sendInput(handle.id, "follow-up");
    await new Promise((r) => setImmediate(r));
    const written = chunks.join("");
    const lines = written.trim().split("\n");
    const obj = JSON.parse(lines[lines.length - 1]);
    assert.equal(obj.type, "user");
    assert.equal(obj.message.content, "follow-up");
  });

  it("sendInput rejects on headless handles", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "headless" });
    fake.stdout.write(`{"type":"system","subtype":"init"}\n`);
    await new Promise((r) => setImmediate(r));
    assert.throws(() => runs.sendInput(handle.id, "x"), /only conversation mode/);
  });

  it("kill marks handle as killed and emits exit", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake });
    runs.killRun(handle.id);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.equal(live.status, "killed");
  });

  it("exit with code 0 marks completed", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake });
    fake.emit("exit", 0, null);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.equal(live.status, "completed");
    assert.equal(live.exitCode, 0);
  });

  it("exit with non-zero code marks error", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake });
    fake.emit("exit", 1, null);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.equal(live.status, "error");
  });

  it("malformed JSON lines do not crash; go to stderr buffer", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake });
    fake.stdout.write("not valid json\n");
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.match(live.stderrTail, /parse-error/);
  });

  it("listRuns returns handles sorted newest first", async () => {
    const a = runs.__injectChildForTest({ child: makeFakeChild() });
    await new Promise((r) => setTimeout(r, 5));
    const b = runs.__injectChildForTest({ child: makeFakeChild() });
    const list = runs.listRuns();
    assert.equal(list[0].id, b.id);
    assert.equal(list[1].id, a.id);
  });
});

describe("sameOriginGuard helper", () => {
  it("loopback Origin passes", () => {
    const next = () => "OK";
    const res = {};
    const result = runRoute.__sameOriginGuard(
      { headers: { origin: "http://127.0.0.1:4820" } },
      res,
      next
    );
    assert.equal(result, "OK");
  });
  it("missing Origin passes (CLI use case)", () => {
    const next = () => "OK";
    const result = runRoute.__sameOriginGuard({ headers: {} }, {}, next);
    assert.equal(result, "OK");
  });
  it("non-loopback Origin is blocked", () => {
    let captured = null;
    const res = {
      status(code) {
        captured = { code };
        return this;
      },
      json(body) {
        captured.body = body;
        return this;
      },
    };
    runRoute.__sameOriginGuard({ headers: { origin: "http://attacker.com" } }, res, () => {});
    assert.equal(captured.code, 403);
    assert.equal(captured.body.error.code, "EBADORIGIN");
  });
});

describe("run-spawner extras", () => {
  beforeEach(() => {
    runs.__reset();
  });

  it("getRun (no opts) returns metadata only — no envelopes field", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(`{"type":"system","subtype":"init","session_id":"s1"}\n`);
    fake.stdout.write(`{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n`);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id);
    assert.equal(live.envelopeCount, 2);
    assert.equal(live.envelopes, undefined);
  });

  it("getRun({includeEnvelopes:true}) returns the in-memory log", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(`{"type":"system","subtype":"init"}\n`);
    fake.stdout.write(`{"type":"assistant","message":{"content":[{"type":"text","text":"x"}]}}\n`);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id, { includeEnvelopes: true });
    assert.ok(Array.isArray(live.envelopes));
    assert.equal(live.envelopes.length, 2);
    assert.equal(live.envelopes[0].type, "system");
  });

  it("listRuns surfaces resumeSessionId (null for fresh)", async () => {
    runs.__injectChildForTest({ child: makeFakeChild(), mode: "conversation" });
    const list = runs.listRuns();
    assert.equal(list.length, 1);
    assert.equal(list[0].resumeSessionId, null);
  });

  it("killRun is idempotent on already-completed handles", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake });
    fake.emit("exit", 0, null);
    await new Promise((r) => setImmediate(r));
    assert.equal(runs.getRun(handle.id).status, "completed");
    // Second kill on a completed handle should be a safe no-op (returns true).
    assert.equal(runs.killRun(handle.id), true);
    assert.equal(runs.getRun(handle.id).status, "completed");
  });

  it("killRun returns false for an unknown id", () => {
    assert.equal(runs.killRun("does-not-exist"), false);
  });

  it("sendInput throws ENOTFOUND for unknown id", () => {
    assert.throws(() => runs.sendInput("nope", "hi"), /not found/);
  });

  it("sendInput throws ENOTRUNNING when handle has already exited", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.emit("exit", 0, null);
    await new Promise((r) => setImmediate(r));
    assert.throws(() => runs.sendInput(handle.id, "x"), /run is (completed|killed|error)/);
  });

  it("sendInput rejects empty text", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    fake.stdout.write(`{"type":"system","subtype":"init"}\n`);
    await new Promise((r) => setImmediate(r));
    assert.throws(() => runs.sendInput(handle.id, ""), /text is required/);
  });

  it("envelope log is capped at 500 entries", async () => {
    const fake = makeFakeChild();
    const handle = runs.__injectChildForTest({ child: fake, mode: "conversation" });
    let line = "";
    for (let i = 0; i < 600; i++) line += `{"type":"assistant","i":${i}}\n`;
    fake.stdout.write(line);
    await new Promise((r) => setImmediate(r));
    const live = runs.getRun(handle.id, { includeEnvelopes: true });
    assert.equal(live.envelopeCount, 600);
    assert.equal(live.envelopes.length, 500);
    // The cap drops the OLDEST entries — last entry should be the latest.
    assert.equal(live.envelopes[live.envelopes.length - 1].i, 599);
  });

  it("getMaxConcurrent respects RUN_MAX_CONCURRENT env override", () => {
    const orig = process.env.RUN_MAX_CONCURRENT;
    try {
      process.env.RUN_MAX_CONCURRENT = "7";
      assert.equal(runs.getMaxConcurrent(), 7);
      process.env.RUN_MAX_CONCURRENT = "garbage";
      assert.ok(runs.getMaxConcurrent() >= 1, "falls back to default on non-numeric");
      delete process.env.RUN_MAX_CONCURRENT;
      assert.ok(runs.getMaxConcurrent() >= 1);
    } finally {
      if (orig != null) process.env.RUN_MAX_CONCURRENT = orig;
      else delete process.env.RUN_MAX_CONCURRENT;
    }
  });
});
