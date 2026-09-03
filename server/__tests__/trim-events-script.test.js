/**
 * @file End-to-end test of scripts/trim-events.js against a throwaway
 * database: the dry run writes nothing, --yes rewrites only the rows that
 * change, and a second --yes run finds nothing left to do (the sweep is
 * idempotent, which is what makes an interrupted run safe to repeat).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");
const Database = require("better-sqlite3");

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "trim-events.js");
const DB_PATH = path.join(os.tmpdir(), `trim-events-test-${Date.now()}-${process.pid}.db`);

function run(...flags) {
  // Hermetic: the caps and env-file location of the developer's shell must
  // not steer the asserts.
  const env = { ...process.env, DASHBOARD_DB_PATH: DB_PATH, DASHBOARD_ENV_PATH: "/dev/null" };
  delete env.DASHBOARD_EVENT_STRING_CAP;
  delete env.DASHBOARD_EVENT_FIELD_CAP;
  const res = spawnSync(process.execPath, [SCRIPT, ...flags], { env, encoding: "utf8" });
  return { code: res.status, out: `${res.stdout}\n${res.stderr}` };
}

function rows() {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return db.prepare("SELECT id, data FROM events ORDER BY id").all();
  } finally {
    db.close();
  }
}

describe("scripts/trim-events.js", () => {
  before(() => {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)");
    const insert = db.prepare("INSERT INTO events (data) VALUES (?)");
    insert.run(JSON.stringify({ tool_name: "Bash", tool_response: { stdout: "fine" } }));
    insert.run(
      JSON.stringify({
        tool_name: "Edit",
        tool_response: { filePath: "/f", originalFile: "o".repeat(100_000), structuredPatch: [] },
      })
    );
    insert.run(JSON.stringify({ tool_name: "Bash", tool_response: { stdout: "x".repeat(5000) } }));
    insert.run("not json");
    insert.run(null);
    // More trimmable rows than one batch holds, so the sweep has to continue.
    for (let i = 0; i < 250; i++) {
      insert.run(
        JSON.stringify({ tool_name: "Bash", tool_response: { stdout: "z".repeat(3000) } })
      );
    }
    db.close();
  });

  after(() => {
    fs.rmSync(path.join(path.dirname(DB_PATH), "backups"), { recursive: true, force: true });
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(DB_PATH + suffix);
      } catch {
        /* ignore */
      }
    }
  });

  it("dry run reports the rows that would change and writes nothing", () => {
    const before = rows();
    const { code, out } = run();
    assert.equal(code, 0, out);
    assert.match(out, /rows to rewrite: 252/);
    assert.match(out, /DRY RUN/);
    assert.equal(fs.existsSync(path.join(path.dirname(DB_PATH), "backups")), false);
    assert.deepEqual(rows(), before);
  });

  it("--yes rewrites only the rows that change, then a re-run is a no-op", () => {
    const first = run("--yes", "--backup");
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /Rewrote 252 row\(s\)/);
    const backupMatch = /Backup written: (.+)/.exec(first.out);
    assert.ok(backupMatch, "backup path printed");
    assert.ok(fs.existsSync(backupMatch[1].trim()), "backup file exists");
    const after = rows();
    assert.equal(after.length, 255);
    assert.match(JSON.parse(after[254].data).tool_response.stdout, /trimmed 952 more chars/);
    assert.equal(JSON.parse(after[0].data).tool_response.stdout, "fine");
    const edit = JSON.parse(after[1].data);
    assert.equal(edit.tool_response.originalFile, undefined);
    assert.equal(edit._trimmed.dropped["tool_response.originalFile"], 100_002);
    const bash = JSON.parse(after[2].data);
    assert.match(bash.tool_response.stdout, /… \[trimmed 2952 more chars\]$/);
    assert.equal(after[3].data, "not json");
    assert.equal(after[4].data, null);

    const second = run("--yes");
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /rows to rewrite: 0/);
    assert.deepEqual(rows(), after);
  });
});
