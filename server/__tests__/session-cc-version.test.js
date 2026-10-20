/**
 * @file Tests for recording each session's Claude Code version and pricing
 * version-gated intro rates with it. Sonnet 5.5 cache reads cost $0.20 in
 * Claude Code up to 2.1.295 and $0.10 from 2.1.296; the dashboard follows the
 * version the session recorded, falling back to the date when none is known.
 * Covers the transcript parser (first version wins), the live hook path that
 * stamps `metadata.version`, the startup backfill for older sessions, and the
 * session cost endpoints that read it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `session-cc-version-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", "-tmp-cc-version");
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const TranscriptCache = require("../lib/transcript-cache");
const { backfillSessionVersions } = require("../../scripts/import-history");

let server;
let BASE;

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function request(method, urlPath, body) {
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
        res.on("end", () => resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }));
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const line = (entry) => JSON.stringify(entry);
const userLine = (version) =>
  line({ type: "user", version, message: { role: "user", content: "hi" } });
const assistantLine = (id, version) =>
  line({
    type: "assistant",
    version,
    timestamp: "2026-10-10T10:00:00.000Z",
    message: {
      id,
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
      content: [{ type: "text", text: "x" }],
    },
  });

function writeTranscript(sessionId, lines) {
  const p = path.join(PROJECT_DIR, `${sessionId}.jsonl`);
  fs.writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

function metadataOf(sessionId) {
  const row = stmts.getSession.get(sessionId);
  return row && row.metadata ? JSON.parse(row.metadata) : {};
}

describe("TranscriptCache — Claude Code version", () => {
  it("keeps the first version seen, across an incremental read", () => {
    const p = writeTranscript("cache-version", [
      line({ type: "summary", summary: "no version here" }),
      userLine("2.1.286"),
    ]);
    const cache = new TranscriptCache();
    assert.equal(cache.extract(p).ccVersion, "2.1.286");

    fs.appendFileSync(p, assistantLine("m1", "2.1.296") + "\n");
    assert.equal(cache.extract(p).ccVersion, "2.1.286", "a resumed newer process does not win");
  });
});

describe("live hook path", () => {
  it("stamps the session's Claude Code version into metadata once", async () => {
    const SID = "30000000-0000-0000-0000-000000000001";
    const p = writeTranscript(SID, [userLine("2.1.286"), assistantLine("m1", "2.1.286")]);
    const res = await request("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: SID, cwd: "/tmp/cc-version", transcript_path: p },
    });
    assert.equal(res.status, 200);
    assert.equal(metadataOf(SID).version, "2.1.286");
  });
});

describe("backfillSessionVersions", () => {
  it("stamps versions onto sessions recorded without one, then does no more work", async () => {
    const withVersion = "backfill-version-1";
    const withoutVersion = "backfill-version-2";
    stmts.insertSession.run(withVersion, "t", "completed", "/tmp/cc-version", null, null);
    stmts.insertSession.run(
      withoutVersion,
      "t",
      "completed",
      "/tmp/cc-version",
      null,
      JSON.stringify({ turn_count: 2 })
    );
    const setPath = db.prepare("UPDATE sessions SET transcript_path = ? WHERE id = ?");
    setPath.run(writeTranscript(withVersion, [userLine("2.1.290")]), withVersion);
    setPath.run(
      writeTranscript(withoutVersion, [line({ type: "summary", summary: "x" })]),
      withoutVersion
    );

    const first = await backfillSessionVersions(dbModule);
    assert.ok(first.stamped >= 1);
    assert.equal(metadataOf(withVersion).version, "2.1.290");
    assert.deepEqual(
      metadataOf(withoutVersion),
      { turn_count: 2, version: null },
      "existing metadata is kept; a transcript with no version is marked as looked at"
    );

    const second = await backfillSessionVersions(dbModule);
    assert.equal(second.sessions, 0, "every session drops out after one look");
  });
});

describe("session cost by Claude Code version", () => {
  // 1M Sonnet 5.5 cache reads: $0.20 when the version (or, without one, the
  // date) is before the repricing, $0.10 after.
  function seedSession(id, startedAt, version) {
    stmts.insertSession.run(
      id,
      "t",
      "completed",
      "/tmp/cc-version",
      "claude-sonnet-5-5",
      version === undefined ? null : JSON.stringify({ version })
    );
    db.prepare("UPDATE sessions SET started_at = ? WHERE id = ?").run(startedAt, id);
    stmts.replaceTokenUsage.run(
      id,
      "claude-sonnet-5-5",
      "standard",
      "global",
      "standard",
      "short",
      0,
      0,
      1_000_000,
      0,
      0,
      0,
      0,
      0
    );
  }

  for (const [id, startedAt, version, expected] of [
    ["cost-old-version", "2026-10-15T12:00:00.000Z", "2.1.286", 0.2],
    ["cost-new-version", "2026-10-01T12:00:00.000Z", "2.1.296", 0.1],
    ["cost-no-version-before", "2026-10-01T12:00:00.000Z", undefined, 0.2],
    ["cost-no-version-after", "2026-10-15T12:00:00.000Z", undefined, 0.1],
  ]) {
    it(`${id}: /api/pricing/cost/:id and the sessions list agree on $${expected}`, async () => {
      seedSession(id, startedAt, version);
      const single = await request("GET", `/api/pricing/cost/${id}`);
      assert.equal(single.status, 200);
      assert.equal(single.body.total_cost, expected);

      const detail = await request("GET", `/api/sessions/${id}`);
      assert.equal(detail.status, 200);
      const list = await request("GET", "/api/sessions?limit=200");
      const listed = list.body.sessions.find((s) => s.id === id);
      assert.equal(listed.cost, expected);
    });
  }
});
