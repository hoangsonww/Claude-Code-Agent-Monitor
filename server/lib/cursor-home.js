/**
 * @file cursor-home.js
 * @description Resolves Cursor's local session roots, identifies Cursor agent
 * transcripts, discovers companion chat metadata, and locates durable dashboard
 * snapshots without depending on Cursor's retention policy. Transcript helpers
 * validate path segments and contain every resolved file to its expected root.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { getDataDir } = require("./claude-home");

const SAFE_CURSOR_ID_RE = /^[A-Za-z0-9_-]+$/;

/** Cursor session and subagent identifiers are single filesystem segments. */
function isSafeCursorId(value) {
  return typeof value === "string" && SAFE_CURSOR_ID_RE.test(value);
}

/** Return whether a candidate is a strict descendant of one trusted directory. */
function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`)) return false;
  if (path.isAbsolute(relative)) return false;
  return true;
}

/** Resolve an existing child file, including symlinks, inside its trusted directory. */
function existingContainedCursorFile(root, filename) {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, filename);
  if (!isPathInside(resolvedRoot, candidate) || !fs.existsSync(candidate)) return null;
  try {
    const realRoot = fs.realpathSync(resolvedRoot);
    const realCandidate = fs.realpathSync(candidate);
    return isPathInside(realRoot, realCandidate) ? realCandidate : null;
  } catch {
    return null;
  }
}

function getCursorHome() {
  return path.resolve(process.env.DASHBOARD_CURSOR_HOME || path.join(os.homedir(), ".cursor"));
}

function getCursorProjectsDir() {
  return path.join(getCursorHome(), "projects");
}

function getCursorChatsDir() {
  return path.join(getCursorHome(), "chats");
}

function getCursorSnapshotDir() {
  return path.join(getDataDir(), "cursor-transcripts");
}

function isCursorTranscriptPath(value) {
  if (typeof value !== "string" || !value) return false;
  const resolved = path.resolve(value);
  const relative = path.relative(getCursorProjectsDir(), resolved).split(path.sep).join("/");
  return (
    !relative.startsWith("../") && /^[^/]+\/agent-transcripts\/[^/]+\/[^/]+\.jsonl$/i.test(relative)
  );
}

function cursorSessionIdFromPath(transcriptPath) {
  if (!isCursorTranscriptPath(transcriptPath)) return null;
  const filename = path.basename(transcriptPath, ".jsonl");
  const parent = path.basename(path.dirname(transcriptPath));
  return filename === parent ? filename : null;
}

function findCursorChatDir(sessionId) {
  if (!isSafeCursorId(sessionId)) return null;
  const root = getCursorChatsDir();
  let workspaces;
  try {
    workspaces = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue;
    const candidate = path.join(root, workspace.name, sessionId);
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Cursor may rotate a chat while discovery is in progress.
    }
  }
  return null;
}

/** Build one session-id lookup for a sync pass instead of rescanning workspaces per transcript. */
function indexCursorChatDirs() {
  const indexed = new Map();
  let workspaces = [];
  try {
    workspaces = fs.readdirSync(getCursorChatsDir(), { withFileTypes: true });
  } catch {
    return indexed;
  }
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue;
    const workspaceDir = path.join(getCursorChatsDir(), workspace.name);
    let sessions = [];
    try {
      sessions = fs.readdirSync(workspaceDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (session.isDirectory() && isSafeCursorId(session.name) && !indexed.has(session.name)) {
        indexed.set(session.name, path.join(workspaceDir, session.name));
      }
    }
  }
  return indexed;
}

function readCursorChatMetadata(sessionId, knownChatDir = undefined) {
  const chatDir = knownChatDir === undefined ? findCursorChatDir(sessionId) : knownChatDir;
  if (!chatDir) return { chatDir: null, meta: null, prompts: [] };
  let meta = null;
  let prompts = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(chatDir, "meta.json"), "utf8"));
    if (parsed && typeof parsed === "object") meta = parsed;
  } catch {
    // Metadata is optional while Cursor is creating a new chat.
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(chatDir, "prompt_history.json"), "utf8"));
    if (Array.isArray(parsed)) {
      prompts = parsed.filter((value) => typeof value === "string" && value.trim());
    }
  } catch {
    // The transcript reader remains useful even without prompt history.
  }
  return { chatDir, meta, prompts };
}

function findCursorTranscriptPath(sessionId) {
  const projectsDir = getCursorProjectsDir();
  let projects;
  try {
    projects = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const candidate = path.join(
      projectsDir,
      project.name,
      "agent-transcripts",
      sessionId,
      `${sessionId}.jsonl`
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve a snapshot file, preferring the plain `.jsonl` and falling back to
 * the compressed `.jsonl.gz` the retention pass writes once Cursor's original
 * is gone (see snapshot-retention.js).
 */
function existingContainedSnapshotFile(root, filename) {
  return (
    existingContainedCursorFile(root, filename) ||
    existingContainedCursorFile(root, `${filename}.gz`)
  );
}

function getCursorSnapshotPath(sessionId) {
  if (!isSafeCursorId(sessionId)) return null;
  return existingContainedSnapshotFile(getCursorSnapshotDir(), `${sessionId}.jsonl`);
}

function getCursorSubagentPath(transcriptPath, agentId) {
  if (!transcriptPath || !isSafeCursorId(agentId)) return null;
  const subagentsDir = path.join(path.dirname(transcriptPath), "subagents");
  return existingContainedCursorFile(subagentsDir, `${agentId}.jsonl`);
}

function getCursorSnapshotSubagentPath(sessionId, agentId) {
  if (!isSafeCursorId(sessionId) || !isSafeCursorId(agentId)) return null;
  const subagentsDir = path.join(getCursorSnapshotDir(), sessionId, "subagents");
  return existingContainedSnapshotFile(subagentsDir, `${agentId}.jsonl`);
}

module.exports = {
  cursorSessionIdFromPath,
  findCursorChatDir,
  findCursorTranscriptPath,
  getCursorChatsDir,
  getCursorHome,
  getCursorProjectsDir,
  getCursorSnapshotDir,
  getCursorSnapshotPath,
  getCursorSnapshotSubagentPath,
  getCursorSubagentPath,
  isSafeCursorId,
  isCursorTranscriptPath,
  indexCursorChatDirs,
  readCursorChatMetadata,
};
