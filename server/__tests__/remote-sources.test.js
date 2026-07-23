/**
 * @file Tests for the Remote Data Sources feature: input validation + command
 * builders in server/lib/remote-sync.js, the /api/remote-sources route CRUD, and
 * the source-scoped data filter threaded through the sessions/events/agents/
 * stats/analytics endpoints. The actual SSH/rsync transfer is not exercised
 * (that needs a live remote); everything up to and around it is.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

// Isolate the DB and disable background pollers/probes before loading server.
const TEST_DB = path.join(os.tmpdir(), `dashboard-remote-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");
const remoteSync = require("../lib/remote-sync");
const sourceFilter = require("../lib/source-filter");

let server;
let BASE;

function fetchJson(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}
const get = (p) => fetchJson(p);
const post = (p, body) => fetchJson(p, { method: "POST", body });
const patch = (p, body) => fetchJson(p, { method: "PATCH", body });
const del = (p) => fetchJson(p, { method: "DELETE" });

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("remote-sync validateSourceInput", () => {
  it("accepts a valid full config and expands ~ in identity_file", () => {
    const v = remoteSync.validateSourceInput({
      label: "Dev Box",
      host: "son@dev.local",
      ssh_port: 22,
      identity_file: "~/.ssh/id_ed25519",
      remote_home: "~/.claude",
    });
    assert.equal(v.label, "Dev Box");
    assert.equal(v.host, "son@dev.local");
    assert.equal(v.sshPort, 22);
    assert.ok(path.isAbsolute(v.identityFile));
    assert.equal(v.remoteHome, "~/.claude");
  });

  it("accepts a config-alias host with no user", () => {
    const v = remoteSync.validateSourceInput({ label: "x", host: "mybox" });
    assert.equal(v.host, "mybox");
  });

  const rejects = [
    [
      "leading-dash host (ssh option injection)",
      { label: "x", host: "-oProxyCommand=evil" },
      "INVALID_HOST",
    ],
    ["host with space", { label: "x", host: "a b" }, "INVALID_HOST"],
    ["host with ;", { label: "x", host: "a;rm -rf /" }, "INVALID_HOST"],
    ["host with : (breaks rsync spec)", { label: "x", host: "a:b" }, "INVALID_HOST"],
    ["missing label", { host: "a" }, "INVALID_LABEL"],
    ["port out of range", { label: "x", host: "a", ssh_port: 99999 }, "INVALID_PORT"],
    [
      "remote_home with ..",
      { label: "x", host: "a", remote_home: "~/../etc" },
      "INVALID_REMOTE_HOME",
    ],
    [
      "relative remote_home",
      { label: "x", host: "a", remote_home: "rel/path" },
      "INVALID_REMOTE_HOME",
    ],
    [
      "identity_file with newline",
      { label: "x", host: "a", identity_file: "/a\nb" },
      "INVALID_IDENTITY_FILE",
    ],
  ];
  for (const [name, input, code] of rejects) {
    it(`rejects ${name}`, () => {
      assert.throws(
        () => remoteSync.validateSourceInput(input),
        (err) => err.code === code
      );
    });
  }

  it("allows hyphens inside an identity_file path", () => {
    const v = remoteSync.validateSourceInput({
      label: "x",
      host: "a",
      identity_file: "/home/u/.ssh/id-ed25519",
    });
    assert.equal(v.identityFile, "/home/u/.ssh/id-ed25519");
  });
});

describe("remote-sync command builders", () => {
  it("builds ssh option args with port + identity", () => {
    const args = remoteSync.sshOptionArgs({ ssh_port: 2222, identity_file: "/k" });
    assert.deepEqual(args, [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      "-p",
      "2222",
      "-i",
      "/k",
      "-o",
      "IdentitiesOnly=yes",
    ]);
  });
  it("defaults the remote projects path to ~/.claude/projects", () => {
    assert.equal(remoteSync.remoteProjectsPath({}), "~/.claude/projects");
    assert.equal(remoteSync.remoteProjectsPath({ remote_home: "/opt/cc" }), "/opt/cc/projects");
  });
  it("identifies top-level session ids in a mirrored tree (skips subagents)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-staged-"));
    const proj = path.join(dir, "-Users-x-proj");
    fs.mkdirSync(path.join(proj, "sess-1", "subagents"), { recursive: true });
    fs.writeFileSync(path.join(proj, "sess-1.jsonl"), "{}\n");
    fs.writeFileSync(path.join(proj, "sess-2.jsonl"), "{}\n");
    fs.writeFileSync(path.join(proj, "sess-1", "subagents", "agent-abc.jsonl"), "{}\n");
    const ids = remoteSync.stagedSessionIds(dir).sort();
    assert.deepEqual(ids, ["sess-1", "sess-2"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── source-filter helper ────────────────────────────────────────────────────

describe("source-filter helper", () => {
  it("parses the sources csv, deduped; empty/absent → null", () => {
    assert.deepEqual(sourceFilter.parseSources({ query: { sources: "local, a ,a,," } }), [
      "local",
      "a",
    ]);
    assert.equal(sourceFilter.parseSources({ query: {} }), null);
    assert.equal(sourceFilter.parseSources({ query: { sources: "  ,, " } }), null);
  });
  it("builds a column clause and a subquery clause", () => {
    assert.deepEqual(sourceFilter.sourceColumnClause(["local", "a"]), {
      clause: "s.source IN (?,?)",
      params: ["local", "a"],
    });
    assert.deepEqual(sourceFilter.sessionIdInSourcesClause(["local"], "e.session_id"), {
      clause: "e.session_id IN (SELECT id FROM sessions WHERE source IN (?))",
      params: ["local"],
    });
    assert.deepEqual(sourceFilter.sourceColumnClause(null), { clause: "", params: [] });
  });
});

// ── Route CRUD ──────────────────────────────────────────────────────────────

describe("/api/remote-sources CRUD", () => {
  let createdId;

  it("starts empty", async () => {
    const res = await get("/api/remote-sources");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.sources, []);
  });

  it("creates a source", async () => {
    const res = await post("/api/remote-sources", { label: "Dev", host: "son@dev", ssh_port: 22 });
    assert.equal(res.status, 201);
    assert.equal(res.body.source.label, "Dev");
    assert.equal(res.body.source.host, "son@dev");
    assert.equal(res.body.source.enabled, true);
    assert.equal(res.body.source.status, "idle");
    assert.ok(res.body.source.id.startsWith("src_"));
    createdId = res.body.source.id;
  });

  it("rejects an invalid host with a 400 + structured error", async () => {
    const res = await post("/api/remote-sources", { label: "Bad", host: "-oProxyCommand=x" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_HOST");
  });

  it("patches label + enabled, leaving other fields intact", async () => {
    const res = await patch(`/api/remote-sources/${createdId}`, {
      label: "Renamed",
      enabled: false,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.source.label, "Renamed");
    assert.equal(res.body.source.enabled, false);
    assert.equal(res.body.source.ssh_port, 22); // unchanged
  });

  it("404s for an unknown id", async () => {
    const res = await patch("/api/remote-sources/src_nope", { label: "x" });
    assert.equal(res.status, 404);
  });

  it("delete without purge detaches its sessions back to local", async () => {
    // Attach a session to the source, then delete without purge.
    stmts.insertSession.run("rs-detach-1", "s", "active", "/x", "claude-opus-4-8", null);
    stmts.setSessionSource.run(createdId, "rs-detach-1");
    const res = await del(`/api/remote-sources/${createdId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.purged, 0);
    assert.equal(stmts.getSession.get("rs-detach-1").source, "local");
    assert.equal(stmts.getRemoteSource.get(createdId), undefined);
  });

  it("delete with purge removes the source's sessions", async () => {
    const c = await post("/api/remote-sources", { label: "P", host: "p@h" });
    const id = c.body.source.id;
    stmts.insertSession.run("rs-purge-1", "s", "active", "/x", "claude-opus-4-8", null);
    stmts.setSessionSource.run(id, "rs-purge-1");
    const res = await del(`/api/remote-sources/${id}?purge=true`);
    assert.equal(res.status, 200);
    assert.equal(res.body.purged, 1);
    assert.equal(stmts.getSession.get("rs-purge-1"), undefined);
  });
});

// ── Source-scoped data endpoints ──────────────────────────────────────────────

describe("source scoping across data endpoints", () => {
  before(async () => {
    // A local session and a remote-tagged session, each with one event.
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: "scope-local", cwd: "/local" },
    });
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: "scope-remote", cwd: "/remote" },
    });
    stmts.setSessionSource.run("src_scope", "scope-remote");
  });

  it("facets lists distinct sources (local + tagged)", async () => {
    const res = await get("/api/sessions/facets");
    assert.ok(res.body.sources.includes("local"));
    assert.ok(res.body.sources.includes("src_scope"));
  });

  it("sessions?sources=local excludes the remote session", async () => {
    const res = await get("/api/sessions?sources=local&limit=1000");
    const ids = res.body.sessions.map((s) => s.id);
    assert.ok(ids.includes("scope-local"));
    assert.ok(!ids.includes("scope-remote"));
  });

  it("sessions?sources=src_scope returns only the remote session", async () => {
    const res = await get("/api/sessions?sources=src_scope&limit=1000");
    const ids = res.body.sessions.map((s) => s.id);
    assert.deepEqual(ids, ["scope-remote"]);
    assert.equal(res.body.sessions[0].source, "src_scope");
  });

  it("sessions with no sources param returns both", async () => {
    const res = await get("/api/sessions?limit=1000");
    const ids = res.body.sessions.map((s) => s.id);
    assert.ok(ids.includes("scope-local") && ids.includes("scope-remote"));
  });

  it("stats respects the source scope", async () => {
    const all = await get("/api/stats");
    const local = await get("/api/stats?sources=local");
    const remote = await get("/api/stats?sources=src_scope");
    assert.ok(all.body.total_sessions >= 2);
    assert.equal(
      local.body.total_sessions + remote.body.total_sessions <= all.body.total_sessions,
      true
    );
    // The remote scope sees exactly its one tagged session.
    assert.equal(remote.body.total_sessions, 1);
  });

  it("analytics respects the source scope", async () => {
    const remote = await get("/api/analytics?sources=src_scope");
    assert.equal(remote.body.overview.total_sessions, 1);
  });

  it("events?sources=src_scope only returns the remote session's events", async () => {
    const res = await get("/api/events?sources=src_scope&limit=1000");
    assert.ok(res.body.events.every((e) => e.session_id === "scope-remote"));
  });

  it("agents?sources=local excludes the remote session's agents", async () => {
    const res = await get("/api/agents?sources=local");
    assert.ok(res.body.agents.every((a) => a.session_id !== "scope-remote"));
  });
});
