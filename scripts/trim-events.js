#!/usr/bin/env node
/**
 * @file One-time shrink of `events.data` rows stored before payload trimming
 * existed (or restored from an older export). Applies the same
 * trimHookPayload() the hook route now applies on ingest, rewrites only rows
 * that change, then VACUUMs to give the space back.
 *
 * Usage:
 *   node scripts/trim-events.js                 Dry run (read-only): report what would change
 *   node scripts/trim-events.js --yes           Rewrite rows and VACUUM
 *   node scripts/trim-events.js --yes --backup  Snapshot the DB to backups/ first
 *
 * Stop the dashboard first: VACUUM needs the only connection, and a live
 * server would keep inserting while the sweep runs. Each batch commits on its
 * own, so an interrupted run leaves a consistent database and a re-run simply
 * continues (already-trimmed rows are unchanged by a second pass).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { getDataDir } = require("../server/lib/claude-home");
const { trimHookPayload } = require("../server/lib/event-payload");

const args = new Set(process.argv.slice(2));
const CONFIRMED = args.has("--yes") || args.has("-y");
const BACKUP = args.has("--backup");
const BATCH = 2000;

// Mirror server/db.js resolution so we rewrite the database the server uses.
const DB_PATH = process.env.DASHBOARD_DB_PATH || path.join(getDataDir(), "dashboard.db");

if (!fs.existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH} — nothing to trim.`);
  process.exit(0);
}

const db = new Database(DB_PATH, { readonly: !CONFIRMED });
db.pragma("busy_timeout = 5000");
const sizeBefore = fs.statSync(DB_PATH).size;

if (CONFIRMED && BACKUP) {
  const backupDir = path.join(path.dirname(DB_PATH), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `dashboard.${stamp}.db`);
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  console.log(`Backup written: ${backupPath}`);
}

const selectBatch = db.prepare(
  "SELECT id, data FROM events WHERE id > ? AND data IS NOT NULL ORDER BY id LIMIT ?"
);
const update = CONFIRMED ? db.prepare("UPDATE events SET data = ? WHERE id = ?") : null;
const applyBatch = CONFIRMED
  ? db.transaction((rows) => {
      for (const row of rows) update.run(row.data, row.id);
    })
  : null;

let scanned = 0;
let changed = 0;
let written = 0;
let bytesBefore = 0;
let bytesAfter = 0;
let lastId = 0;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

try {
  for (;;) {
    const rows = selectBatch.all(lastId, BATCH);
    if (rows.length === 0) break;
    const pending = [];
    for (const row of rows) {
      lastId = row.id;
      scanned += 1;
      let parsed;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        continue; // not JSON — leave it alone
      }
      const trimmed = trimHookPayload(parsed);
      if (trimmed === parsed) continue;
      const next = JSON.stringify(trimmed);
      changed += 1;
      bytesBefore += Buffer.byteLength(row.data);
      bytesAfter += Buffer.byteLength(next);
      pending.push({ id: row.id, data: next });
    }
    if (CONFIRMED && pending.length > 0) {
      applyBatch(pending);
      written += pending.length;
    }
  }
} catch (err) {
  console.error("");
  console.error(`Stopped at event id ${lastId}: ${err.message}`);
  console.error(
    `${written.toLocaleString()} row(s) were rewritten before that and are consistent; ` +
      "re-run to continue (a running dashboard is the usual cause — stop it first)."
  );
  db.close();
  process.exit(1);
}

console.log("");
console.log(`Database: ${DB_PATH} (${mb(sizeBefore)})`);
console.log(
  `Rows scanned: ${scanned.toLocaleString()}  rows to rewrite: ${changed.toLocaleString()}`
);
console.log(`Those rows: ${mb(bytesBefore)} → ${mb(bytesAfter)}`);

if (!CONFIRMED) {
  db.close();
  console.log("");
  console.log(
    "DRY RUN (read-only) — nothing was written. Stop the dashboard, then re-run with --yes"
  );
  console.log("(add --backup to snapshot the database first).");
  process.exit(0);
}

console.log(`Rewrote ${written.toLocaleString()} row(s). VACUUM…`);
try {
  db.exec("VACUUM");
} catch (err) {
  console.error(
    `VACUUM failed: ${err.message}. Rows are rewritten; run VACUUM once the dashboard is stopped.`
  );
  db.close();
  process.exit(1);
}
db.close();
console.log(`Done. Database is now ${mb(fs.statSync(DB_PATH).size)}.`);
