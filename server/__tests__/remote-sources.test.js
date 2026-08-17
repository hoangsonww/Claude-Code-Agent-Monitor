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

  it("accepts an independent remote Codex home", () => {
    const v = remoteSync.validateSourceInput({
      label: "x",
      host: "mybox",
      remote_home: "/home/son/.claude",
      remote_codex_home: "wsl:~/.codex",
    });
    assert.equal(v.remoteHome, "/home/son/.claude");
    assert.equal(v.remoteCodexHome, "wsl:~/.codex");
  });

  const rejects = [
    [
      "leading-dash host (ssh option injection)",
      { label: "x", host: "-oProxyCommand=evil" },
      "INVALID_HOST",
    ],
    ["host with space", { label: "x", host: "a b" }, "INVALID_HOST"],
    ["host with ;", { label: "x", host: "a;rm -rf /" }, "INVALID_HOST"],
    ["host with : (breaks scp spec)", { label: "x", host: "a:b" }, "INVALID_HOST"],
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
      "relative remote_codex_home",
      { label: "x", host: "a", remote_codex_home: "rel/path" },
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
  it("builds ssh option args with port + identity", async () => {
    const args = await remoteSync.sshOptionArgs({ ssh_port: 2222, identity_file: "/k" });
    assert.ok(args.includes("-p"));
    assert.equal(args[args.indexOf("-p") + 1], "2222");
    assert.ok(args.includes("-i"));
    assert.equal(args[args.indexOf("-i") + 1], "/k");
    assert.ok(args.includes("IdentitiesOnly=yes"));
  });
  it("builds scp option args with capital -P for port", async () => {
    const args = await remoteSync.scpOptionArgs({ ssh_port: 2222, identity_file: "/k" });
    assert.ok(args.includes("-P"));
    assert.equal(args[args.indexOf("-P") + 1], "2222");
  });
  it("parses ssh -G output for identity agent discovery", () => {
    const cfg = remoteSync.parseSshGOutput(
      "hostname example.com\nidentityagent /tmp/agent.sock\nport 22\n"
    );
    assert.equal(cfg.identityagent, "/tmp/agent.sock");
    assert.equal(cfg.port, "22");
  });
  it("buildSshChildEnv sets HOME and does not override SSH_AUTH_SOCK", () => {
    const env = remoteSync.buildSshChildEnv();
    assert.ok(env.HOME);
    if (process.env.SSH_AUTH_SOCK) {
      assert.equal(env.SSH_AUTH_SOCK, process.env.SSH_AUTH_SOCK);
    }
  });
  it("identityAgentArgsFromConfig follows ssh -G only for concrete agent paths", () => {
    assert.deepEqual(remoteSync.identityAgentArgsFromConfig("none"), []);
    assert.deepEqual(remoteSync.identityAgentArgsFromConfig("SSH_AUTH_SOCK"), []);
    assert.deepEqual(remoteSync.identityAgentArgsFromConfig("/tmp/custom-agent.sock"), [
      "-o",
      "IdentityAgent=/tmp/custom-agent.sock",
    ]);
    const home = os.homedir();
    assert.deepEqual(remoteSync.identityAgentArgsFromConfig("~/Library/agent.sock"), [
      "-o",
      `IdentityAgent=${path.join(home, "Library/agent.sock")}`,
    ]);
  });
  it("adds PowerShell and WSL probes for ~-rooted remote homes (Windows remotes)", () => {
    const probes = remoteSync.connectionProbeCommands({ remote_home: "~/.claude" });
    assert.equal(probes.length, 3);
    assert.match(probes[0], /sh -c/);
    assert.match(probes[0], /~\/\.claude\/projects/);
    assert.match(probes[1], /powershell\.exe/);
    assert.match(probes[1], /\.claude\\projects/);
    assert.match(probes[2], /wsl\.exe/);
    assert.match(probes[2], /~\/\.claude\/projects/);
  });
  it("uses only wsl.exe for wsl: remote homes", () => {
    const probes = remoteSync.connectionProbeCommands({ remote_home: "wsl:~/.claude" });
    assert.equal(probes.length, 1);
    assert.match(probes[0], /wsl\.exe/);
  });

  it("connectionSuccessMessage reflects explicit vs auto-detected WSL", () => {
    const wslProbe = "wsl.exe -e sh -c 'test -d ~/.claude/projects && echo CCAM_OK'";
    assert.match(
      remoteSync.connectionSuccessMessage({ remote_home: "wsl:~/.claude" }, wslProbe),
      /wsl:~\/\.claude/
    );
    assert.doesNotMatch(
      remoteSync.connectionSuccessMessage({ remote_home: "wsl:~/.claude" }, wslProbe),
      /auto-detected/i
    );
    assert.match(
      remoteSync.connectionSuccessMessage({ remote_home: null }, wslProbe),
      /auto-detected/i
    );
    assert.match(
      remoteSync.connectionSuccessMessage({ remote_home: null }, "sh -c 'echo CCAM_OK'"),
      /Remote Claude Code history found/
    );
  });
  it("accepts wsl: and UNC remote_home values", () => {
    const wsl = remoteSync.validateSourceInput({
      label: "WSL",
      host: "u@win",
      remote_home: "wsl:/home/hoang/.claude",
    });
    assert.equal(wsl.remoteHome, "wsl:/home/hoang/.claude");
    assert.equal(
      remoteSync.remoteProjectsPath({ remote_home: wsl.remoteHome }),
      "wsl:/home/hoang/.claude/projects"
    );
    const unc = remoteSync.validateSourceInput({
      label: "UNC",
      host: "u@win",
      remote_home: "//wsl.localhost/Ubuntu/home/hoang/.claude",
    });
    assert.equal(unc.remoteHome, "//wsl.localhost/Ubuntu/home/hoang/.claude");
    assert.equal(
      remoteSync.remoteProjectsPath({ remote_home: unc.remoteHome }),
      "//wsl.localhost/Ubuntu/home/hoang/.claude/projects"
    );
  });
  it("builds a wsl tar command for WSL-hosted Claude homes", () => {
    assert.equal(
      remoteSync.wslTarRemoteCmd("~/.claude"),
      "wsl.exe -e sh -c 'tar -cC ~/.claude/projects .'"
    );
  });
  it("adds cmd.exe probe only for Windows drive-letter remote homes", () => {
    const probes = remoteSync.connectionProbeCommands({
      remote_home: "C:/Users/hoang/.claude",
    });
    assert.equal(probes.length, 1);
    assert.match(probes[0], /cmd \/c/);
    assert.match(probes[0], /C:\\Users\\hoang\\.claude\\projects/);
  });
  it("uses sh probe for POSIX absolute remote homes", () => {
    const probes = remoteSync.connectionProbeCommands({ remote_home: "/opt/cc" });
    assert.deepEqual(probes, [
      "sh -c 'test -d /opt/cc/projects && echo CCAM_OK || echo CCAM_NO_DIR'",
    ]);
  });
  it("accepts Windows-style remote_home with forward slashes", () => {
    const v = remoteSync.validateSourceInput({
      label: "Win",
      host: "u@win",
      remote_home: "C:/Users/hoang/.claude",
    });
    assert.equal(v.remoteHome, "C:/Users/hoang/.claude");
    assert.equal(
      remoteSync.remoteProjectsPath({ remote_home: v.remoteHome }),
      "C:/Users/hoang/.claude/projects"
    );
    assert.equal(
      remoteSync.scpRemoteSpec({ host: "u@win", remote_home: v.remoteHome }),
      "u@win:C:/Users/hoang/.claude/projects/."
    );
  });
  it("expands tilde in ssh -G IdentityAgent paths and strips quotes", () => {
    const home = os.homedir();
    assert.equal(
      remoteSync.expandSshConfigPath("~/Library/agent.sock"),
      path.join(home, "Library/agent.sock")
    );
    assert.equal(remoteSync.expandSshConfigPath('"/tmp/quoted.sock"'), "/tmp/quoted.sock");
    assert.equal(remoteSync.expandSshConfigPath("/tmp/a"), "/tmp/a");
  });
  it("sshConfigFileArgs points at user config when present", () => {
    const args = remoteSync.sshConfigFileArgs();
    const cfg = path.join(os.homedir(), ".ssh", "config");
    if (fs.existsSync(cfg)) {
      assert.deepEqual(args, ["-F", cfg]);
    } else {
      assert.deepEqual(args, []);
    }
  });
  it("treats blank identity_file as null", () => {
    const v = remoteSync.validateSourceInput({
      label: "x",
      host: "a",
      identity_file: "   ",
    });
    assert.equal(v.identityFile, null);
  });
  it("detects legacy scp protocol errors for -O retry", () => {
    assert.equal(
      remoteSync.isLegacyScpProtocolError("subsystem request failed on channel 0"),
      true
    );
    assert.equal(remoteSync.isLegacyScpProtocolError("Permission denied"), false);
  });
  it("strips ANSI escapes from command output", () => {
    assert.equal(remoteSync.stripAnsi("\u001b[31;1mscp: not found\u001b[0m"), "scp: not found");
  });
  it("resolves ssh/scp binaries on Windows when OpenSSH is in System32", () => {
    const prev = process.platform;
    const prevWin = process.env.WINDIR;
    try {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.WINDIR = process.env.WINDIR || "C:\\Windows";
      const ssh = remoteSync.resolveSshBinary("ssh");
      assert.match(ssh, /ssh\.exe$/i);
    } finally {
      Object.defineProperty(process, "platform", { value: prev });
      if (prevWin === undefined) delete process.env.WINDIR;
      else process.env.WINDIR = prevWin;
    }
  });
  it("defaults the remote projects path to ~/.claude/projects", () => {
    assert.equal(remoteSync.remoteProjectsPath({}), "~/.claude/projects");
    assert.equal(remoteSync.remoteProjectsPath({ remote_home: "/opt/cc" }), "/opt/cc/projects");
  });
  it("defaults the remote Codex sessions path to ~/.codex/sessions", () => {
    assert.equal(remoteSync.remoteCodexSessionsPath({}), "~/.codex/sessions");
    assert.equal(
      remoteSync.remoteCodexSessionsPath({ remote_codex_home: "/opt/codex" }),
      "/opt/codex/sessions"
    );
    assert.equal(
      remoteSync.scpRemoteSpec({ host: "u@box", remote_codex_home: "~/.codex" }, "codex"),
      "u@box:~/.codex/sessions/."
    );
  });
  it("builds a Codex WSL tar command that keeps its native title index", () => {
    assert.equal(
      remoteSync.wslTarRemoteCmd("~/.codex", "codex"),
      "wsl.exe -e sh -c 'cd ~/.codex && (test -f session_index.jsonl && tar -c sessions session_index.jsonl || tar -c sessions)'"
    );
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

  it("identifies native Codex rollout ids in a mirrored staging tree", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-codex-staged-"));
    const id = "019fbb99-bd87-7c80-afec-ee65e2ebbe1c";
    const rollout = path.join(
      dir,
      "sessions",
      "2026",
      "08",
      "02",
      `rollout-2026-08-02T12-00-00-${id}.jsonl`
    );
    fs.mkdirSync(path.dirname(rollout), { recursive: true });
    fs.writeFileSync(rollout, "{}\n");
    assert.deepEqual(remoteSync.stagedSessionIds(dir, "codex"), [id]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("remote Codex staging import", () => {
  it("uses the Codex ingestor, tags the source, and honors mirrored native titles", async () => {
    const sourceId = "src_remote_codex_import";
    const sessionId = "019fbb99-bd87-7c80-afec-ee65e2ebbe1c";
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-remote-codex-import-"));
    const rollout = path.join(
      stage,
      "sessions",
      "2026",
      "08",
      "02",
      `rollout-2026-08-02T12-00-00-${sessionId}.jsonl`
    );
    const record = (type, payload) => ({
      timestamp: "2026-08-02T12:00:00.000Z",
      type,
      payload,
    });
    try {
      stmts.insertRemoteSource.run(
        sourceId,
        "Remote Codex",
        "codex@example",
        null,
        null,
        null,
        null,
        1
      );
      fs.mkdirSync(path.dirname(rollout), { recursive: true });
      fs.writeFileSync(
        path.join(stage, "session_index.jsonl"),
        `${JSON.stringify({ id: sessionId, thread_name: "Remote renamed thread" })}\n`
      );
      fs.writeFileSync(
        rollout,
        [
          record("session_meta", { id: sessionId, cwd: "/remote/codex-project" }),
          record("turn_context", { model: "gpt-5.6-terra" }),
          record("event_msg", { type: "user_message", message: "Inspect remote Codex" }),
          record("event_msg", { type: "task_complete" }),
        ]
          .map((entry) => JSON.stringify(entry))
          .join("\n") + "\n"
      );

      const result = await remoteSync.ingestStagedProvider(
        require("../db"),
        { id: sourceId },
        "codex",
        stage
      );
      const session = stmts.getSession.get(sessionId);
      assert.equal(result.status, "ok");
      assert.equal(result.counters.sessions_tagged, 1);
      assert.equal(session.provider, "codex");
      assert.equal(session.source, sourceId);
      assert.equal(session.name, "Remote renamed thread");
      assert.equal(stmts.getAgent.get(`codex:${sessionId}`).task, "Inspect remote Codex");
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
      stmts.deleteRemoteSource.run(sourceId);
    }
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
    const res = await post("/api/remote-sources", {
      label: "Dev",
      host: "son@dev",
      ssh_port: 22,
      remote_home: "/srv/claude",
      remote_codex_home: "/srv/codex",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.source.label, "Dev");
    assert.equal(res.body.source.host, "son@dev");
    assert.equal(res.body.source.enabled, true);
    assert.equal(res.body.source.status, "idle");
    assert.equal(res.body.source.remote_home, "/srv/claude");
    assert.equal(res.body.source.remote_codex_home, "/srv/codex");
    assert.ok(res.body.source.id.startsWith("src_"));
    createdId = res.body.source.id;
  });

  it("rejects an invalid host with a 400 + structured error", async () => {
    const res = await post("/api/remote-sources", { label: "Bad", host: "-oProxyCommand=x" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_HOST");
  });

  it("patches label + enabled, and can clear a custom Codex home", async () => {
    const res = await patch(`/api/remote-sources/${createdId}`, {
      label: "Renamed",
      enabled: false,
      remote_codex_home: null,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.source.label, "Renamed");
    assert.equal(res.body.source.enabled, false);
    assert.equal(res.body.source.ssh_port, 22); // unchanged
    assert.equal(res.body.source.remote_home, "/srv/claude"); // independently retained
    assert.equal(res.body.source.remote_codex_home, null);
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

  it("pricing cost respects the source scope (regression: total cost was global)", async () => {
    // Equal usage on the local + the remote session; the default claude-opus-4-8
    // pricing rule prices it. Before the fix, /pricing/cost ignored `sources`, so
    // every scope returned the same global total and the Dashboard cost never
    // moved when the scope changed.
    stmts.upsertTokenUsage.run("scope-local", "claude-opus-4-8", 1_000_000, 0, 0, 0);
    stmts.upsertTokenUsage.run("scope-remote", "claude-opus-4-8", 1_000_000, 0, 0, 0);

    const all = await get("/api/pricing/cost");
    const local = await get("/api/pricing/cost?sources=local");
    const remote = await get("/api/pricing/cost?sources=src_scope");

    assert.ok(all.body.total_cost > 0, "some cost recorded across all sources");
    assert.ok(local.body.total_cost > 0, "local scope has cost");
    assert.ok(remote.body.total_cost > 0, "remote scope has cost");
    // The fix: each scope is strictly less than the combined total.
    assert.ok(local.body.total_cost < all.body.total_cost, "local scope excludes remote cost");
    assert.ok(remote.body.total_cost < all.body.total_cost, "remote scope excludes local cost");
    // The two disjoint scopes partition the whole (no other opus-4-8 usage here).
    assert.ok(
      Math.abs(local.body.total_cost + remote.body.total_cost - all.body.total_cost) < 1e-6,
      "local + remote cost sums to the unscoped total"
    );
  });
});

describe("/api/remote-sources session_count", () => {
  it("reports the live number of sessions attributed to each source", async () => {
    const c = await post("/api/remote-sources", { label: "Counted", host: "c@h" });
    const id = c.body.source.id;
    // A freshly-added source has no sessions yet.
    assert.equal(c.body.source.session_count ?? 0, 0);
    // Tag two sessions to it, then confirm the list reflects the count.
    stmts.insertSession.run("rs-count-1", "s", "active", "/x", "claude-opus-4-8", null);
    stmts.insertSession.run("rs-count-2", "s", "active", "/y", "claude-opus-4-8", null);
    stmts.setSessionSource.run(id, "rs-count-1");
    stmts.setSessionSource.run(id, "rs-count-2");
    const list = await get("/api/remote-sources");
    const row = list.body.sources.find((s) => s.id === id);
    assert.equal(row.session_count, 2);
  });
});

// ── Remote failure stale fallback ───────────────────────────────────────────
// A healthy source owns lifecycle reconciliation from its current mirror. Once
// it cannot sync, that authority disappears; old active/Waiting rows must fall
// through to the same global stale sweep as local sessions instead of lingering
// forever. These assert eligibility for the shared prepared statement that both
// the periodic sweep and hook-triggered orphan cleanup use.
describe("remote failure stale fallback", () => {
  const STALE_MINUTES = 180;
  const oldIso = () => new Date(Date.now() - (STALE_MINUTES + 10) * 60 * 1000).toISOString();

  function addRemoteSession(sourceId, sessionId) {
    stmts.insertSession.run(sessionId, "Remote waiting", "active", "/remote/project", null, null);
    stmts.setSessionSource.run(sourceId, sessionId);
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(oldIso(), sessionId);
  }

  it("includes an old session when its remote source reports an SSH error", () => {
    const sourceId = "src_stale_error";
    stmts.insertRemoteSource.run(sourceId, "Offline", "offline@example", null, null, null, null, 1);
    addRemoteSession(sourceId, "remote-stale-error");
    stmts.setRemoteSourceStatus.run("error", "connection timed out", sourceId);

    const staleIds = new Set(
      stmts.findStaleSessions
        .all("__remote-test__", STALE_MINUTES, STALE_MINUTES, STALE_MINUTES)
        .map((row) => row.id)
    );
    assert.ok(staleIds.has("remote-stale-error"));
  });

  it("includes a remote source stranded in syncing beyond the stale window", () => {
    const sourceId = "src_stale_syncing";
    stmts.insertRemoteSource.run(
      sourceId,
      "Stranded",
      "stranded@example",
      null,
      null,
      null,
      null,
      1
    );
    addRemoteSession(sourceId, "remote-stale-syncing");
    stmts.setRemoteSourceStatus.run("syncing", null, sourceId);
    db.prepare("UPDATE remote_sources SET updated_at = ? WHERE id = ?").run(oldIso(), sourceId);

    const staleIds = new Set(
      stmts.findStaleSessions
        .all("__remote-test__", STALE_MINUTES, STALE_MINUTES, STALE_MINUTES)
        .map((row) => row.id)
    );
    assert.ok(staleIds.has("remote-stale-syncing"));
  });

  it("keeps an old session out of the global sweep while its source remains healthy", () => {
    const sourceId = "src_stale_healthy";
    stmts.insertRemoteSource.run(sourceId, "Healthy", "healthy@example", null, null, null, null, 1);
    addRemoteSession(sourceId, "remote-stale-healthy");
    stmts.setRemoteSourceSyncResult.run(
      "ok",
      null,
      new Date().toISOString(),
      "{}",
      "ok",
      "ok",
      sourceId
    );

    const staleIds = new Set(
      stmts.findStaleSessions
        .all("__remote-test__", STALE_MINUTES, STALE_MINUTES, STALE_MINUTES)
        .map((row) => row.id)
    );
    assert.ok(!staleIds.has("remote-stale-healthy"));
  });

  it("applies stale fallback per provider when a mixed source loses only Claude history", () => {
    const sourceId = "src_stale_mixed";
    stmts.insertRemoteSource.run(sourceId, "Mixed", "mixed@example", null, null, null, null, 1);
    addRemoteSession(sourceId, "remote-stale-mixed-claude");
    addRemoteSession(sourceId, "remote-stale-mixed-codex");
    db.prepare("UPDATE sessions SET provider = 'codex' WHERE id = ?").run(
      "remote-stale-mixed-codex"
    );
    stmts.setRemoteSourceSyncResult.run(
      "ok",
      null,
      new Date().toISOString(),
      "{}",
      "unavailable",
      "ok",
      sourceId
    );

    const staleIds = new Set(
      stmts.findStaleSessions
        .all("__remote-test__", STALE_MINUTES, STALE_MINUTES, STALE_MINUTES)
        .map((row) => row.id)
    );
    assert.ok(staleIds.has("remote-stale-mixed-claude"));
    assert.ok(!staleIds.has("remote-stale-mixed-codex"));
  });
});

// ── Remote session status reconciliation ─────────────────────────────────────
// A healthy remote source gets NO live hooks and keeps its sessions outside the
// local liveness/staleness sweeps, so successful mirror reconciliation owns
// active/completed state. An errored or stale-syncing source deliberately falls
// back to the shared stale sweep above. These exercise successful reconciliation
// directly against a staged tree with controlled mtimes.
describe("reconcileRemoteSessionStatus", () => {
  const dbModule = require("../db");
  const SRC = { id: "src_recon" };
  let stageRoot;

  before(() => {
    stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-recon-"));
  });
  after(() => {
    try {
      fs.rmSync(stageRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function stageSession(id, ageMs, contentLine = "{}") {
    const proj = path.join(stageRoot, "-Users-x-proj");
    fs.mkdirSync(proj, { recursive: true });
    const f = path.join(proj, `${id}.jsonl`);
    fs.writeFileSync(f, `${contentLine}\n`);
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(f, t, t);
    return f;
  }

  it("heals a wrongly-completed remote session whose mirror is still fresh", () => {
    stmts.insertSession.run(
      "recon-fresh",
      "s",
      "completed",
      "/home/ubuntu/matroid",
      "claude-opus-4-8",
      null
    );
    stmts.setSessionSource.run(SRC.id, "recon-fresh");
    stmts.insertAgent.run(
      "recon-fresh-main",
      "recon-fresh",
      "Main",
      "main",
      null,
      "completed",
      null,
      null,
      null
    );
    stageSession("recon-fresh", 1_000); // 1s old → still running

    remoteSync.reconcileRemoteSessionStatus(dbModule, SRC, stageRoot);

    assert.equal(stmts.getSession.get("recon-fresh").status, "active");
    assert.equal(stmts.getSession.get("recon-fresh").ended_at, null, "ended_at cleared on heal");
    assert.equal(stmts.getAgent.get("recon-fresh-main").status, "waiting");
  });

  it("completes an active remote session whose mirror has gone stale", () => {
    stmts.insertSession.run(
      "recon-stale",
      "s",
      "active",
      "/home/ubuntu/other",
      "claude-opus-4-8",
      null
    );
    stmts.setSessionSource.run(SRC.id, "recon-stale");
    stmts.insertAgent.run(
      "recon-stale-main",
      "recon-stale",
      "Main",
      "main",
      null,
      "waiting",
      null,
      null,
      null
    );
    stageSession("recon-stale", 20 * 60 * 1000); // 20 min idle → ended

    remoteSync.reconcileRemoteSessionStatus(dbModule, SRC, stageRoot);

    assert.equal(stmts.getSession.get("recon-stale").status, "completed");
    assert.ok(stmts.getSession.get("recon-stale").ended_at, "ended_at stamped");
    assert.equal(stmts.getAgent.get("recon-stale-main").status, "completed");
  });

  it("completes an active session when mtime is fresh but transcript content is stale", () => {
    stmts.insertSession.run(
      "recon-touch",
      "s",
      "active",
      "/home/ubuntu/touched",
      "claude-opus-4-8",
      null
    );
    stmts.setSessionSource.run(SRC.id, "recon-touch");
    stmts.insertAgent.run(
      "recon-touch-main",
      "recon-touch",
      "Main",
      "main",
      null,
      "waiting",
      null,
      null,
      null
    );
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    stageSession("recon-touch", 1_000, `{"timestamp":"${stale}"}`);

    remoteSync.reconcileRemoteSessionStatus(dbModule, SRC, stageRoot);

    assert.equal(stmts.getSession.get("recon-touch").status, "completed");
    assert.equal(stmts.getAgent.get("recon-touch-main").status, "completed");
  });

  it("never touches a session owned by a different source", () => {
    stmts.insertSession.run(
      "recon-other",
      "s",
      "active",
      "/home/ubuntu/z",
      "claude-opus-4-8",
      null
    );
    stmts.setSessionSource.run("src_different", "recon-other");
    stageSession("recon-other", 20 * 60 * 1000); // stale, but not this source's

    remoteSync.reconcileRemoteSessionStatus(dbModule, SRC, stageRoot);

    assert.equal(stmts.getSession.get("recon-other").status, "active");
  });
});

describe("POST /api/remote-sources/sync-all", () => {
  it("syncs only enabled sources and isolates per-source outcomes", async () => {
    // Disable every existing source so this exercises the wiring without any
    // real SSH/rsync shell-out (nothing enabled → nothing to pull).
    const { body } = await get("/api/remote-sources");
    for (const s of body.sources) {
      if (s.enabled) await patch(`/api/remote-sources/${s.id}`, { enabled: false });
    }
    const res = await post("/api/remote-sources/sync-all");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.synced, 0);
    assert.deepEqual(res.body.results, []);
  });

  it("does not collide with the /:id/sync route", async () => {
    // "sync-all" is a single path segment, so it must not be treated as an :id.
    const res = await post("/api/remote-sources/sync-all");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
  });
});
