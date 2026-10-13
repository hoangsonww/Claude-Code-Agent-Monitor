/**
 * @file Exercises interrupted source status recovery without changing import receipts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-cost-repair-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = root;
process.env.DASHBOARD_DB_PATH = path.join(root, "base.db");
const { db } = require("../db");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  return db;
}
it("interrupted source sync is an error and preserves the preceding receipt", () => {
  const d = fixture();
  try {
    d.exec(
      "INSERT INTO remote_sources(id,label,host,status,claude_status,codex_status,last_sync_at,last_sync_counts) VALUES('box','Box','fixture','syncing','error','syncing','2026-10-01','{\"imported\":20}')"
    );
    const { recoverInterruptedSyncs } = require("../lib/remote-sync");
    assert.equal(recoverInterruptedSyncs({ db: d }), 1);
    const row = d.prepare("SELECT * FROM remote_sources").get();
    assert.equal(row.status, "error");
    assert.equal(row.claude_status, "error");
    assert.equal(row.codex_status, "error");
    assert.equal(row.last_sync_at, "2026-10-01");
    assert.equal(row.last_sync_counts, '{"imported":20}');
    assert.match(row.last_error, /interrupted/);
    assert.equal(recoverInterruptedSyncs({ db: d }), 0);
  } finally {
    d.exec("DELETE FROM remote_sources");
  }
});
