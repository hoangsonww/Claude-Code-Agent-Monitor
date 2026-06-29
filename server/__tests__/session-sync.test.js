/**
 * @file Tests for syncDefaultProjects — the incremental, mtime-fingerprinted
 * sync of ~/.claude/projects that backs the background session-sync poll
 * (server/index.js startSessionSync). Verifies that a project added after the
 * one-time backfill is discovered, that an unchanged sweep does no work, and
 * that a grown session is reported as an update (not a new session).
 *
 * Runs in its own process (node --test isolates files), so pointing CLAUDE_HOME
 * and DASHBOARD_DB_PATH at temp locations before requiring the modules gives a
 * clean, isolated projects dir + database without touching the real ones.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-sync-home-"));
process.env.CLAUDE_HOME = TMP_HOME;
process.env.DASHBOARD_DB_PATH = path.join(TMP_HOME, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(TMP_HOME, "data");

const PROJECTS_DIR = path.join(TMP_HOME, "projects");
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const dbModule = require("../db");
const { syncDefaultProjects } = require("../../scripts/import-history");

const SESSION_NEW = "11111111-aaaa-4aaa-8aaa-111111111111";

function fixtureLines(sessionId, cwd, extra = []) {
  return [
    {
      type: "user",
      cwd,
      sessionId,
      timestamp: "2026-04-18T12:00:00.000Z",
      message: { content: "hi" },
    },
    {
      type: "assistant",
      cwd,
      sessionId,
      timestamp: "2026-04-18T12:00:00.000Z",
      message: {
        model: "claude-opus-4-8",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    },
    ...extra,
  ];
}

function writeSession(projName, sessionId, lines) {
  const projDir = path.join(PROJECTS_DIR, projName);
  fs.mkdirSync(projDir, { recursive: true });
  const file = path.join(projDir, `${sessionId}.jsonl`);
  fs.writeFileSync(file, lines.map((o) => JSON.stringify(o)).join("\n") + "\n");
  return file;
}

after(() => {
  if (dbModule.db) dbModule.db.close();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
});

describe("syncDefaultProjects", () => {
  const mtimeCache = new Map();

  it("discovers a newly added project and reports it as a new session", async () => {
    writeSession("-work", SESSION_NEW, fixtureLines(SESSION_NEW, "/work"));

    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache });

    const hit = changed.find((c) => c.sessionId === SESSION_NEW);
    assert.ok(hit, "the new session should be reported");
    assert.equal(hit.isNew, true, "a session not yet in the DB is new");
    assert.ok(dbModule.stmts.getSession.get(SESSION_NEW), "session should be imported into the DB");
  });

  it("does no work on a second sweep when nothing changed", async () => {
    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache });
    assert.equal(changed.length, 0, "an unchanged sweep reports no sessions");
  });

  it("reports a grown session as an update, not a new session", async () => {
    const file = writeSession(
      "-work",
      SESSION_NEW,
      fixtureLines(SESSION_NEW, "/work", [
        {
          type: "assistant",
          cwd: "/work",
          sessionId: SESSION_NEW,
          timestamp: "2026-04-18T12:05:00.000Z",
          message: {
            model: "claude-opus-4-8",
            content: [{ type: "text", text: "more" }],
            usage: { input_tokens: 7, output_tokens: 3 },
          },
        },
      ])
    );
    // Force a clearly-later mtime so the sweep treats the file as changed.
    const future = Date.now() / 1000 + 60;
    fs.utimesSync(file, future, future);

    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache });

    const hit = changed.find((c) => c.sessionId === SESSION_NEW);
    assert.ok(hit, "the grown session should be reported");
    assert.equal(hit.isNew, false, "an already-imported session counts as an update");
  });

  it("never throws when the projects dir is empty of sessions", async () => {
    const emptyCache = new Map();
    const emptyProj = path.join(PROJECTS_DIR, "-empty");
    fs.mkdirSync(emptyProj, { recursive: true });
    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache: emptyCache });
    // -empty contributes nothing; the pre-existing -work session is brand new to
    // this fresh cache, so it is reported once — but the empty dir must not error.
    assert.ok(Array.isArray(changed));
  });

  it("skips re-parsing an already-imported, unchanged session even on a cold cache", async () => {
    // Models the immediate sweep after every server restart: mtimeCache is
    // empty, but the DB already holds these sessions. An unchanged file must NOT
    // be re-parsed/re-reported (the cold-restart fast path), so a large history
    // doesn't re-parse every transcript on boot.
    const SESSION_STABLE = "22222222-bbbb-4bbb-8bbb-222222222222";
    writeSession("-stable", SESSION_STABLE, fixtureLines(SESSION_STABLE, "/stable"));

    // First sweep (cold cache) imports it.
    const first = await syncDefaultProjects(dbModule, { mtimeCache: new Map() });
    assert.ok(
      first.changed.find((c) => c.sessionId === SESSION_STABLE && c.isNew),
      "first sweep imports the new session"
    );

    // Second sweep with a FRESH (cold) cache: the file is unchanged and the row
    // exists, so the gate skips it — nothing reported for SESSION_STABLE.
    const second = await syncDefaultProjects(dbModule, { mtimeCache: new Map() });
    assert.equal(
      second.changed.find((c) => c.sessionId === SESSION_STABLE),
      undefined,
      "an unchanged, already-imported session is skipped on a cold cache"
    );
  });
});
