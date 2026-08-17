/**
 * @file Regression test for issue #223 — the packaged desktop app froze on a
 * large ~/.claude/projects history. The desktop shell hosts the Express server
 * IN the Electron main process, so a session sweep that scans every file
 * synchronously (statSync + a getSession query per file) with no yield freezes
 * the whole window. `syncDefaultProjects` must yield to the event loop
 * periodically — even on the all-unchanged, cold-cache fast path that never
 * parses a transcript — so a multi-thousand-session history can't monopolize
 * the loop. Under `npm start` the server is its own process, which is why the
 * hang only reproduced in the packaged app.
 *
 * Runs in its own process (node --test isolates files), so pointing CLAUDE_HOME
 * and DASHBOARD_DB_PATH at temp locations before requiring the modules gives a
 * clean, isolated projects dir + database without touching the real ones.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-sync-yield-"));
process.env.CLAUDE_HOME = TMP_HOME;
process.env.DASHBOARD_DB_PATH = path.join(TMP_HOME, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(TMP_HOME, "data");

const PROJECTS_DIR = path.join(TMP_HOME, "projects");
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const dbModule = require("../db");
const { syncDefaultProjects } = require("../../scripts/import-history");

// Enough sessions that the sweep crosses several yield boundaries
// (SWEEP_YIELD_EVERY_FILES = 100), so a cooperative sweep interleaves multiple
// event-loop ticks while a blocking one interleaves zero.
const SESSION_COUNT = 300;

function sessionLines(sessionId) {
  return [
    {
      type: "user",
      cwd: "/w",
      sessionId,
      timestamp: "2026-04-18T12:00:00.000Z",
      message: { content: "hi" },
    },
    {
      type: "assistant",
      cwd: "/w",
      sessionId,
      timestamp: "2026-04-18T12:00:00.000Z",
      message: {
        model: "claude-opus-4-8",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    },
  ];
}

before(() => {
  const projDir = path.join(PROJECTS_DIR, "-w");
  fs.mkdirSync(projDir, { recursive: true });
  for (let i = 0; i < SESSION_COUNT; i++) {
    // Valid v4 UUID shape, unique per index.
    const suffix = i.toString(16).padStart(12, "0");
    const id = `00000000-0000-4000-8000-${suffix}`;
    fs.writeFileSync(
      path.join(projDir, `${id}.jsonl`),
      sessionLines(id)
        .map((o) => JSON.stringify(o))
        .join("\n") + "\n"
    );
  }
});

after(() => {
  if (dbModule.db) dbModule.db.close();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
});

describe("syncDefaultProjects cooperative yielding (#223)", () => {
  it("imports the full history on the first sweep", async () => {
    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache: new Map() });
    assert.equal(
      changed.length,
      SESSION_COUNT,
      "every session is imported on the cold first sweep"
    );
  });

  it("yields to the event loop during an all-unchanged cold-cache sweep", async () => {
    // Count event-loop ticks that fire DURING the sweep. A blocking sweep runs
    // the whole scan synchronously (no await on the unchanged fast path), so a
    // setImmediate chain scheduled alongside it gets zero ticks until it
    // finishes. A cooperative sweep yields every SWEEP_YIELD_EVERY_FILES files,
    // letting the chain advance mid-sweep.
    let ticks = 0;
    let active = true;
    const pump = () => {
      if (active) {
        ticks += 1;
        setImmediate(pump);
      }
    };
    setImmediate(pump);

    // Fresh (cold) cache but the rows already exist and the files are unchanged,
    // so every file takes the fast path — the exact restart/poll scenario that
    // froze the app. Nothing is reported as changed.
    const { changed } = await syncDefaultProjects(dbModule, { mtimeCache: new Map() });
    active = false;

    assert.equal(changed.length, 0, "an unchanged sweep still reports no work");
    assert.ok(
      ticks >= 2,
      `sweep must yield to the event loop on the fast path (observed ${ticks} ticks across ${SESSION_COUNT} files)`
    );
  });
});
