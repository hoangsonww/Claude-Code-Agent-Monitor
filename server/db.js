/**
 * @file Database setup and access layer using SQLite for storing sessions, agents, events, token usage, and model pricing. Handles schema creation, migrations, and provides prepared statements for all database operations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

let Database;
try {
  Database = require("better-sqlite3");
  // `require` only loads better-sqlite3's JS; its native addon is resolved
  // lazily on the first `new Database(...)`. Probe it here (a throwaway
  // in-memory handle) so a missing or ABI-mismatched binary — e.g. installed
  // for a different Node version — falls back to node:sqlite now, instead of
  // crashing later at the real `new Database(DB_PATH)` outside any try/catch.
  new Database(":memory:").close();
} catch {
  try {
    Database = require("./compat-sqlite");
  } catch {
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════╗\n" +
        "║  SQLite backend not available                                ║\n" +
        "║                                                              ║\n" +
        "║  better-sqlite3 could not be loaded (native module) and      ║\n" +
        "║  node:sqlite is not available (requires Node.js >= 22).      ║\n" +
        "║                                                              ║\n" +
        "║  Fix options (pick one):                                     ║\n" +
        "║    1. Upgrade to Node.js 22+ (recommended)                   ║\n" +
        "║    2. Install Python 3 + C++ build tools, then               ║\n" +
        "║       run: npm rebuild better-sqlite3                        ║\n" +
        "╚══════════════════════════════════════════════════════════════╝\n"
    );
    process.exit(1);
  }
}
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { getDataDir } = require("./lib/claude-home");

/**
 * Seed `targetPath` from the richest pre-existing database when none exists
 * there yet. Best-effort and strictly non-destructive: it never overwrites the
 * target and never modifies or deletes the sources, so existing web users keep
 * an untouched backup at the old path.
 *
 * Earlier builds kept the DB per-host — the repo-local `data/` dir for
 * `npm start`/`dev`, and the desktop app's per-user `userData/data` (handed in
 * via DASHBOARD_LEGACY_DB_PATH). When both exist we copy the larger one (more
 * rows ≈ larger file) so the fuller history wins.
 */
function migrateLegacyDatabase(targetPath) {
  try {
    // Respect explicit overrides: if the operator pinned the path, they own it.
    if (process.env.DASHBOARD_DB_PATH || process.env.DASHBOARD_DATA_DIR) return;
    if (fs.existsSync(targetPath)) return; // already migrated, or in active use

    const candidates = [
      process.env.DASHBOARD_LEGACY_DB_PATH, // desktop app's old per-user DB
      path.join(__dirname, "..", "data", "dashboard.db"), // repo-local `npm start` DB
    ].filter((p) => p && fs.existsSync(p));
    if (candidates.length === 0) return;

    const source = candidates
      .map((p) => ({ p, size: fs.statSync(p).size }))
      .sort((a, b) => b.size - a.size)[0].p;

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // `VACUUM INTO` produces a consistent, fully-checkpointed single-file copy —
    // safe even when another process still holds the source open in WAL mode,
    // and it never touches the source. A raw file copy of a live WAL database,
    // by contrast, can capture an inconsistent .db/-wal/-shm trio and yield a
    // "database disk image is malformed" file, so we deliberately do NOT fall
    // back to one. `VACUUM INTO` ships in every SQLite the project uses (3.27+:
    // better-sqlite3 and node:sqlite both support it).
    const src = new Database(source);
    try {
      src.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
    } finally {
      src.close();
    }

    // Carry over the one-time legacy-import marker so the (idempotent) backfill
    // doesn't needlessly re-run against the migrated copy.
    const srcMarker = path.join(path.dirname(source), ".legacy-import.done");
    const dstMarker = path.join(path.dirname(targetPath), ".legacy-import.done");
    if (fs.existsSync(srcMarker) && !fs.existsSync(dstMarker)) {
      try {
        fs.copyFileSync(srcMarker, dstMarker);
      } catch {
        /* non-fatal */
      }
    }

    console.log(`[db] migrated existing database → ${targetPath} (from ${source})`);
  } catch (err) {
    // Migration is an optimization, never a hard requirement. On any failure,
    // remove a possibly-partial target so the next start retries (or falls back
    // to a fresh empty DB) instead of opening a half-written, corrupt file. The
    // source is never modified, so nothing is lost.
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.rmSync(targetPath + suffix, { force: true });
      } catch {
        /* best effort */
      }
    }
    console.warn("[db] legacy database migration skipped:", err?.message || err);
  }
}

// Resolution order: explicit DASHBOARD_DB_PATH wins; otherwise the file lives in
// the shared data dir — DASHBOARD_DATA_DIR if set, else the canonical user-global
// `~/.claude/agent-dashboard/` (see getDataDir). Resolving every launch path to
// the same file is what lets the web app and the native apps share ONE database.
const DB_PATH = process.env.DASHBOARD_DB_PATH || path.join(getDataDir(), "dashboard.db");
const DB_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DB_DIR, { recursive: true });

