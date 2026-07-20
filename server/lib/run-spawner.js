/**
 * @file run-spawner.js
 * @description Spawns and supervises Claude Code subprocesses for the
 * dashboard's Run page. Two modes:
 *   - "headless"     — single-shot. Stdin is closed after spawn; the prompt
 *                      lives in argv via `-p`. Process exits when the model
 *                      finishes the turn.
 *   - "conversation" — multi-turn. Stdin stays open; follow-up turns are
 *                      delivered via JSON envelopes through stdin and the
 *                      caller can pipe more messages until they kill or the
 *                      child exits naturally.
 *
 * Conversation mode also supports resuming an existing session via
 * `--resume <session-id>`, so the user can continue any prior Claude Code
 * conversation from inside the dashboard.
 *
 * Output is always `--output-format stream-json --verbose` so the parser can
 * deliver structured envelopes (system/init, assistant text+tool_use, user
 * tool_result, result/success, etc). Each envelope is broadcast over the
 * dashboard's existing WebSocket as a `run_stream` message; status changes
 * (spawning → running → completed/error/killed) broadcast as `run_status`.
 *
 * Concurrency is capped (RUN_MAX_CONCURRENT, default 10) — over the cap we
 * throw ECONCURRENCY with the running set so the route can return 429.
 *
 * Each handle keeps a bounded in-memory envelope log (cap 500) so a client
 * that attaches late can replay what it missed. Completed handles are reaped
 * after 5 min — but the underlying transcripts persist via the normal hook
 * ingestion pipeline (every spawned `claude` fires hooks like any other
 * session, so the run shows up in /sessions automatically).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { broadcast } = require("../websocket");
const { createLineParser } = require("./stream-json-parser");

// Persistence is best-effort and optional — load lazily so unit tests that
// don't bring up the full db can still exercise the spawner.
let dashboardRuns = null;
try {
  dashboardRuns = require("./dashboard-runs");
} catch {
  /* db-less environment, skip persistence */
}
function recordRun(handle) {
  if (dashboardRuns) dashboardRuns.recordRun(handle);
}
function patchRun(args) {
  if (dashboardRuns) dashboardRuns.patchRun(args);
}

// Effectively uncapped — claude's terminal TUI doesn't gate concurrent
// sessions, so we don't either. The number is high enough that a buggy
// client still can't fork-bomb the host before someone notices, but low
// enough that no human will ever hit it organically. Users who want a
// real cap can set RUN_MAX_CONCURRENT.
const MAX_CONCURRENT_DEFAULT = 10000;
const REAP_AFTER_MS = 5 * 60 * 1000; // keep handle for 5 min after exit
const STDOUT_TAIL_BYTES = 4 * 1024;
const STDERR_TAIL_BYTES = 4 * 1024;
// Cap stored envelopes per handle so a long-running conversation doesn't
// balloon memory. Late-attaching clients get this much history; the full
// transcript is always available via the existing /sessions/<id> view.
const MAX_ENVELOPES_PER_HANDLE = 500;

const handles = new Map();
const reapers = new Map();

function getMaxConcurrent() {
  const raw = process.env.RUN_MAX_CONCURRENT;
  if (!raw) return MAX_CONCURRENT_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : MAX_CONCURRENT_DEFAULT;
}

function liveCount() {
  let n = 0;
  for (const h of handles.values()) {
    if (h.status === "spawning" || h.status === "running") n++;
  }
  return n;
}

function tail(s, n) {
  if (typeof s !== "string") return "";
  if (s.length <= n) return s;
  return s.slice(s.length - n);
}

/**
 * Build argv for the `claude` invocation. The two modes have different argv
 * shapes because of how Claude Code resolves the first user message:
 *
 *   - HEADLESS: `-p "<prompt>"` carries the prompt; stdin is closed; Claude
 *     processes one turn and exits.
 *   - CONVERSATION: `--input-format stream-json` puts Claude in multi-turn
 *     mode where ALL user turns (including the first) come via stdin. When
 *     stream-json input is enabled, `-p` is silently ignored — so we OMIT
 *     it and send the initial prompt over stdin in `spawnRun` immediately
 *     after the spawn handshake.
 */
const EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

