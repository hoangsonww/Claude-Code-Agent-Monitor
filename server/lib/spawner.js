// server/lib/spawner.js
/**
 * @file Process-spawn helper for orchestrator-launched `claude` children.
 * Stream-json over stdin/stdout drives back-and-forth turns. Persists every
 * launch to the audit table. Concurrency-capped via ORCHESTRATOR_MAX_CONCURRENT.
 */

const { spawn } = require("node:child_process");

let _spawnImpl = spawn;
function __setSpawnImplForTest(fn) { _spawnImpl = fn; }
const { randomUUID } = require("node:crypto");
const { broadcast } = require("../websocket");
const { buildArgsFromConfig, validateProfileConfig } = require("./profile-schema");
const { createLineParser } = require("./stream-json-parser");

const MAX_CONCURRENT = Number(process.env.ORCHESTRATOR_MAX_CONCURRENT || 5);
const agents = new Map();

function cleanSpawnEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

function liveCount() {
  let n = 0;
  for (const h of agents.values()) if (h.status === "spawning" || h.status === "running") n++;
  return n;
}

function attachStreamHandlers(handle) {
  const parser = createLineParser(
    (obj) => {
      handle.status = "running";
      broadcast("agent_stream", { sessionId: handle.id, chunk: obj });
    },
    (err, raw) => {
      handle.stderrBuffer += `[parse-error] ${err.message}: ${raw}\n`;
    },
  );
  handle.child.stdout.on("data", (chunk) => {
    const s = chunk.toString();
    handle.stdoutBuffer += s;
    parser.push(s);
  });
  handle.child.stderr.on("data", (chunk) => {
    handle.stderrBuffer += chunk.toString();
  });
  handle.child.on("exit", (code) => {
    parser.flush();
    handle.status = code === 0 ? "completed" : "error";
    handle.exitCode = code;
    handle.endedAt = Date.now();
    broadcast("agent_status", { sessionId: handle.id, status: handle.status });
  });
  handle.child.on("error", (err) => {
    handle.status = "error";
    handle.error = err.message;
    broadcast("agent_status", { sessionId: handle.id, status: "error" });
  });
}

function makeHandle({ id, child, perLaunch, profile }) {
  return {
    id,
    pid: child?.pid,
    status: "spawning",
    startedAt: Date.now(),
    endedAt: null,
    cwd: perLaunch.cwd,
    profile: profile || null,
    perLaunch,
    child,
    stdoutBuffer: "",
    stderrBuffer: "",
  };
}

function spawnAgent({ profile, perLaunch, envExtra }) {
  if (!perLaunch || typeof perLaunch.prompt !== "string") {
    throw new Error("prompt is required");
  }
  if (liveCount() >= MAX_CONCURRENT) {
    const err = new Error(`concurrency limit ${MAX_CONCURRENT} reached`);
    err.code = "EConcurrencyLimit";
    err.running = Array.from(agents.values())
      .filter((h) => h.status === "running" || h.status === "spawning")
      .map((h) => ({ id: h.id, pid: h.pid, startedAt: h.startedAt }));
    throw err;
  }
  const v = validateProfileConfig(profile || {});
  if (!v.ok) {
    const err = new Error(v.errors.join("; "));
    err.code = "EConfigInvalid";
    throw err;
  }
  const id = randomUUID();
  const argv = buildArgsFromConfig(profile || {}, perLaunch);
  const child = _spawnImpl("claude", argv, {
    env: cleanSpawnEnv(envExtra || {}),
    cwd: perLaunch.cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const handle = makeHandle({ id, child, perLaunch, profile });
  handle.argv = argv;
  agents.set(id, handle);
  attachStreamHandlers(handle);
  broadcast("agent_status", { sessionId: id, status: "spawning" });
  // Send the initial prompt via stdin (same path as sendMessage). buildArgs no
  // longer uses -p PROMPT — that combo with --input-format stream-json hangs.
  if (child?.stdin?.writable) {
    const obj = { type: "user", message: { role: "user", content: String(perLaunch.prompt ?? "") }, id: randomUUID() };
    child.stdin.write(JSON.stringify(obj) + "\n");
  }
  return handle;
}

// Test seam: drive a stub child without invoking the real CLI binary.
spawnAgent.__injectChildForTest = function injectChildForTest(child, perLaunch) {
  const id = randomUUID();
  const handle = makeHandle({ id, child, perLaunch, profile: null });
  handle.argv = ["-p", perLaunch.prompt];
  agents.set(id, handle);
  attachStreamHandlers(handle);
  return handle;
};

function sendMessage(handleId, text) {
  const h = agents.get(handleId);
  if (!h) throw new Error("agent not found");
  if (h.status !== "running" && h.status !== "spawning") {
    throw new Error(`agent not accepting input (status=${h.status})`);
  }
  if (!h.child?.stdin?.writable) throw new Error("stdin not writable");
  const messageId = randomUUID();
  const obj = { type: "user", message: { role: "user", content: text }, id: messageId };
  h.child.stdin.write(JSON.stringify(obj) + "\n");
  broadcast("agent_input_ack", { sessionId: h.id, messageId, ts: Date.now() });
  return { messageId };
}

function killAgent(id) {
  const h = agents.get(id);
  if (!h) return false;
  if (h.child && !h.child.killed) {
    h.child.kill("SIGTERM");
    setTimeout(() => {
      if (h.child && !h.child.killed) h.child.kill("SIGKILL");
    }, 5000);
  }
  h.status = "killed";
  broadcast("agent_status", { sessionId: id, status: "killed" });
  return true;
}

function getAgent(id) { return agents.get(id); }

function listAgents() {
  return Array.from(agents.values()).map((h) => ({
    id: h.id, pid: h.pid, status: h.status,
    startedAt: h.startedAt, endedAt: h.endedAt,
    cwd: h.cwd, profile: h.profile,
  }));
}

function respawnAgent({ id, profile, perLaunch, envExtra }) {
  return new Promise((resolve, reject) => {
    const old = agents.get(id);
    if (!old) return reject(new Error("agent not found"));
    const v = validateProfileConfig(profile || {});
    if (!v.ok) return reject(Object.assign(new Error(v.errors.join("; ")), { code: "EConfigInvalid" }));
    const onOldExit = () => {
      try {
        agents.delete(id);
        const newHandle = spawnAgent({ profile, perLaunch, envExtra });
        broadcast("agent_respawned", {
          sessionId: perLaunch?.resumeSessionId || newHandle.id,
          oldHandleId: id,
          newHandleId: newHandle.id,
        });
        resolve(newHandle);
      } catch (err) {
        reject(err);
      }
    };
    if (old.child && !old.child.killed) {
      old.child.once("exit", onOldExit);
      old.child.kill("SIGTERM");
      setTimeout(() => {
        if (old.child && !old.child.killed) old.child.kill("SIGKILL");
      }, 5000);
    } else {
      onOldExit();
    }
  });
}

module.exports = {
  spawnAgent, sendMessage, killAgent, getAgent, listAgents,
  cleanSpawnEnv, liveCount, MAX_CONCURRENT,
  respawnAgent, __setSpawnImplForTest,
};
