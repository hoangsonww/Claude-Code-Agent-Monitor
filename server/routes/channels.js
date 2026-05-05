/**
 * @file Read-only channels viewer routes. Exposes Claude Code's `/channels`
 * configuration — slack/telegram/discord/imessage/webhook destinations — as
 * configured per-project in `~/.claude.json` (`projects[<cwd>].channels`)
 * and globally in `~/.claude/settings.json` (`channels`).
 *
 * Disabled by default — gated behind ORCHESTRATOR_ENABLED=1 (same flag as the
 * orchestrator and memory routers) so this filesystem-reading endpoint isn't
 * exposed unless the operator opts in.
 *
 * Endpoints are strictly read-only; editing/configuration belongs to a later
 * phase. Channel objects are returned as-is from disk; we do NOT redact secret
 * fields here, but we do add a `scope` discriminator so the UI can flag
 * project-scoped vs user-scoped entries. The `/raw` sub-route is provided for
 * transparency/debugging — it returns whatever shape happens to live on disk
 * so operators can sanity-check what Claude Code itself reads.
 */

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

// Resolve config locations lazily — these are read on each request so that a
// test can mutate process.env.CLAUDE_HOME / HOME before requiring the module.
function claudeHome() {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
}

function claudeJsonPath() {
  // ~/.claude.json (NOT inside CLAUDE_HOME) is where the CLI keeps the
  // projects map. Honor a CLAUDE_JSON override for tests.
  return process.env.CLAUDE_JSON || path.join(os.homedir(), ".claude.json");
}

function settingsJsonPath() {
  return path.join(claudeHome(), "settings.json");
}

// Same gating model as orchestrator/memory routers: 404 (not 403) hides the
// endpoint entirely when disabled.
router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "channels routes disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 to enable read-only channels browse.",
    });
  }
  next();
});

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, "utf8");
    if (!txt.trim()) return null;
    return JSON.parse(txt);
  } catch (err) {
    // Surface the parse/IO error inline so the UI can show "config malformed"
    // without us tearing down the entire endpoint.
    return { _error: err.message };
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Normalize an arbitrary `channels` blob (array OR object map) into a uniform
// array of channel records. Mutates nothing; returns a fresh array.
function normalizeChannels(blob, scope) {
  if (!blob) return [];
  if (Array.isArray(blob)) {
    return blob
      .filter((ch) => isPlainObject(ch))
      .map((ch) => ({ ...ch, scope }));
  }
  if (isPlainObject(blob)) {
    return Object.entries(blob)
      .filter(([, ch]) => isPlainObject(ch))
      .map(([name, ch]) => ({ name, ...ch, scope }));
  }
  return [];
}

router.get("/", (_req, res) => {
  const settings = readJson(settingsJsonPath());
  const cfg = readJson(claudeJsonPath());

  const channels = [];
  const errors = [];

  if (settings && settings._error) {
    errors.push({ source: "settings.json", error: settings._error });
  } else if (settings && settings.channels !== undefined) {
    channels.push(...normalizeChannels(settings.channels, "user"));
  }

  if (cfg && cfg._error) {
    errors.push({ source: ".claude.json", error: cfg._error });
  } else if (cfg && isPlainObject(cfg.projects)) {
    const cwd = process.cwd();
    const proj = cfg.projects[cwd];
    if (isPlainObject(proj) && proj.channels !== undefined) {
      channels.push(...normalizeChannels(proj.channels, "project"));
    }
  }

  // Summary aggregates for at-a-glance UX. `type` and `kind` are both seen in
  // the wild (different Claude Code versions); fall back to "unknown" so we
  // never crash on a partially-populated entry.
  const byType = {};
  for (const ch of channels) {
    const t = ch.type || ch.kind || "unknown";
    byType[t] = (byType[t] || 0) + 1;
  }

  res.json({
    channels,
    summary: {
      total: channels.length,
      byScope: {
        user: channels.filter((c) => c.scope === "user").length,
        project: channels.filter((c) => c.scope === "project").length,
      },
      byType,
    },
    sources: {
      settingsJson: settingsJsonPath(),
      claudeJson: claudeJsonPath(),
      cwd: process.cwd(),
    },
    errors,
  });
});

router.get("/raw", (_req, res) => {
  const settings = readJson(settingsJsonPath());
  const cfg = readJson(claudeJsonPath());
  const cwd = process.cwd();

  // Pull out only the channel-relevant slices. We deliberately do NOT return
  // the entire ~/.claude.json file here — it contains unrelated user state
  // (oauth tokens, telemetry caches) that shouldn't leak through a "raw"
  // viewer.
  const settingsChannels =
    settings && !settings._error ? (settings.channels ?? null) : null;

  let projectChannels = null;
  if (cfg && !cfg._error && isPlainObject(cfg.projects)) {
    const proj = cfg.projects[cwd];
    if (isPlainObject(proj)) {
      projectChannels = proj.channels ?? null;
    }
  }

  res.json({
    settingsChannels,
    projectChannels,
    cwd,
    sources: {
      settingsJson: settingsJsonPath(),
      claudeJson: claudeJsonPath(),
    },
    errors: [
      settings && settings._error
        ? { source: "settings.json", error: settings._error }
        : null,
      cfg && cfg._error ? { source: ".claude.json", error: cfg._error } : null,
    ].filter(Boolean),
  });
});

module.exports = router;
