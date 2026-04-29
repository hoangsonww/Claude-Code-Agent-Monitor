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
 * Infer the sub-agent JSONL file path from sessionId, cwd, and agentId.
 * Falls back to scanning all project directories if the encoded path doesn't exist.
 */
function getSubagentTranscriptPath(sessionId, cwd, agentId) {
  if (!cwd) return null;
  const encoded = encodeCwd(cwd);
  const candidate = path.join(
    getProjectsDir(),
    encoded,
    sessionId,
    "subagents",
    `agent-${agentId}.jsonl`
  );
  if (fs.existsSync(candidate)) return candidate;
  // Fallback: scan all project directories
  return findSubagentTranscriptPath(sessionId, agentId);
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
 * Find a sub-agent JSONL file path by scanning when cwd is unknown.
 * Supports exact match and prefix fuzzy match:
 * - Exact: agent-<agentId>.jsonl
 * - Fuzzy: agent-acompact-*.jsonl (for compaction type)
 */
function findSubagentTranscriptPath(sessionId, agentId) {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return null;
  try {
    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const subagentsDir = path.join(projectsDir, d.name, sessionId, "subagents");
      if (!fs.existsSync(subagentsDir)) continue;

      // Exact match
      const exact = path.join(subagentsDir, `agent-${agentId}.jsonl`);
      if (fs.existsSync(exact)) return exact;

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
  const envPath = path.resolve(__dirname, "..", "..", ".env");
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
  getSettingsPath,
  getTranscriptPath,
  getSubagentTranscriptPath,
  findTranscriptPath,
  findSubagentTranscriptPath,
  setClaudeHome,
  writeEnvFile,
};
