/**
 * @file claude-home.js
 * @description Centralized Claude Code home directory path management.
 * Resolves the projects directory, transcript paths (main + per-subagent),
 * and settings file location. Supports a custom root via the CLAUDE_HOME
 * environment variable (e.g. ~/.codefuse/engine/cc/) so the dashboard can
 * track non-default Claude Code installations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const path = require("path");
const os = require("os");
const fs = require("fs");

function getClaudeHome() {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
}

function getProjectsDir() {
  return path.join(getClaudeHome(), "projects");
}

/**
 * Canonical, user-global directory for the dashboard's writable state — the
 * SQLite database, VAPID keys, and transcript snapshots. It resolves to the
 * SAME absolute path for every launch path (`npm start`, `npm run dev`, and the
 * macOS/Windows desktop app), so they all share ONE database instead of each
 * host keeping its own. Lives under the Claude home, next to the hook discovery
 * file (`~/.claude/.agent-dashboard.json`).
 *
 * An explicit `DASHBOARD_DATA_DIR` still wins — for tests, power users, or
 * anyone pinning a custom location. The earlier default was the repo-local
 * `data/` dir, which the desktop app (read-only bundle) couldn't use and which
 * never coincided with the web server's copy; see db.js for the one-time
 * migration that carries pre-existing databases into this location.
 */
function getDataDir() {
  return process.env.DASHBOARD_DATA_DIR || path.join(getClaudeHome(), "agent-dashboard");
}

/**
 * Dashboard-owned directory where imported transcripts are snapshotted so the
 * Conversation tab survives Claude Code pruning the originals in
 * ~/.claude/projects. Lives next to the SQLite DB under the shared data dir.
 */
function getTranscriptSnapshotDir() {
  return path.join(getDataDir(), "transcripts");
}

function getSettingsPath() {
  return path.join(getClaudeHome(), "settings.json");
}

/**
 * Claude Code path encoding: replace all non-alphanumeric characters with "-".
 * Example: "/Users/txj/.codefuse" → "-Users-txj--codefuse"
 * Note: not just "/", characters like "." are also replaced.
 */
