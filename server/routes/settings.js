/**
 * @file Express router for dashboard settings: system information, pricing and
 * hook operations, data maintenance, and live-safe Claude Code/Codex session
 * home configuration for the frontend Settings experience.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const {
  db,
  stmts,
  DB_PATH,
  DEFAULT_PRICING,
  DEFAULT_GPT_PRICING,
  applyIntroPricing,
  seedGptPricing,
} = require("../db");
const { getConnectionCount } = require("../websocket");
const { transcriptCache } = require("./hooks");
const {
  buildExportBundle,
  importExportBundle,
  ImportFormatError,
} = require("../lib/data-transfer");

const router = Router();
const MAX_BACKUP_IMPORT_BYTES = 25 * 1024 * 1024;
const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BACKUP_IMPORT_BYTES, files: 1 },
}).single("file");

const APP_VERSION = (() => {
  try {
    return require("../../package.json").version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const { getSettingsPath, getClaudeHome, setClaudeHome } = require("../lib/claude-home");
const { getCodexHome, setCodexHome } = require("../lib/codex-home");
const CLAUDE_SETTINGS_PATH = getSettingsPath();

function getDbSize() {
  try {
    const stat = fs.statSync(DB_PATH);
    return stat.size;
  } catch {
    return 0;
  }
}

function getTableCounts() {
  const tables = ["sessions", "agents", "events", "model_pricing", "gpt_model_pricing"];
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
  const claude = require("../../scripts/install-hooks").getClaudeHookStatus();
  const codex = require("../../scripts/install-codex-hooks").getCodexHookStatus();
  return {
    // Backward-compatible Claude fields; `providers` is the canonical product
    // status used by the chooser UI.
    installed: claude.installed || codex.installed,
    path: claude.path || CLAUDE_SETTINGS_PATH,
    hooks: claude.hooks,
    providers: { claude, codex },
  };
}

// GET /api/settings/info — system info, db stats, hook status
router.get("/info", (req, res) => {
  const dbSize = getDbSize();
  const counts = getTableCounts();
  const hookStatus = getHookStatus();

  // Advanced SQLite info
  const pragmas = {
    journal_mode: db.pragma("journal_mode", { simple: true }),
    synchronous: db.pragma("synchronous", { simple: true }),
    auto_vacuum: db.pragma("auto_vacuum", { simple: true }),
    encoding: db.pragma("encoding", { simple: true }),
    foreign_keys: db.pragma("foreign_keys", { simple: true }),
    busy_timeout: db.pragma("busy_timeout", { simple: true }),
  };

  // Recent activity load (events in last 5, 15, 60 minutes)
  const getCount = (ms) => {
    const d = new Date(Date.now() - ms).toISOString();
    return db.prepare("SELECT COUNT(*) as c FROM events WHERE created_at > ?").get(d).c;
  };

  const load_stats = {
    m5: getCount(5 * 60 * 1000),
    m15: getCount(15 * 60 * 1000),
    h1: getCount(60 * 60 * 1000),
  };

  res.json({
    db: {
      path: DB_PATH,
      size: dbSize,
      counts,
      pragmas,
      load_stats,
    },
    hooks: hookStatus,
    server: {
      version: APP_VERSION,
      uptime: process.uptime(),
      node_version: process.version,
      platform: process.platform,
      ws_connections: getConnectionCount(),
      memory: process.memoryUsage(),
      cpu_load: os.loadavg(),
      arch: os.arch(),
      total_mem: os.totalmem(),
      free_mem: os.freemem(),
      cpus: os.cpus().length,
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
  // Fired alerts reference the cleared sessions — wipe the feed too. Alert
  // *rules* survive: they're user configuration, like model_pricing.
  db.prepare("DELETE FROM alert_events").run();
  // Webhook delivery log is an audit trail of those fired alerts — wipe it too.
  // Webhook *targets* survive, like alert rules and pricing.
  db.prepare("DELETE FROM webhook_deliveries").run();
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

// POST /api/settings/install-hooks — install one or both supported product
// hook sets. The UI has already shown status/overwrite information; each
// installer replaces only this dashboard's own entries and preserves others.
router.post("/install-hooks", (req, res) => {
  const requested = Array.isArray(req.body?.providers) ? req.body.providers : [];
  const providers = [
    ...new Set(requested.filter((provider) => provider === "claude" || provider === "codex")),
  ];
  if (providers.length === 0) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Select Claude Code, Codex, or both" },
    });
  }
  try {
    const results = {};
    if (providers.includes("claude")) {
      const before = require("../../scripts/install-hooks").getClaudeHookStatus();
      const ok = require("../../scripts/install-hooks").installHooks(true);
      results.claude = {
        ok,
        replaced: before.has_dashboard_hooks,
        output: ok
          ? [
              `Claude Code hooks ${before.has_dashboard_hooks ? "updated" : "installed"}.`,
              `Settings: ${before.path}`,
            ]
          : ["Claude Code hooks could not be installed. See server logs for details."],
      };
    }
    if (providers.includes("codex")) {
      results.codex = require("../../scripts/install-codex-hooks").installCodexHooks({
        silent: true,
      });
    }
    const hooks = getHookStatus();
    const ok = Object.values(results).every((result) => result.ok);
    res.json({ ok, results, hooks });
  } catch (err) {
    res.status(500).json({ error: { code: "HOOK_INSTALL_FAILED", message: err.message } });
  }
});

// POST /api/settings/reset-pricing — reset pricing to defaults
router.post("/reset-pricing", (req, res) => {
  const provider = req.body?.provider;
  if (provider !== undefined && provider !== "claude" && provider !== "codex") {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "provider must be claude or codex" },
    });
  }
  const resetClaude = provider !== "codex";
  const resetCodex = provider !== "claude";

  if (resetClaude) {
    db.prepare("DELETE FROM model_pricing").run();
    const seedPricing = db.prepare(
      "INSERT OR IGNORE INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok, cache_write_1h_per_mtok, fast_input_per_mtok, fast_output_per_mtok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const [pattern, name, inp, out, cr, cw, cw1h, fin, fout] of DEFAULT_PRICING) {
      seedPricing.run(pattern, name, inp, out, cr, cw, cw1h, fin, fout);
    }
    // Re-apply time-limited intro rates (e.g. Sonnet 5) — the seed above only
    // carries standard rates, so without this a reset silently drops the promo.
    applyIntroPricing(db);
  }
  if (resetCodex) {
    db.prepare("DELETE FROM gpt_model_pricing").run();
    seedGptPricing(db);
  }

  const pricing = stmts.listPricing.all();
  res.json({
    ok: true,
    provider: provider || "both",
    pricing,
    gpt_pricing: stmts.listGptPricing.all(),
  });
});

// GET /api/settings/export — export all data as JSON
router.get("/export", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="agent-monitor-export-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json(buildExportBundle(db, stmts));
});

// POST /api/settings/import — restore a bundle produced by /export. Browser
// callers upload one JSON file as multipart/form-data; CLI/MCP callers pass an
// absolute server-side path in a JSON body. Restore is idempotent and never
// overwrites an existing session or configuration row.
router.post("/import", (req, res) => {
  backupUpload(req, res, (uploadError) => {
    if (uploadError) {
      const tooLarge = uploadError.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? "IMPORT_TOO_LARGE" : "IMPORT_UPLOAD_FAILED",
          message: tooLarge
            ? `Export file exceeds ${MAX_BACKUP_IMPORT_BYTES} bytes`
            : uploadError.message,
        },
      });
    }

    try {
      let source;
      let text;
      if (req.file) {
        source = req.file.originalname || "uploaded-export.json";
        text = req.file.buffer.toString("utf8");
      } else {
        const rawPath = req.body?.path;
        if (typeof rawPath !== "string" || !rawPath.trim()) {
          return res.status(400).json({
            error: {
              code: "INVALID_INPUT",
              message: 'Provide multipart field "file" or JSON body { "path": "/absolute/file" }',
            },
          });
        }
        const expanded = rawPath.startsWith("~")
          ? path.join(os.homedir(), rawPath.slice(1))
          : rawPath;
        if (!path.isAbsolute(expanded)) {
          return res.status(400).json({
            error: { code: "INVALID_PATH", message: "path must be absolute" },
          });
        }
        const stat = fs.statSync(expanded);
        if (!stat.isFile()) {
          return res.status(400).json({
            error: { code: "INVALID_PATH", message: "path must reference a regular file" },
          });
        }
        if (stat.size > MAX_BACKUP_IMPORT_BYTES) {
          return res.status(413).json({
            error: {
              code: "IMPORT_TOO_LARGE",
              message: `Export file exceeds ${MAX_BACKUP_IMPORT_BYTES} bytes`,
            },
          });
        }
        source = expanded;
        text = fs.readFileSync(expanded, "utf8");
      }

      const bundle = JSON.parse(text);
      const counters = importExportBundle(db, bundle);
      return res.json({
        ok: true,
        source,
        format: bundle.format || "legacy",
        version: bundle.version || 1,
        ...counters,
      });
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ImportFormatError) {
        return res.status(400).json({
          error: {
            code: error instanceof SyntaxError ? "INVALID_JSON" : error.code,
            message: error.message,
          },
        });
      }
      if (error?.code === "ENOENT") {
        return res.status(404).json({
          error: { code: "PATH_NOT_FOUND", message: error.message },
        });
      }
      return res.status(500).json({
        error: { code: "IMPORT_FAILED", message: error.message || String(error) },
      });
    }
  });
});

// GET /api/settings/claude-home — get current CLAUDE_HOME path
router.get("/claude-home", (_req, res) => {
  res.json({ claude_home: getClaudeHome() });
});

// PUT /api/settings/claude-home — update CLAUDE_HOME path
router.put("/claude-home", (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath || typeof newPath !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_PATH", message: "path is required and must be a string" },
    });
  }
  try {
    const resolved = setClaudeHome(newPath);
    res.json({ ok: true, claude_home: resolved });
  } catch (err) {
    res.status(400).json({
      error: { code: "INVALID_PATH", message: err.message },
    });
  }
});

// GET /api/settings/codex-home — get the active Codex state directory.
router.get("/codex-home", (_req, res) => {
  res.json({ codex_home: getCodexHome() });
});

// PUT /api/settings/codex-home — repoint the Codex rollout scanner and hooks.
// setCodexHome notifies the live synchronizer, which re-watches and immediately
// sweeps the new sessions directory without blocking this response.
router.put("/codex-home", (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath || typeof newPath !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_PATH", message: "path is required and must be a string" },
    });
  }
  try {
    const resolved = setCodexHome(newPath);
    res.json({ ok: true, codex_home: resolved });
  } catch (err) {
    res.status(400).json({
      error: { code: "INVALID_PATH", message: err.message },
    });
  }
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
        "UPDATE agents SET status = 'completed', ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_id = ? AND status IN ('waiting','working')"
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