function buildArgv({ prompt, mode, model, permissionMode, resumeSessionId, effort }) {
  const argv = [];
  argv.push("--output-format", "stream-json");
  argv.push("--verbose");
  // Real character-by-character streaming. Without this flag Claude only
  // emits the *final* assistant envelope, which makes the UI feel like the
  // response arrives all at once. With it, we also receive `stream_event`
  // envelopes (Anthropic Messages API streaming events) so the UI can
  // render text + thinking deltas as they arrive.
  argv.push("--include-partial-messages");
  argv.push("--permission-mode", permissionMode || "acceptEdits");
  if (mode === "headless") {
    argv.push("-p", prompt);
  } else {
    argv.push("--input-format", "stream-json");
  }
  if (model) {
    argv.push("--model", model);
  }
  if (effort && EFFORT_LEVELS.has(effort)) {
    // Drives thinking depth: higher = more reasoning tokens before the
    // assistant turn. Empty / unset means "inherit from the model's default".
    argv.push("--effort", effort);
  }
  if (resumeSessionId) {
    argv.push("--resume", resumeSessionId);
  }
  return argv;
}

/**
 * Frame a stream-json user envelope. Used both for the initial conversation-
 * mode prompt and for follow-up turns via sendInput.
 */
function userEnvelope(text, id) {
  const e = {
    type: "user",
    message: { role: "user", content: text },
  };
  if (id) e.id = id;
  return JSON.stringify(e) + "\n";
}

/**
 * Strip dashboard-internal env vars from the child so the spawned `claude`
 * doesn't accidentally pick up our hook-handler context (and to keep the
 * child's auth entirely from the user's existing OAuth in $HOME).
 */
function cleanSpawnEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

function attachStreamHandlers(handle) {
  const parser = createLineParser(
    (envelope) => {
      // First parsed envelope means the child is producing output → "running".
      if (handle.status === "spawning") {
        handle.status = "running";
        broadcast("run_status", { id: handle.id, status: "running", at: Date.now() });
        patchRun({ id: handle.id, status: "running" });
      }
      // Capture session_id off the system/init envelope — once we have it the
      // dashboard can deep-link to /sessions/<id> on completion.
      if (
        envelope &&
        envelope.type === "system" &&
        envelope.subtype === "init" &&
        typeof envelope.session_id === "string"
      ) {
        const wasNull = !handle.sessionId;
        handle.sessionId = envelope.session_id;
        if (wasNull) patchRun({ id: handle.id, sessionId: envelope.session_id });
      }
      handle.envelopeCount += 1;
      handle.envelopes.push(envelope);
      // Keep only the most recent N — older entries are still in the disk
      // transcript at ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl,
      // visible via the regular /sessions/<id> dashboard view.
      if (handle.envelopes.length > MAX_ENVELOPES_PER_HANDLE) {
        handle.envelopes.splice(0, handle.envelopes.length - MAX_ENVELOPES_PER_HANDLE);
      }
      broadcast("run_stream", { id: handle.id, envelope });
    },
    (err, raw) => {
      handle.stderrBuffer += `[parse-error] ${err.message}: ${raw}\n`;
    }
  );

  handle.child.stdout.on("data", (chunk) => {
    const s = chunk.toString("utf8");
    handle.stdoutBuffer = tail(handle.stdoutBuffer + s, STDOUT_TAIL_BYTES);
    parser.push(s);
  });
  handle.child.stderr.on("data", (chunk) => {
    handle.stderrBuffer = tail(handle.stderrBuffer + chunk.toString("utf8"), STDERR_TAIL_BYTES);
  });
  handle.child.on("error", (err) => {
    handle.status = "error";
    handle.error = err.message;
    handle.endedAt = Date.now();
    broadcast("run_status", {
      id: handle.id,
      status: "error",
      error: err.message,
      at: handle.endedAt,
    });
    patchRun({ id: handle.id, status: "error", endedAt: handle.endedAt });
    scheduleReap(handle.id);
  });
  handle.child.on("exit", (code, signal) => {
    parser.flush();
    if (handle.status === "killed") {
      // already broadcast — patchRun already happened in stop()
    } else {
      handle.status = code === 0 ? "completed" : "error";
      handle.exitCode = code;
      handle.signal = signal;
      handle.endedAt = Date.now();
      broadcast("run_status", {
        id: handle.id,
        status: handle.status,
        exitCode: code,
        sessionId: handle.sessionId || null,
        at: handle.endedAt,
      });
      patchRun({
        id: handle.id,
        status: handle.status,
        exitCode: code,
        sessionId: handle.sessionId || null,
        endedAt: handle.endedAt,
      });
    }
    scheduleReap(handle.id);
  });
}

