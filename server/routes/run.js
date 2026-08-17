/**
 * @file run.js
 * @description HTTP routes for the dashboard's Run Agent feature. Spawns and
 * supervises Claude Code processes or interactive Codex app-server threads,
 * streams structured envelopes over the existing WebSocket, and exposes one
 * provider-aware surface for live runs, history, and dynamic model discovery.
 *
 * Security model:
 *   - Local-first dashboard. The dashboard server is expected to bind to
 *     localhost (or the user's intranet at most). To prevent a malicious
 *     webpage from drive-by spawning processes via CSRF, we enforce a
 *     same-origin / loopback-Origin check on every route here. curl from the
 *     terminal (no Origin header) is allowed; browser requests must come from
 *     a localhost-ish origin.
 *   - cwd is sanitised: must be absolute and exist as a directory at request
 *     time. Anything else is rejected.
 *   - Concurrency cap (RUN_MAX_CONCURRENT, default 10) prevents runaway spawn.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("node:fs");
const path = require("node:path");
const claudeRuns = require("../lib/run-spawner");
const codexRuns = require("../lib/codex-run-spawner");
const { startCodexAppServer } = require("../lib/codex-app-server");

const router = Router();

const ALLOWED_ORIGIN_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * Loopback-Origin guard. Browser requests carry Origin; if it's not localhost,
 * we reject. Server/CLI requests (curl) typically don't carry Origin and pass.
 *
 * Referer is checked as a fallback for older browsers / fetch with credentials
 * disabled — the same loopback-host rule applies.
 */
function sameOriginGuard(req, res, next) {
  const checkHost = (raw) => {
    try {
      const u = new URL(raw);
      return ALLOWED_ORIGIN_HOSTS.has(u.hostname);
    } catch {
      return false;
    }
  };
  const origin = req.headers.origin;
  if (origin) {
    if (!checkHost(origin)) {
      return res.status(403).json({
        error: { code: "EBADORIGIN", message: "cross-origin requests are not allowed" },
      });
    }
    return next();
  }
  const referer = req.headers.referer;
  if (referer && !checkHost(referer)) {
    return res.status(403).json({
      error: { code: "EBADORIGIN", message: "cross-origin requests are not allowed" },
    });
  }
  return next();
}

router.use(sameOriginGuard);

function isExistingDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function sanitiseCwd(input) {
  if (input == null || input === "") return process.cwd();
  if (typeof input !== "string") {
    const e = new Error("cwd must be a string");
    e.code = "EBADCWD";
    throw e;
  }
  if (!path.isAbsolute(input)) {
    const e = new Error("cwd must be an absolute path");
    e.code = "EBADCWD";
    throw e;
  }
  const resolved = path.resolve(input);
  if (!isExistingDir(resolved)) {
    const e = new Error(`cwd does not exist: ${resolved}`);
    e.code = "EBADCWD";
    throw e;
  }
  try {
    return fs.realpathSync(resolved);
  } catch {
    const e = new Error(`cwd is not readable: ${resolved}`);
    e.code = "EBADCWD";
    throw e;
  }
}

const ALLOWED_PERMISSION_MODES = new Set(["acceptEdits", "default", "plan", "bypassPermissions"]);
const ALLOWED_CODEX_APPROVALS = new Set(["untrusted", "on-request", "never"]);
const ALLOWED_CODEX_SANDBOXES = new Set(["read-only", "workspace-write", "danger-full-access"]);

function providerOf(value) {
  return value === "codex" ? "codex" : "claude";
}
function spawnerFor(provider) {
  return provider === "codex" ? codexRuns : claudeRuns;
}
function allLiveRuns() {
  return [...claudeRuns.listRuns(), ...codexRuns.listRuns()];
}
function totalLiveCount() {
  return claudeRuns.liveCount() + codexRuns.liveCount();
}

