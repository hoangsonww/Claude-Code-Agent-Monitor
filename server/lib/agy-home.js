/**
 * @file agy-home.js
 * @description Locates Google Antigravity CLI (agy) local session data. agy keeps
 * a SQLite index of conversations (conversation_summaries.db) and one directory
 * per conversation under brain/<id>/.system_generated/logs with a JSONL
 * transcript. DASHBOARD_AGY_HOME overrides the root (tests, custom installs).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

/** Root of agy's data directory (default ~/.gemini/antigravity). */
function getAgyHome() {
  const override = process.env.DASHBOARD_AGY_HOME;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(os.homedir(), ".gemini", "antigravity");
}

/** SQLite index with one row per conversation (title, workspace, status). */
function getAgySummariesDb(home = getAgyHome()) {
  return path.join(home, "conversation_summaries.db");
}

/** Directory holding one sub-directory per conversation id. */
function getAgyBrainDir(home = getAgyHome()) {
  return path.join(home, "brain");
}

/** Transcript JSONL for one conversation id. */
function getAgyTranscriptPath(conversationId, home = getAgyHome()) {
  return path.join(
    getAgyBrainDir(home),
    conversationId,
    ".system_generated",
    "logs",
    "transcript.jsonl"
  );
}

/** True when agy has written any session data on this machine. */
function agyHomeExists(home = getAgyHome()) {
  try {
    return fs.existsSync(getAgyBrainDir(home)) || fs.existsSync(getAgySummariesDb(home));
  } catch {
    return false;
  }
}

module.exports = {
  getAgyHome,
  getAgySummariesDb,
  getAgyBrainDir,
  getAgyTranscriptPath,
  agyHomeExists,
};