function scheduleReap(id) {
  const existing = reapers.get(id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    handles.delete(id);
    reapers.delete(id);
  }, REAP_AFTER_MS);
  // Don't keep the process alive just for the reap timer.
  if (typeof t.unref === "function") t.unref();
  reapers.set(id, t);
}

/**
 * @param {object} args
 * @param {string} args.prompt
 * @param {"headless"|"conversation"} args.mode
 * @param {string} [args.cwd]
 * @param {string} [args.model]
 * @param {string} [args.permissionMode]
 * @returns handle
 */
function spawnRun(args) {
  const { prompt, mode, cwd, model, permissionMode, resumeSessionId, effort } = args || {};
  if (typeof prompt !== "string") {
    throw makeErr("EBADPROMPT", "prompt is required");
  }
  // Empty prompt is allowed only when resuming a conversation — claude
  // idles on the resumed transcript until the user types a follow-up.
  if (!prompt.trim() && !(mode === "conversation" && resumeSessionId)) {
    throw makeErr("EBADPROMPT", "prompt is required");
  }
  if (mode !== "headless" && mode !== "conversation") {
    throw makeErr("EBADMODE", `mode must be "headless" or "conversation"`);
  }
  if (effort != null && effort !== "" && !EFFORT_LEVELS.has(effort)) {
    throw makeErr("EBADEFFORT", `effort must be one of: ${Array.from(EFFORT_LEVELS).join(", ")}`);
  }
  if (resumeSessionId != null) {
    if (typeof resumeSessionId !== "string" || !/^[A-Za-z0-9-]{8,}$/.test(resumeSessionId)) {
      throw makeErr("EBADSESSION", "resumeSessionId is not a valid session id");
    }
    // Resume only makes sense in conversation mode (you want to keep talking).
    // Headless `claude --resume` does run, but the UX of "send one prompt and
    // exit" on a resumed session is confusing — disallow.
    if (mode !== "conversation") {
      throw makeErr("EBADMODE", "resumeSessionId requires conversation mode");
    }
  }
  const max = getMaxConcurrent();
  if (liveCount() >= max) {
    const err = makeErr("ECONCURRENCY", `concurrency limit ${max} reached`);
    err.running = Array.from(handles.values())
      .filter((h) => h.status === "running" || h.status === "spawning")
      .map((h) => ({ id: h.id, pid: h.pid, startedAt: h.startedAt, mode: h.mode }));
    throw err;
  }

  const id = randomUUID();
  const argv = buildArgv({ prompt, mode, model, permissionMode, resumeSessionId, effort });
  const child = spawn("claude", argv, {
    env: cleanSpawnEnv(),
    cwd: cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    // On Windows, the npm-installed `claude` binary is a .cmd shim, which
    // CreateProcess can't launch directly (EINVAL) — spawn() only resolves
    // that through cmd.exe when shell is enabled. Without this, every spawn
    // here (new runs and --resume alike) fails with ENOENT and the handle
    // never leaves "spawning", which is why Resume looked like an infinite spinner.
    shell: process.platform === "win32",
  });

  const handle = {
    id,
    pid: child.pid || null,
    mode,
    cwd: cwd || process.cwd(),
    model: model || null,
    permissionMode: permissionMode || "acceptEdits",
    effort: effort || null,
    prompt,
    argv,
    resumeSessionId: resumeSessionId || null,
    status: "spawning",
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    sessionId: resumeSessionId || null, // optimistic; will be confirmed by system/init envelope
    envelopeCount: 0,
    envelopes: [],
    stdoutBuffer: "",
    stderrBuffer: "",
    child,
  };
  handles.set(id, handle);
  recordRun(handle);

  attachStreamHandlers(handle);

  if (mode === "headless") {
    // Headless: prompt is in argv; close stdin so Claude knows nothing more
    // is coming and exits after the one turn.
    try {
      child.stdin.end();
    } catch {
      /* ignore */
    }
  } else if (prompt && prompt.trim()) {
    // Conversation: deliver the initial prompt over stdin so Claude in
    // stream-json input mode actually starts processing it. Stdin stays
    // open for follow-up turns.
    try {
      child.stdin.write(userEnvelope(prompt));
    } catch (err) {
      handle.stderrBuffer += `[stdin-write-error] ${err.message}\n`;
    }
  }
  // Conversation with empty prompt (resume scenarios) — leave stdin open;
  // claude will idle on the resumed conversation until the user types a
  // follow-up via POST /:id/message.

  broadcast("run_status", { id, status: "spawning", at: handle.startedAt });
  return handle;
}

