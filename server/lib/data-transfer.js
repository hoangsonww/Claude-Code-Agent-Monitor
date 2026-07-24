/**
 * @file server/lib/data-transfer.js
 * @description Full-dataset export/import ("backup / restore") for the local
 * dashboard database. This is the round-trip counterpart to the transcript
 * importer (scripts/import-history.js): where that reconstructs sessions from
 * raw Claude Code JSONL, this serializes the dashboard's OWN captured data to a
 * single portable JSON bundle and restores it later — the workflow a user needs
 * to consolidate several machines into one dashboard.
 *
 * Design guarantees:
 *   • Complete — the bundle carries every table that holds user-owned captured
 *     data or portable configuration: sessions, agents, events, token_usage,
 *     workflows, dashboard_runs, alert_rules, and model_pricing. Machine-bound
 *     or secret-bearing tables (push_subscriptions, webhook_targets/deliveries,
 *     alert_events audit log) are intentionally excluded.
 *   • Idempotent + non-destructive — restore is session-atomic: a session that
 *     already exists (matched by its stable UUID) is skipped WHOLE, together
 *     with its agents/events/token_usage/workflows, so re-importing the same
 *     bundle (or overlapping bundles from two machines) never duplicates rows
 *     or clobbers live data. Independent config rows (dashboard_runs,
 *     alert_rules, model_pricing) are inserted with INSERT OR IGNORE on their
 *     natural primary key.
 *   • Accurate — token_usage (including compaction baselines) is restored
 *     verbatim for every new session, so cost/analytics match the source
 *     machine exactly. events are re-inserted WITHOUT their source autoincrement
 *     id (which is not portable across databases); SQLite assigns fresh ids.
 *   • Schema-tolerant — inserts are built by intersecting each table's live
 *     columns (PRAGMA table_info) with the keys present on each row, so older
 *     or newer bundles import cleanly without a migration step.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const EXPORT_FORMAT = "ccam-export";
const EXPORT_VERSION = 1;

// Tables serialized into the bundle. Order matters for restore (parents before
// children); FK checks are deferred to COMMIT anyway (see importExportBundle).
const SESSION_CHILD_TABLES = ["agents", "events", "token_usage", "workflows"];

/**
 * Build the full export bundle from the live database.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {{ listPricing: { all: () => any[] } }} stmts - the prepared-statement
 *   bag from server/db.js (used for the canonical model_pricing ordering).
 * @returns {object} A JSON-serializable bundle stamped with format/version.
 */
function buildExportBundle(db, stmts) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    sessions: db.prepare("SELECT * FROM sessions ORDER BY started_at DESC").all(),
    agents: db.prepare("SELECT * FROM agents ORDER BY started_at DESC").all(),
    events: db.prepare("SELECT * FROM events ORDER BY created_at DESC").all(),
    token_usage: db.prepare("SELECT * FROM token_usage").all(),
    workflows: db.prepare("SELECT * FROM workflows").all(),
    dashboard_runs: db.prepare("SELECT * FROM dashboard_runs ORDER BY started_at DESC").all(),
    alert_rules: db.prepare("SELECT * FROM alert_rules ORDER BY created_at ASC").all(),
    model_pricing: stmts.listPricing.all(),
  };
}

/** Column names of a table, in definition order. */
function tableColumns(db, table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
}

