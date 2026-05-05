/**
 * @file Read-only viewer routes for Claude Code's configured hooks across the
 * three settings layers (user / project / local). Disabled by default — gated
 * behind ORCHESTRATOR_ENABLED=1 (same flag as the orchestrator and skills
 * surfaces) so this filesystem-reading endpoint isn't exposed unless the
 * operator opts in.
 *
 * Endpoints are strictly read-only; editing belongs to a later phase.
 *
 * Layout we read from:
 *   ~/.claude/settings.json                 -- user-scoped settings (`hooks` block)
 *   <project>/.claude/settings.json         -- project-scoped settings (`hooks` block)
 *   <project>/.claude/settings.local.json   -- local-only project settings (`hooks` block)
 *
 * IMPORTANT: This file is intentionally distinct from `routes/hooks.js`, which
 * is the live INGESTION endpoint that hook-handler.js POSTs to. This module
 * concerns itself with *configuration* of those hooks, not their runtime
 * delivery.
 */

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

// Resolve paths lazily inside each handler so tests that mutate CLAUDE_HOME /
// process.cwd() between requests pick up the new values without forcing a
// require-cache bust.
function userSettingsPath() {
  const home = process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
  return path.join(home, "settings.json");
}
function projectSettingsPath() {
  return path.join(process.cwd(), ".claude", "settings.json");
}
function localSettingsPath() {
  return path.join(process.cwd(), ".claude", "settings.local.json");
}

// Documented hook event taxonomy. Anything found in a settings file that is
// NOT in this map is surfaced as a "custom / unknown" event so the UI can
// still render it.
const HOOK_EVENT_DOCS = {
  SessionStart: {
    description: "Fires when a new Claude Code session begins.",
    since: "earliest",
  },
  SessionEnd: {
    description: "Fires when a Claude Code session ends.",
    since: "earliest",
  },
  UserPromptSubmit: {
    description: "Fires when the user submits a prompt.",
    since: "earliest",
  },
  PreToolUse: {
    description: "Fires before any tool invocation. Can block or modify the action.",
    since: "earliest",
  },
  PostToolUse: {
    description: "Fires after any tool invocation completes.",
    since: "earliest",
  },
  Stop: {
    description: "Fires when the assistant turn ends.",
    since: "earliest",
  },
  SubagentStop: {
    description: "Fires when a Task-tool subagent completes.",
    since: "earliest",
  },
  Notification: {
    description: "Fires when a notification is surfaced.",
    since: "earliest",
  },
  PreCompact: {
    description: "Fires before compaction runs. Useful for snapshotting transcript state.",
    since: "v2.1.x",
  },
  PostCompact: {
    description: "Fires after compaction completes.",
    since: "v2.1.x",
  },
};

router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "hooks-mgmt routes disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 to enable read-only hook configuration browsing.",
    });
  }
  next();
});

/**
 * Read a JSON file. Returns:
 *   - null if the file does not exist
 *   - { _error: string } if the file exists but cannot be parsed
 *   - the parsed object otherwise
 */
function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    // Guard against an array / scalar at the top level — settings files must
    // be objects, otherwise the `hooks` accessor will explode.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { _error: "settings root is not a JSON object" };
    }
    return parsed;
  } catch (e) {
    return { _error: e instanceof Error ? e.message : String(e) };
  }
}

function getHooks(settings) {
  if (!settings || settings._error) return {};
  const h = settings.hooks;
  if (!h || typeof h !== "object" || Array.isArray(h)) return {};
  return h;
}

/**
 * Count the number of `command`-shaped entries inside a single event's
 * configuration array (e.g. settings.hooks.PreToolUse).
 *
 * Each event is an array of objects of the form:
 *   { matcher?: string, hooks: [{ type, command, ... }, ...] }
 * We tolerate missing `hooks` arrays so a malformed user file doesn't
 * crash the dashboard.
 */
function countCommands(eventArr) {
  if (!Array.isArray(eventArr)) return 0;
  let n = 0;
  for (const entry of eventArr) {
    if (entry && Array.isArray(entry.hooks)) {
      n += entry.hooks.length;
    }
  }
  return n;
}

// GET /api/hooks-mgmt — merged view across all three scopes.
router.get("/", (_req, res) => {
  const userSettings = readJson(userSettingsPath());
  const projectSettings = readJson(projectSettingsPath());
  const localSettings = readJson(localSettingsPath());

  const userHooks = getHooks(userSettings);
  const projectHooks = getHooks(projectSettings);
  const localHooks = getHooks(localSettings);

  // Collect every event type referenced anywhere, plus the documented set so
  // the UI can show docs even for events with no hooks installed yet.
  const allEvents = new Set([
    ...Object.keys(userHooks),
    ...Object.keys(projectHooks),
    ...Object.keys(localHooks),
    ...Object.keys(HOOK_EVENT_DOCS),
  ]);

  const events = {};
  for (const ev of allEvents) {
    const userArr = Array.isArray(userHooks[ev]) ? userHooks[ev] : [];
    const projectArr = Array.isArray(projectHooks[ev]) ? projectHooks[ev] : [];
    const localArr = Array.isArray(localHooks[ev]) ? localHooks[ev] : [];
    events[ev] = {
      doc: HOOK_EVENT_DOCS[ev] || {
        description: "Unknown / custom event",
        since: "?",
      },
      user: userArr,
      project: projectArr,
      local: localArr,
      hasAny: userArr.length > 0 || projectArr.length > 0 || localArr.length > 0,
    };
  }

  let totalCommands = 0;
  let totalEventTypesWithHooks = 0;
  for (const ev of Object.values(events)) {
    if (ev.hasAny) totalEventTypesWithHooks += 1;
    totalCommands += countCommands(ev.user);
    totalCommands += countCommands(ev.project);
    totalCommands += countCommands(ev.local);
  }

  const summary = {
    totalEventTypesWithHooks,
    totalCommands,
    bySource: {
      user: !!userSettings && !userSettings._error,
      project: !!projectSettings && !projectSettings._error,
      local: !!localSettings && !localSettings._error,
    },
    paths: {
      user: userSettingsPath(),
      project: projectSettingsPath(),
      local: localSettingsPath(),
    },
  };

  const errors = {
    user: userSettings && userSettings._error ? userSettings._error : null,
    project: projectSettings && projectSettings._error ? projectSettings._error : null,
    local: localSettings && localSettings._error ? localSettings._error : null,
  };

  res.json({ events, summary, errors });
});

// GET /api/hooks-mgmt/events — known event taxonomy with descriptions.
// Listed BEFORE /scope/:scope so it doesn't get shadowed.
router.get("/events", (_req, res) => {
  res.json({ events: HOOK_EVENT_DOCS });
});

// GET /api/hooks-mgmt/scope/:scope — raw hooks block from a single layer.
router.get("/scope/:scope", (req, res) => {
  const map = {
    user: userSettingsPath(),
    project: projectSettingsPath(),
    local: localSettingsPath(),
  };
  const target = map[req.params.scope];
  if (!target) {
    return res.status(400).json({ error: "scope must be user, project, or local" });
  }
  const settings = readJson(target);
  if (!settings) {
    return res.json({
      scope: req.params.scope,
      hooks: null,
      exists: false,
      path: target,
    });
  }
  res.json({
    scope: req.params.scope,
    hooks: settings._error ? {} : settings.hooks || {},
    exists: true,
    error: settings._error || null,
    path: target,
  });
});

module.exports = router;
module.exports.HOOK_EVENT_DOCS = HOOK_EVENT_DOCS;
