#!/usr/bin/env node
/**
 * @file One-time shrink of `events.data` rows stored before payload trimming
 * existed. Applies the same trimHookPayload() the hook route now applies on
 * ingest, rewrites only rows that change, then VACUUMs to give the space back.
 *
 * Usage:
 *   node scripts/trim-events.js                 Dry run: report what would change
 *   node scripts/trim-events.js --yes           Rewrite rows and VACUUM
 *   node scripts/trim-events.js --yes --backup  Snapshot the DB to backups/ first
 *
 * Stop the dashboard first: VACUUM needs the only connection, and a live
 * server would keep inserting while the sweep runs.
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

const db = new Database(DB_PATH);
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
  "SELECT id, data FROM events WHERE id > ? AND length(data) > 512 ORDER BY id LIMIT ?"
);
const update = db.prepare("UPDATE events SET data = ? WHERE id = ?");
const applyBatch = db.transaction((rows) => {
  for (const row of rows) update.run(row.data, row.id);
});

let scanned = 0;
let changed = 0;
let bytesBefore = 0;
let bytesAfter = 0;
let lastId = 0;

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
  if (CONFIRMED && pending.length > 0) applyBatch(pending);
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log("");
console.log(`Database: ${DB_PATH} (${mb(sizeBefore)})`);
console.log(
  `Rows scanned: ${scanned.toLocaleString()}  rows to rewrite: ${changed.toLocaleString()}`
);
console.log(`Those rows: ${mb(bytesBefore)} → ${mb(bytesAfter)}`);

if (!CONFIRMED) {
  db.close();
  console.log("");
  console.log("DRY RUN — nothing was written. Stop the dashboard, then re-run with --yes");
  console.log("(add --backup to snapshot the database first).");
  process.exit(0);
}

console.log("VACUUM…");
db.exec("VACUUM");
db.close();
console.log(`Done. Database is now ${mb(fs.statSync(DB_PATH).size)}.`);