// One-time, non-destructive migration into the shared location. Earlier builds
// kept the database per-host: the repo-local `data/` dir for `npm start`/`dev`,
// and the desktop app's per-user `userData/data` (handed to us via
// DASHBOARD_LEGACY_DB_PATH). If the canonical DB doesn't exist yet, seed it from
// the richest legacy copy found so existing users keep all their history. The
// source files are never modified or deleted, and an existing canonical DB is
// never overwritten — so this is safe to run on every startup.
migrateLegacyDatabase(DB_PATH);

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','error','abandoned')),
    cwd TEXT,
    model TEXT,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at TEXT,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'main' CHECK(type IN ('main','subagent')),
    subagent_type TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('working','waiting','completed','error')),
    task TEXT,
    current_tool TEXT,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at TEXT,
    parent_agent_id TEXT,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_agent_id) REFERENCES agents(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    event_type TEXT NOT NULL,
    tool_name TEXT,
    summary TEXT,
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS token_usage (
    session_id TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'unknown',
    -- Pricing dimensions: tokens are bucketed by these because each changes the
    -- per-token RATE (fast mode, US data residency, Batch API). Defaults match
    -- the standard/global/standard rate so historical rows price unchanged.
    speed TEXT NOT NULL DEFAULT 'standard',
    inference_geo TEXT NOT NULL DEFAULT 'global',
    service_tier TEXT NOT NULL DEFAULT 'standard',
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    -- Subset of cache_write_tokens stored at the 1h tier; 5m = total - 1h.
    cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
    -- Server-tool request counts (billed separately from tokens).
    web_search_requests INTEGER NOT NULL DEFAULT 0,
    web_fetch_requests INTEGER NOT NULL DEFAULT 0,
    code_execution_requests INTEGER NOT NULL DEFAULT 0,
    -- Compaction baselines preserve pre-rewrite totals (effective = current + baseline).
    baseline_input INTEGER NOT NULL DEFAULT 0,
    baseline_output INTEGER NOT NULL DEFAULT 0,
    baseline_cache_read INTEGER NOT NULL DEFAULT 0,
    baseline_cache_write INTEGER NOT NULL DEFAULT 0,
    baseline_cache_write_1h INTEGER NOT NULL DEFAULT 0,
    baseline_web_search INTEGER NOT NULL DEFAULT 0,
    baseline_web_fetch INTEGER NOT NULL DEFAULT 0,
    baseline_code_execution INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, model, speed, inference_geo, service_tier),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS model_pricing (
    model_pattern TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    input_per_mtok REAL NOT NULL DEFAULT 0,
    output_per_mtok REAL NOT NULL DEFAULT 0,
    cache_read_per_mtok REAL NOT NULL DEFAULT 0,
    cache_write_per_mtok REAL NOT NULL DEFAULT 0,
    cache_write_1h_per_mtok REAL NOT NULL DEFAULT 0,
    -- Fast mode (research preview) premium input/output rates; 0 = no fast pricing.
    -- Cache rates in fast mode are derived from fast_input via the standard
    -- caching multipliers (see server/lib/pricing-constants.js).
    fast_input_per_mtok REAL NOT NULL DEFAULT 0,
    fast_output_per_mtok REAL NOT NULL DEFAULT 0,
    -- Time-limited introductory rates. When intro_until is set, usage on/before
    -- that date (YYYY-MM-DD) is priced at the intro_* rates and usage after it at
    -- the standard rates — so promo pricing (e.g. Claude Sonnet 5's launch
    -- discount through 2026-08-31) stays correct for historical and future usage
    -- at all times. 0 / NULL means "no intro rate" → standard rates always apply.
    intro_input_per_mtok REAL NOT NULL DEFAULT 0,
    intro_output_per_mtok REAL NOT NULL DEFAULT 0,
    intro_cache_read_per_mtok REAL NOT NULL DEFAULT 0,
    intro_cache_write_per_mtok REAL NOT NULL DEFAULT 0,
    intro_cache_write_1h_per_mtok REAL NOT NULL DEFAULT 0,
    intro_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Persistent record of every Claude run spawned via the dashboard's
  -- /api/run endpoint. Survives the in-memory handle reap so the Run page
  -- can list completed / errored / killed runs and offer Resume long after
  -- the spawner has forgotten about them.
  CREATE TABLE IF NOT EXISTS dashboard_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    mode TEXT NOT NULL,
    cwd TEXT NOT NULL,
    model TEXT,
    permission_mode TEXT,
    effort TEXT,
    resume_session_id TEXT,
    prompt_preview TEXT,
    status TEXT NOT NULL,
    exit_code INTEGER,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id);
  CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

  -- Composite indexes for frequent query patterns (columns that exist at table creation time)
  CREATE INDEX IF NOT EXISTS idx_events_session_type ON events(session_id, event_type);
  -- Subagent JSONL import dedups each tool event with
  -- "WHERE agent_id = ? AND event_type = ? AND data LIKE '%tool_use_id%'".
  -- Without an agent_id index that is a full events-table scan per tool event;
  -- on a large DB a single re-import (e.g. the startup sync sweep re-touching a
  -- session with many subagents) becomes tens of seconds and blocks the event
  -- loop. This composite narrows each dedup to the agent's events of that type.
  CREATE INDEX IF NOT EXISTS idx_events_agent_type ON events(agent_id, event_type);
  CREATE INDEX IF NOT EXISTS idx_agents_session_type ON agents(session_id, type);
  CREATE INDEX IF NOT EXISTS idx_dashboard_runs_started ON dashboard_runs(started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_dashboard_runs_session ON dashboard_runs(session_id);

  -- Rules-based alerting engine. Rules are evaluated server-side: event-driven
  -- types (event_pattern, token_threshold) on hook ingest, time-based types
  -- (inactivity, status_duration) on a periodic sweep in server/lib/alerts.js.
  CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK(rule_type IN ('event_pattern','inactivity','status_duration','token_threshold')),
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    cooldown_seconds INTEGER NOT NULL DEFAULT 300,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Fired alerts. rule_name/rule_type are snapshotted so history stays
  -- readable after a rule is edited. session_id intentionally has no FK:
  -- alerts are an audit trail and must survive session cleanup.
  CREATE TABLE IF NOT EXISTS alert_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    message TEXT NOT NULL,
    details TEXT,
    triggered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    acknowledged_at TEXT,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_alert_events_triggered ON alert_events(triggered_at DESC);
  CREATE INDEX IF NOT EXISTS idx_alert_events_rule ON alert_events(rule_id);
  CREATE INDEX IF NOT EXISTS idx_alert_events_session ON alert_events(session_id);

  -- Universal webhook delivery for fired alerts. A target is an outbound
  -- destination (Slack / Discord / Teams / any generic HTTP endpoint). When an
  -- alert fires, server/lib/webhooks.js formats a per-platform payload and
  -- POSTs it to every enabled target (optionally scoped to specific rules).
  -- Targets are user configuration and survive Clear Data, like alert_rules.
  CREATE TABLE IF NOT EXISTS webhook_targets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- provider key (slack, discord, teams, telegram, pagerduty, …). Not a DB
    -- CHECK: the provider registry in server/lib/webhook-providers.js is the
    -- single source of truth and the route validates against it, so a CHECK
    -- here would just be a second list to keep in sync.
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    -- optional HMAC-SHA256 signing secret (generic targets): when set, the raw
    -- request body is signed and sent as X-Webhook-Signature.
    secret TEXT,
    -- optional JSON object of extra request headers (generic targets only).
    headers TEXT,
    -- optional JSON array of alert_rule ids this target is scoped to. NULL or
    -- empty array means "all rules".
    rule_ids TEXT,
    -- optional JSON object of provider-specific config (e.g. Telegram chat_id,
    -- PagerDuty routing_key, Opsgenie api_key + region). Schema is per-provider
    -- and lives in server/lib/webhook-providers.js. Secret fields are redacted
    -- in API responses.
    config TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Delivery audit log: one row per completed delivery attempt-chain. alert_id
  -- intentionally has no FK (like alert_events.session_id) — deliveries are an
  -- audit trail and the referenced alert may be wiped by Clear Data. NULL
  -- alert_id marks a manual "Send test" ping.
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    target_type TEXT NOT NULL,
    alert_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('success','failed')),
    status_code INTEGER,
    attempts INTEGER NOT NULL DEFAULT 1,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (target_id) REFERENCES webhook_targets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_target ON webhook_deliveries(target_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

  -- Workflow-tool runs: fleets of sub-agents spawned by the Claude Code
  -- "Workflow" tool (and self-paced /loop). These emit NO hooks; the source of
  -- truth is the on-disk run journal (~/.claude/projects/<enc-cwd>/<sessionId>/
  -- workflows/wf_<runId>.json), written at workflow COMPLETION. A row is keyed
  -- by run_id, parented to the launching session. status is an open string
  -- (running | completed | error | failed | …) — intentionally no CHECK, so new
  -- harness states never trip a stale constraint. phases/progress hold the
  -- journal's phases[] / workflowProgress[] arrays verbatim (JSON) for detail
  -- rendering; the inner agents are linked via agents.workflow_run_id.
  CREATE TABLE IF NOT EXISTS workflows (
    run_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    task_id TEXT,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    default_model TEXT,
    started_at TEXT,
    ended_at TEXT,
    duration_ms INTEGER,
    agent_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_tool_calls INTEGER NOT NULL DEFAULT 0,
    phases TEXT,
    progress TEXT,
    script_path TEXT,
    journal_path TEXT,
    source TEXT NOT NULL DEFAULT 'journal',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_session ON workflows(session_id);
  CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

  -- Projects: a user-named grouping of one or more working directories. There
  -- is deliberately NO project_id column on sessions - membership is derived
  -- by joining sessions.cwd against project_paths.cwd, so a session created
  -- (or imported) before its folder was ever assigned to a project retroactively
  -- belongs to that project the moment the mapping is added, with no backfill.
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Folder membership: a cwd belongs to at most one project (UNIQUE), while a
  -- project may claim many folders - the one-to-many side lives here rather
  -- than on projects itself.
  CREATE TABLE IF NOT EXISTS project_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    cwd TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_project_paths_project ON project_paths(project_id);

  -- Per-repo plans ingested from <cwd>/AGENT-PLAN.md. Keyed by cwd (projects
  -- aggregate via the project_paths join, exactly like sessions do). The file
  -- is the human-owned source of truth; the dashboard only mirrors it.
  -- missing_at is stamped when the file disappears - the row is kept because
  -- focus history still references its items.
  CREATE TABLE IF NOT EXISTS plans (
    cwd TEXT PRIMARY KEY,
    title TEXT,
    file_path TEXT NOT NULL,
    content_hash TEXT,
    item_count INTEGER NOT NULL DEFAULT 0,
    missing_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- One row per checkbox item. Identity across re-ingest is (cwd, item_id) —
  -- item_id is parsed from the file's "id:" line (or synthesized
  -- deterministically from cwd+item_number for pre-id files — see
  -- fallbackItemId() in plan-ingest.js), and never changes for the life of
  -- the item. item_number is purely positional/display (recomputed from file
  -- order on every ingest) — reordering items is a normal edit, so a row's
  -- item_number can and does change across ingests while item_id stays put;
  -- that's what lets declared_done_at and live focus pointers survive a
  -- reorder instead of looking like a delete+recreate. checked mirrors the
  -- file's checkbox (human-owned); declared_done_* is the agent's claim via
  -- "ccam focus done N" and survives re-ingest (upserts never touch it).
  -- declared_done_session has no FK on purpose - it is an audit trail that
  -- must outlive session deletion.
  -- item_number is NULL for a sub-item (an "N.M" dotted child under a
  -- top-level item — see parent_item_id) since it has no flat, ccam-typeable
  -- number of its own; SQLite's UNIQUE index treats multiple NULLs as
  -- distinct, so any number of sub-items coexist under the same cwd without
  -- colliding. parent_item_id is the parent's item_id (never its number, for
  -- the same reorder-safety reason item identity everywhere else is id-based)
  -- and is NULL for a top-level item.
  CREATE TABLE IF NOT EXISTS plan_items (
    cwd TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_number INTEGER,
    parent_item_id TEXT,
    text TEXT NOT NULL,
    acceptance TEXT,
    detail TEXT,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    declared_done_at TEXT,
    declared_done_session TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (cwd, item_id),
    FOREIGN KEY (cwd) REFERENCES plans(cwd) ON DELETE CASCADE
  );

  -- item_number is only unique-at-a-point-in-time (not a permanent identity
  -- anymore), but every live lookup by number ("ccam focus set <n>" typing
  -- the number currently on screen) still needs it to be unique per cwd.
  -- (NULL item_number rows — sub-items — are exempt by SQLite's own UNIQUE
  -- semantics, not a special case here.)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_items_cwd_number ON plan_items(cwd, item_number);

  -- Current focus per session: which plan item the session declared it is
  -- serving, plus a stack of in-flight detours. History is NOT here - every
  -- focus change also writes a "Focus" row to events, which the timeline
  -- already renders. drift_status is an open string (NULL | ok | drift |
  -- unknown) written only by the drift auditor; declarations never touch it.
  CREATE TABLE IF NOT EXISTS session_focus (
    session_id TEXT PRIMARY KEY,
    cwd TEXT,
    item_number INTEGER,
    note TEXT,
    set_at TEXT,
    detour_stack TEXT NOT NULL DEFAULT '[]',
    drift_status TEXT,
    drift_reason TEXT,
    drift_checked_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_session_focus_cwd ON session_focus(cwd);

  -- Inferred focus for sessions that never declared one. Written only by the
  -- background classifier (server/lib/focus-inference.js), which digests a
  -- silent session's activity (prompts, files touched, commands) and matches
  -- it against the cwd's plan items — or labels it a detour. One row per
  -- session, re-inferred when the session gains activity after inferred_at.
  -- kind: 'item' (item_id set) | 'detour' (label set) | 'unclassified'.
  -- item_id references the plan item's STABLE id (never its display number,
  -- which can change on reorder). method: 'llm' | 'heuristic'. Declared Focus
  -- events always take precedence over this table at report time — inference
  -- only fills gaps, never overwrites ground truth.
  CREATE TABLE IF NOT EXISTS focus_inferences (
    session_id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    kind TEXT NOT NULL,
    item_id TEXT,
    label TEXT,
    confidence REAL,
    method TEXT NOT NULL,
    reason TEXT,
    inferred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_focus_inferences_cwd ON focus_inferences(cwd);

  -- Cached stakeholder-readable window summaries for GET
  -- /api/focus-report/summary (server/lib/focus-summary.js): 2-4 plain
  -- bullets synthesized by a one-shot LLM call from a window's per-session
  -- focus segments. cache_key identifies the scope+window request
  -- (project/session/unassigned/sources + from/to); input_digest hashes the
  -- underlying segment data, so a hit is served only while the data is
  -- unchanged - a still-running day regenerates when new activity lands,
  -- a finished day stays cached forever. bullets: JSON array of strings.
  CREATE TABLE IF NOT EXISTS focus_summaries (
    cache_key TEXT PRIMARY KEY,
    input_digest TEXT NOT NULL,
    bullets TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

// Migrate: give plan_items a stable item_id independent of item_number (see
// the schema comment above). Old DBs have (cwd, item_number) as the primary
// key with no item_id/detail columns at all — rebuild the table, synthesizing
// an item_id per existing row with the SAME deterministic algorithm
// plan-ingest.js falls back to for a not-yet-migrated AGENT-PLAN.md
// (sha1(`${cwd}:${item_number}`).slice(0,8)), so the very next ingest of an
// unmodified legacy file resolves to the identical id and updates these rows
// in place rather than re-creating them (which would silently drop
// declared_done_at — exactly the bug this migration exists to fix).
{
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='plan_items'")
    .get();
  if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("item_id")) {
    db.pragma("foreign_keys = OFF");
    db.prepare("ALTER TABLE plan_items RENAME TO plan_items_old").run();
    db.prepare(
      `CREATE TABLE plan_items (
        cwd TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        acceptance TEXT,
        detail TEXT,
        checked INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        declared_done_at TEXT,
        declared_done_session TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (cwd, item_id),
        FOREIGN KEY (cwd) REFERENCES plans(cwd) ON DELETE CASCADE
      )`
    ).run();
    const oldRows = db.prepare("SELECT * FROM plan_items_old").all();
    const insertMigrated = db.prepare(
      `INSERT INTO plan_items
         (cwd, item_id, item_number, text, acceptance, detail, checked, position,
          declared_done_at, declared_done_session, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
    );
    db.transaction(() => {
      for (const row of oldRows) {
        const itemId = crypto
          .createHash("sha1")
          .update(`${row.cwd}:${row.item_number}`)
          .digest("hex")
          .slice(0, 8);
        insertMigrated.run(
          row.cwd,
          itemId,
          row.item_number,
          row.text,
          row.acceptance,
          row.checked,
          row.position,
          row.declared_done_at,
          row.declared_done_session,
          row.updated_at
        );
      }
    })();
    db.prepare("DROP TABLE plan_items_old").run();
    db.pragma("foreign_keys = ON");
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_items_cwd_number ON plan_items(cwd, item_number);"
  );
}

// Migrate: add sub-item support (parent_item_id, nullable item_number) to
// plan_items. SQLite can't drop a NOT NULL constraint via ALTER TABLE, so
// this rebuilds the table exactly like the item_id migration above —
// deliberately a separate, later block rather than folded into it, so it
// runs (and is independently idempotent) whether the DB just got the item_id
// migration above in this same startup or already had item_id from a prior
// run.
{
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='plan_items'")
    .get();
  if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("parent_item_id")) {
    db.pragma("foreign_keys = OFF");
    db.prepare("ALTER TABLE plan_items RENAME TO plan_items_old").run();
    db.prepare(
      `CREATE TABLE plan_items (
        cwd TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_number INTEGER,
        parent_item_id TEXT,
        text TEXT NOT NULL,
        acceptance TEXT,
        detail TEXT,
        checked INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        declared_done_at TEXT,
        declared_done_session TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (cwd, item_id),
        FOREIGN KEY (cwd) REFERENCES plans(cwd) ON DELETE CASCADE
      )`
    ).run();
    const oldRows = db.prepare("SELECT * FROM plan_items_old").all();
    const insertMigrated = db.prepare(
      `INSERT INTO plan_items
         (cwd, item_id, item_number, parent_item_id, text, acceptance, detail, checked, position,
          declared_done_at, declared_done_session, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    db.transaction(() => {
      for (const row of oldRows) {
        insertMigrated.run(
          row.cwd,
          row.item_id,
          row.item_number,
          row.text,
          row.acceptance,
          row.detail,
          row.checked,
          row.position,
          row.declared_done_at,
          row.declared_done_session,
          row.updated_at
        );
      }
    })();
    db.prepare("DROP TABLE plan_items_old").run();
    db.pragma("foreign_keys = ON");
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_items_cwd_number ON plan_items(cwd, item_number);"
  );
}

// Migrate: link agent rows to a workflow run. Workflow inner-agents are already
// ingested as subagents (same subagents/ dir); these columns add the grouping +
// phase that the run journal provides. Additive, safe on existing DBs.
try {
  db.prepare("SELECT workflow_run_id FROM agents LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE agents ADD COLUMN workflow_run_id TEXT").run();
  db.prepare("ALTER TABLE agents ADD COLUMN workflow_phase TEXT").run();
}
db.prepare("CREATE INDEX IF NOT EXISTS idx_agents_workflow ON agents(workflow_run_id)").run();

// Migrate: add the 1h-ephemeral cache-write rate column to model_pricing.
// Older DBs predate the 5m/1h cache-write split. ADD COLUMN defaults every
// existing row to 0, which is not a realistic rate — so immediately backfill a
// sensible per-model value derived from each row's own rates rather than a flat
// guess (this also covers custom user-added models, not just the defaults):
//   • 1h write ≈ 2× base input            (Anthropic's published ratio)
//   • fallback: 1.6× the 5m write rate     (since 5m ≈ 1.25× input ⇒ 1h ≈ 1.6× 5m)
//   • leave 0 only when neither input nor 5m-write is known.
// User-edited 5m/input/output/read rates are preserved untouched. The top-up
// below only inserts missing patterns, so it can't fill a new column on rows
// that already exist — this backfill is what keeps existing models complete.
try {
  db.prepare("SELECT cache_write_1h_per_mtok FROM model_pricing LIMIT 1").get();
} catch {
  db.prepare(
    "ALTER TABLE model_pricing ADD COLUMN cache_write_1h_per_mtok REAL NOT NULL DEFAULT 0"
  ).run();
  db.prepare(
    `UPDATE model_pricing
     SET cache_write_1h_per_mtok = CASE
       WHEN input_per_mtok > 0 THEN input_per_mtok * 2
       WHEN cache_write_per_mtok > 0 THEN cache_write_per_mtok * 1.6
       ELSE 0
     END
     WHERE cache_write_1h_per_mtok = 0`
  ).run();
}

// Migrate: add fast-mode (research preview) premium rate columns to model_pricing.
// Default 0 (= no fast pricing), then backfill the fast-capable Opus models on
// existing DBs with their published rates so historical configs gain fast pricing
// without a manual "Reset Defaults" (only fills rows still at 0).
try {
  db.prepare("SELECT fast_input_per_mtok FROM model_pricing LIMIT 1").get();
} catch {
  db.prepare(
    "ALTER TABLE model_pricing ADD COLUMN fast_input_per_mtok REAL NOT NULL DEFAULT 0"
  ).run();
  db.prepare(
    "ALTER TABLE model_pricing ADD COLUMN fast_output_per_mtok REAL NOT NULL DEFAULT 0"
  ).run();
  const setFast = db.prepare(
    "UPDATE model_pricing SET fast_input_per_mtok = ?, fast_output_per_mtok = ? WHERE model_pattern = ? AND fast_input_per_mtok = 0"
  );
  setFast.run(10, 50, "claude-opus-4-8%");
  setFast.run(30, 150, "claude-opus-4-7%");
  setFast.run(30, 150, "claude-opus-4-6%");
}

// Migrate: add time-limited introductory-rate columns to model_pricing.
// Usage on/before intro_until prices at the intro_* rates; usage after prices at
// standard — so promo pricing (e.g. Claude Sonnet 5's launch discount) stays
// correct for both historical and future usage. Additive + default 0/NULL, so
// existing rows keep behaving exactly as before until an intro rate is set.
try {
  db.prepare("SELECT intro_until FROM model_pricing LIMIT 1").get();
} catch {
  for (const col of [
    "intro_input_per_mtok",
    "intro_output_per_mtok",
    "intro_cache_read_per_mtok",
    "intro_cache_write_per_mtok",
    "intro_cache_write_1h_per_mtok",
  ]) {
    db.prepare(`ALTER TABLE model_pricing ADD COLUMN ${col} REAL NOT NULL DEFAULT 0`).run();
  }
  db.prepare("ALTER TABLE model_pricing ADD COLUMN intro_until TEXT").run();
}

// Default model pricing — shared by initial seed + startup top-up + reset endpoint
// Columns: pattern, display_name, input, output, cache_read (hits & refreshes),
//          cache_write (5m ephemeral writes), cache_write_1h (1h ephemeral writes),
//          fast_input, fast_output (fast-mode premium; 0 = model has no fast pricing)
// Each model gets its own explicit row — no catch-all grouping.
// Rate shape mirrors Anthropic's published table: 5m write = 1.25× input, 1h write = 2× input.
const DEFAULT_PRICING = [
  // Next-gen flagship
  ["claude-fable-5%", "Claude Fable 5", 10, 50, 1, 12.5, 20, 0, 0],
  ["claude-mythos-5%", "Claude Mythos 5", 10, 50, 1, 12.5, 20, 0, 0],
  // Opus family (fast mode available on 4.6 / 4.7 / 4.8)
  ["claude-opus-4-8%", "Claude Opus 4.8", 5, 25, 0.5, 6.25, 10, 10, 50],
  ["claude-opus-4-7%", "Claude Opus 4.7", 5, 25, 0.5, 6.25, 10, 30, 150],
  ["claude-opus-4-6%", "Claude Opus 4.6", 5, 25, 0.5, 6.25, 10, 30, 150],
  ["claude-opus-4-5%", "Claude Opus 4.5", 5, 25, 0.5, 6.25, 10, 0, 0],
  ["claude-opus-4-1%", "Claude Opus 4.1", 15, 75, 1.5, 18.75, 30, 0, 0],
  ["claude-opus-4-2%", "Claude Opus 4", 15, 75, 1.5, 18.75, 30, 0, 0],
  // Sonnet family
  ["claude-sonnet-5%", "Claude Sonnet 5", 3, 15, 0.3, 3.75, 6, 0, 0],
  ["claude-sonnet-4-6%", "Claude Sonnet 4.6", 3, 15, 0.3, 3.75, 6, 0, 0],
  ["claude-sonnet-4-5%", "Claude Sonnet 4.5", 3, 15, 0.3, 3.75, 6, 0, 0],
  ["claude-sonnet-4-2%", "Claude Sonnet 4", 3, 15, 0.3, 3.75, 6, 0, 0],
  ["claude-3-7-sonnet%", "Claude Sonnet 3.7", 3, 15, 0.3, 3.75, 6, 0, 0],
  ["claude-3-5-sonnet%", "Claude Sonnet 3.5", 3, 15, 0.3, 3.75, 6, 0, 0],
  // Haiku family
  ["claude-haiku-4-5%", "Claude Haiku 4.5", 1, 5, 0.1, 1.25, 2, 0, 0],
  ["claude-3-5-haiku%", "Claude Haiku 3.5", 0.8, 4, 0.08, 1, 1.6, 0, 0],
  ["claude-3-haiku%", "Claude Haiku 3", 0.25, 1.25, 0.03, 0.3, 0.5, 0, 0],
  // Legacy
  ["claude-3-opus%", "Claude Opus 3", 15, 75, 1.5, 18.75, 30, 0, 0],
];

// Top-up: insert any default pattern that isn't already present. Preserves
// user edits to existing rows — we only add what's missing, never overwrite.
// This runs every startup so new default models (e.g. Opus 4.8) appear in the
// Settings UI automatically without requiring a manual "Reset Defaults".
{
  const existing = new Set(
    db
      .prepare("SELECT model_pattern FROM model_pricing")
      .all()
      .map((r) => r.model_pattern)
  );
  const insert = db.prepare(
    "INSERT OR IGNORE INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok, cache_write_1h_per_mtok, fast_input_per_mtok, fast_output_per_mtok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const addMissing = db.transaction((rows) => {
    for (const [pattern, name, inp, out, cr, cw, cw1h, fin, fout] of rows) {
      if (!existing.has(pattern)) insert.run(pattern, name, inp, out, cr, cw, cw1h, fin, fout);
    }
  });
  addMissing(DEFAULT_PRICING);
}

// Known introductory promo rates: [pattern, in, out, cacheRead, cw5m, cw1h, until].
// Standard rates live in the DEFAULT_PRICING row; these add the time-limited
// discount on top. Claude Sonnet 5: 2/3-off launch pricing through 2026-08-31.
const DEFAULT_INTRO_PRICING = [["claude-sonnet-5%", 2, 10, 0.2, 2.5, 4, "2026-08-31"]];

// Backfill the known intro rates. Only fills rows whose intro_until is still
// NULL, so a user who edits or clears an intro rate in Settings is never
// overwritten. Shared by startup and the reset-pricing endpoint (which
// re-seeds standard rates and must re-apply the intro discount too, else Sonnet
// 5 would silently price at standard until the next restart).
function applyIntroPricing(dbHandle = db) {
  const setIntro = dbHandle.prepare(
    `UPDATE model_pricing SET
       intro_input_per_mtok = ?, intro_output_per_mtok = ?, intro_cache_read_per_mtok = ?,
       intro_cache_write_per_mtok = ?, intro_cache_write_1h_per_mtok = ?, intro_until = ?
     WHERE model_pattern = ? AND intro_until IS NULL`
  );
  for (const [pattern, inp, out, cr, cw5m, cw1h, until] of DEFAULT_INTRO_PRICING) {
    setIntro.run(inp, out, cr, cw5m, cw1h, until, pattern);
  }
}
applyIntroPricing();

// Migrate: if token_usage has rows without model column (old schema), add it
try {
  db.prepare("SELECT model FROM token_usage LIMIT 1").get();
} catch {
  // Old schema — recreate table with model column
  db.pragma("foreign_keys = OFF");
  db.prepare("ALTER TABLE token_usage RENAME TO token_usage_old").run();
  db.prepare(
    `
    CREATE TABLE token_usage (
      session_id TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'unknown',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, model),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `
  ).run();
  db.prepare(
    `
    INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
      SELECT tu.session_id, COALESCE(s.model, 'unknown'), tu.input_tokens, tu.output_tokens, tu.cache_read_tokens, tu.cache_write_tokens
      FROM token_usage_old tu LEFT JOIN sessions s ON s.id = tu.session_id
  `
  ).run();
  db.prepare("DROP TABLE token_usage_old").run();
  db.pragma("foreign_keys = ON");
}

// Migrate: add updated_at columns to sessions and agents
try {
  db.prepare("SELECT updated_at FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''").run();
  db.prepare("UPDATE sessions SET updated_at = COALESCE(ended_at, started_at)").run();
}
try {
  db.prepare("SELECT updated_at FROM agents LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE agents ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''").run();
  db.prepare("UPDATE agents SET updated_at = COALESCE(ended_at, started_at)").run();
}

// Composite index on (status, updated_at) — must be AFTER migration adds updated_at
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_sessions_status_updated ON sessions(status, updated_at DESC)`
);

// Migrate: add `awaiting_input_since` columns to sessions and agents.
// When Claude Code emits a Notification asking for permission or user input,
// we mark the session and its main agent as awaiting input by stamping this
// column with the notification's ISO timestamp. The underlying status enum
// stays unchanged (so existing CHECK constraints, queries, and aggregations
// keep working); the UI derives an effective "waiting" status whenever this
// column is non-null.
try {
  db.prepare("SELECT awaiting_input_since FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN awaiting_input_since TEXT").run();
}
try {
  db.prepare("SELECT awaiting_input_since FROM agents LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE agents ADD COLUMN awaiting_input_since TEXT").run();
}

// Migrate: add `awaiting_reason` columns to sessions and agents. Explains WHY
// a row is awaiting input alongside the `awaiting_input_since` timestamp:
// 'notification' (Claude asked the user something), 'stop' (turn completed),
// 'session_start' (new/resumed session waiting for the first prompt), or
// 'interrupted' (watchdog/Esc recovery). Set wherever awaiting_input_since is
// set, cleared (NULL) wherever it is cleared.
try {
  db.prepare("SELECT awaiting_reason FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN awaiting_reason TEXT").run();
}
try {
  db.prepare("SELECT awaiting_reason FROM agents LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE agents ADD COLUMN awaiting_reason TEXT").run();
}

// Migrate: add `transcript_path` to sessions for fast active-session sweep.
// Before this, the periodic compaction sweep had to do
//   SELECT DISTINCT json_extract(events.data, '$.transcript_path') ...
// across the entire events table (250k+ rows in mature DBs). Storing the
// path on sessions lets the sweep query touch only active session rows.
// Backfilled once from the events table; thereafter populated by
// routes/hooks.js ensureSession() and the first event that carries
// transcript_path.
try {
  db.prepare("SELECT transcript_path FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN transcript_path TEXT").run();
  // Backfill: pull the first transcript_path we can find in events for each
  // session. Uses a correlated subquery so SQLite limits the inner scan to
  // each session's rows (still bounded by events row count, but only runs
  // once per DB lifetime).
  // json_valid guard: legacy events.data may hold non-JSON text. Without it,
  // json_extract throws "malformed JSON" mid-UPDATE and aborts startup.
  db.prepare(
    `UPDATE sessions SET transcript_path = (
       SELECT json_extract(e.data, '$.transcript_path')
       FROM events e
       WHERE e.session_id = sessions.id
         AND json_valid(e.data) = 1
         AND json_extract(e.data, '$.transcript_path') IS NOT NULL
       LIMIT 1
     ) WHERE transcript_path IS NULL`
  ).run();
}

// Partial index for the periodic active-session sweep — covers only the
// handful of rows the sweep actually reads.
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_sessions_active_tp
   ON sessions(status, transcript_path)
   WHERE status='active' AND transcript_path IS NOT NULL`
);

// Migrate: add `source` to sessions — the machine a session was collected from.
// 'local' is this dashboard's own machine (the zero-config default that every
// pre-existing and hook-ingested row keeps); a remote_sources.id marks a session
// pulled from another machine over SSH (see server/lib/remote-sync.js). Additive
// + NOT NULL DEFAULT 'local', so every historical row reads exactly as before and
// the whole feature is invisible until the user configures a remote source.
try {
  db.prepare("SELECT source FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'local'").run();
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source)`);

// Remote data sources: other machines whose Claude Code history this dashboard
// pulls in over SSH. Config only — NO secrets are stored here: authentication
// always defers to the host's own SSH stack (~/.ssh/config, ssh-agent, keys,
// known_hosts), so `host` is an ssh destination (user@host or a config alias)
// and `identity_file` is at most a path to a key the user already controls.
// `status`/`last_*` columns are operational state the Settings UI renders.
db.exec(`
  CREATE TABLE IF NOT EXISTS remote_sources (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    host TEXT NOT NULL,
    ssh_port INTEGER,
    identity_file TEXT,
    remote_home TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','syncing','ok','error')),
    last_error TEXT,
    last_sync_at TEXT,
    last_sync_counts TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

// Migrate webhook_targets for first-class providers. Earlier installs created
// the table with a 4-value `type` CHECK (slack/discord/teams/generic) and no
// `config` column. SQLite can't drop a CHECK in place, so rebuild the table
// when the legacy constraint is present; otherwise just add the column.
{
  const meta = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_targets'")
    .get();
  const hasLegacyCheck =
    meta && meta.sql && meta.sql.includes("'slack','discord','teams','generic'");
  if (hasLegacyCheck) {
    db.exec(`
      ALTER TABLE webhook_targets RENAME TO webhook_targets_old;
      CREATE TABLE webhook_targets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        secret TEXT,
        headers TEXT,
        rule_ids TEXT,
        config TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO webhook_targets (id, name, type, url, enabled, secret, headers, rule_ids, config, created_at, updated_at)
        SELECT id, name, type, url, enabled, secret, headers, rule_ids, NULL, created_at, updated_at FROM webhook_targets_old;
      DROP TABLE webhook_targets_old;
    `);
  } else {
    try {
      db.prepare("SELECT config FROM webhook_targets LIMIT 1").get();
    } catch {
      db.prepare("ALTER TABLE webhook_targets ADD COLUMN config TEXT").run();
    }
  }
}

// Migrate: replace legacy idle/connected agent statuses with waiting/working
// and update the CHECK constraint to the 4-status model.
// SQLite doesn't support ALTER CHECK, so we detect the old constraint and
// rebuild the table with rename-copy-drop when needed.
{
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'")
    .get();
  if (tableInfo && tableInfo.sql && tableInfo.sql.includes("'idle'")) {
    // Old constraint found — rebuild the table
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      -- Map old statuses to new ones in-place (still valid under old constraint isn't needed
      -- because we're about to drop the table — we do it in the INSERT below)
      CREATE TABLE agents_new (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'main' CHECK(type IN ('main','subagent')),
        subagent_type TEXT,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('working','waiting','completed','error')),
        task TEXT,
        current_tool TEXT,
        started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ended_at TEXT,
        parent_agent_id TEXT,
        metadata TEXT,
        updated_at TEXT NOT NULL DEFAULT '',
        awaiting_input_since TEXT,
        awaiting_reason TEXT,
        workflow_run_id TEXT,
        workflow_phase TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_agent_id) REFERENCES agents(id) ON DELETE SET NULL
      );
      INSERT INTO agents_new SELECT
        id, session_id, name, type, subagent_type,
        CASE status
          WHEN 'idle' THEN 'waiting'
          WHEN 'connected' THEN 'working'
          ELSE status
        END,
        task, current_tool, started_at, ended_at, parent_agent_id, metadata,
        updated_at, awaiting_input_since, awaiting_reason, workflow_run_id, workflow_phase
      FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_new RENAME TO agents;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    // Recreate indexes that were on the old table
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);
      CREATE INDEX IF NOT EXISTS idx_agents_workflow ON agents(workflow_run_id);
    `);
  }
}

// Migrate: add compaction baseline columns to token_usage.
// When conversation compaction rewrites the JSONL, pre-compaction token counts
// are lost from the transcript. Baselines preserve those counts so the effective
// total = current + baseline.
try {
  db.prepare("SELECT baseline_input FROM token_usage LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE token_usage ADD COLUMN baseline_input INTEGER NOT NULL DEFAULT 0").run();
  db.prepare("ALTER TABLE token_usage ADD COLUMN baseline_output INTEGER NOT NULL DEFAULT 0").run();
  db.prepare(
    "ALTER TABLE token_usage ADD COLUMN baseline_cache_read INTEGER NOT NULL DEFAULT 0"
  ).run();
  db.prepare(
    "ALTER TABLE token_usage ADD COLUMN baseline_cache_write INTEGER NOT NULL DEFAULT 0"
  ).run();
}

// Migrate: re-key token_usage by pricing dimensions (speed / inference_geo /
// service_tier) and add the 1h cache-write split + server-tool request columns
// (with their compaction baselines). SQLite cannot alter a PRIMARY KEY in place,
// so recreate the table. Existing rows map to the standard / global / standard
// bucket with zero tool requests and zero 1h-writes — so their computed cost is
// IDENTICAL to before (all writes priced at the 5m rate). Fully backward
// compatible with historical sessions; old transcripts lacking these usage
// fields continue to price exactly as they did.
try {
  db.prepare("SELECT speed FROM token_usage LIMIT 1").get();
} catch {
  db.pragma("foreign_keys = OFF");
  db.prepare("ALTER TABLE token_usage RENAME TO token_usage_pre_modifiers").run();
  db.prepare(
    `
    CREATE TABLE token_usage (
      session_id TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'unknown',
      speed TEXT NOT NULL DEFAULT 'standard',
      inference_geo TEXT NOT NULL DEFAULT 'global',
      service_tier TEXT NOT NULL DEFAULT 'standard',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
      web_search_requests INTEGER NOT NULL DEFAULT 0,
      web_fetch_requests INTEGER NOT NULL DEFAULT 0,
      code_execution_requests INTEGER NOT NULL DEFAULT 0,
      baseline_input INTEGER NOT NULL DEFAULT 0,
      baseline_output INTEGER NOT NULL DEFAULT 0,
      baseline_cache_read INTEGER NOT NULL DEFAULT 0,
      baseline_cache_write INTEGER NOT NULL DEFAULT 0,
      baseline_cache_write_1h INTEGER NOT NULL DEFAULT 0,
      baseline_web_search INTEGER NOT NULL DEFAULT 0,
      baseline_web_fetch INTEGER NOT NULL DEFAULT 0,
      baseline_code_execution INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, model, speed, inference_geo, service_tier),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `
  ).run();
  db.prepare(
    `
    INSERT INTO token_usage (session_id, model, speed, inference_geo, service_tier,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      baseline_input, baseline_output, baseline_cache_read, baseline_cache_write)
    SELECT session_id, model, 'standard', 'global', 'standard',
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      baseline_input, baseline_output, baseline_cache_read, baseline_cache_write
    FROM token_usage_pre_modifiers
  `
  ).run();
  db.prepare("DROP TABLE token_usage_pre_modifiers").run();
  db.pragma("foreign_keys = ON");
}

// Startup cleanup: mark stale active sessions as completed.
// Legacy sessions (created before SessionEnd hook) will never receive a SessionEnd event,
// so they stay "active" forever. Complete any active session whose last event is older than
// 1 hour — the CLI process is certainly gone by then.
// Remote-source sessions (source != 'local') are exempt: their "last event" is bounded by
// the rsync cadence, not the remote CLI's actual activity, so a busy remote session could be
// wrongly completed here. server/lib/remote-sync.js owns their status via mirror reconciliation.
db.prepare(
  `
  UPDATE sessions SET
    status = 'completed',
    ended_at = COALESCE(ended_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  WHERE status = 'active'
    AND (source = 'local' OR source IS NULL)
    AND started_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')
    AND NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.session_id = sessions.id
        AND e.created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')
    )
`
).run();

// Startup cleanup: complete orphaned agents on finished sessions
db.prepare(
  `
  UPDATE agents SET
    status = 'completed',
    ended_at = COALESCE(ended_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  WHERE status IN ('working', 'waiting')
    AND session_id IN (SELECT id FROM sessions WHERE status IN ('completed', 'error', 'abandoned'))
`
).run();

// Startup repair: normalize compaction agents whose started_at > ended_at.
// Earlier hook ingestion (pre-#156) stamped started_at = NOW (ingestion wall
// clock) and ended_at = transcript timestamp (in the past), producing
// impossible negative durations that corrupted workflow analytics. Compaction
// is instantaneous from the user's perspective, so the transcript timestamp
// (preserved in ended_at) is the canonical value — collapse started_at to it.
// Idempotent: only touches rows where the invariant is broken.
db.prepare(
  `
  UPDATE agents SET
    started_at = ended_at,
    updated_at = ended_at
  WHERE subagent_type = 'compaction'
    AND ended_at IS NOT NULL
    AND julianday(ended_at) < julianday(started_at)
`
).run();

const stmts = {
  getSession: db.prepare("SELECT * FROM sessions WHERE id = ?"),
  listSessions: db.prepare(
    `SELECT s.*, COUNT(a.id) as agent_count, s.updated_at as last_activity
     FROM sessions s LEFT JOIN agents a ON a.session_id = s.id
     GROUP BY s.id ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`
  ),
  listSessionsByStatus: db.prepare(
    `SELECT s.*, COUNT(a.id) as agent_count, s.updated_at as last_activity
     FROM sessions s LEFT JOIN agents a ON a.session_id = s.id
     WHERE s.status = ? GROUP BY s.id ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`
  ),
  insertSession: db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)"
  ),
  updateSession: db.prepare(
    "UPDATE sessions SET name = COALESCE(?, name), status = COALESCE(?, status), ended_at = COALESCE(?, ended_at), metadata = COALESCE(?, metadata), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  reactivateSession: db.prepare(
    "UPDATE sessions SET status = 'active', ended_at = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  // Updates session.model only when the new value differs from what's stored,
  // so the broadcast/refresh path stays quiet across the common no-op case.
  // Used by the hook ingestor to keep the displayed model in sync after the
  // user invokes /model mid-session.
  updateSessionModel: db.prepare(
    "UPDATE sessions SET model = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND COALESCE(model, '') != ?"
  ),
  // Updates session.name only when the new value differs from what's stored.
  // Used by the hook ingestor / watchdog to keep the displayed session name in
  // sync with the transcript's title (set via /rename, `claude -n`, or the
  // auto-generated ai-title). No-op (zero changes) on the common unchanged
  // case so the broadcast path stays quiet.
  updateSessionName: db.prepare(
    "UPDATE sessions SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND COALESCE(name, '') != ?"
  ),
  // One-shot writer for sessions.transcript_path. The NULL/'' guard makes
  // every subsequent hook event for the same session a SQL no-op, so the
  // periodic compaction sweep can read transcript_path off the row instead
  // of scanning events.
  setSessionTranscriptPath: db.prepare(
    "UPDATE sessions SET transcript_path = ? WHERE id = ? AND (transcript_path IS NULL OR transcript_path = '')"
  ),
  // Tag a session with the machine it was collected from (see remote-sync.js).
  // Remote-pulled sessions are stamped after the shared importer runs over the
  // per-source staging dir; local sessions keep the 'local' default.
  setSessionSource: db.prepare("UPDATE sessions SET source = ? WHERE id = ?"),
  // Distinct origins present in the data, for the Sessions source facet. Always
  // includes at least 'local' via the column default.
  distinctSessionSources: db.prepare(
    "SELECT DISTINCT source FROM sessions WHERE source IS NOT NULL AND source != '' ORDER BY source"
  ),

  // ── Remote sources (SSH machines the dashboard pulls history from) ──────────
  listRemoteSources: db.prepare("SELECT * FROM remote_sources ORDER BY created_at ASC"),
  listEnabledRemoteSources: db.prepare(
    "SELECT * FROM remote_sources WHERE enabled = 1 ORDER BY created_at ASC"
  ),
  getRemoteSource: db.prepare("SELECT * FROM remote_sources WHERE id = ?"),
  insertRemoteSource: db.prepare(
    `INSERT INTO remote_sources (id, label, host, ssh_port, identity_file, remote_home, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  updateRemoteSource: db.prepare(
    `UPDATE remote_sources SET
       label = COALESCE(?, label),
       host = COALESCE(?, host),
       ssh_port = ?,
       identity_file = ?,
       remote_home = ?,
       enabled = COALESCE(?, enabled),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ),
  deleteRemoteSource: db.prepare("DELETE FROM remote_sources WHERE id = ?"),
  setRemoteSourceStatus: db.prepare(
    `UPDATE remote_sources SET status = ?, last_error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ),
  setRemoteSourceSyncResult: db.prepare(
    `UPDATE remote_sources SET status = ?, last_error = ?, last_sync_at = ?, last_sync_counts = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ),

  getAgent: db.prepare("SELECT * FROM agents WHERE id = ?"),
  listAgents: db.prepare("SELECT * FROM agents ORDER BY started_at DESC LIMIT ? OFFSET ?"),
  listAgentsBySession: db.prepare(
    "SELECT * FROM agents WHERE session_id = ? ORDER BY started_at DESC"
  ),
  listAgentsByStatus: db.prepare(
    "SELECT * FROM agents WHERE status = ? ORDER BY started_at DESC LIMIT ? OFFSET ?"
  ),
  insertAgent: db.prepare(
    "INSERT INTO agents (id, session_id, name, type, subagent_type, status, task, started_at, updated_at, parent_agent_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?)"
  ),
  updateAgent: db.prepare(
    "UPDATE agents SET name = COALESCE(?, name), status = COALESCE(?, status), task = COALESCE(?, task), current_tool = ?, ended_at = COALESCE(?, ended_at), metadata = COALESCE(?, metadata), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  reactivateAgent: db.prepare(
    "UPDATE agents SET status = 'working', ended_at = NULL, current_tool = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  // Repoint a subagent at its true spawner. Used by reconcileSubagentParents to
  // fix nested subagents that were inserted flat under the main agent (hook and
  // JSONL ingestion can't know the spawner from a single file). Authoritative
  // parent comes from the spawner transcript's Task tool_result (agentId).
  setAgentParent: db.prepare(
    "UPDATE agents SET parent_agent_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  // Awaiting-input state. Stamping awaiting_input_since marks the row as
  // "waiting" for user attention without touching the underlying status
  // enum (kept stable for legacy CHECK constraints and aggregations).
  // awaiting_reason records WHY ('notification' | 'stop' | 'session_start' |
  // 'interrupted'), and is cleared back to NULL alongside the timestamp.
  setSessionAwaitingInput: db.prepare(
    "UPDATE sessions SET awaiting_input_since = ?, awaiting_reason = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  clearSessionAwaitingInput: db.prepare(
    "UPDATE sessions SET awaiting_input_since = NULL, awaiting_reason = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND awaiting_input_since IS NOT NULL"
  ),
  setAgentAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = ?, awaiting_reason = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  clearAgentAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = NULL, awaiting_reason = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND awaiting_input_since IS NOT NULL"
  ),
  clearSessionAgentsAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = NULL, awaiting_reason = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_id = ? AND awaiting_input_since IS NOT NULL"
  ),
  // Find the deepest currently-working subagent in a session using a recursive CTE.
  // Used to infer which agent is spawning a new subagent when hook events don't
  // carry an explicit agent ID. Returns the most recently created deepest agent.
  findDeepestWorkingAgent: db.prepare(`
    WITH RECURSIVE agent_depth AS (
      SELECT id, parent_agent_id, 0 as depth
      FROM agents
      WHERE session_id = ? AND parent_agent_id IS NULL
      UNION ALL
      SELECT a.id, a.parent_agent_id, ad.depth + 1
      FROM agents a
      JOIN agent_depth ad ON a.parent_agent_id = ad.id
      WHERE a.session_id = ?
    )
    SELECT ad.id, ad.depth
    FROM agent_depth ad
    JOIN agents a ON a.id = ad.id
    WHERE a.status = 'working' AND a.type = 'subagent'
    ORDER BY ad.depth DESC, a.started_at DESC
    LIMIT 1
  `),

  touchSession: db.prepare(
    "UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  // Remote-source sessions (source != 'local') are excluded: their updated_at is
  // driven by the rsync/import cadence rather than the remote CLI's real activity,
  // so the periodic abandon sweep must not touch them. remote-sync.js reconciles
  // their status from the mirrored transcript instead.
  findStaleSessions: db.prepare(
    `SELECT id FROM sessions
     WHERE status = 'active' AND id != ?
       AND (source = 'local' OR source IS NULL)
       AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' minutes')`
  ),

  insertEvent: db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"
  ),
  listEvents: db.prepare("SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"),
  listEventsBySession: db.prepare(
    "SELECT * FROM events WHERE session_id = ? ORDER BY created_at DESC, id DESC"
  ),
  countEvents: db.prepare("SELECT COUNT(*) as count FROM events"),
  countEventsSince: db.prepare("SELECT COUNT(*) as count FROM events WHERE created_at >= ?"),
  // Accepts tz modifier (e.g. '-420 minutes') to compute local midnight in UTC.
  // Pattern: shift now→local, truncate to day start, shift back→UTC.
  countEventsToday: db.prepare(
    "SELECT COUNT(*) as count FROM events WHERE created_at >= datetime('now', ?, 'start of day', ?)"
  ),

  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sessions) as total_sessions,
      (SELECT COUNT(*) FROM sessions WHERE status = 'active') as active_sessions,
      (SELECT COUNT(*) FROM agents WHERE status IN ('working', 'waiting')) as active_agents,
      (SELECT COUNT(*) FROM agents) as total_agents,
      (SELECT COUNT(*) FROM events) as total_events
  `),
  agentStatusCounts: db.prepare("SELECT status, COUNT(*) as count FROM agents GROUP BY status"),
  sessionStatusCounts: db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status"),

  // Legacy additive upsert. Targets the standard/global/standard bucket; kept
  // for backward compatibility with any caller using the original 6-arg shape.
  upsertTokenUsage: db.prepare(`
    INSERT INTO token_usage (session_id, model, speed, inference_geo, service_tier,
                             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
    VALUES (?, ?, 'standard', 'global', 'standard', ?, ?, ?, ?)
    ON CONFLICT(session_id, model, speed, inference_geo, service_tier) DO UPDATE SET
      input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens,
      cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
      cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens
  `),
  // Replace a bucket's totals with the latest full re-parse, keeping the
  // effective total (`live + baseline`) a monotonic HIGH-WATER MARK: it never
  // decreases, but it also never inflates past the largest value ever seen.
  //
  //   baseline := max(old_live + old_baseline - new_live, 0)
  //   live     := new_live
  //   ⇒ effective = new_live + baseline = max(old_effective, new_live)
  //
  // Why not the old `baseline += old_live` on any decrease: two writers hit the
  // same (session, model, …) bucket with DIFFERENT scopes — the live hook writer
  // stores main-transcript-only tokens (server/routes/hooks.js), while
  // importSession stores main+subagents combined (combineSessionTokens). Every
  // time the smaller write followed the larger, the old formula mistook it for a
  // compaction and ADDED the current value into baseline, so a long-lived,
  // frequently-reswept session accumulated a baseline many times its real usage
  // (a 26-day/80-repo session reached ~11× — its transcript proved 774M
  // cache-read while baseline claimed 8.5B). Transcripts are append-only, so a
  // full re-parse always sees the complete total; the high-water mark preserves
  // the true max across writer-scope noise and re-imports without ever
  // double-counting. Args, in order:
  //   session_id, model, speed, inference_geo, service_tier,
  //   input, output, cache_read, cache_write, cache_write_1h,
  //   web_search, web_fetch, code_execution
  replaceTokenUsage: db.prepare(`
    INSERT INTO token_usage (session_id, model, speed, inference_geo, service_tier,
                             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cache_write_1h_tokens,
                             web_search_requests, web_fetch_requests, code_execution_requests,
                             baseline_input, baseline_output, baseline_cache_read, baseline_cache_write, baseline_cache_write_1h,
                             baseline_web_search, baseline_web_fetch, baseline_code_execution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)
    ON CONFLICT(session_id, model, speed, inference_geo, service_tier) DO UPDATE SET
      baseline_input = MAX(input_tokens + baseline_input - excluded.input_tokens, 0),
      baseline_output = MAX(output_tokens + baseline_output - excluded.output_tokens, 0),
      baseline_cache_read = MAX(cache_read_tokens + baseline_cache_read - excluded.cache_read_tokens, 0),
      baseline_cache_write = MAX(cache_write_tokens + baseline_cache_write - excluded.cache_write_tokens, 0),
      baseline_cache_write_1h = MAX(cache_write_1h_tokens + baseline_cache_write_1h - excluded.cache_write_1h_tokens, 0),
      baseline_web_search = MAX(web_search_requests + baseline_web_search - excluded.web_search_requests, 0),
      baseline_web_fetch = MAX(web_fetch_requests + baseline_web_fetch - excluded.web_fetch_requests, 0),
      baseline_code_execution = MAX(code_execution_requests + baseline_code_execution - excluded.code_execution_requests, 0),
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cache_read_tokens = excluded.cache_read_tokens,
      cache_write_tokens = excluded.cache_write_tokens,
      cache_write_1h_tokens = excluded.cache_write_1h_tokens,
      web_search_requests = excluded.web_search_requests,
      web_fetch_requests = excluded.web_fetch_requests,
      code_execution_requests = excluded.code_execution_requests
  `),
  getTokenTotals: db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens + baseline_input), 0) as total_input,
      COALESCE(SUM(output_tokens + baseline_output), 0) as total_output,
      COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) as total_cache_read,
      COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) as total_cache_write,
      COALESCE(SUM(cache_write_1h_tokens + baseline_cache_write_1h), 0) as total_cache_write_1h,
      COALESCE(SUM(web_search_requests + baseline_web_search), 0) as total_web_search,
      COALESCE(SUM(web_fetch_requests + baseline_web_fetch), 0) as total_web_fetch,
      COALESCE(SUM(code_execution_requests + baseline_code_execution), 0) as total_code_execution
    FROM token_usage
  `),
  getTokensBySession: db.prepare(
    `SELECT model, speed, inference_geo, service_tier,
      input_tokens + baseline_input as input_tokens,
      output_tokens + baseline_output as output_tokens,
      cache_read_tokens + baseline_cache_read as cache_read_tokens,
      cache_write_tokens + baseline_cache_write as cache_write_tokens,
      cache_write_1h_tokens + baseline_cache_write_1h as cache_write_1h_tokens,
      web_search_requests + baseline_web_search as web_search_requests,
      web_fetch_requests + baseline_web_fetch as web_fetch_requests,
      code_execution_requests + baseline_code_execution as code_execution_requests
    FROM token_usage WHERE session_id = ?`
  ),

  // Model pricing
  listPricing: db.prepare("SELECT * FROM model_pricing ORDER BY display_name ASC"),
  getPricing: db.prepare("SELECT * FROM model_pricing WHERE model_pattern = ?"),
  upsertPricing: db.prepare(`
    INSERT INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok, cache_write_1h_per_mtok, fast_input_per_mtok, fast_output_per_mtok, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(model_pattern) DO UPDATE SET
      display_name = excluded.display_name,
      input_per_mtok = excluded.input_per_mtok,
      output_per_mtok = excluded.output_per_mtok,
      cache_read_per_mtok = excluded.cache_read_per_mtok,
      cache_write_per_mtok = excluded.cache_write_per_mtok,
      cache_write_1h_per_mtok = excluded.cache_write_1h_per_mtok,
      fast_input_per_mtok = excluded.fast_input_per_mtok,
      fast_output_per_mtok = excluded.fast_output_per_mtok,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `),
  // Update ONLY the time-limited introductory rates for an existing row. Kept
  // separate from upsertPricing so a standard-rate edit never touches intro
  // columns (and vice versa): the PUT route calls this only when the caller
  // actually sends intro fields, so legacy callers that omit them preserve any
  // promo untouched. intro_until = NULL clears the promo (row reverts to
  // standard rates at all dates). This is fully generic — any model pattern can
  // carry a promo window, not just Sonnet 5.
  setIntroPricing: db.prepare(`
    UPDATE model_pricing SET
      intro_input_per_mtok = ?,
      intro_output_per_mtok = ?,
      intro_cache_read_per_mtok = ?,
      intro_cache_write_per_mtok = ?,
      intro_cache_write_1h_per_mtok = ?,
      intro_until = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE model_pattern = ?
  `),
  deletePricing: db.prepare("DELETE FROM model_pricing WHERE model_pattern = ?"),
  matchPricing: db.prepare(
    "SELECT * FROM model_pricing WHERE ? LIKE REPLACE(model_pattern, '%', '%') LIMIT 1"
  ),
  toolUsageCounts: db.prepare(`
    SELECT tool_name, COUNT(*) as count
    FROM events
    WHERE tool_name IS NOT NULL
    GROUP BY tool_name
    ORDER BY count DESC
    LIMIT 20
  `),
  // Accept a timezone modifier (e.g. '-420 minutes') so GROUP BY uses local dates
  dailyEventCounts: db.prepare(`
    SELECT DATE(created_at, ?) as date, COUNT(*) as count
    FROM events
    WHERE created_at >= DATE('now', '-365 days')
    GROUP BY 1
    ORDER BY date ASC
  `),
  dailySessionCounts: db.prepare(`
    SELECT DATE(started_at, ?) as date, COUNT(*) as count
    FROM sessions
    WHERE started_at >= DATE('now', '-365 days')
    GROUP BY 1
    ORDER BY date ASC
  `),
  agentTypeDistribution: db.prepare(`
    SELECT subagent_type, COUNT(*) as count
    FROM agents
    WHERE type = 'subagent' AND subagent_type IS NOT NULL
    GROUP BY subagent_type
    ORDER BY count DESC
  `),
  totalSubagentCount: db.prepare("SELECT COUNT(*) as count FROM agents WHERE type = 'subagent'"),
  eventTypeCounts: db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM events
    GROUP BY event_type
    ORDER BY count DESC
  `),
  avgEventsPerSession: db.prepare(`
    SELECT ROUND(CAST(COUNT(*) AS REAL) / MAX(1, (SELECT COUNT(*) FROM sessions)), 1) as avg
    FROM events
  `),

  // Per-session aggregations powering the SessionOverview panel.
  sessionEventCount: db.prepare("SELECT COUNT(*) as count FROM events WHERE session_id = ?"),
  sessionEventTypeCounts: db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM events
    WHERE session_id = ?
    GROUP BY event_type
    ORDER BY count DESC
  `),
  sessionToolUsageCounts: db.prepare(`
    SELECT tool_name, COUNT(*) as count
    FROM events
    WHERE session_id = ? AND tool_name IS NOT NULL
    GROUP BY tool_name
    ORDER BY count DESC
    LIMIT 15
  `),
  // Errors are surfaced via a couple of conventions: event_type containing
  // "error" (case-insensitive) OR a summary prefixed with "Error" / "Failed".
  // We accept both so legacy and current hook conventions both count.
  sessionErrorCount: db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE session_id = ?
      AND (
        LOWER(event_type) LIKE '%error%'
        OR LOWER(event_type) LIKE '%failed%'
        OR LOWER(summary) LIKE 'error%'
        OR LOWER(summary) LIKE 'failed%'
      )
  `),
  sessionEventTimeRange: db.prepare(`
    SELECT MIN(created_at) as first_at, MAX(created_at) as last_at
    FROM events
    WHERE session_id = ?
  `),
  sessionAgentTypeCounts: db.prepare(`
    SELECT
      COALESCE(subagent_type, 'unknown') as subagent_type,
      COUNT(*) as count
    FROM agents
    WHERE session_id = ? AND type = 'subagent'
    GROUP BY COALESCE(subagent_type, 'unknown')
    ORDER BY count DESC
  `),
  sessionAgentStatusCounts: db.prepare(`
    SELECT status, COUNT(*) as count
    FROM agents
    WHERE session_id = ?
    GROUP BY status
  `),
  sessionTokenTotals: db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0) as cache_write_tokens
    FROM token_usage
    WHERE session_id = ?
  `),

  // ── Alerting engine ───────────────────────────────────────────────────────
  listAlertRules: db.prepare("SELECT * FROM alert_rules ORDER BY created_at DESC"),
  listEnabledAlertRules: db.prepare("SELECT * FROM alert_rules WHERE enabled = 1"),
  getAlertRule: db.prepare("SELECT * FROM alert_rules WHERE id = ?"),
  insertAlertRule: db.prepare(
    "INSERT INTO alert_rules (id, name, rule_type, config, enabled, cooldown_seconds) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  updateAlertRule: db.prepare(
    "UPDATE alert_rules SET name = COALESCE(?, name), config = COALESCE(?, config), enabled = COALESCE(?, enabled), cooldown_seconds = COALESCE(?, cooldown_seconds), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  deleteAlertRule: db.prepare("DELETE FROM alert_rules WHERE id = ?"),

  insertAlertEvent: db.prepare(
    "INSERT INTO alert_events (rule_id, rule_name, rule_type, session_id, agent_id, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ),
  getAlertEvent: db.prepare("SELECT * FROM alert_events WHERE id = ?"),
  listAlertEvents: db.prepare(
    "SELECT * FROM alert_events ORDER BY triggered_at DESC, id DESC LIMIT ? OFFSET ?"
  ),
  listUnackedAlertEvents: db.prepare(
    "SELECT * FROM alert_events WHERE acknowledged_at IS NULL ORDER BY triggered_at DESC, id DESC LIMIT ? OFFSET ?"
  ),
  countAlertEvents: db.prepare("SELECT COUNT(*) as count FROM alert_events"),
  countUnackedAlertEvents: db.prepare(
    "SELECT COUNT(*) as count FROM alert_events WHERE acknowledged_at IS NULL"
  ),
  ackAlertEvent: db.prepare(
    "UPDATE alert_events SET acknowledged_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND acknowledged_at IS NULL"
  ),
  ackAllAlertEvents: db.prepare(
    "UPDATE alert_events SET acknowledged_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE acknowledged_at IS NULL"
  ),
  // Cooldown lookup: most recent firing of a rule for a given scope (session,
  // or session+agent for per-agent rules). COALESCE folds NULL scopes to ''.
  lastAlertFor: db.prepare(
    `SELECT triggered_at FROM alert_events
     WHERE rule_id = ? AND COALESCE(session_id, '') = COALESCE(?, '') AND COALESCE(agent_id, '') = COALESCE(?, '')
     ORDER BY triggered_at DESC, id DESC LIMIT 1`
  ),

  // ── Webhook delivery ──────────────────────────────────────────────────────
  listWebhookTargets: db.prepare("SELECT * FROM webhook_targets ORDER BY created_at DESC"),
  listEnabledWebhookTargets: db.prepare("SELECT * FROM webhook_targets WHERE enabled = 1"),
  getWebhookTarget: db.prepare("SELECT * FROM webhook_targets WHERE id = ?"),
  insertWebhookTarget: db.prepare(
    "INSERT INTO webhook_targets (id, name, type, url, enabled, secret, headers, rule_ids, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  // Partial update: COALESCE keeps the existing value when a column arg is
  // NULL. url/secret/headers/rule_ids/config are nullable *values*, so they use
  // a companion "_set" flag arg to distinguish "leave alone" from "clear".
  updateWebhookTarget: db.prepare(
    `UPDATE webhook_targets SET
       name = COALESCE(?, name),
       url = COALESCE(?, url),
       enabled = COALESCE(?, enabled),
       secret = CASE WHEN ? = 1 THEN ? ELSE secret END,
       headers = CASE WHEN ? = 1 THEN ? ELSE headers END,
       rule_ids = CASE WHEN ? = 1 THEN ? ELSE rule_ids END,
       config = CASE WHEN ? = 1 THEN ? ELSE config END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ),
  deleteWebhookTarget: db.prepare("DELETE FROM webhook_targets WHERE id = ?"),

  insertWebhookDelivery: db.prepare(
    "INSERT INTO webhook_deliveries (target_id, target_name, target_type, alert_id, status, status_code, attempts, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  listWebhookDeliveriesForTarget: db.prepare(
    "SELECT * FROM webhook_deliveries WHERE target_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
  ),
  lastWebhookDeliveryForTarget: db.prepare(
    "SELECT * FROM webhook_deliveries WHERE target_id = ? ORDER BY created_at DESC, id DESC LIMIT 1"
  ),
  // Keep the delivery log bounded — prune everything older than the newest
  // 2000 rows after each insert (cheap with the created_at index).
  pruneWebhookDeliveries: db.prepare(
    `DELETE FROM webhook_deliveries WHERE id NOT IN (
       SELECT id FROM webhook_deliveries ORDER BY created_at DESC, id DESC LIMIT 2000
     )`
  ),

  // ── Workflow-tool runs ────────────────────────────────────────────────────
  // Upsert keyed by run_id. started_at and created_at are written only on first
  // insert (COALESCE keeps the existing launch time across a running→completed
  // transition); every other field reflects the latest journal/scan.
  upsertWorkflow: db.prepare(
    `INSERT INTO workflows
       (run_id, session_id, task_id, name, status, default_model, started_at, ended_at,
        duration_ms, agent_count, total_tokens, total_tool_calls, phases, progress,
        script_path, journal_path, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(run_id) DO UPDATE SET
       session_id = excluded.session_id,
       task_id = COALESCE(excluded.task_id, workflows.task_id),
       name = COALESCE(excluded.name, workflows.name),
       status = excluded.status,
       default_model = COALESCE(excluded.default_model, workflows.default_model),
       started_at = COALESCE(workflows.started_at, excluded.started_at),
       ended_at = excluded.ended_at,
       duration_ms = excluded.duration_ms,
       agent_count = excluded.agent_count,
       total_tokens = excluded.total_tokens,
       total_tool_calls = excluded.total_tool_calls,
       phases = COALESCE(excluded.phases, workflows.phases),
       progress = COALESCE(excluded.progress, workflows.progress),
       script_path = COALESCE(excluded.script_path, workflows.script_path),
       journal_path = COALESCE(excluded.journal_path, workflows.journal_path),
       source = excluded.source,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  getWorkflow: db.prepare("SELECT * FROM workflows WHERE run_id = ?"),
  listWorkflowsBySession: db.prepare(
    "SELECT * FROM workflows WHERE session_id = ? ORDER BY started_at DESC, created_at DESC"
  ),
  listWorkflows: db.prepare(
    "SELECT * FROM workflows ORDER BY COALESCE(started_at, created_at) DESC LIMIT ? OFFSET ?"
  ),
  listWorkflowsByStatus: db.prepare(
    "SELECT * FROM workflows WHERE status = ? ORDER BY COALESCE(started_at, created_at) DESC LIMIT ? OFFSET ?"
  ),
  listWorkflowsBySessionFilter: db.prepare(
    "SELECT * FROM workflows WHERE session_id = ? ORDER BY COALESCE(started_at, created_at) DESC LIMIT ? OFFSET ?"
  ),
  countWorkflows: db.prepare("SELECT COUNT(*) AS n FROM workflows"),
  countWorkflowsByStatus: db.prepare("SELECT COUNT(*) AS n FROM workflows WHERE status = ?"),
  workflowStatusCounts: db.prepare("SELECT status, COUNT(*) AS n FROM workflows GROUP BY status"),
  setAgentWorkflow: db.prepare(
    "UPDATE agents SET workflow_run_id = ?, workflow_phase = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ),
  listAgentsByWorkflow: db.prepare(
    "SELECT * FROM agents WHERE workflow_run_id = ? ORDER BY started_at ASC, id ASC"
  ),

  // Projects
  insertProject: db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)"),
  getProject: db.prepare("SELECT * FROM projects WHERE id = ?"),
  listProjects: db.prepare("SELECT * FROM projects ORDER BY name COLLATE NOCASE ASC"),
  renameProject: db.prepare(
    "UPDATE projects SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  deleteProject: db.prepare("DELETE FROM projects WHERE id = ?"),
  insertProjectPath: db.prepare("INSERT INTO project_paths (project_id, cwd) VALUES (?, ?)"),
  deleteProjectPath: db.prepare("DELETE FROM project_paths WHERE id = ? AND project_id = ?"),
  getProjectPathByCwd: db.prepare("SELECT * FROM project_paths WHERE cwd = ?"),
  listProjectPaths: db.prepare("SELECT * FROM project_paths WHERE project_id = ? ORDER BY cwd ASC"),
  listAllProjectPaths: db.prepare("SELECT * FROM project_paths ORDER BY cwd ASC"),

  // ── Plans & session focus ─────────────────────────────────────────────────
  // Upsert keyed by cwd. created_at survives re-ingest; missing_at clears on
  // every successful ingest (the file is demonstrably back).
  upsertPlan: db.prepare(
    `INSERT INTO plans (cwd, title, file_path, content_hash, item_count, missing_at,
                        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL,
             strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(cwd) DO UPDATE SET
       title = excluded.title,
       file_path = excluded.file_path,
       content_hash = excluded.content_hash,
       item_count = excluded.item_count,
       missing_at = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  getPlanByCwd: db.prepare("SELECT * FROM plans WHERE cwd = ?"),
  listPlans: db.prepare("SELECT * FROM plans ORDER BY updated_at DESC"),
  markPlanMissing: db.prepare(
    "UPDATE plans SET missing_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE cwd = ? AND missing_at IS NULL"
  ),
  // Conflict target is item_id (the stable identity), NOT item_number — an
  // item that moved from number 3 to number 5 across a reorder still matches
  // its existing row here and gets UPDATEd in place, so declared_done_at
  // (deliberately untouched below) survives. Only the file's own
  // text/acceptance/detail/checked/position/number sync on every ingest.
  upsertPlanItem: db.prepare(
    `INSERT INTO plan_items (cwd, item_id, item_number, parent_item_id, text, acceptance, detail, checked, position, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(cwd, item_id) DO UPDATE SET
       item_number = excluded.item_number,
       parent_item_id = excluded.parent_item_id,
       text = excluded.text,
       acceptance = excluded.acceptance,
       detail = excluded.detail,
       checked = excluded.checked,
       position = excluded.position,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  // Re-point one plan_items row's item_number by its (stable) item_id.
  // Ingest uses this to vacate every about-to-move number to a collision-safe
  // negative placeholder BEFORE running the upserts above — otherwise a swap
  // (item A: 1→2, item B: 2→1 in the same ingest) trips the UNIQUE(cwd,
  // item_number) index when B's upsert tries to claim 1 while A's row is
  // still sitting on it (upsert order is file order, not a dependency-safe
  // order).
  remapPlanItemNumberById: db.prepare(
    "UPDATE plan_items SET item_number = ? WHERE cwd = ? AND item_id = ?"
  ),
  listPlanItems: db.prepare("SELECT * FROM plan_items WHERE cwd = ? ORDER BY position ASC"),
  // Live lookup by the number currently on screen — e.g. "ccam focus set 3"
  // means whatever item is AT position 3 right now, resolved via the unique
  // (cwd, item_number) index. Unaffected by item_id.
  getPlanItem: db.prepare("SELECT * FROM plan_items WHERE cwd = ? AND item_number = ?"),
  // Snapshot of every current (item_number -> item_id) pairing for a cwd,
  // taken BEFORE an ingest's upserts run. Ingest diffs this against the
  // freshly parsed items' numbers to find items that moved, then migrates
  // any session_focus rows still pointing at their OLD number so a live
  // focus pointer survives a reorder (see migrateFocusNumbersOnReorder in
  // plan-ingest.js).
  listPlanItemIdsAndNumbers: db.prepare(
    "SELECT item_id, item_number FROM plan_items WHERE cwd = ?"
  ),
  // Second param is a JSON array of the item ids present in the file this
  // ingest (e.g. ["a1b2c3d4","e5f6a7b8"]) - ids no longer in the file are
  // removed. (Switched from item_number: a surviving item's number can
  // change across a reorder, but its id can't.)
  deletePlanItemsNotIn: db.prepare(
    "DELETE FROM plan_items WHERE cwd = ? AND item_id NOT IN (SELECT value FROM json_each(?))"
  ),
  setPlanItemDeclaredDone: db.prepare(
    "UPDATE plan_items SET declared_done_at = ?, declared_done_session = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE cwd = ? AND item_number = ?"
  ),
  // drift_* deliberately untouched: a fresh declaration must not silence the
  // drift badge - only the auditor writes those columns.
  upsertSessionFocus: db.prepare(
    `INSERT INTO session_focus (session_id, cwd, item_number, note, set_at, detour_stack, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(session_id) DO UPDATE SET
       cwd = excluded.cwd,
       item_number = excluded.item_number,
       note = excluded.note,
       set_at = excluded.set_at,
       detour_stack = excluded.detour_stack,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  getSessionFocus: db.prepare("SELECT * FROM session_focus WHERE session_id = ?"),
  // Re-point every session_focus row at `fromNumber` to `toNumber` for one
  // cwd. Used only by the reorder migration in plan-ingest.js, always called
  // in two passes (every affected number moved to a collision-safe negative
  // offset, then every offset moved to its true new number) so simultaneous
  // swaps/cycles resolve correctly instead of one item's move clobbering
  // another's.
  remapSessionFocusNumber: db.prepare(
    "UPDATE session_focus SET item_number = ? WHERE cwd = ? AND item_number = ?"
  ),
  setSessionFocusDrift: db.prepare(
    "UPDATE session_focus SET drift_status = ?, drift_reason = ?, drift_checked_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id = ?"
  ),
  // Audit candidates: active sessions with a declared item or an open detour.
  listActiveFocusSessions: db.prepare(
    `SELECT f.*, s.status AS session_status, s.updated_at AS session_updated_at
     FROM session_focus f JOIN sessions s ON s.id = f.session_id
     WHERE s.status = 'active' AND (f.item_number IS NOT NULL OR f.detour_stack != '[]')`
  ),
  // Bulk hydrate for GET /api/focus - every active session's focus row.
  listFocusForActiveSessions: db.prepare(
    `SELECT f.* FROM session_focus f JOIN sessions s ON s.id = f.session_id
     WHERE s.status = 'active'`
  ),
  latestTodoWriteEvent: db.prepare(
    `SELECT data, created_at FROM events
     WHERE session_id = ? AND event_type = 'PostToolUse' AND tool_name = 'TodoWrite'
     ORDER BY id DESC LIMIT 1`
  ),
  recentEventSummaries: db.prepare(
    `SELECT event_type, tool_name, summary, created_at FROM events
     WHERE session_id = ? AND created_at > ? ORDER BY id DESC LIMIT ?`
  ),
  listFocusEvents: db.prepare(
    `SELECT id, agent_id, summary, data, created_at FROM events
     WHERE session_id = ? AND event_type = 'Focus' ORDER BY id DESC LIMIT ?`
  ),
  distinctSessionCwds: db.prepare(
    "SELECT DISTINCT cwd FROM sessions WHERE cwd IS NOT NULL AND cwd != ''"
  ),
  // Stable-id lookup, the inference-side sibling of getPlanItem (which is
  // keyed by the live display number). Inference rows store item_id so a
  // plan reorder can't silently re-point inferred time at the wrong item.
  getPlanItemById: db.prepare("SELECT * FROM plan_items WHERE cwd = ? AND item_id = ?"),
  upsertFocusInference: db.prepare(
    `INSERT INTO focus_inferences (session_id, cwd, kind, item_id, label, confidence, method, reason, inferred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(session_id) DO UPDATE SET
       cwd = excluded.cwd,
       kind = excluded.kind,
       item_id = excluded.item_id,
       label = excluded.label,
       confidence = excluded.confidence,
       method = excluded.method,
       reason = excluded.reason,
       inferred_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
  getFocusInference: db.prepare("SELECT * FROM focus_inferences WHERE session_id = ?"),
  // Window-summary cache (see the focus_summaries schema comment) - read by
  // GET /api/focus-report/summary, written after each successful synthesis.
  getFocusSummary: db.prepare("SELECT * FROM focus_summaries WHERE cache_key = ?"),
  upsertFocusSummary: db.prepare(
    `INSERT INTO focus_summaries (cache_key, input_digest, bullets, model, created_at)
     VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(cache_key) DO UPDATE SET
       input_digest = excluded.input_digest,
       bullets = excluded.bullets,
       model = excluded.model,
       created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ),
};

module.exports = { db, stmts, DB_PATH, DEFAULT_PRICING, applyIntroPricing };
