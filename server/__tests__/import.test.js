/**
 * @file Tests provider-aware Import History routes for Claude Code and Codex.
 * Verifies equivalent accounting, durable imported transcripts, native titles,
 * tool events, idempotent re-scans, and archive extraction hardening.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const zlib = require("zlib");

const TEST_DB = path.join(os.tmpdir(), `dashboard-import-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");
const importHistory = require("../../scripts/import-history");
const archive = require("../lib/archive");

let server;
let BASE;

function fetch(urlPath, options = {}) {
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
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function post(urlPath, body) {
  return fetch(urlPath, { method: "POST", body });
}

// ────────────────────────────────────────────────────────────────────────────
// Fixtures — deterministic JSONL sessions with known token counts so we can
// assert imported values match byte-for-byte.
// ────────────────────────────────────────────────────────────────────────────

const SESSION_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const SESSION_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

function fixtureLines(sessionId, cwd, model, inputTok, outputTok) {
  const base = "2026-04-18T12:00:00.000Z";
  return [
    { type: "user", cwd, sessionId, timestamp: base, message: { content: "hi" } },
    {
      type: "assistant",
      cwd,
      sessionId,
      timestamp: base,
      message: {
        model,
        content: [{ type: "text", text: "ok" }],
        usage: {
          input_tokens: inputTok,
          output_tokens: outputTok,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
    {
      type: "assistant",
      cwd,
      sessionId,
      timestamp: "2026-04-18T12:00:01.000Z",
      message: {
        model,
        content: [{ type: "tool_use", name: "Read", input: { file_path: "/tmp/foo" } }],
        usage: {
          input_tokens: inputTok,
          output_tokens: outputTok,
          cache_read_input_tokens: 10,
          cache_creation_input_tokens: 20,
        },
      },
    },
  ];
}

function writeFixtureDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-fixture-"));
  const projDir = path.join(root, "-Users-demo-project");
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(
    path.join(projDir, `${SESSION_A}.jsonl`),
    fixtureLines(SESSION_A, "/Users/demo/project", "claude-opus-4-7", 100, 50)
      .map((o) => JSON.stringify(o))
      .join("\n")
  );
  fs.writeFileSync(
    path.join(projDir, `${SESSION_B}.jsonl`),
    fixtureLines(SESSION_B, "/Users/demo/project", "claude-sonnet-4-6", 200, 100)
      .map((o) => JSON.stringify(o))
      .join("\n")
  );
  return root;
}

const CODEX_SESSION = "019a4ba6-a2b6-75f0-b186-bddd23ae4f2f";

function writeCodexFixtureDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-codex-import-"));
  const rollout = path.join(
    root,
    "sessions",
    "2026",
    "08",
    "02",
    `rollout-2026-08-02T12-00-00-${CODEX_SESSION}.jsonl`
  );
  const at = "2026-08-02T12:00:00.000Z";
  fs.mkdirSync(path.dirname(rollout), { recursive: true });
  fs.writeFileSync(
    rollout,
    [
      {
        type: "session_meta",
        timestamp: at,
        payload: { id: CODEX_SESSION, timestamp: at, cwd: "/workspace/imported-codex" },
      },
      { type: "turn_context", timestamp: at, payload: { model: "gpt-5.6-terra" } },
      {
        type: "event_msg",
        timestamp: at,
        payload: { type: "user_message", message: "Import this Codex rollout" },
      },
      {
        type: "response_item",
        timestamp: at,
        payload: {
          type: "function_call",
          name: "exec_command",
          call_id: "import-command",
          arguments: '{"cmd":"git status"}',
        },
      },
      {
        type: "event_msg",
        timestamp: at,
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 100,
              cached_input_tokens: 20,
              cache_write_input_tokens: 10,
              output_tokens: 15,
              reasoning_output_tokens: 5,
            },
          },
        },
      },
      { type: "event_msg", timestamp: at, payload: { type: "task_complete" } },
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  fs.writeFileSync(
    path.join(root, "session_index.jsonl"),
    `${JSON.stringify({ id: CODEX_SESSION, thread_name: "Imported native Codex title" })}\n`
  );
  return root;
}

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

// ────────────────────────────────────────────────────────────────────────────

describe("GET /api/import/guide", () => {
  it("returns OS-aware instructions and supported extensions", async () => {
    const res = await fetch("/api/import/guide");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.default_projects_dir, "string");
    assert.ok(res.body.supported_extensions.includes(".jsonl"));
    assert.ok(res.body.supported_extensions.includes(".tar.gz"));
    assert.ok(res.body.supported_extensions.includes(".zip"));
    assert.ok(Array.isArray(res.body.steps));
    assert.ok(res.body.steps.length >= 4);
    assert.ok(res.body.archive_command.includes("tar"));
  });

  it("returns Codex-specific paths and instructions when requested", async () => {
    const res = await fetch("/api/import/guide?provider=codex");
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "codex");
    assert.ok(res.body.default_projects_dir.endsWith("sessions"));
    assert.ok(res.body.archive_command.includes("codex-history"));
    assert.ok(res.body.steps[0].title.includes("Codex"));
  });

  it("rejects an unknown provider", async () => {
    const res = await fetch("/api/import/guide?provider=other");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_PROVIDER");
  });
});

describe("POST /api/import/scan-path validation", () => {
  it("rejects missing path", async () => {
    const res = await post("/api/import/scan-path", {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("rejects relative paths", async () => {
    const res = await post("/api/import/scan-path", { path: "./somewhere" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("rejects non-existent paths", async () => {
    const res = await post("/api/import/scan-path", {
      path: "/definitely/does/not/exist/ccam-" + Date.now(),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "PATH_NOT_FOUND");
  });

  it("rejects files (not directories)", async () => {
    const tmp = path.join(os.tmpdir(), `ccam-not-dir-${Date.now()}.txt`);
    fs.writeFileSync(tmp, "hello");
    try {
      const res = await post("/api/import/scan-path", { path: tmp });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "NOT_A_DIRECTORY");
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe("POST /api/import/scan-path happy path", () => {
  it("imports sessions from a custom folder and records token usage", async () => {
    const root = writeFixtureDir();
    try {
      const res = await post("/api/import/scan-path", { path: root });
      assert.equal(res.status, 200);
      assert.ok(res.body.ok);
      // Both sessions should import the first time.
      assert.ok(res.body.imported >= 2);
      assert.equal(res.body.errors, 0);

      const sessA = stmts.getSession.get(SESSION_A);
      const sessB = stmts.getSession.get(SESSION_B);
      assert.ok(sessA, "session A should exist in DB");
      assert.ok(sessB, "session B should exist in DB");

      // Tokens: each fixture has 2 assistant messages with usage.
      const tokA = stmts.getTokensBySession.all(SESSION_A);
      const opus = tokA.find((t) => /opus/.test(t.model));
      assert.ok(opus, "expected opus tokens");
      assert.equal(opus.input_tokens, 200);
      assert.equal(opus.output_tokens, 100);
      assert.equal(opus.cache_read_tokens, 10);
      assert.equal(opus.cache_write_tokens, 20);

      // Cost endpoint should produce a non-zero result after we add a pricing rule.
      const ruleRes = await fetch("/api/pricing", {
        method: "PUT",
        body: {
          model_pattern: "claude-opus-4-7",
          display_name: "Opus 4.7",
          input_per_mtok: 15,
          output_per_mtok: 75,
          cache_read_per_mtok: 1.5,
          cache_write_per_mtok: 18.75,
        },
      });
      assert.equal(ruleRes.status, 200);

      const costRes = await fetch(`/api/pricing/cost/${SESSION_A}`);
      assert.equal(costRes.status, 200);
      assert.ok(costRes.body.total_cost > 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("imports Codex rollouts with tokens, tools, durable transcript access, and native titles", async () => {
    const root = writeCodexFixtureDir();
    const priorDataDir = process.env.DASHBOARD_DATA_DIR;
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-codex-import-data-"));
    process.env.DASHBOARD_DATA_DIR = dataDir;
    try {
      const res = await post("/api/import/scan-path", { path: root, provider: "codex" });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "codex");
      assert.equal(res.body.imported, 1);
      assert.equal(res.body.errors, 0);

      const session = stmts.getSession.get(CODEX_SESSION);
      assert.equal(session.provider, "codex");
      assert.equal(session.name, "Imported native Codex title");
      assert.ok(
        session.transcript_path.startsWith(path.join(dataDir, "codex-transcripts")),
        "external Codex imports must persist outside the temporary/source directory"
      );
      assert.ok(fs.existsSync(session.transcript_path));
      assert.equal(stmts.getAgent.get(`codex:${CODEX_SESSION}`).status, "waiting");

      const tokens = stmts.getTokensBySession.all(CODEX_SESSION);
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].input_tokens, 70);
      assert.equal(tokens[0].cache_read_tokens, 20);
      assert.equal(tokens[0].cache_write_tokens, 10);
      assert.equal(tokens[0].output_tokens, 20);
      assert.equal(
        stmts.listEventsBySession
          .all(CODEX_SESSION)
          .filter((event) => event.event_type === "codex_tool_call" && event.tool_name === "Bash")
          .length,
        1
      );

      const second = await post("/api/import/scan-path", { path: root, provider: "codex" });
      assert.equal(second.status, 200);
      assert.equal(second.body.imported, 0);
      assert.equal(second.body.skipped >= 1, true);
      assert.equal(stmts.getTokensBySession.all(CODEX_SESSION)[0].input_tokens, 70);
    } finally {
      if (priorDataDir === undefined) delete process.env.DASHBOARD_DATA_DIR;
      else process.env.DASHBOARD_DATA_DIR = priorDataDir;
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("is idempotent: a second scan does not duplicate tokens", async () => {
    const before = stmts.getTokensBySession.all(SESSION_A);
    const root = writeFixtureDir();
    try {
      const res = await post("/api/import/scan-path", { path: root });
      assert.equal(res.status, 200);
      const after = stmts.getTokensBySession.all(SESSION_A);
      const beforeOpus = before.find((t) => /opus/.test(t.model));
      const afterOpus = after.find((t) => /opus/.test(t.model));
      assert.equal(afterOpus.input_tokens, beforeOpus.input_tokens);
      assert.equal(afterOpus.output_tokens, beforeOpus.output_tokens);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("archive helpers", () => {
  it("isPathInside rejects traversal", () => {
    const root = path.resolve("/tmp/ccam-root");
    assert.equal(archive.isPathInside(root, "/tmp/ccam-root/ok.jsonl"), true);
    assert.equal(archive.isPathInside(root, "/tmp/other/bad.jsonl"), false);
    assert.equal(archive.isPathInside(root, "/tmp/ccam-root/../escape"), false);
  });

  it("safeJoin rejects absolute and traversal entries", () => {
    const root = path.resolve("/tmp/ccam-root");
    assert.equal(archive.safeJoin(root, "/etc/passwd"), path.join(root, "etc/passwd"));
    assert.equal(archive.safeJoin(root, "../escape.txt"), null);
    assert.equal(archive.safeJoin(root, "deep/../../escape"), null);
    assert.ok(archive.safeJoin(root, "good/file.jsonl").startsWith(root));
  });

  it("detectKind handles common extensions", () => {
    assert.equal(archive.detectKind("a.jsonl"), "jsonl");
    assert.equal(archive.detectKind("a.meta.json"), "meta");
    assert.equal(archive.detectKind("a.zip"), "zip");
    assert.equal(archive.detectKind("a.tar"), "tar");
    assert.equal(archive.detectKind("a.tar.gz"), "tgz");
    assert.equal(archive.detectKind("a.tgz"), "tgz");
    assert.equal(archive.detectKind("a.gz"), "gz");
    assert.equal(archive.detectKind("random.bin"), "unknown");
  });

  it("extractGzSingle decompresses plain gz", async () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-gz-"));
    const src = path.join(dest, "sample.jsonl.gz");
    fs.writeFileSync(src, zlib.gzipSync(Buffer.from('{"ok":true}\n')));
    try {
      const result = await archive.extractGzSingle(src, dest);
      assert.equal(result.extracted, 1);
      assert.ok(fs.existsSync(path.join(dest, "sample.jsonl")));
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });
});

describe("importFromDirectory directly", () => {
  it("reports progress and never throws on empty dirs", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-empty-"));
    try {
      const events = [];
      const counters = await importHistory.importFromDirectory({ db, stmts }, empty, {
        onProgress: (p) => events.push(p.phase),
      });
      assert.equal(counters.filesScanned, 0);
      assert.ok(events.includes("complete"));
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("matches the legacy importer's token totals on the same fixtures", async () => {
    // Clean any tokens from prior tests for a fresh comparison.
    const freshSession = "cccccccc-3333-4333-8333-cccccccccccc";
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-fresh-"));
    const projDir = path.join(root, "-Users-demo-fresh");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, `${freshSession}.jsonl`),
      fixtureLines(freshSession, "/Users/demo/fresh", "claude-haiku-4-5", 7, 3)
        .map((o) => JSON.stringify(o))
        .join("\n")
    );

    try {
      await importHistory.importFromDirectory({ db, stmts }, root);
      const tok = stmts.getTokensBySession.all(freshSession);
      const haiku = tok.find((t) => /haiku/.test(t.model));
      assert.ok(haiku);
      assert.equal(haiku.input_tokens, 14); // 7 * 2 messages
      assert.equal(haiku.output_tokens, 6); // 3 * 2 messages
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("snapshots the transcript into the data dir so it survives Claude Code pruning", async () => {
    // Regression: the Conversation tab reads JSONL live from ~/.claude/projects,
    // but Claude Code deletes session files older than cleanupPeriodDays
    // (default 30 days). Import must snapshot the transcript into the
    // dashboard's own data dir so the conversation survives that deletion.
    const prevDataDir = process.env.DASHBOARD_DATA_DIR;
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-data-"));
    process.env.DASHBOARD_DATA_DIR = dataDir;
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-src-"));
    const sessionId = "dddddddd-4444-4444-8444-dddddddddddd";
    fs.writeFileSync(
      path.join(src, `${sessionId}.jsonl`),
      fixtureLines(sessionId, "/Users/demo/snap", "claude-opus-4-8", 5, 3)
        .map((o) => JSON.stringify(o))
        .join("\n")
    );

    try {
      await importHistory.importFromDirectory({ db, stmts }, src);
      const snapshot = path.join(dataDir, "transcripts", `${sessionId}.jsonl`);
      assert.ok(fs.existsSync(snapshot), "transcript should be snapshotted into the data dir");
      assert.ok(
        fs.readFileSync(snapshot, "utf8").includes('"text":"ok"'),
        "snapshot should contain the original conversation"
      );

      // And the read route should resolve it via the snapshot helper.
      const { getSnapshotTranscriptPath } = require("../lib/claude-home");
      assert.equal(getSnapshotTranscriptPath(sessionId), snapshot);
    } finally {
      if (prevDataDir === undefined) delete process.env.DASHBOARD_DATA_DIR;
      else process.env.DASHBOARD_DATA_DIR = prevDataDir;
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("POST /api/import/rescan", () => {
  it("runs without crashing even when default projects dir is missing", async () => {
    // We can't mutate the real projects dir, but we can assert the endpoint
    // always returns a JSON envelope regardless of whether it found anything.
    const res = await post("/api/import/rescan");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.imported, "number");
    assert.equal(typeof res.body.skipped, "number");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Hardening tests
// ────────────────────────────────────────────────────────────────────────────

describe("tar path-traversal hardening", () => {
  it("extractTar rejects entries with ../ segments", async () => {
    const tar = require("tar");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-tar-bad-"));
    const stageDir = path.join(tmp, "stage");
    const targetDir = path.join(tmp, "target");
    fs.mkdirSync(stageDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    // Build a tar that tries to write "../escape.jsonl".
    const inner = path.join(stageDir, "legit.jsonl");
    fs.writeFileSync(inner, '{"ok":true}\n');
    const tarPath = path.join(tmp, "evil.tar");
    await tar.c({ file: tarPath, cwd: stageDir, prefix: "../" }, ["legit.jsonl"]);

    try {
      await archive.extractTar(tarPath, targetDir);
      // Anything extracted must remain inside targetDir.
      const walked = [];
      (function walk(d) {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory()) walk(p);
          else walked.push(p);
        }
      })(targetDir);
      for (const p of walked) {
        assert.ok(
          path.resolve(p).startsWith(path.resolve(targetDir) + path.sep) ||
            path.resolve(p) === path.resolve(targetDir),
          `traversal escape detected: ${p}`
        );
      }
      // Nothing should exist one level above targetDir with name escape.jsonl
      assert.equal(fs.existsSync(path.join(tmp, "escape.jsonl")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("extraction size cap", () => {
  it("extractGzSingle aborts past MAX_EXTRACT_BYTES", async () => {
    const prev = process.env.CCAM_IMPORT_MAX_EXTRACT_BYTES;
    process.env.CCAM_IMPORT_MAX_EXTRACT_BYTES = "128";
    // Re-require to pick up the lowered limit for this one check.
    delete require.cache[require.resolve("../lib/archive")];
    const localArchive = require("../lib/archive");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-bomb-"));
    const gzPath = path.join(tmp, "bomb.jsonl.gz");
    // 2 KB of zeros compresses to a few bytes — decompressing blows past 128 B.
    fs.writeFileSync(gzPath, zlib.gzipSync(Buffer.alloc(2048, 0)));
    try {
      await assert.rejects(
        () => localArchive.extractGzSingle(gzPath, tmp),
        (err) => err.code === "EXTRACTION_LIMIT_EXCEEDED"
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      if (prev === undefined) delete process.env.CCAM_IMPORT_MAX_EXTRACT_BYTES;
      else process.env.CCAM_IMPORT_MAX_EXTRACT_BYTES = prev;
      // Restore the module with production limits for subsequent tests.
      delete require.cache[require.resolve("../lib/archive")];
      require("../lib/archive");
    }
  });
});

describe("orphan subagent inference", () => {
  it("attaches subagent via Layout 2: <proj>/subagents/<sessionId>/agent.jsonl", async () => {
    const orphanSession = "dddddddd-4444-4444-8444-dddddddddddd";
    // Seed a parent session first.
    const seedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-orphan-seed-"));
    const seedProj = path.join(seedRoot, "project");
    fs.mkdirSync(seedProj, { recursive: true });
    fs.writeFileSync(
      path.join(seedProj, `${orphanSession}.jsonl`),
      fixtureLines(orphanSession, "/Users/demo/orphan", "claude-opus-4-7", 5, 5)
        .map((o) => JSON.stringify(o))
        .join("\n")
    );
    await importHistory.importFromDirectory({ db, stmts }, seedRoot);
    assert.ok(stmts.getSession.get(orphanSession), "parent session must exist before orphan pass");

    // Now create an "orphan" subagent tree in the non-standard layout.
    const orphanRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-orphan-"));
    const orphanLayoutDir = path.join(orphanRoot, "project", "subagents", orphanSession);
    fs.mkdirSync(orphanLayoutDir, { recursive: true });
    const subAgentId = "agent-xyz";
    fs.writeFileSync(
      path.join(orphanLayoutDir, `${subAgentId}.jsonl`),
      [
        { type: "user", timestamp: "2026-04-18T12:00:00.000Z", message: { content: "hi" } },
        {
          type: "assistant",
          timestamp: "2026-04-18T12:00:00.000Z",
          message: {
            model: "claude-opus-4-7",
            content: [{ type: "text", text: "ok" }],
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        },
      ]
        .map((o) => JSON.stringify(o))
        .join("\n")
    );

    try {
      const before = db
        .prepare("SELECT COUNT(*) as c FROM agents WHERE session_id = ?")
        .get(orphanSession).c;
      await importHistory.importFromDirectory({ db, stmts }, orphanRoot);
      const after = db
        .prepare("SELECT COUNT(*) as c FROM agents WHERE session_id = ?")
        .get(orphanSession).c;
      assert.ok(after > before, "orphan subagent should attach under known session");
    } finally {
      fs.rmSync(seedRoot, { recursive: true, force: true });
      fs.rmSync(orphanRoot, { recursive: true, force: true });
    }
  });
});

describe("concurrent scan-path requests", () => {
  it("two concurrent imports of different folders both succeed without clobbering", async () => {
    const sessA = "eeeeeeee-5555-4555-8555-eeeeeeeeeeee";
    const sessB = "ffffffff-6666-4666-8666-ffffffffffff";
    const rootA = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-concurrent-a-"));
    const rootB = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-concurrent-b-"));
    fs.mkdirSync(path.join(rootA, "-Users-demo-a"), { recursive: true });
    fs.mkdirSync(path.join(rootB, "-Users-demo-b"), { recursive: true });
    fs.writeFileSync(
      path.join(rootA, "-Users-demo-a", `${sessA}.jsonl`),
      fixtureLines(sessA, "/Users/demo/a", "claude-opus-4-7", 3, 2)
        .map((o) => JSON.stringify(o))
        .join("\n")
    );
    fs.writeFileSync(
      path.join(rootB, "-Users-demo-b", `${sessB}.jsonl`),
      fixtureLines(sessB, "/Users/demo/b", "claude-sonnet-4-6", 4, 1)
        .map((o) => JSON.stringify(o))
        .join("\n")
    );

    try {
      const [rA, rB] = await Promise.all([
        post("/api/import/scan-path", { path: rootA }),
        post("/api/import/scan-path", { path: rootB }),
      ]);
      assert.equal(rA.status, 200);
      assert.equal(rB.status, 200);
      assert.ok(stmts.getSession.get(sessA), "session A should be imported");
      assert.ok(stmts.getSession.get(sessB), "session B should be imported");
    } finally {
      fs.rmSync(rootA, { recursive: true, force: true });
      fs.rmSync(rootB, { recursive: true, force: true });
    }
  });
});