/**
 * Send a follow-up user turn into a running conversation. Throws if the
 * handle is not running, not in conversation mode, or stdin is closed.
 */
function sendInput(id, text) {
  const handle = handles.get(id);
  if (!handle) throw makeErr("ENOTFOUND", "run not found");
  if (handle.mode !== "conversation") {
    throw makeErr("EWRONGMODE", "only conversation mode accepts follow-up input");
  }
  if (handle.status !== "running" && handle.status !== "spawning") {
    throw makeErr("ENOTRUNNING", `run is ${handle.status}`);
  }
  if (typeof text !== "string" || !text) {
    throw makeErr("EBADINPUT", "text is required");
  }
  if (!handle.child || !handle.child.stdin || !handle.child.stdin.writable) {
    throw makeErr("ESTDINCLOSED", "stdin is not writable");
  }
  const messageId = randomUUID();
  handle.child.stdin.write(userEnvelope(text, messageId));
  broadcast("run_input_ack", { id, messageId, at: Date.now() });
  return { messageId };
}

function killRun(id) {
  const handle = handles.get(id);
  if (!handle) return false;
  if (handle.status === "completed" || handle.status === "error" || handle.status === "killed") {
    return true;
  }
  if (handle.child && !handle.child.killed) {
    try {
      handle.child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      const h = handles.get(id);
      if (h && h.child && !h.child.killed) {
        try {
          h.child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }, 5000).unref?.();
  }
  handle.status = "killed";
  handle.endedAt = Date.now();
  broadcast("run_status", { id, status: "killed", at: handle.endedAt });
  patchRun({ id, status: "killed", endedAt: handle.endedAt });
  scheduleReap(id);
  return true;
}

function publicHandle(handle, opts = {}) {
  if (!handle) return null;
  const out = {
    id: handle.id,
    pid: handle.pid,
    mode: handle.mode,
    cwd: handle.cwd,
    model: handle.model,
    permissionMode: handle.permissionMode,
    effort: handle.effort || null,
    prompt: handle.prompt,
    argv: handle.argv,
    resumeSessionId: handle.resumeSessionId || null,
    status: handle.status,
    startedAt: handle.startedAt,
    endedAt: handle.endedAt,
    exitCode: handle.exitCode,
    signal: handle.signal,
    error: handle.error,
    sessionId: handle.sessionId,
    envelopeCount: handle.envelopeCount,
    stdoutTail: handle.stdoutBuffer,
    stderrTail: handle.stderrBuffer,
  };
  if (opts.includeEnvelopes) {
    out.envelopes = handle.envelopes.slice();
  }
  return out;
}

function getRun(id, opts = {}) {
  return publicHandle(handles.get(id), opts);
}

function listRuns() {
  return Array.from(handles.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(publicHandle);
}

function makeErr(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Test seam: inject a fake child (e.g. PassThrough streams) without invoking
// the real `claude` binary. Returns the handle.
function __injectChildForTest({ child, mode = "conversation", prompt = "test" }) {
  const id = randomUUID();
  const handle = {
    id,
    pid: 0,
    mode,
    cwd: process.cwd(),
    model: null,
    permissionMode: "acceptEdits",
    effort: null,
    prompt,
    argv: ["-p", prompt],
    resumeSessionId: null,
    status: "spawning",
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    error: null,
    sessionId: null,
    envelopeCount: 0,
    envelopes: [],
    stdoutBuffer: "",
    stderrBuffer: "",
    child,
  };
  handles.set(id, handle);
  attachStreamHandlers(handle);
  return handle;
}

function __reset() {
  for (const t of reapers.values()) clearTimeout(t);
  reapers.clear();
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
  __injectChildForTest,
  __reset,
};