router.get("/", (_req, res) => {
  res.json({
    items: allLiveRuns(),
    maxConcurrent: claudeRuns.getMaxConcurrent(),
    activeCount: totalLiveCount(),
  });
});

/**
 * Persistent history of every run spawned via the dashboard. Survives the
 * 5-minute in-memory reap so the user can see (and resume) past runs days
 * after they finished. Backed by the `dashboard_runs` sqlite table.
 *
 * Optional ?limit=<n> caps results (default 50, max 500). The most recent
 * runs are first.
 */
router.get("/history", (req, res) => {
  let dr = null;
  try {
    dr = require("../lib/dashboard-runs");
  } catch {
    return res.json({ items: [] });
  }
  const limit = Number.parseInt(String(req.query.limit || "50"), 10);
  const items = dr.listRuns({ limit: Number.isFinite(limit) ? limit : 50 });
  // Cross-reference with live handles so the UI can mark which history
  // entries are still attached / running.
  const liveIds = new Set();
  for (const h of allLiveRuns()) {
    if (h.id && (h.status === "running" || h.status === "spawning")) liveIds.add(h.id);
  }
  res.json({
    items: items.map((it) => ({ ...it, isLive: liveIds.has(it.id) })),
  });
});

/**
 * Suggest plausible working directories. Pulls from:
 *   - "dashboard": the dashboard server's cwd
 *   - "home": $HOME (the Run page's default cwd and first autocomplete group —
 *     a neutral spawn location that doesn't inherit this repo's project
 *     context, issue #202)
 *   - "recent": distinct cwds Claude Code has been used in, sourced from the
 *     dashboard's own sessions table. Filtered to dirs that still exist.
 *
 * Optional ?q=<substring> filter applied client-side as well.
 */
router.get("/cwds", (_req, res) => {
  const out = [];
  const seen = new Set();
  const push = (kind, p, label) => {
    if (!p) return;
    const abs = path.resolve(p);
    if (seen.has(abs)) return;
    if (!isExistingDir(abs)) return;
    seen.add(abs);
    out.push({ kind, path: abs, label: label || path.basename(abs) || abs });
  };

  push("dashboard", process.cwd(), "Dashboard server");
  push("home", require("node:os").homedir(), "Home");

  // Pull recent cwds from the sessions DB (best-effort; if the DB isn't
  // ready or has a different schema, just return what we have).
  try {
    const { db } = require("../db");
    const rows = db
      .prepare(
        `SELECT cwd, MAX(started_at) AS last_at FROM sessions
         WHERE cwd IS NOT NULL AND cwd <> ''
         GROUP BY cwd ORDER BY last_at DESC LIMIT 30`
      )
      .all();
    for (const row of rows) {
      push("recent", row.cwd, path.basename(row.cwd));
    }
  } catch {
    /* ignore — DB may not be ready in tests */
  }

  res.json({ items: out });
});

/**
 * File autocomplete for the prompt editor's `@` references. Walks `cwd`
 * (must be inside the cwd allowlist via sanitiseCwd), returns up to 40
 * matching paths relative to that cwd. Skips dotdirs, node_modules, build,
 * dist, .git, etc. Substring-matches against `q` case-insensitively.
 */
router.get("/files", (req, res) => {
  let cwd;
  try {
    cwd = sanitiseCwd(req.query.cwd);
  } catch (err) {
    return res.status(400).json({ error: { code: err.code, message: err.message } });
  }
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
  const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    ".cache",
    ".vite",
    "coverage",
    ".turbo",
    "target",
    ".venv",
    "__pycache__",
  ]);
  const MAX_RESULTS = 40;
  const MAX_VISITED = 5000;
  const results = [];
  let visited = 0;
  const walk = (dir, rel) => {
    if (results.length >= MAX_RESULTS || visited >= MAX_VISITED) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (results.length >= MAX_RESULTS || visited >= MAX_VISITED) return;
      visited++;
      if (ent.name.startsWith(".") && ent.name !== ".env" && ent.name !== ".gitignore") continue;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name);
      } else if (ent.isFile()) {
        const relPath = rel ? `${rel}/${ent.name}` : ent.name;
        if (!q || relPath.toLowerCase().includes(q)) {
          results.push(relPath);
        }
      }
    }
  };
  walk(cwd, "");
  results.sort((a, b) => a.length - b.length || a.localeCompare(b));
  res.json({ items: results.slice(0, MAX_RESULTS) });
});

