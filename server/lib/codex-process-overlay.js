/**
 * @file Tracks interactive Codex TUI processes before Codex creates a durable
 * session identity. The resulting session and agent cards live only in memory,
 * never enter SQLite, and hand off immediately when the process opens a durable
 * thread writer lock, including before a resumed thread receives a new message.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { isInsideContainer } = require("../../scripts/install-hooks");
const { getCodexHome, getCodexSessionsDir } = require("./codex-home");

const NON_INTERACTIVE_COMMANDS = new Set([
  "e",
  "exec",
  "review",
  "login",
  "logout",
  "mcp",
  "plugin",
  "mcp-server",
  "app-server",
  "remote-control",
  "app",
  "completion",
  "update",
  "doctor",
  "sandbox",
  "debug",
  "apply",
  "archive",
  "delete",
  "unarchive",
  "cloud",
  "exec-server",
  "features",
  "help",
]);
const VALUE_FLAGS = new Set([
  "-c",
  "--config",
  "--enable",
  "--disable",
  "--remote",
  "--remote-auth-token-env",
  "-i",
  "--image",
  "-m",
  "--model",
  "--local-provider",
  "-p",
  "--profile",
  "-s",
  "--sandbox",
  "-C",
  "--cd",
  "--add-dir",
  "-a",
  "--ask-for-approval",
]);

let sessionsById = new Map();
let matchedSessionIds = new Set();
let monitorStarted = false;

function commandTokens(args) {
  return typeof args === "string" ? args.trim().split(/\s+/).filter(Boolean) : [];
}

function codexBinaryIndex(tokens) {
  if (path.basename(tokens[0] || "") === "codex") return 0;
  const interpreter = path.basename(tokens[0] || "");
  if (
    (interpreter === "node" || interpreter === "bun") &&
    path.basename(tokens[1] || "") === "codex"
  ) {
    return 1;
  }
  return -1;
}

function isInteractiveCodexCommand(args) {
  const tokens = commandTokens(args);
  const binaryIndex = codexBinaryIndex(tokens);
  if (binaryIndex < 0) return false;

  let command = null;
  for (let index = binaryIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") return true;
    if (token === "-h" || token === "--help" || token === "-V" || token === "--version") {
      return false;
    }
    if (VALUE_FLAGS.has(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith("-")) continue;
    command = token;
    break;
  }
  return (
    command === null ||
    command === "resume" ||
    command === "fork" ||
    !NON_INTERACTIVE_COMMANDS.has(command)
  );
}

function probeDisabled() {
  const raw = String(process.env.DASHBOARD_LIVENESS_PROBE || "")
    .trim()
    .toLowerCase();
  return (
    raw === "0" ||
    raw === "false" ||
    raw === "no" ||
    raw === "off" ||
    process.platform === "win32" ||
    isInsideContainer()
  );
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) {
        error.stdout = stdout;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function writerLockSessionId(
  filename,
  lockRoot = path.join(getCodexHome(), "thread-writer-locks")
) {
  if (typeof filename !== "string" || !filename) return null;
  const resolved = path.resolve(filename);
  const root = path.resolve(lockRoot);
  if (path.dirname(resolved) !== root || path.extname(resolved) !== ".lock") return null;
  const sessionId = path.basename(resolved, ".lock");
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(sessionId) ? sessionId : null;
}

function rolloutSessionId(filename, sessionsRoot = getCodexSessionsDir()) {
  if (typeof filename !== "string" || !filename) return null;
  const resolved = path.resolve(filename);
  const root = path.resolve(sessionsRoot);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return path.basename(resolved).match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i)?.[1] || null;
}

function newestWriterLock(paths, options = {}) {
  const statFile = options.statFile || fs.statSync;
  const locks = [];
  for (const filename of paths) {
    const sessionId = writerLockSessionId(filename, options.lockRoot);
    if (!sessionId) continue;
    let openedAtMs = 0;
    try {
      const stat = statFile(filename);
      openedAtMs = stat.birthtimeMs || stat.mtimeMs || 0;
    } catch {
      // Open descriptors remain useful even when the path disappears mid-probe.
    }
    locks.push({ sessionId, openedAtMs });
  }
  return locks.sort(
    (left, right) =>
      right.openedAtMs - left.openedAtMs || right.sessionId.localeCompare(left.sessionId)
  )[0];
}

function processInfosFromLsof(argsByPid, output, options = {}) {
  const byPid = new Map();
  let currentPid = null;
  let currentField = null;
  for (const line of String(output || "").split("\n")) {
    if (line.startsWith("p")) {
      const pid = Number(line.slice(1));
      currentPid = argsByPid.has(pid) ? pid : null;
      currentField = null;
      if (currentPid && !byPid.has(currentPid)) {
        byPid.set(currentPid, { pid: currentPid, cwd: null, openPaths: [] });
      }
      continue;
    }
    if (!currentPid) continue;
    if (line.startsWith("f")) {
      currentField = line.slice(1);
      continue;
    }
    if (!line.startsWith("n")) continue;
    const filename = line.slice(1);
    const processInfo = byPid.get(currentPid);
    if (currentField === "cwd") processInfo.cwd = path.resolve(filename);
    else processInfo.openPaths.push(filename);
  }

  const processes = [];
  for (const processInfo of byPid.values()) {
    if (!processInfo.cwd) continue;
    const rolloutIds = [
      ...new Set(
        processInfo.openPaths
          .map((filename) => rolloutSessionId(filename, options.sessionsRoot))
          .filter(Boolean)
      ),
    ];
    const newest = newestWriterLock(processInfo.openPaths, options);
    const sessionId = rolloutIds.length === 1 ? rolloutIds[0] : newest?.sessionId;
    processes.push({
      pid: processInfo.pid,
      cwd: processInfo.cwd,
      ...(sessionId ? { sessionId } : {}),
    });
  }
  return processes;
}

/**
 * Collapse the Node launcher and its direct native Codex child into one logical
 * interactive process. npm's `codex` shim stays alive as the parent, so counting
 * both PIDs creates two transient cards for every real terminal session.
 */
