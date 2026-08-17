/**
 * @file Tests for the first-user-prompt fallback descriptor (issue #201).
 * Covers:
 *   - TranscriptCache capturing the first real user message plus the two
 *     newest distinct human prompts (tool-result, meta/caveat, slash-command
 *     plumbing, and interrupt entries skipped), normalized and length-capped
 *     across incremental re-reads.
 *   - The hook ingestor filling placeholder session/main-agent names and the
 *     main agent task from the descriptor — without clobbering real titles,
 *     user-set names, or an in-flight current_tool — and staying idempotent.
 *   - A later ai-title replacing a descriptor-filled session name.
 *   - importSession using the descriptor for imported sessions (new rows and
 *     the re-import backfill path).
 * Uses Node's built-in test runner with temp CLAUDE_HOME / DASHBOARD_DATA_DIR.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const STAMP = `first-user-desc-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const CLAUDE_HOME = path.join(TMP, "home");
const DATA_DIR = path.join(TMP, "data");
const TEST_DB = path.join(TMP, "dashboard.db");
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = DATA_DIR;

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const TranscriptCache = require("../lib/transcript-cache");
const { parseSessionFile, importSession } = require("../../scripts/import-history");

const enc = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, "-");
const PROJECTS = path.join(CLAUDE_HOME, "projects");

function jsonl(lines) {
  return lines.map((o) => JSON.stringify(o)).join("\n") + "\n";
}

function transcriptPath(cwd, sessionId) {
  return path.join(PROJECTS, enc(cwd), `${sessionId}.jsonl`);
}

function writeTranscript(cwd, sessionId, lines) {
  const p = transcriptPath(cwd, sessionId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, jsonl(lines));
  return p;
}

function appendTranscript(cwd, sessionId, lines) {
  const p = transcriptPath(cwd, sessionId);
  fs.appendFileSync(p, jsonl(lines));
  return p;
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

let server;
let BASE;

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("TranscriptCache — first user message extraction", () => {
  it("captures the first real prompt, skipping caveat/command/tool-result entries", () => {
    const cwd = "/tmp/fud-cache-skip";
    const sid = "cache-skip";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        isMeta: true,
        message: {
          role: "user",
          content: "<local-command-caveat>Caveat: local commands</local-command-caveat>",
        },
      },
      {
        type: "user",
        message: { role: "user", content: "<command-name>/model</command-name>" },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: "<local-command-stdout>Set model</local-command-stdout>",
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "result text" }],
        },
      },
      {
        type: "user",
        message: { role: "user", content: "fix the   login\nbug in auth.ts" },
      },
      { type: "user", message: { role: "user", content: "a later prompt" } },
    ]);
    const r = new TranscriptCache().extract(p);
    assert.ok(r, "result should not be null");
    // Whitespace runs / newlines collapse to single spaces; first prompt wins.
    assert.equal(r.firstUserMessage, "fix the login bug in auth.ts");
    assert.deepEqual(r.recentUserMessages, ["fix the login bug in auth.ts", "a later prompt"]);
  });

  it("skips user-interrupt entries and caps the captured text at 500 chars", () => {
    const cwd = "/tmp/fud-cache-cap";
    const sid = "cache-cap";
    const long = "x".repeat(600);
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: "[Request interrupted by user]" }],
        },
      },
      { type: "user", message: { role: "user", content: long } },
    ]);
    const r = new TranscriptCache().extract(p);
    assert.equal(r.firstUserMessage, "x".repeat(500));
  });

  it("returns a result for a transcript that has ONLY a user prompt", () => {
    const cwd = "/tmp/fud-cache-only";
    const sid = "cache-only";
    const p = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "just a prompt" } },
    ]);
    const r = new TranscriptCache().extract(p);
    assert.ok(r, "result should not be null");
    assert.equal(r.firstUserMessage, "just a prompt");
  });

  it("keeps the FIRST prompt across incremental appends (first wins)", () => {
    const cwd = "/tmp/fud-cache-incr";
    const sid = "cache-incr";
    const cache = new TranscriptCache();
    const p = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "original prompt" } },
    ]);
    assert.equal(cache.extract(p).firstUserMessage, "original prompt");
    appendTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "second prompt" } },
    ]);
    // Force a fresh stat (mtime granularity) by touching size — append above
    // already grew the file, so the incremental path runs.
    const appended = cache.extract(p);
    assert.equal(appended.firstUserMessage, "original prompt");
    assert.deepEqual(appended.recentUserMessages, ["original prompt", "second prompt"]);
  });

  it("keeps only the two newest distinct prompts for compact card context", () => {
    const cwd = "/tmp/fud-cache-recent";
    const sid = "cache-recent";
    const p = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "first task" } },
      { type: "user", message: { role: "user", content: "second task" } },
      { type: "user", message: { role: "user", content: "first task" } },
      { type: "user", message: { role: "user", content: "final refinement" } },
    ]);
    const result = new TranscriptCache().extract(p);
    assert.deepEqual(result.recentUserMessages, ["first task", "final refinement"]);
  });
});

describe("hook ingestor — descriptor fills placeholders", () => {
  it("fills placeholder session name and main agent name/task on UserPromptSubmit", async () => {
    const cwd = "/tmp/fud-hook-fill";
    const sid = "10000000-0000-0000-0000-000000000001";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "add dark mode to settings" } },
    ]);
    const res = await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(res.status, 200);
    const sess = stmts.getSession.get(sid);
    assert.equal(sess.name, "add dark mode to settings");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "Main Agent - add dark mode to settings");
    assert.equal(main.task, "add dark mode to settings");
    assert.equal(sess.card_prompt_preview, "add dark mode to settings");
  });

  it("refreshes Claude card context with the two newest real prompts", async () => {
    const cwd = "/tmp/fud-hook-card-preview";
    const sid = "10000000-0000-0000-0000-000000000008";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "investigate the sync delay" } },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    appendTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "also cover remote sources" } },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });

    assert.equal(
      stmts.getSession.get(sid).card_prompt_preview,
      "investigate the sync delay\nalso cover remote sources"
    );
    const listed = await req("GET", "/api/sessions?limit=20");
    assert.equal(
      listed.body.sessions.find((session) => session.id === sid).prompt_preview,
      "investigate the sync delay\nalso cover remote sources"
    );
  });

  it("truncates long prompts to 60 chars for names but keeps the task longer", async () => {
    const cwd = "/tmp/fud-hook-trunc";
    const sid = "10000000-0000-0000-0000-000000000002";
    const prompt = "p".repeat(100);
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: prompt } },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    const sess = stmts.getSession.get(sid);
    assert.equal(sess.name, "p".repeat(57) + "...");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, `Main Agent - ${"p".repeat(57)}...`);
    assert.equal(main.task, prompt);
  });

  it("title still wins: ai-title takes the session name, descriptor fills the agent", async () => {
    const cwd = "/tmp/fud-hook-title";
    const sid = "10000000-0000-0000-0000-000000000003";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "investigate the flaky test" } },
      { type: "ai-title", aiTitle: "Flaky test investigation", sessionId: sid },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    const sess = stmts.getSession.get(sid);
    assert.equal(sess.name, "Flaky test investigation");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "Main Agent - investigate the flaky test");
    assert.equal(main.task, "investigate the flaky test");
  });

  it("a later ai-title replaces a descriptor-filled session name", async () => {
    const cwd = "/tmp/fud-hook-later-title";
    const sid = "10000000-0000-0000-0000-000000000004";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "refactor the websocket layer" } },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(stmts.getSession.get(sid).name, "refactor the websocket layer");

    appendTranscript(cwd, sid, [
      { type: "ai-title", aiTitle: "WebSocket refactor", sessionId: sid },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(stmts.getSession.get(sid).name, "WebSocket refactor");
  });

  it("never clobbers a user-set session name or a renamed main agent", async () => {
    const cwd = "/tmp/fud-hook-user-set";
    const sid = "10000000-0000-0000-0000-000000000005";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "descriptor text" } },
    ]);
    // Seed the session, then simulate user-chosen names on both rows.
    await req("POST", "/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: sid, cwd },
    });
    stmts.updateSessionName.run("my chosen name", sid, "my chosen name");
    stmts.updateAgent.run("My Renamed Agent", null, "my task", null, null, null, `${sid}-main`);

    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(stmts.getSession.get(sid).name, "my chosen name");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "My Renamed Agent");
    assert.equal(main.task, "my task");
  });

  it("preserves an in-flight current_tool when filling the main agent", async () => {
    const cwd = "/tmp/fud-hook-tool";
    const sid = "10000000-0000-0000-0000-000000000006";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "run the test suite" } },
    ]);
    // PreToolUse stamps current_tool = Bash in the same transaction that then
    // applies the descriptor — the fill must not wipe the in-flight tool.
    await req("POST", "/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: sid, cwd, transcript_path: tpath, tool_name: "Bash" },
    });
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.current_tool, "Bash");
    assert.equal(main.name, "Main Agent - run the test suite");
    assert.equal(main.task, "run the test suite");
  });

  it("is idempotent — a second event changes nothing", async () => {
    const cwd = "/tmp/fud-hook-idem";
    const sid = "10000000-0000-0000-0000-000000000007";
    const tpath = writeTranscript(cwd, sid, [
      { type: "user", message: { role: "user", content: "one prompt only" } },
    ]);
    await req("POST", "/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    const before = {
      session: stmts.getSession.get(sid).name,
      agent: stmts.getAgent.get(`${sid}-main`),
    };
    await req("POST", "/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd, transcript_path: tpath },
    });
    assert.equal(stmts.getSession.get(sid).name, before.session);
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, before.agent.name);
    assert.equal(main.task, before.agent.task);
  });
});

describe("import — descriptor for imported sessions", () => {
  it("parseSessionFile falls back to the first user prompt below titles", async () => {
    const cwd = "/tmp/fud-import-parse";
    const sid = "20000000-0000-0000-0000-000000000001";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        cwd,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "build the CSV exporter" },
      },
    ]);
    const parsed = await parseSessionFile(p);
    assert.equal(parsed.firstUserMessage, "build the CSV exporter");
    assert.equal(parsed.name, "build the CSV exporter");
  });

  it("a real title still outranks the descriptor in parseSessionFile", async () => {
    const cwd = "/tmp/fud-import-title";
    const sid = "20000000-0000-0000-0000-000000000002";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        cwd,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "some prompt" },
      },
      { type: "ai-title", aiTitle: "Real title", sessionId: sid },
    ]);
    const parsed = await parseSessionFile(p);
    assert.equal(parsed.name, "Real title");
    assert.equal(parsed.firstUserMessage, "some prompt");
  });

  it("importSession names new rows and their main agent from the descriptor", async () => {
    const cwd = "/tmp/fud-import-new";
    const sid = "20000000-0000-0000-0000-000000000003";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        cwd,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "wire up the pricing table" },
      },
    ]);
    const parsed = await parseSessionFile(p);
    importSession(dbModule, parsed);
    const sess = stmts.getSession.get(sid);
    assert.equal(sess.name, "wire up the pricing table");
    assert.equal(sess.card_prompt_preview, "wire up the pricing table");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "Main Agent - wire up the pricing table");
    assert.equal(main.task, "wire up the pricing table");
  });

  it("re-import backfills placeholder-named rows created by earlier imports", async () => {
    const cwd = "/tmp/fud-import-backfill";
    const sid = "20000000-0000-0000-0000-000000000004";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        cwd,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "migrate the alerts schema" },
      },
    ]);
    // Simulate an old import: cwd-derived placeholder session + agent names.
    // metadata.imported = true is what routes importSession to its backfill
    // branch (hand-created sessions are never touched by re-imports).
    const base = path.basename(cwd);
    stmts.insertSession.run(
      sid,
      `${base} - ${sid.slice(0, 8)}`,
      "completed",
      cwd,
      null,
      JSON.stringify({ imported: true })
    );
    stmts.insertAgent.run(
      `${sid}-main`,
      sid,
      `Main Agent - ${base} - ${sid.slice(0, 8)}`,
      "main",
      null,
      "completed",
      null,
      null,
      null
    );

    const parsed = await parseSessionFile(p);
    const result = importSession(dbModule, parsed);
    assert.equal(result.backfilled, true);
    assert.equal(stmts.getSession.get(sid).name, "migrate the alerts schema");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "Main Agent - migrate the alerts schema");
    assert.equal(main.task, "migrate the alerts schema");
  });

  it("re-import keeps user-picked names intact", async () => {
    const cwd = "/tmp/fud-import-keep";
    const sid = "20000000-0000-0000-0000-000000000005";
    const p = writeTranscript(cwd, sid, [
      {
        type: "user",
        cwd,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: { role: "user", content: "descriptor that must not apply" },
      },
    ]);
    stmts.insertSession.run(
      sid,
      "picked by hand",
      "completed",
      cwd,
      null,
      JSON.stringify({ imported: true })
    );
    stmts.insertAgent.run(
      `${sid}-main`,
      sid,
      "Main Agent - picked by hand",
      "main",
      null,
      "completed",
      "hand-written task",
      null,
      null
    );
    const parsed = await parseSessionFile(p);
    importSession(dbModule, parsed);
    assert.equal(stmts.getSession.get(sid).name, "picked by hand");
    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.name, "Main Agent - picked by hand");
    assert.equal(main.task, "hand-written task");
  });
});
