/**
 * @file Database setup and access layer using SQLite for storing sessions, agents, events, token usage, and model pricing. Handles schema creation, migrations, and provides prepared statements for all database operations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

let Database;
try {
  Database = require("better-sqlite3");
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
  CREATE INDEX IF NOT EXISTS idx_agents_session_type ON agents(session_id, type);
  CREATE INDEX IF NOT EXISTS idx_dashboard_runs_started ON dashboard_runs(started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_dashboard_runs_session ON dashboard_runs(session_id);
`);

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
        updated_at, awaiting_input_since
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
db.prepare(
  `
  UPDATE sessions SET
    status = 'completed',
    ended_at = COALESCE(ended_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  WHERE status = 'active'
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
  // One-shot writer for sessions.transcript_path. The NULL/'' guard makes
  // every subsequent hook event for the same session a SQL no-op, so the
  // periodic compaction sweep can read transcript_path off the row instead
  // of scanning events.
  setSessionTranscriptPath: db.prepare(
    "UPDATE sessions SET transcript_path = ? WHERE id = ? AND (transcript_path IS NULL OR transcript_path = '')"
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
  // Awaiting-input state. Stamping awaiting_input_since marks the row as
  // "waiting" for user attention without touching the underlying status
  // enum (kept stable for legacy CHECK constraints and aggregations).
  setSessionAwaitingInput: db.prepare(
    "UPDATE sessions SET awaiting_input_since = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  clearSessionAwaitingInput: db.prepare(
    "UPDATE sessions SET awaiting_input_since = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND awaiting_input_since IS NOT NULL"
  ),
  setAgentAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  clearAgentAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND awaiting_input_since IS NOT NULL"
  ),
  clearSessionAgentsAwaitingInput: db.prepare(
    "UPDATE agents SET awaiting_input_since = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_id = ? AND awaiting_input_since IS NOT NULL"
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
  findStaleSessions: db.prepare(
    `SELECT id FROM sessions
     WHERE status = 'active' AND id != ?
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
  // Replace a bucket's totals with the latest full re-parse. The baseline_*
  // columns preserve the highest-seen value so compaction (which shrinks the
  // transcript) never reduces effective totals. Args, in order:
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
      baseline_input = CASE WHEN excluded.input_tokens < input_tokens
        THEN baseline_input + input_tokens ELSE baseline_input END,
      baseline_output = CASE WHEN excluded.output_tokens < output_tokens
        THEN baseline_output + output_tokens ELSE baseline_output END,
      baseline_cache_read = CASE WHEN excluded.cache_read_tokens < cache_read_tokens
        THEN baseline_cache_read + cache_read_tokens ELSE baseline_cache_read END,
      baseline_cache_write = CASE WHEN excluded.cache_write_tokens < cache_write_tokens
        THEN baseline_cache_write + cache_write_tokens ELSE baseline_cache_write END,
      baseline_cache_write_1h = CASE WHEN excluded.cache_write_1h_tokens < cache_write_1h_tokens
        THEN baseline_cache_write_1h + cache_write_1h_tokens ELSE baseline_cache_write_1h END,
      baseline_web_search = CASE WHEN excluded.web_search_requests < web_search_requests
        THEN baseline_web_search + web_search_requests ELSE baseline_web_search END,
      baseline_web_fetch = CASE WHEN excluded.web_fetch_requests < web_fetch_requests
        THEN baseline_web_fetch + web_fetch_requests ELSE baseline_web_fetch END,
      baseline_code_execution = CASE WHEN excluded.code_execution_requests < code_execution_requests
        THEN baseline_code_execution + code_execution_requests ELSE baseline_code_execution END,
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
};

module.exports = { db, stmts, DB_PATH, DEFAULT_PRICING };
