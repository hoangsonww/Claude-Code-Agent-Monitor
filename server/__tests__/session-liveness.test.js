/**
 * @file Tests for the watchdog's process-liveness reap. A session whose
 * SessionEnd hook was lost (dashboard down when the user quit with Ctrl+C)
 * must be completed once no running `claude` CLI process has the session's
 * cwd — instead of sitting in Waiting until the 3 h stale sweep. Covers:
 *   - the claude-command matcher (`isClaudeCommand`),
 *   - probeLiveCwds shape + env escape hatch,
 *   - the reap itself: dead session → completed (agents completed, awaiting
 *     cleared, synthetic SessionEnd event), live session → untouched,
 *   - all fail-safe guards (probe unavailable, fresh activity, no cwd),
 *   - hook reactivation after a (hypothetical) false completion.
 * The probe is stubbed by swapping `liveness.probeLiveCwds` on the shared
 * module object — routes/hooks.js looks the function up at call time.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const STAMP = `liveness-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const CLAUDE_HOME = path.join(TMP, "home");
const DATA_DIR = path.join(TMP, "data");
const TEST_DB = path.join(TMP, "dashboard.db");
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = DATA_DIR;
// Keep the REAL probe inert for any watchdog interval tick that fires while
// this suite runs — stubbed probes below bypass this env check entirely.
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");
const liveness = require("../lib/session-liveness");
const hooksRouter = require("../routes/hooks");

const realProbe = liveness.probeLiveCwds;

const enc = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, "-");
const PROJECTS = path.join(CLAUDE_HOME, "projects");

function writeTranscript(cwd, sessionId, lines) {
  const p = path.join(PROJECTS, enc(cwd), `${sessionId}.jsonl`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.map((o) => JSON.stringify(o)).join("\n") + "\n");
  return p;
}

/** Backdate a session row + its transcript so the idle gate passes. */
function backdate(sessionId, tpath, ageMs = 10 * 60 * 1000) {
  const old = new Date(Date.now() - ageMs);
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(old.toISOString(), sessionId);
  if (tpath) fs.utimesSync(tpath, old, old);
}

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(b || "{}");
          } catch {
            parsed = b;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

/** Create a session + transcript via a real hook event, then backdate it. */
async function seedSession(sid, cwd, { old = true } = {}) {
  const tpath = writeTranscript(cwd, sid, [
    { type: "user", message: { role: "user", content: "hello" } },
  ]);
  const res = await req("POST", "/api/hooks/event", {
    hook_type: "Stop",
    data: { session_id: sid, cwd, transcript_path: tpath },
  });
  assert.equal(res.status, 200);
  if (old) backdate(sid, tpath);
  return tpath;
}

let server;
let BASE;

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  liveness.probeLiveCwds = realProbe;
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  liveness.probeLiveCwds = realProbe;
});

describe("isClaudeCommand — claude CLI process matcher", () => {
  const yes = [
    "claude",
    "claude --dangerously-skip-permissions",
    "/usr/local/bin/claude -p hello",
    "/Users/x/.local/bin/claude --resume abc",
    "node /Users/x/.nvm/versions/node/v22.0.0/bin/claude",
    "bun /opt/homebrew/bin/claude --model opus",
  ];
  const no = [
    "claude-mem --daemon",
    "/Applications/Claude.app/Contents/MacOS/Claude",
    "grep claude",
    "node /app/server/index.js",
    "node /Users/x/claude-dashboard/index.js",
    "tail -f claude.log",
    "",
  ];
  for (const cmd of yes) {
    it(`matches: ${cmd || "(empty)"}`, () => assert.equal(liveness.isClaudeCommand(cmd), true));
  }
  for (const cmd of no) {
    it(`rejects: ${cmd || "(empty)"}`, () => assert.equal(liveness.isClaudeCommand(cmd), false));
  }
});

describe("probeLiveCwds — probe availability", () => {
  it("returns a well-formed result without throwing", () => {
    delete process.env.DASHBOARD_LIVENESS_PROBE;
    try {
      const r = realProbe();
      assert.equal(typeof r.available, "boolean");
      assert.ok(r.cwds instanceof Set);
    } finally {
      process.env.DASHBOARD_LIVENESS_PROBE = "0";
    }
  });

  it("is disabled by DASHBOARD_LIVENESS_PROBE=0", () => {
    const r = realProbe(); // env is "0" for this whole suite
    assert.equal(r.available, false);
    assert.equal(r.cwds.size, 0);
  });

  it("is disabled inside a container (CCAM_FORCE_CONTAINER)", () => {
    delete process.env.DASHBOARD_LIVENESS_PROBE;
    process.env.CCAM_FORCE_CONTAINER = "1";
    try {
      assert.equal(realProbe().available, false);
    } finally {
      delete process.env.CCAM_FORCE_CONTAINER;
      process.env.DASHBOARD_LIVENESS_PROBE = "0";
    }
  });
});

