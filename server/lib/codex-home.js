/**
 * @file Resolves and safely updates the local Codex state directory and its
 * append-only rollout transcripts, live-thread state, and native session titles.
 * A Settings change persists a dashboard-only override and notifies the live
 * synchronizer without changing the Codex CLI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeEnvFile } = require("./claude-home");

// The live synchronizer subscribes here instead of the settings route owning a
// second scanner. This keeps a runtime home change immediate while preserving
// the single, idempotent ingest path used by hooks and the background watcher.
const homeChangeListeners = new Set();
// Codex writes CLI `/rename` values to this lightweight index rather than the
// append-only rollout. Cache it by stat fingerprint so the live synchronizer
// can honor native titles without repeatedly parsing the whole JSONL file.
let sessionTitleIndex = { path: null, fingerprint: null, titles: new Map() };

function getCodexHome() {
  return path.resolve(
    process.env.DASHBOARD_CODEX_HOME || process.env.CODEX_HOME || path.join(os.homedir(), ".codex")
  );
}

function getCodexSessionsDir() {
  return path.join(getCodexHome(), "sessions");
}

function getCodexSessionIndexPath() {
  return path.join(getCodexHome(), "session_index.jsonl");
}

/**
 * Codex writes the currently live threads to a versioned SQLite file. The
 * version is intentionally discovered instead of hard-coded because it has
 * changed across CLI releases (for example, `state_5.sqlite`).
 */
function getCodexStateDbPath() {
  const home = getCodexHome();
  try {
    const candidates = fs
      .readdirSync(home)
      .filter((name) => /^state_\d+\.sqlite$/.test(name))
      .sort((left, right) => {
        const leftVersion = Number(left.match(/\d+/)?.[0] || 0);
        const rightVersion = Number(right.match(/\d+/)?.[0] || 0);
        return rightVersion - leftVersion;
      });
    return candidates.length ? path.join(home, candidates[0]) : null;
  } catch {
    return null;
  }
}

function getCodexHooksPath() {
  return path.join(getCodexHome(), "hooks.json");
}

function getCodexSessionTitles() {
  const indexPath = getCodexSessionIndexPath();
  let fingerprint = null;
  try {
    const stat = fs.statSync(indexPath);
    fingerprint = `${stat.size}:${stat.mtimeMs}`;
  } catch {
    sessionTitleIndex = { path: indexPath, fingerprint: null, titles: new Map() };
    return sessionTitleIndex.titles;
  }
  if (sessionTitleIndex.path === indexPath && sessionTitleIndex.fingerprint === fingerprint) {
    return sessionTitleIndex.titles;
  }

  const titles = new Map();
  try {
    for (const line of fs.readFileSync(indexPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const id = typeof entry?.id === "string" ? entry.id : null;
        const title = typeof entry?.thread_name === "string" ? entry.thread_name.trim() : "";
        if (id && title) titles.set(id, title);
      } catch {
        // Codex may be in the middle of appending a line. Keep every complete
        // title we can read and retry on its next filesystem notification.
      }
    }
  } catch {
    // The state directory is optional and may disappear during a Settings edit.
  }
  sessionTitleIndex = { path: indexPath, fingerprint, titles };
  return titles;
}

function getCodexSessionTitle(sessionId) {
  if (typeof sessionId !== "string" || !sessionId) return null;
  return getCodexSessionTitles().get(sessionId) || null;
}

/** Subscribe to a successful runtime Codex-home change. */
function onCodexHomeChanged(listener) {
  homeChangeListeners.add(listener);
  return () => homeChangeListeners.delete(listener);
}

/**
 * Update the Codex state root without a server restart. `DASHBOARD_CODEX_HOME`
 * deliberately wins over `CODEX_HOME`: it is the dashboard-specific override
 * users configure from Settings and avoids mutating their broader CLI setup.
 */
function setCodexHome(newPath) {
  const expanded = newPath.replace(/^~(?=\/)/, os.homedir());
  if (!path.isAbsolute(expanded)) {
    throw new Error("Codex home must be an absolute path");
  }
  const resolved = path.resolve(expanded);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }

  process.env.DASHBOARD_CODEX_HOME = resolved;
  sessionTitleIndex = { path: null, fingerprint: null, titles: new Map() };
  writeEnvFile("DASHBOARD_CODEX_HOME", resolved);
  for (const listener of homeChangeListeners) {
    try {
      listener(resolved);
    } catch {
      // A listener failure must never make a valid path update fail.
    }
  }
  return resolved;
}

module.exports = {
  getCodexHome,
  getCodexSessionsDir,
  getCodexSessionIndexPath,
  getCodexStateDbPath,
  getCodexSessionTitles,
  getCodexSessionTitle,
  getCodexHooksPath,
  onCodexHomeChanged,
  setCodexHome,
};