function encodeCwd(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/**
 * Infer the main session JSONL file path from sessionId and cwd.
 * Encoding rule: all non-alphanumeric characters replaced with "-".
 * Falls back to scanning all project directories if the encoded path doesn't exist.
 */
function getTranscriptPath(sessionId, cwd) {
  if (!cwd) return null;
  const encoded = encodeCwd(cwd);
  const candidate = path.join(getProjectsDir(), encoded, `${sessionId}.jsonl`);
  if (fs.existsSync(candidate)) return candidate;
  // Fallback: scan projects/ subdirectories
  return findTranscriptPath(sessionId);
}

/**
 * Resolve a per-agent transcript file inside a session's `subagents` directory,
 * supporting BOTH on-disk layouts Claude Code has used for sub-agent transcripts:
 *   - flat:   <subagents>/agent-<agentId>.jsonl
 *             (regular sub-agents, and older Workflow-tool builds)
 *   - nested: <subagents>/workflows/<runId>/agent-<agentId>.jsonl
 *             (current Workflow-tool fan-out runs)
 *
 * The flat path is checked first, so regular sub-agents resolve exactly as
 * before. For the nested layout: when `runId` is known the run directory is read
 * directly; when it is unknown the nested tree is scanned and a match is
 * returned ONLY if exactly one run contains that agent — an ambiguous agentId
 * across multiple runs resolves to null rather than guessing.
 *
 * @param {string} subagentsDir absolute path to a `.../subagents` directory
 * @param {string} agentId the agent-<agentId>.jsonl key (no prefix/suffix)
 * @param {string|null} [runId] the workflow run id, when known
 * @returns {string|null} absolute transcript path, or null. Never throws.
 */
function resolveAgentTranscriptInDir(subagentsDir, agentId, runId = null) {
  if (!subagentsDir) return null;
  const flat = path.join(subagentsDir, `agent-${agentId}.jsonl`);
  if (fs.existsSync(flat)) return flat;

  const workflowsDir = path.join(subagentsDir, "workflows");
  if (!fs.existsSync(workflowsDir)) return null;

  if (runId) {
    const nested = path.join(workflowsDir, runId, `agent-${agentId}.jsonl`);
    return fs.existsSync(nested) ? nested : null;
  }

  // Unknown run: accept only an unambiguous single match across all runs.
  try {
    const matches = [];
    for (const d of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const cand = path.join(workflowsDir, d.name, `agent-${agentId}.jsonl`);
      if (fs.existsSync(cand)) matches.push(cand);
      if (matches.length > 1) break;
    }
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

/**
 * Infer the sub-agent JSONL file path from sessionId, cwd, agentId, and
 * (optionally) the Workflow runId. Resolves both the flat and nested
 * Workflow-tool layouts via resolveAgentTranscriptInDir. Falls back to scanning
 * all project directories if the encoded path doesn't exist.
 */
function getSubagentTranscriptPath(sessionId, cwd, agentId, runId = null) {
  if (!cwd) return null;
  const encoded = encodeCwd(cwd);
  const subagentsDir = path.join(getProjectsDir(), encoded, sessionId, "subagents");
  const direct = resolveAgentTranscriptInDir(subagentsDir, agentId, runId);
  if (direct) return direct;
  // Fallback: scan all project directories
  return findSubagentTranscriptPath(sessionId, agentId, runId);
}

/**
 * When cwd is unknown, scan projects/ subdirectories to find the JSONL file for a sessionId.
 * Returns the found path or null.
 */
function findTranscriptPath(sessionId) {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return null;
  try {
    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const candidate = path.join(projectsDir, d.name, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Permission or IO error, ignore
  }
  return null;
}

/**
 * Path to the dashboard's durable transcript snapshot for a session, if one
 * exists. Snapshots are written at import time (see snapshotTranscript in
 * scripts/import-history.js) so the Conversation tab keeps working after Claude
 * Code deletes the original under its `cleanupPeriodDays` retention (default
 * 30d). Returns the path or null.
 */
function getSnapshotTranscriptPath(sessionId) {
  const candidate = path.join(getTranscriptSnapshotDir(), `${sessionId}.jsonl`);
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Path to a snapshotted subagent transcript, mirroring the live layout
 * `<snapshotDir>/<sessionId>/subagents/agent-<agentId>.jsonl` (flat) and
 * `<snapshotDir>/<sessionId>/subagents/workflows/<runId>/agent-<agentId>.jsonl`
 * (nested Workflow-tool runs, preserved by the snapshot writer). Supports the
 * same compaction prefix-fuzzy match as findSubagentTranscriptPath. Returns
 * the path or null.
 */
function getSnapshotSubagentTranscriptPath(sessionId, agentId, runId = null) {
  const subDir = path.join(getTranscriptSnapshotDir(), sessionId, "subagents");
  if (!fs.existsSync(subDir)) return null;
  const hit = resolveAgentTranscriptInDir(subDir, agentId, runId);
  if (hit) return hit;
  if (agentId.startsWith("acompact-")) {
    try {
      const match = fs
        .readdirSync(subDir)
        .find((f) => f.startsWith("agent-acompact-") && f.endsWith(".jsonl"));
      if (match) return path.join(subDir, match);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Find a sub-agent JSONL file path by scanning when cwd is unknown.
 * Supports both layouts (flat + nested Workflow-tool, via
 * resolveAgentTranscriptInDir) and a prefix fuzzy match:
 * - Exact:  agent-<agentId>.jsonl (or workflows/<runId>/agent-<agentId>.jsonl)
 * - Fuzzy:  agent-acompact-*.jsonl (for compaction type)
 */
function findSubagentTranscriptPath(sessionId, agentId, runId = null) {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return null;
  try {
    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const subagentsDir = path.join(projectsDir, d.name, sessionId, "subagents");
      if (!fs.existsSync(subagentsDir)) continue;

      // Exact match (flat or nested Workflow-tool layout)
      const hit = resolveAgentTranscriptInDir(subagentsDir, agentId, runId);
      if (hit) return hit;

      // Prefix fuzzy match (compaction type: agentId starts with "acompact-")
      if (agentId.startsWith("acompact-")) {
        const files = fs.readdirSync(subagentsDir);
        const match = files.find((f) => f.startsWith("agent-acompact-") && f.endsWith(".jsonl"));
        if (match) return path.join(subagentsDir, match);
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Update CLAUDE_HOME at runtime. Updates process.env so getClaudeHome()
 * immediately returns the new value, and persists to .env file.
 * Returns the resolved absolute path.
 */
function setClaudeHome(newPath) {
  const resolved = newPath.replace(/^~(?=\/)/, os.homedir());
  if (!path.isAbsolute(resolved)) {
    throw new Error("CLAUDE_HOME must be an absolute path");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }
  process.env.CLAUDE_HOME = resolved;
  writeEnvFile("CLAUDE_HOME", resolved);
  return resolved;
}

/**
 * Write or update a key=value line in the .env file.
 * Creates the file if it doesn't exist.
 */
function writeEnvFile(key, value) {
  const envPath = path.resolve(
    process.env.DASHBOARD_ENV_PATH || path.resolve(__dirname, "..", "..", ".env")
  );
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  let lines = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf8").split("\n");
  }
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push(`${key}=${value}`);
  }
  // Write atomically: write to temp file then rename to prevent corruption
  const tempPath = envPath + ".tmp";
  fs.writeFileSync(tempPath, lines.join("\n") + "\n", "utf8");
  fs.renameSync(tempPath, envPath);
}

module.exports = {
  getClaudeHome,
  getProjectsDir,
  getDataDir,
  getTranscriptSnapshotDir,
  getSettingsPath,
  getTranscriptPath,
  resolveAgentTranscriptInDir,
  getSubagentTranscriptPath,
  getSnapshotTranscriptPath,
  getSnapshotSubagentTranscriptPath,
  findTranscriptPath,
  findSubagentTranscriptPath,
  setClaudeHome,
  writeEnvFile,
};