function collapseCodexProcessTree(processes, parentByPid) {
  const byPid = new Map((processes || []).map((processInfo) => [processInfo.pid, processInfo]));
  const launcherPids = new Set();
  const inheritedSessionIds = new Map();
  for (const child of processes || []) {
    const parent = byPid.get(parentByPid.get(child.pid));
    if (!parent || parent.cwd !== child.cwd) continue;
    if (!child.sessionId && parent.sessionId) {
      inheritedSessionIds.set(child.pid, parent.sessionId);
    }
    launcherPids.add(parent.pid);
  }
  return (processes || [])
    .filter((processInfo) => !launcherPids.has(processInfo.pid))
    .map((processInfo) =>
      inheritedSessionIds.has(processInfo.pid)
        ? { ...processInfo, sessionId: inheritedSessionIds.get(processInfo.pid) }
        : processInfo
    );
}

async function probeInteractiveCodexProcesses() {
  if (probeDisabled()) return { available: false, processes: [] };

  let psOutput;
  try {
    psOutput = await run("ps", ["-Ao", "pid=,ppid=,args="], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return { available: false, processes: [] };
  }

  const argsByPid = new Map();
  const parentByPid = new Map();
  for (const line of psOutput.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (!match || !isInteractiveCodexCommand(match[3])) continue;
    const pid = Number(match[1]);
    argsByPid.set(pid, match[3]);
    parentByPid.set(pid, Number(match[2]));
  }
  if (argsByPid.size === 0) return { available: true, processes: [] };

  const processes = [];
  if (process.platform === "linux") {
    for (const pid of argsByPid.keys()) {
      try {
        const cwd = path.resolve(fs.readlinkSync(`/proc/${pid}/cwd`));
        const openPaths = fs.readdirSync(`/proc/${pid}/fd`).flatMap((descriptor) => {
          try {
            return [fs.readlinkSync(`/proc/${pid}/fd/${descriptor}`)];
          } catch {
            return [];
          }
        });
        const rolloutIds = [
          ...new Set(openPaths.map((filename) => rolloutSessionId(filename)).filter(Boolean)),
        ];
        const newest = newestWriterLock(openPaths);
        const sessionId = rolloutIds.length === 1 ? rolloutIds[0] : newest?.sessionId;
        processes.push({ pid, cwd, ...(sessionId ? { sessionId } : {}) });
      } catch {
        // The process exited between ps and readlink.
      }
    }
    return { available: true, processes: collapseCodexProcessTree(processes, parentByPid) };
  }

  let lsofOutput;
  try {
    lsofOutput = await run("lsof", ["-a", "-p", [...argsByPid.keys()].join(","), "-Fn"], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    lsofOutput = error && typeof error.stdout === "string" && error.stdout ? error.stdout : null;
    if (lsofOutput === null) return { available: false, processes: [] };
  }

  return {
    available: true,
    processes: collapseCodexProcessTree(processInfosFromLsof(argsByPid, lsofOutput), parentByPid),
  };
}

function overlaySessionId(processInfo) {
  const cwdHash = crypto.createHash("sha256").update(processInfo.cwd).digest("hex").slice(0, 12);
  return `codex-process:${processInfo.pid}:${cwdHash}`;
}

function buildSession(processInfo, startedAt) {
  const metadata = JSON.stringify({
    transient: true,
    transient_process: true,
    pre_identity_process: true,
    process_pid: processInfo.pid,
  });
  return {
    id: overlaySessionId(processInfo),
    name: "Codex session",
    status: "active",
    cwd: processInfo.cwd,
    model: null,
    started_at: startedAt,
    ended_at: null,
    metadata,
    agent_count: 1,
    last_activity: startedAt,
    cost: 0,
    awaiting_input_since: startedAt,
    awaiting_reason: "session_start",
    source: "local",
    provider: "codex",
  };
}

function reconcileCodexProcessOverlay(processes, durableSessions, now = new Date().toISOString()) {
  const durableIds = new Set((durableSessions || []).map((session) => session?.id).filter(Boolean));
  const matchedDurableIds = new Set(
    (processes || [])
      .map((processInfo) => processInfo?.sessionId)
      .filter((sessionId) => durableIds.has(sessionId))
  );
  const liveByCwd = new Map();
  for (const processInfo of processes || []) {
    if (
      !Number.isInteger(processInfo?.pid) ||
      processInfo.pid <= 0 ||
      !path.isAbsolute(processInfo?.cwd || "")
    ) {
      continue;
    }
    if (processInfo.sessionId && durableIds.has(processInfo.sessionId)) continue;
    const cwd = path.resolve(processInfo.cwd);
    const entries = liveByCwd.get(cwd) || [];
    if (!entries.some((entry) => entry.pid === processInfo.pid)) {
      entries.push({ pid: processInfo.pid, cwd });
    }
    liveByCwd.set(cwd, entries);
  }

  const durableCountByCwd = new Map();
  for (const session of durableSessions || []) {
    if (session?.status && session.status !== "active") continue;
    if (matchedDurableIds.has(session.id)) continue;
    if (!path.isAbsolute(session?.cwd || "")) continue;
    const cwd = path.resolve(session.cwd);
    durableCountByCwd.set(cwd, (durableCountByCwd.get(cwd) || 0) + 1);
  }

  const desired = new Map();
  for (const [cwd, entries] of liveByCwd) {
    entries.sort((left, right) => left.pid - right.pid);
    const count = Math.max(0, entries.length - (durableCountByCwd.get(cwd) || 0));
    for (const processInfo of entries.slice(0, count)) {
      const id = overlaySessionId(processInfo);
      desired.set(id, buildSession(processInfo, sessionsById.get(id)?.started_at || now));
    }
  }

  const added = [...desired.values()].filter((session) => !sessionsById.has(session.id));
  const removed = [...sessionsById.values()]
    .filter((session) => !desired.has(session.id))
    .map((session) => ({
      ...session,
      status: "abandoned",
      ended_at: now,
      awaiting_input_since: null,
      awaiting_reason: null,
    }));
  sessionsById = desired;
  matchedSessionIds = matchedDurableIds;
  return { added, removed };
}

async function refreshCodexProcessOverlay(options = {}) {
  const probe = options.probe || (await probeInteractiveCodexProcesses());
  if (!probe?.available || !Array.isArray(probe.processes)) return { added: [], removed: [] };

  let durableSessions = options.durableSessions;
  if (!durableSessions) {
    try {
      const { db } = require("../db");
      const selectedIds = [
        ...new Set(
          probe.processes
            .map((processInfo) => processInfo?.sessionId)
            .filter((sessionId) => typeof sessionId === "string" && sessionId)
        ),
      ];
      const selectedClause = selectedIds.length
        ? ` OR id IN (${selectedIds.map(() => "?").join(", ")})`
        : "";
      durableSessions = db
        .prepare(
          `SELECT id, cwd, status FROM sessions
           WHERE provider = 'codex' AND (source = 'local' OR source IS NULL)
             AND (status = 'active'${selectedClause})`
        )
        .all(...selectedIds);
    } catch {
      return { added: [], removed: [] };
    }
  }
  const durableIds = new Set((durableSessions || []).map((session) => session.id));
  const resumed = [];
  for (const processInfo of probe.processes) {
    if (!processInfo?.sessionId || !durableIds.has(processInfo.sessionId)) continue;
    try {
      const { resumeCodexSessionAtPrompt } = require("./codex-ingest");
      const result = resumeCodexSessionAtPrompt(processInfo.sessionId);
      if (result?.changed) resumed.push(result);
    } catch {
      // Lock hints are optional; rollout and hook ingestion remain authoritative.
    }
  }
  const changes = reconcileCodexProcessOverlay(probe.processes, durableSessions, options.now);
  return { ...changes, resumed };
}

function visibleCodexProcessSessions(durableSessions = []) {
  const durableCountByCwd = new Map();
  for (const session of durableSessions) {
    if (session?.status && session.status !== "active") continue;
    if (matchedSessionIds.has(session.id)) continue;
    if (!path.isAbsolute(session?.cwd || "")) continue;
    const cwd = path.resolve(session.cwd);
    durableCountByCwd.set(cwd, (durableCountByCwd.get(cwd) || 0) + 1);
  }

  const transientByCwd = new Map();
  for (const session of sessionsById.values()) {
    const cwd = path.resolve(session.cwd);
    const entries = transientByCwd.get(cwd) || [];
    entries.push(session);
    transientByCwd.set(cwd, entries);
  }

  const visible = [];
  for (const [cwd, entries] of transientByCwd) {
    entries.sort((left, right) => left.id.localeCompare(right.id));
    const count = Math.max(0, entries.length - (durableCountByCwd.get(cwd) || 0));
    visible.push(...entries.slice(0, count));
  }
  return visible;
}

function getCodexProcessSessions(durableSessions = []) {
  return visibleCodexProcessSessions(durableSessions).map((session) => ({ ...session }));
}

function getCodexProcessAgents(durableSessions = []) {
  return getCodexProcessSessions(durableSessions).map((session) => ({
    id: `codex:${session.id}`,
    session_id: session.id,
    name: "Codex",
    type: "main",
    subagent_type: null,
    status: "waiting",
    task: null,
    current_tool: null,
    started_at: session.started_at,
    ended_at: null,
    updated_at: session.started_at,
    last_activity: session.started_at,
    parent_agent_id: null,
    metadata: session.metadata,
    awaiting_input_since: session.awaiting_input_since,
    awaiting_reason: session.awaiting_reason,
    cost: 0,
  }));
}

function startCodexProcessOverlay({ broadcast, intervalMs = 1_000 } = {}) {
  if (monitorStarted || typeof broadcast !== "function") return;
  monitorStarted = true;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const changes = await refreshCodexProcessOverlay();
      for (const session of [...changes.added, ...changes.removed]) {
        broadcast("session_updated", session);
      }
      for (const result of changes.resumed || []) {
        if (result.session) broadcast("session_updated", result.session);
        if (result.agent) broadcast("agent_updated", result.agent);
      }
    } catch {
      // This optional pre-identity signal must never affect durable ingestion.
    } finally {
      running = false;
    }
  };

  const initial = setTimeout(() => void tick(), 50);
  if (initial.unref) initial.unref();
  const timer = setInterval(() => void tick(), intervalMs);
  if (timer.unref) timer.unref();
}

function resetCodexProcessOverlayForTests() {
  sessionsById = new Map();
  matchedSessionIds = new Set();
}

module.exports = {
  collapseCodexProcessTree,
  getCodexProcessAgents,
  getCodexProcessSessions,
  isInteractiveCodexCommand,
  processInfosFromLsof,
  probeInteractiveCodexProcesses,
  reconcileCodexProcessOverlay,
  refreshCodexProcessOverlay,
  rolloutSessionId,
  resetCodexProcessOverlayForTests,
  startCodexProcessOverlay,
};