// better-sqlite3 only binds numbers/strings/bigints/buffers/null. A row parsed
// from JSON never contains booleans/objects for these tables (SQLite stores
// them as INTEGER/TEXT), but a missing key yields `undefined`, which throws —
// normalize it to null so partial/legacy rows still bind.
function bindable(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

/**
 * Make a prepared INSERT OR IGNORE that only writes the columns a table
 * actually has AND the row actually provides. `omit` drops columns even if
 * present (used to strip the non-portable events.id).
 */
function makeInserter(db, table, { omit = [] } = {}) {
  const cols = tableColumns(db, table).filter((c) => !omit.includes(c));
  const quoted = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (${quoted}) VALUES (${placeholders})`);
  return (row) => stmt.run(cols.map((c) => bindable(row[c])));
}

/** Group an array of rows by a key field into a Map. */
function groupBy(rows, key) {
  const map = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || r[key] == null) continue;
    const k = r[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

class ImportFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportFormatError";
    this.code = "INVALID_FORMAT";
  }
}

/**
 * Validate a parsed object looks like an export bundle. Accepts bundles stamped
 * with our format marker AND legacy exports (pre-versioning) that merely carry
 * a `sessions` array, so old backups remain importable.
 *
 * @throws {ImportFormatError}
 */
function assertBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new ImportFormatError("Not a valid export file (expected a JSON object).");
  }
  if (bundle.format && bundle.format !== EXPORT_FORMAT) {
    throw new ImportFormatError(
      `Unrecognized export format "${bundle.format}" (expected "${EXPORT_FORMAT}").`
    );
  }
  const hasAnyTable =
    Array.isArray(bundle.sessions) ||
    Array.isArray(bundle.model_pricing) ||
    Array.isArray(bundle.alert_rules) ||
    Array.isArray(bundle.dashboard_runs);
  if (!bundle.format && !hasAnyTable) {
    throw new ImportFormatError(
      "Not a recognizable dashboard export (no sessions/pricing/rules arrays)."
    );
  }
}

/**
 * Restore an export bundle into the live database. Idempotent and
 * non-destructive (see file header). Runs inside a single transaction with
 * deferred FK checks so agent parent/child ordering never trips a constraint.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} bundle - parsed export JSON.
 * @returns {{sessions_imported:number, sessions_skipped:number, agents:number,
 *   events:number, token_usage:number, workflows:number, dashboard_runs:number,
 *   alert_rules:number, model_pricing:number, errors:number}}
 */
function importExportBundle(db, bundle) {
  assertBundle(bundle);

  const counters = {
    sessions_imported: 0,
    sessions_skipped: 0,
    agents: 0,
    events: 0,
    token_usage: 0,
    workflows: 0,
    dashboard_runs: 0,
    alert_rules: 0,
    model_pricing: 0,
    errors: 0,
  };

  const sessionExists = db.prepare("SELECT 1 FROM sessions WHERE id = ?").pluck();

  const insert = {
    sessions: makeInserter(db, "sessions"),
    agents: makeInserter(db, "agents"),
    events: makeInserter(db, "events", { omit: ["id"] }),
    token_usage: makeInserter(db, "token_usage"),
    workflows: makeInserter(db, "workflows"),
    dashboard_runs: makeInserter(db, "dashboard_runs"),
    alert_rules: makeInserter(db, "alert_rules"),
    model_pricing: makeInserter(db, "model_pricing"),
  };

  const childRows = {
    agents: groupBy(bundle.agents, "session_id"),
    events: groupBy(bundle.events, "session_id"),
    token_usage: groupBy(bundle.token_usage, "session_id"),
    workflows: groupBy(bundle.workflows, "session_id"),
  };

  const sessions = Array.isArray(bundle.sessions) ? bundle.sessions : [];

  const run = db.transaction(() => {
    // Defer FK enforcement to COMMIT: an agent's parent_agent_id may point to a
    // sibling that is inserted later in the same batch. Auto-resets at COMMIT.
    db.pragma("defer_foreign_keys = ON");

    for (const s of sessions) {
      if (!s || !s.id) {
        counters.errors++;
        continue;
      }
      if (sessionExists.get(s.id)) {
        counters.sessions_skipped++;
        continue;
      }
      insert.sessions(s);
      counters.sessions_imported++;

      // Agents first so events/token_usage that reference them satisfy FKs.
      for (const a of childRows.agents.get(s.id) || []) {
        if (insert.agents(a).changes > 0) counters.agents++;
      }
      // Insert events oldest-first so fresh autoincrement ids stay chronological.
      const evs = (childRows.events.get(s.id) || [])
        .slice()
        .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      for (const e of evs) {
        if (insert.events(e).changes > 0) counters.events++;
      }
      for (const tu of childRows.token_usage.get(s.id) || []) {
        if (insert.token_usage(tu).changes > 0) counters.token_usage++;
      }
      for (const wf of childRows.workflows.get(s.id) || []) {
        if (insert.workflows(wf).changes > 0) counters.workflows++;
      }
    }

    // Session-independent, config-like tables: restore by natural PK, never
    // overwriting a row the target machine already has.
    for (const r of Array.isArray(bundle.dashboard_runs) ? bundle.dashboard_runs : []) {
      if (r && r.id && insert.dashboard_runs(r).changes > 0) counters.dashboard_runs++;
    }
    for (const r of Array.isArray(bundle.alert_rules) ? bundle.alert_rules : []) {
      if (r && r.id && insert.alert_rules(r).changes > 0) counters.alert_rules++;
    }
    for (const p of Array.isArray(bundle.model_pricing) ? bundle.model_pricing : []) {
      if (p && p.model_pattern && insert.model_pricing(p).changes > 0) counters.model_pricing++;
    }
  });

  run();
  return counters;
}

module.exports = {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  SESSION_CHILD_TABLES,
  buildExportBundle,
  importExportBundle,
  ImportFormatError,
};
