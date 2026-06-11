/**
 * @file cc-watcher.js
 * @description Best-effort file watcher for the Claude Code config surfaces
 * surfaced by the Config Explorer page. Watches ~/.claude/ recursively (if
 * the platform supports it) plus ~/.claude.json and emits a debounced
 * `cc_config_changed` over the dashboard websocket so the UI can refetch
 * without polling.
 *
 * Aggressively filters fs.watch events: ~/.claude/ contains lots of churn
 * (`projects/*.jsonl` transcripts, `file-history/`, our own
 * `cc-config-backups/`) that has nothing to do with the Config Explorer.
 * Only paths matching real config surfaces fire a broadcast. Without this
 * filter the watcher fires multiple times per second while a claude session
 * is active and the page becomes a perpetual loading spinner.
 *
 * Failures here are non-fatal — `fs.watch` is platform-quirky, and the
 * Config Explorer still has a manual Refresh button.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { getClaudeHome } = require("./claude-home");

const DEBOUNCE_MS = 500;

// Subpaths inside ~/.claude/ that ARE config surfaces and should trigger a
// refetch. Anything else (transcripts, file history, our own backups) is
// ignored. Match is by prefix on the relative path.
const RELEVANT_PREFIXES = [
  "settings.json",
  "settings.local.json",
  "keybindings.json",
  "statusline.py",
  "statusline-command.sh",
  "known_marketplaces.json",
  "agents",
  "commands",
  "skills",
  "output-styles",
  "hooks",
  "plugins",
  "CLAUDE.md",
];

// Subpaths to explicitly ignore even if they match RELEVANT_PREFIXES by
// accident. Important: our own backup dir lives at ~/.claude/cc-config-backups/
// and writing backups would re-trigger the watcher in a loop without this.
const IGNORED_PREFIXES = [
  "cc-config-backups",
  "backups", // Claude Code's own ~/.claude/backups/.claude.json.backup.* churn
  "projects",
  "file-history",
  "todos",
  "shell-snapshots",
  "ide",
  "logs",
  "statsig",
];

// Config surfaces that are DIRECTORIES — watched recursively so nested changes
// (e.g. skills/<x>/SKILL.md) still fire. We deliberately watch ONLY these,
// never the whole of ~/.claude/, so the recursive watcher never registers
// interest in high-churn dirs (backups/, projects/, logs/) whose transient
// files crash Node's Linux userland recursive watcher mid-stat.
const WATCH_SUBDIRS = ["agents", "commands", "skills", "output-styles", "hooks", "plugins"];

let started = false;
let timer = null;
let pendingPaths = new Set();
const watchers = [];

function isRelevantUnderHome(home, fullPath) {
  const rel = path.relative(home, fullPath);
  if (!rel || rel.startsWith("..")) return false;
  // First segment of the relative path
  const head = rel.split(path.sep)[0];
  if (IGNORED_PREFIXES.includes(head)) return false;
  if (!RELEVANT_PREFIXES.includes(head)) return false;
  return true;
}

function scheduleEmit(broadcast, p) {
  if (p) pendingPaths.add(p);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const paths = Array.from(pendingPaths);
    pendingPaths = new Set();
    if (paths.length === 0) return;
    try {
      broadcast("cc_config_changed", { source: "fs", paths });
    } catch {
      /* ignore */
    }
  }, DEBOUNCE_MS);
}

function safeWatchHome({ home, broadcast }) {
  if (!fs.existsSync(home)) return;

  // Watch ~/.claude/ itself NON-recursively. Catches top-level config files
  // (settings.json, keybindings.json, CLAUDE.md, statusline.*, *.json) plus the
  // creation/removal of subdirs. Non-recursive does NOT walk-and-stat children,
  // so it never trips the recursive-watcher ENOENT race on churn dirs.
  try {
    const w = fs.watch(home, (_event, filename) => {
      if (!filename) return;
      const full = path.join(home, filename);
      if (!isRelevantUnderHome(home, full)) return;
      scheduleEmit(broadcast, full);
    });
    w.on("error", () => {});
    watchers.push(w);
  } catch {
    /* platform limitation — best effort only */
  }

  // Recursively watch ONLY the relevant config subdirs (never backups/, projects/,
  // logs/, …) so nested changes still fire without watching the high-churn trees.
  for (const sub of WATCH_SUBDIRS) {
    const dir = path.join(home, sub);
    try {
      if (!fs.existsSync(dir)) continue;
      const w = fs.watch(dir, { recursive: true }, (_event, filename) => {
        const full = filename ? path.join(dir, filename) : dir;
        if (!isRelevantUnderHome(home, full)) return;
        scheduleEmit(broadcast, full);
      });
      w.on("error", () => {});
      watchers.push(w);
    } catch {
      /* platform limitation — best effort only */
    }
  }
}

function safeWatchFile({ target, broadcast }) {
  try {
    if (!fs.existsSync(target)) return;
    const w = fs.watch(target, () => scheduleEmit(broadcast, target));
    w.on("error", () => {});
    watchers.push(w);
  } catch {
    /* ignore */
  }
}

// Belt-and-suspenders: Node's recursive fs.watch (userland impl on Linux) stats
// changed paths and can throw ENOENT/EPERM when a file vanishes mid-event. That
// throw escapes the watcher's `error` event as an uncaughtException. This watcher
// is explicitly best-effort and must NEVER take down the server, so swallow
// exactly that class of error and let every other uncaught exception crash as
// normal (print + non-zero exit, matching Node's default).
let crashGuard = null;
function installWatchCrashGuard() {
  if (crashGuard) return;
  crashGuard = (err) => {
    const stack = (err && err.stack) || "";
    const transientWatch =
      err &&
      (err.code === "ENOENT" || err.code === "EPERM") &&
      err.syscall === "stat" &&
      /fs[\\/](recursive_watch|watchers)/.test(stack);
    if (transientWatch) return; // vanished file under a watched tree — ignore
    // Not ours: preserve default crash behavior.
    console.error(err);
    process.exit(1);
  };
  process.on("uncaughtException", crashGuard);
}
function uninstallWatchCrashGuard() {
  if (!crashGuard) return;
  process.removeListener("uncaughtException", crashGuard);
  crashGuard = null;
}

/**
 * Start watching the Claude Code config surfaces. Idempotent: subsequent
 * calls are no-ops.
 */
function startCcWatcher({ broadcast }) {
  if (started) return;
  started = true;
  installWatchCrashGuard();
  const home = getClaudeHome();
  safeWatchHome({ home, broadcast });
  // ~/.claude.json sits beside ~/.claude/, not inside it.
  safeWatchFile({ target: path.join(os.homedir(), ".claude.json"), broadcast });
}

function stopCcWatcher() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  watchers.length = 0;
  pendingPaths = new Set();
  uninstallWatchCrashGuard();
  started = false;
}

module.exports = { startCcWatcher, stopCcWatcher, isRelevantUnderHome };
