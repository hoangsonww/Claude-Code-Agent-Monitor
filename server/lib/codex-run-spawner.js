/**
 * @file Runs interactive Codex conversations through its local app-server.
 * Every dashboard handle owns a real persistent Codex thread, preserving
 * native turns, tools, cancellation, resumability, and session ingestion.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { randomUUID } = require("node:crypto");
const { broadcast } = require("../websocket");
const { startCodexAppServer, makeError } = require("./codex-app-server");

let dashboardRuns = null;
try {
  dashboardRuns = require("./dashboard-runs");
} catch {
  /* db-less tests can exercise the transport independently */
}

const MAX_ENVELOPES_PER_HANDLE = 500;
const REAP_AFTER_MS = 5 * 60 * 1000;
const handles = new Map();
const reapers = new Map();
const EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const APPROVAL_POLICIES = new Set(["untrusted", "on-request", "never"]);
const SANDBOXES = new Set(["read-only", "workspace-write", "danger-full-access"]);

function recordRun(handle) {
  dashboardRuns?.recordRun(handle);
}
function patchRun(args) {
  dashboardRuns?.patchRun(args);
}
function tail(value, limit = 8192) {
  return String(value || "").slice(-limit);
}
function isLive(handle) {
  return handle.status === "spawning" || handle.status === "running";
}
function liveCount() {
  return Array.from(handles.values()).filter(isLive).length;
}
function getMaxConcurrent() {
  const raw = Number(process.env.RUN_MAX_CONCURRENT);
  return Number.isFinite(raw) && raw > 0 ? raw : 10000;
}
function scheduleReap(id) {
  const prior = reapers.get(id);
  if (prior) clearTimeout(prior);
  const timer = setTimeout(() => {
    const handle = handles.get(id);
    handle?.server?.close();
    handles.delete(id);
    reapers.delete(id);
  }, REAP_AFTER_MS);
  timer.unref?.();
  reapers.set(id, timer);
}
function pushEnvelope(handle, envelope) {
  handle.envelopeCount += 1;
  handle.envelopes.push(envelope);
  if (handle.envelopes.length > MAX_ENVELOPES_PER_HANDLE) {
    handle.envelopes.splice(0, handle.envelopes.length - MAX_ENVELOPES_PER_HANDLE);
  }
  broadcast("run_stream", { id: handle.id, envelope });
}
function setStatus(handle, status, extra = {}) {
  if (!handle || handle.status === "killed") return;
  handle.status = status;
  if (status === "completed" || status === "error" || status === "killed") {
    handle.endedAt = Date.now();
  }
  if (extra.error) handle.error = extra.error;
  if (typeof extra.exitCode === "number") handle.exitCode = extra.exitCode;
  broadcast("run_status", {
    id: handle.id,
    provider: "codex",
    status,
    sessionId: handle.sessionId || null,
    ...extra,
    at: Date.now(),
  });
  patchRun({
    id: handle.id,
    status,
    sessionId: handle.sessionId || null,
    exitCode: handle.exitCode,
    endedAt: handle.endedAt,
  });
  if (!isLive(handle)) scheduleReap(handle.id);
}
function sandboxPolicy(sandbox) {
  if (sandbox === "danger-full-access") return { type: "dangerFullAccess" };
  if (sandbox === "workspace-write") {
    return { type: "workspaceWrite", writableRoots: [], networkAccess: false };
  }
  return { type: "readOnly", networkAccess: false };
}
function updateSession(handle, result) {
  const thread = result?.thread || result;
  const sessionId = thread?.sessionId || thread?.id || null;
  if (typeof sessionId !== "string" || !sessionId) return;
  handle.sessionId = sessionId;
  handle.threadId = thread?.id || sessionId;
  patchRun({ id: handle.id, sessionId });
}
function notificationFor(handle, message) {
  const { method, params = {} } = message;
  if (params.threadId && handle.threadId && params.threadId !== handle.threadId) return;
  if (method === "turn/started") handle.activeTurnId = params.turn?.id || params.turnId || null;
  if (method === "turn/completed") handle.activeTurnId = null;
  if (method === "thread/name/updated" && typeof params.threadName === "string") {
    handle.threadName = params.threadName;
  }
  if (method === "thread/tokenUsage/updated") handle.tokenUsage = params.tokenUsage || params;
  pushEnvelope(handle, { type: "codex_event", method, params });
}
async function startTurn(handle, text) {
  if (!handle.threadId) throw makeError("ECODEXTHREAD", "Codex thread is not ready");
  const result = await handle.server.request("turn/start", {
    threadId: handle.threadId,
    input: [{ type: "text", text }],
    model: handle.model || undefined,
    effort: handle.effort || undefined,
    approvalPolicy: handle.permissionMode,
    sandboxPolicy: sandboxPolicy(handle.sandbox),
    cwd: handle.cwd,
  });
  handle.activeTurnId = result?.turn?.id || result?.turnId || handle.activeTurnId;
  return result;
}
async function boot(handle) {
  try {
    await handle.server.initialize();
    const result = handle.resumeSessionId
      ? await handle.server.request("thread/resume", {
          threadId: handle.resumeSessionId,
          cwd: handle.cwd,
          model: handle.model || undefined,
          sandbox: handle.sandbox,
          approvalPolicy: handle.permissionMode,
        })
      : await handle.server.request("thread/start", {
          cwd: handle.cwd,
          model: handle.model || undefined,
          sandbox: handle.sandbox,
          approvalPolicy: handle.permissionMode,
        });
    updateSession(handle, result);
    setStatus(handle, "running", { waitingForInput: !handle.prompt.trim() });
    if (handle.prompt.trim()) await startTurn(handle, handle.prompt);
  } catch (err) {
    if (handle.status === "killed") return;
    handle.stderrBuffer = tail(`${handle.stderrBuffer}${err?.message || String(err)}\n`);
    setStatus(handle, "error", { error: err?.message || "Unable to start Codex" });
  }
}