router.get("/binary", (req, res) => {
  const provider = providerOf(req.query.provider);
  const binary = provider === "codex" ? "codex" : "claude";
  // Surface whether the selected CLI is on PATH so the UI can show a helpful error
  // before the user clicks Run. We don't actually invoke it — just let the
  // user know the spawn will work.
  const which = require("node:child_process").spawnSync(
    process.platform === "win32" ? "where" : "which",
    [binary],
    { encoding: "utf8" }
  );
  const stdout = (which.stdout || "").trim();
  res.json({
    found: which.status === 0 && stdout.length > 0,
    path: stdout || null,
    provider,
  });
});

const CLAUDE_FALLBACK_MODELS = [
  {
    id: "",
    label: "Default (recommended)",
    hint: "Use the default model configured in Claude Code",
    isDefault: true,
  },
  {
    id: "opus",
    label: "Opus 5 (1M context)",
    hint: "Best for everyday, complex tasks · $5/$25 per Mtok",
  },
  {
    id: "fable",
    label: "Fable 5",
    hint: "Most capable for your hardest and longest-running tasks",
  },
  {
    id: "sonnet",
    label: "Sonnet 5",
    hint: "Efficient for routine tasks · $3/$15 per Mtok",
  },
  {
    id: "haiku",
    label: "Haiku 4.5",
    hint: "Fastest for quick answers · $1/$5 per Mtok",
  },
];

async function discoverCodexModels() {
  const server = startCodexAppServer({ cwd: process.cwd() });
  try {
    await server.initialize();
    const result = await server.request("model/list", { includeHidden: false, limit: 100 }, 10_000);
    const candidates = Array.isArray(result?.models)
      ? result.models
      : Array.isArray(result?.items)
        ? result.items
        : Array.isArray(result?.data)
          ? result.data
          : [];
    return candidates
      .filter((item) => typeof item?.id === "string" && item.id)
      .map((item) => ({
        id: item.id,
        label: item.displayName || item.name || item.id,
        hint: item.description || null,
        supportedEfforts: Array.isArray(item.supportedReasoningEfforts)
          ? item.supportedReasoningEfforts
              .map((entry) => entry?.reasoningEffort || entry)
              .filter(Boolean)
          : [],
        defaultEffort: item.defaultReasoningEffort || null,
        isDefault: Boolean(item.isDefault),
      }));
  } finally {
    server.close();
  }
}

router.get("/models", async (req, res) => {
  const provider = providerOf(req.query.provider);
  if (provider === "codex") {
    try {
      const models = await discoverCodexModels();
      return res.json({ provider, dynamic: true, source: "codex-app-server", items: models });
    } catch (err) {
      return res.status(503).json({
        error: {
          code: err.code || "ECODEXMODELS",
          message: err.message || "Could not read Codex models",
        },
      });
    }
  }
  // Claude Code intentionally does not expose an account model-list command.
  // Do not infer availability from old transcript model strings: those can be
  // stale, unavailable to this account, or difficult to understand. Mirror
  // the CLI's stable chooser and leave uncommon/legacy IDs to Custom model.
  return res.json({
    provider,
    dynamic: false,
    source: "claude-cli-curated-aliases",
    items: CLAUDE_FALLBACK_MODELS,
  });
});