describe("watchdog liveness reap", () => {
  it("completes an idle active session whose cwd has no live claude process", async () => {
    const sid = "dead0000-0000-0000-0000-000000000001";
    const cwd = "/tmp/liveness-dead";
    await seedSession(sid, cwd);
    assert.equal(stmts.getSession.get(sid).status, "active");
    assert.ok(stmts.getSession.get(sid).awaiting_input_since, "seeded as Waiting");

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.livenessReap();

    const sess = stmts.getSession.get(sid);
    assert.equal(sess.status, "completed");
    assert.ok(sess.ended_at, "ended_at stamped");
    assert.equal(sess.awaiting_input_since, null, "Waiting flag cleared");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.status, "completed");
    assert.equal(main.awaiting_input_since, null);
    const evt = db
      .prepare(
        "SELECT * FROM events WHERE session_id = ? AND event_type = 'SessionEnd' ORDER BY created_at DESC LIMIT 1"
      )
      .get(sid);
    assert.ok(evt, "synthetic SessionEnd event recorded");
    assert.match(evt.summary, /no running claude process/);
    assert.equal(JSON.parse(evt.data).source, "liveness-probe");
  });

  it("leaves a session alone when a claude process runs in its cwd", async () => {
    const sid = "live0000-0000-0000-0000-000000000002";
    const cwd = "/tmp/liveness-alive";
    await seedSession(sid, cwd);

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set([path.resolve(cwd)]) });
    hooksRouter.livenessReap();

    assert.equal(stmts.getSession.get(sid).status, "active");
  });

  it("does nothing when the probe is unavailable", async () => {
    const sid = "unav0000-0000-0000-0000-000000000003";
    const cwd = "/tmp/liveness-unavailable";
    await seedSession(sid, cwd);

    liveness.probeLiveCwds = () => ({ available: false, cwds: new Set() });
    hooksRouter.livenessReap();

    assert.equal(stmts.getSession.get(sid).status, "active");
  });

  it("spares sessions with recent activity (idle gate)", async () => {
    const sid = "frsh0000-0000-0000-0000-000000000004";
    const cwd = "/tmp/liveness-fresh";
    await seedSession(sid, cwd, { old: false }); // updated_at + mtime are NOW

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.livenessReap();

    assert.equal(stmts.getSession.get(sid).status, "active");
  });

  it("skips sessions without a cwd", async () => {
    const sid = "nocw0000-0000-0000-0000-000000000005";
    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid },
    });
    backdate(sid, null);

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.livenessReap();

    assert.equal(stmts.getSession.get(sid).status, "active");
  });

  it("does not touch error sessions", async () => {
    const sid = "errr0000-0000-0000-0000-000000000006";
    const cwd = "/tmp/liveness-error";
    const tpath = await seedSession(sid, cwd);
    stmts.updateSession.run(null, "error", null, null, sid);
    backdate(sid, tpath);

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.livenessReap();

    assert.equal(stmts.getSession.get(sid).status, "error");
  });

  it("a reaped session reactivates on the next hook event (self-heal)", async () => {
    const sid = "heal0000-0000-0000-0000-000000000007";
    const cwd = "/tmp/liveness-heal";
    const tpath = await seedSession(sid, cwd);

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.livenessReap();
    assert.equal(stmts.getSession.get(sid).status, "completed");

    const res = await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(res.status, 200);
    assert.equal(stmts.getSession.get(sid).status, "active");
    assert.equal(stmts.getAgent.get(`${sid}-main`).status, "working");
  });

  it("full watchdogCheck runs the reap end-to-end", async () => {
    const sid = "wdog0000-0000-0000-0000-000000000008";
    const cwd = "/tmp/liveness-watchdog";
    await seedSession(sid, cwd);

    liveness.probeLiveCwds = () => ({ available: true, cwds: new Set() });
    hooksRouter.watchdogCheck();

    assert.equal(stmts.getSession.get(sid).status, "completed");
  });
});