function spawnRun(args = {}) {
  const {
    prompt,
    cwd = process.cwd(),
    model = null,
    resumeSessionId = null,
    effort = null,
    permissionMode = "on-request",
    sandbox = "workspace-write",
  } = args;
  if (typeof prompt !== "string") throw makeError("EBADPROMPT", "prompt is required");
  if (!prompt.trim() && !resumeSessionId) throw makeError("EBADPROMPT", "prompt is required");
  if (effort && !EFFORT_LEVELS.has(effort))
    throw makeError("EBADEFFORT", "unsupported Codex effort");
  if (!APPROVAL_POLICIES.has(permissionMode))
    throw makeError("EBADAPPROVAL", "unsupported approval policy");
  if (!SANDBOXES.has(sandbox)) throw makeError("EBADSANDBOX", "unsupported Codex sandbox");
  if (liveCount() >= getMaxConcurrent())
    throw makeError("ECONCURRENCY", "concurrency limit reached");

  const id = randomUUID();
  const server = startCodexAppServer({ cwd });
  const handle = {
    id,
    provider: "codex",
    pid: server.child.pid || null,
    mode: "conversation",
    cwd,
    model,
    permissionMode,
    sandbox,
    effort,
    prompt,
    argv: ["codex", "app-server", "--stdio"],
    resumeSessionId,
    sessionId: resumeSessionId,
    threadId: null,
    threadName: null,
    activeTurnId: null,
    status: "spawning",
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    envelopeCount: 0,
    envelopes: [],
    stdoutBuffer: "",
    stderrBuffer: "",
    server,
  };
  handles.set(id, handle);
  recordRun(handle);
  server.on("notification", (message) => notificationFor(handle, message));
  server.on("exit", ({ code, signal, stderr }) => {
    handle.stderrBuffer = tail(`${handle.stderrBuffer}${stderr || ""}`);
    if (handle.status === "killed") return;
    handle.exitCode = typeof code === "number" ? code : null;
    handle.signal = signal || null;
    setStatus(handle, code === 0 ? "completed" : "error", {
      exitCode: handle.exitCode,
      error: code === 0 ? undefined : "Codex app-server exited unexpectedly",
    });
  });
  broadcast("run_status", { id, provider: "codex", status: "spawning", at: handle.startedAt });
  void boot(handle);
  return handle;
}

async function sendInput(id, text) {
  const handle = handles.get(id);
  if (!handle) throw makeError("ENOTFOUND", "run not found");
  if (!isLive(handle)) throw makeError("ENOTRUNNING", `run is ${handle.status}`);
  if (handle.activeTurnId)
    throw makeError("ETURNINPROGRESS", "Codex is still finishing the current turn");
  if (typeof text !== "string" || !text.trim()) throw makeError("EBADINPUT", "text is required");
  const messageId = randomUUID();
  await startTurn(handle, text);
  broadcast("run_input_ack", { id, messageId, provider: "codex", at: Date.now() });
  return { messageId };
}

function killRun(id) {
  const handle = handles.get(id);
  if (!handle) return false;
  if (!isLive(handle)) return true;
  const activeTurnId = handle.activeTurnId;
  if (activeTurnId) {
    void handle.server
      .request("turn/interrupt", { threadId: handle.threadId, turnId: activeTurnId }, 3000)
      .catch(() => {});
  }
  handle.status = "killed";
  handle.endedAt = Date.now();
  broadcast("run_status", { id, provider: "codex", status: "killed", at: handle.endedAt });
  patchRun({ id, status: "killed", sessionId: handle.sessionId, endedAt: handle.endedAt });
  handle.server.close();
  scheduleReap(id);
  return true;
}

function publicHandle(handle, { includeEnvelopes = false } = {}) {
  if (!handle) return null;
  const publicValue = {
    id: handle.id,
    provider: "codex",
    pid: handle.pid,
    mode: handle.mode,
    cwd: handle.cwd,
    model: handle.model,
    permissionMode: handle.permissionMode,
    sandbox: handle.sandbox,
    effort: handle.effort,
    prompt: handle.prompt,
    argv: handle.argv,
    resumeSessionId: handle.resumeSessionId,
    sessionId: handle.sessionId,
    threadName: handle.threadName,
    activeTurnId: handle.activeTurnId,
    status: handle.status,
    startedAt: handle.startedAt,
    endedAt: handle.endedAt,
    exitCode: handle.exitCode,
    signal: handle.signal,
    error: handle.error,
    envelopeCount: handle.envelopeCount,
    stdoutTail: handle.stdoutBuffer,
    stderrTail: handle.stderrBuffer,
  };
  return includeEnvelopes ? { ...publicValue, envelopes: handle.envelopes.slice() } : publicValue;
}
function getRun(id, opts) {
  return publicHandle(handles.get(id), opts);
}
function listRuns() {
  return Array.from(handles.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(publicHandle);
}
function __reset() {
  for (const timer of reapers.values()) clearTimeout(timer);
  reapers.clear();
  for (const handle of handles.values()) handle.server.close();
  handles.clear();
}

module.exports = {
  spawnRun,
  sendInput,
  killRun,
  getRun,
  listRuns,
  liveCount,
  getMaxConcurrent,
  __reset,
};
