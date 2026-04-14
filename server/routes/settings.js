/**
 * @file Express router for settings-related endpoints, providing system info, database statistics, hook status, and operations to clear data, re-import sessions, reinstall hooks, reset pricing, export data, and perform cleanup of stale sessions. This allows the frontend to manage and maintain the agent monitoring system effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { db, stmts, DB_PATH } = require("../db");
const { getConnectionCount } = require("../websocket");
const { transcriptCache } = require("./hooks");

const router = Router();

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

function getDbSize() {
  try {
    const stat = fs.statSync(DB_PATH);
    return stat.size;
  } catch {
    return 0;
  }
}

function getTableCounts() {
  const tables = ["sessions", "agents", "events", "model_pricing"];
  const counts = {};
  for (const t of tables) {
    counts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
  }
  counts.token_usage = db
    .prepare("SELECT COUNT(DISTINCT session_id) as c FROM token_usage")
    .get().c;
  return counts;
}

function getHookStatus() {
  try {
    if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      return { installed: false, path: CLAUDE_SETTINGS_PATH, hooks: {} };
    }
    const raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8");
    const settings = JSON.parse(raw);
    const hookTypes = [
      "PreToolUse",
      "PostToolUse",
      "Stop",
      "SubagentStop",
      "Notification",
      "SessionStart",
      "SessionEnd",
    ];
    const hooks = {};
    for (const ht of hookTypes) {
      const entries = settings.hooks?.[ht] || [];
      hooks[ht] = entries.some(
        (e) =>
          (e.command && e.command.includes("hook-handler.js")) ||
          (Array.isArray(e.hooks) &&
            e.hooks.some((h) => h.command && h.command.includes("hook-handler.js")))
      );
    }
    const installed = Object.values(hooks).every(Boolean);
    return { installed, path: CLAUDE_SETTINGS_PATH, hooks };
  } catch {
    return { installed: false, path: CLAUDE_SETTINGS_PATH, hooks: {} };
  }
}

// GET /api/settings/info — system info, db stats, hook status
router.get("/info", (_req, res) => {
  const dbSize = getDbSize();
  const counts = getTableCounts();
  const hookStatus = getHookStatus();

  res.json({
    db: {
      path: DB_PATH,
      size: dbSize,
      counts,
    },
    hooks: hookStatus,
    server: {
      uptime: process.uptime(),
      node_version: process.version,
      platform: process.platform,
      ws_connections: getConnectionCount(),
    },
    transcript_cache: transcriptCache.stats(),
  });
});

// POST /api/settings/clear-data — delete all sessions, agents, events, tokens
router.post("/clear-data", (_req, res) => {
  const counts = getTableCounts();
  db.pragma("foreign_keys = OFF");
  db.prepare("DELETE FROM token_usage").run();
  db.prepare("DELETE FROM events").run();
  db.prepare("DELETE FROM agents").run();
  db.prepare("DELETE FROM sessions").run();
  db.pragma("foreign_keys = ON");
  res.json({ ok: true, cleared: counts });
});

// POST /api/settings/reimport — re-import legacy sessions from ~/.claude/
router.post("/reimport", async (_req, res) => {
  try {
    const { importAllSessions } = require("../../scripts/import-history");
    const dbModule = require("../db");
    const result = await importAllSessions(dbModule);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({
      error: { code: "IMPORT_FAILED", message: err.message },
    });
  }
});

// POST /api/settings/reinstall-hooks — reinstall Claude Code hooks
router.post("/reinstall-hooks", (_req, res) => {
  try {
    const { installHooks } = require("../../scripts/install-hooks");
    const success = installHooks(true);
    const hookStatus = getHookStatus();
    res.json({ ok: success, hooks: hookStatus });
  } catch (err) {
    res.status(500).json({
      error: { code: "HOOK_INSTALL_FAILED", message: err.message },
    });
  }
});

// POST /api/settings/reset-pricing — reset pricing to defaults
router.post("/reset-pricing", (_req, res) => {
  db.prepare("DELETE FROM model_pricing").run();

  const seedPricing = db.prepare(
    "INSERT OR IGNORE INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const defaults = [
    ["claude-opus-4-5%", "Claude Opus 4.5", 5, 25, 0.5, 6.25],
    ["claude-opus-4-6%", "Claude Opus 4.6", 5, 25, 0.5, 6.25],
    ["claude-opus-4-1%", "Claude Opus 4.1", 15, 75, 1.5, 18.75],
    ["claude-opus-4-2%", "Claude Opus 4", 15, 75, 1.5, 18.75],
    ["claude-sonnet-4-6%", "Claude Sonnet 4.6", 3, 15, 0.3, 3.75],
    ["claude-sonnet-4-5%", "Claude Sonnet 4.5", 3, 15, 0.3, 3.75],
    ["claude-sonnet-4-2%", "Claude Sonnet 4", 3, 15, 0.3, 3.75],
    ["claude-3-7-sonnet%", "Claude Sonnet 3.7", 3, 15, 0.3, 3.75],
    ["claude-3-5-sonnet%", "Claude Sonnet 3.5", 3, 15, 0.3, 3.75],
    ["claude-haiku-4-5%", "Claude Haiku 4.5", 1, 5, 0.1, 1.25],
    ["claude-3-5-haiku%", "Claude Haiku 3.5", 0.8, 4, 0.08, 1],
    ["claude-3-haiku%", "Claude Haiku 3", 0.25, 1.25, 0.03, 0.3],
    ["claude-3-opus%", "Claude Opus 3", 15, 75, 1.5, 18.75],
  ];
  for (const [pattern, name, inp, out, cr, cw] of defaults) {
    seedPricing.run(pattern, name, inp, out, cr, cw);
  }

  const pricing = stmts.listPricing.all();
  res.json({ ok: true, pricing });
});

// GET /api/settings/export — export all data as JSON
router.get("/export", (_req, res) => {
  const sessions = db.prepare("SELECT * FROM sessions ORDER BY started_at DESC").all();
  const agents = db.prepare("SELECT * FROM agents ORDER BY started_at DESC").all();
  const events = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
  const tokenUsage = db.prepare("SELECT * FROM token_usage").all();
  const pricing = stmts.listPricing.all();

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="agent-monitor-export-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json({
    exported_at: new Date().toISOString(),
    sessions,
    agents,
    events,
    token_usage: tokenUsage,
    model_pricing: pricing,
  });
});

// POST /api/settings/cleanup — abandon stale sessions, purge old data
router.post("/cleanup", (req, res) => {
  const { abandon_hours, purge_days } = req.body;
  const result = { abandoned: 0, purged_sessions: 0, purged_events: 0, purged_agents: 0 };

  if (abandon_hours && typeof abandon_hours === "number" && abandon_hours > 0) {
    // Mark active sessions with no recent events as abandoned
    const cutoff = new Date(Date.now() - abandon_hours * 3600 * 1000).toISOString();
    const stale = db
      .prepare(
        `SELECT s.id FROM sessions s
         WHERE s.status = 'active'
           AND s.started_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM events e WHERE e.session_id = s.id AND e.created_at > ?
           )`
      )
      .all(cutoff, cutoff);

    for (const row of stale) {
      db.prepare(
        "UPDATE sessions SET status = 'abandoned', ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
      ).run(row.id);
      // Also complete any lingering agents
      db.prepare(
        "UPDATE agents SET status = 'completed', ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_id = ? AND status IN ('idle','connected','working')"
      ).run(row.id);
    }
    result.abandoned = stale.length;
  }

  if (purge_days && typeof purge_days === "number" && purge_days > 0) {
    const cutoff = new Date(Date.now() - purge_days * 86400 * 1000).toISOString();
    // Only purge completed/error/abandoned sessions, never active
    const toDelete = db
      .prepare(
        "SELECT id FROM sessions WHERE status IN ('completed','error','abandoned') AND started_at < ?"
      )
      .all(cutoff);

    if (toDelete.length > 0) {
      const ids = toDelete.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      // Cascading deletes handle agents/events, but token_usage FK might not cascade on all setups
      result.purged_events = db
        .prepare(`DELETE FROM events WHERE session_id IN (${placeholders})`)
        .run(...ids).changes;
      result.purged_agents = db
        .prepare(`DELETE FROM agents WHERE session_id IN (${placeholders})`)
        .run(...ids).changes;
      db.prepare(`DELETE FROM token_usage WHERE session_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...ids);
      result.purged_sessions = toDelete.length;
    }
  }

  res.json({ ok: true, ...result });
});

module.exports = router;