router.post("/", (req, res) => {
  const body = req.body || {};
  const provider = providerOf(body.provider);
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const mode =
    provider === "codex" ? "conversation" : body.mode === "headless" ? "headless" : "conversation";
  const model = typeof body.model === "string" && body.model ? body.model : null;
  const resumeSessionId =
    typeof body.resumeSessionId === "string" && body.resumeSessionId ? body.resumeSessionId : null;
  const effort = typeof body.effort === "string" && body.effort ? body.effort : null;
  const permissionMode =
    provider === "codex"
      ? typeof body.permissionMode === "string" && ALLOWED_CODEX_APPROVALS.has(body.permissionMode)
        ? body.permissionMode
        : "on-request"
      : typeof body.permissionMode === "string" && ALLOWED_PERMISSION_MODES.has(body.permissionMode)
        ? body.permissionMode
        : "acceptEdits";
  const sandbox =
    provider === "codex" &&
    typeof body.sandbox === "string" &&
    ALLOWED_CODEX_SANDBOXES.has(body.sandbox)
      ? body.sandbox
      : "workspace-write";
  // Resuming a conversation can spawn with an empty prompt — claude waits
  // on stdin until the user types a follow-up. Headless and fresh
  // conversation runs still need a prompt to do anything.
  if (!prompt.trim() && !(mode === "conversation" && resumeSessionId)) {
    return res.status(400).json({ error: { code: "EBADPROMPT", message: "prompt is required" } });
  }
  let cwd;
  try {
    cwd = sanitiseCwd(body.cwd);
  } catch (err) {
    return res.status(400).json({ error: { code: err.code, message: err.message } });
  }
  try {
    if (totalLiveCount() >= claudeRuns.getMaxConcurrent()) {
      const err = new Error(`concurrency limit ${claudeRuns.getMaxConcurrent()} reached`);
      err.code = "ECONCURRENCY";
      err.running = allLiveRuns().filter(
        (run) => run.status === "running" || run.status === "spawning"
      );
      throw err;
    }
    const handle = spawnerFor(provider).spawnRun({
      prompt,
      mode,
      cwd,
      model,
      permissionMode,
      resumeSessionId,
      effort,
      sandbox,
    });
    return res.status(201).json(spawnerFor(provider).getRun(handle.id));
  } catch (err) {
    if (err.code === "ECONCURRENCY") {
      return res.status(429).json({
        error: { code: err.code, message: err.message },
        running: err.running || [],
      });
    }
    if (err.code && err.code.startsWith("E")) {
      return res.status(400).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { code: "EINTERNAL", message: err.message } });
  }
});

router.post("/:id/message", async (req, res) => {
  const body = req.body || {};
  const text = typeof body.text === "string" ? body.text : "";
  if (!text) {
    return res.status(400).json({ error: { code: "EBADINPUT", message: "text is required" } });
  }
  try {
    const provider = providerOf(body.provider);
    const result = await spawnerFor(provider).sendInput(req.params.id, text);
    return res.json(result);
  } catch (err) {
    const status = err.code === "ENOTFOUND" ? 404 : 400;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
});

router.get("/:id", (req, res) => {
  // ?envelopes=1 includes the in-memory envelope history so the UI can
  // re-attach to an active run started elsewhere and see what it missed.
  const includeEnvelopes = req.query.envelopes === "1";
  const handle =
    claudeRuns.getRun(req.params.id, { includeEnvelopes }) ||
    codexRuns.getRun(req.params.id, { includeEnvelopes });
  if (!handle) {
    return res.status(404).json({ error: { code: "ENOTFOUND", message: "run not found" } });
  }
  return res.json(handle);
});

router.delete("/:id", (req, res) => {
  const ok = claudeRuns.killRun(req.params.id) || codexRuns.killRun(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: { code: "ENOTFOUND", message: "run not found" } });
  }
  return res.json({ ok: true });
});

module.exports = router;
module.exports.__sameOriginGuard = sameOriginGuard;
module.exports.__sanitiseCwd = sanitiseCwd;
