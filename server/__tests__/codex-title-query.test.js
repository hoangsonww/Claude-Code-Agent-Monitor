/**
 * @file Verifies title discovery reads only actual renames, binds unusual title
 * strings safely, preserves provider scope and batches beyond SQLite limits.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-title-query-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "dashboard.db");
const { db } = require("../db");
const { refreshCodexSessionTitles } = require("../lib/codex-ingest");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

it("large stable title maps emit no rows, then only exact Codex renames", () => {
  const titles = [];
  const insert = db.prepare("INSERT INTO sessions(id,name,provider) VALUES(?,?,?)");
  db.transaction(() => {
    for (let n = 0; n < 530; n++) {
      const id = `native-${n}`,
        name = `Title ${n}`;
      insert.run(id, name, "codex");
      titles.push({ id, thread_name: name });
    }
    for (let n = 0; n < 300; n++) insert.run(`unindexed-${n}`, "Untouched", "codex");
    insert.run("claude-owned", "Keep Claude", "claude");
  })();
  titles.push({ id: "claude-owned", thread_name: "Do not apply" });
  titles.push({ id: "not-in-dashboard", thread_name: "Do not create" });
  const index = path.join(process.env.DASHBOARD_CODEX_HOME, "session_index.jsonl");
  fs.mkdirSync(path.dirname(index), { recursive: true });
  const write = () =>
    fs.writeFileSync(index, titles.map((row) => JSON.stringify(row)).join("\n") + "\n");
  write();
  const prepare = db.prepare;
  const reads = [];
  db.prepare = function (sql) {
    const statement = prepare.call(this, sql);
    if (sql.startsWith("WITH desired")) {
      const all = statement.all;
      statement.all = function (...params) {
        const rows = all.apply(this, params);
        reads.push({ params: params.length, rows: rows.length });
        return rows;
      };
    }
    return statement;
  };
  try {
    assert.deepEqual(refreshCodexSessionTitles(), []);
    assert.equal(reads.length, 3);
    assert.ok(reads.every((read) => read.rows === 0 && read.params <= 500));
    reads.length = 0;
    const unusual = "Quoted ' title ); DROP TABLE sessions; -- Привет 🎵";
    titles[0].thread_name = unusual;
    titles[529].thread_name = "Title 529 changed";
    write();
    const changed = refreshCodexSessionTitles();
    assert.deepEqual(changed.map((row) => row.session.id).sort(), ["native-0", "native-529"]);
    assert.equal(
      reads.reduce((n, read) => n + read.rows, 0),
      2
    );
    assert.equal(db.prepare("SELECT name FROM sessions WHERE id='native-0'").get().name, unusual);
    assert.equal(
      db.prepare("SELECT name FROM sessions WHERE id='claude-owned'").get().name,
      "Keep Claude"
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id='not-in-dashboard'").get().n,
      0
    );
    assert.deepEqual(refreshCodexSessionTitles(), []);
  } finally {
    db.prepare = prepare;
  }
});
