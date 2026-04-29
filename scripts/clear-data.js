#!/usr/bin/env node

/**
 * Clears all sessions, agents, events, and token usage from the database.
 * Destructive — requires explicit confirmation.
 *
 * Usage:
 *   node scripts/clear-data.js --yes              Wipe everything (irrevocable)
 *   node scripts/clear-data.js --yes --backup     Snapshot DB to data/backups/ first
 *   node scripts/clear-data.js --demo-only --yes  Delete only seed-fixture rows
 *   node scripts/clear-data.js                    Dry run — print counts, do nothing
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  try {
    Database = require("../server/compat-sqlite");
  } catch {
    console.error(
      "Error: No SQLite backend available. Upgrade to Node.js 22+ or install build tools."
    );
    process.exit(1);
  }
}
const fs = require("fs");
const path = require("path");

const args = new Set(process.argv.slice(2));
const CONFIRMED = args.has("--yes") || args.has("-y");
const BACKUP = args.has("--backup");
const DEMO_ONLY = args.has("--demo-only");
const DRY_RUN = args.has("--dry-run") || !CONFIRMED;

const DB_PATH = process.env.DASHBOARD_DB_PATH || path.join(__dirname, "..", "data", "dashboard.db");

if (!fs.existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH} — nothing to clear.`);
  process.exit(0);
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = OFF");

const counts = {
  token_usage: db.prepare("SELECT COUNT(*) as n FROM token_usage").get()?.n ?? 0,
  events: db.prepare("SELECT COUNT(*) as n FROM events").get()?.n ?? 0,
  agents: db.prepare("SELECT COUNT(*) as n FROM agents").get()?.n ?? 0,
  sessions: db.prepare("SELECT COUNT(*) as n FROM sessions").get()?.n ?? 0,
};

const totalRows = counts.sessions + counts.agents + counts.events + counts.token_usage;

console.log("");
console.log(`Target DB: ${DB_PATH}`);
console.log("Current row counts:");
console.log(`  Sessions: ${counts.sessions.toLocaleString()}`);
console.log(`  Agents:   ${counts.agents.toLocaleString()}`);
console.log(`  Events:   ${counts.events.toLocaleString()}`);
console.log(`  Tokens:   ${counts.token_usage.toLocaleString()}`);
console.log("");

if (DRY_RUN) {
  db.close();
  console.log("⚠️  DRY RUN — no data was deleted.");
  console.log("");
  console.log("This is a DESTRUCTIVE operation. To actually wipe the database,");
  console.log("re-run with --yes:");
  console.log("");
  console.log("  node scripts/clear-data.js --yes");
  console.log("");
  console.log("Strongly recommended: also pass --backup to snapshot the DB first:");
  console.log("");
  console.log("  node scripts/clear-data.js --yes --backup");
  console.log("");
  if (DEMO_ONLY) {
    console.log("(--demo-only would delete only rows tagged as seed fixtures.)");
  }
  process.exit(0);
}

// Confirmed path — actually delete.

if (BACKUP) {
  const backupDir = path.join(path.dirname(DB_PATH), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `dashboard.${stamp}.db`);
  // Use SQLite VACUUM INTO for a consistent snapshot
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  console.log(`📦 Backup written: ${backupPath}`);
}

if (DEMO_ONLY) {
  // Delete only fixture rows. These IDs are stable across seed runs.
  const FIXTURE_SESSION_IDS = [
    "demo-solo-0001-0001-0001-000000000001",
    "demo-nested-0001-0001-0001-000000000001",
  ];
  const placeholders = FIXTURE_SESSION_IDS.map(() => "?").join(",");
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM events WHERE session_id IN (${placeholders})`).run(
      ...FIXTURE_SESSION_IDS
    );
    db.prepare(`DELETE FROM agents WHERE session_id IN (${placeholders})`).run(
      ...FIXTURE_SESSION_IDS
    );
    db.prepare(`DELETE FROM token_usage WHERE session_id IN (${placeholders})`).run(
      ...FIXTURE_SESSION_IDS
    );
    db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...FIXTURE_SESSION_IDS);
  });
  tx();
  console.log(
    `Cleared demo fixture rows (${FIXTURE_SESSION_IDS.length} sessions and their children).`
  );
} else {
  console.log(`⚠️  Wiping ${totalRows.toLocaleString()} rows…`);
  db.exec("DELETE FROM token_usage; DELETE FROM events; DELETE FROM agents; DELETE FROM sessions;");
  console.log("Database cleared.");
}

db.pragma("foreign_keys = ON");
db.close();

console.log("");
console.log(
  "Tip: run `npm run import-history` to restore sessions from ~/.claude/ JSONL transcripts."
);
