/**
 * @file Env-stripping spawn helper for orchestrator-launched `claude` processes.
 * Uses the claudeclaw daemon trick: stripping OAuth-related env vars so the
 * spawned `claude` re-resolves credentials from the macOS Keychain instead of
 * inheriting the (potentially short-lived) parent token. See
 * docs/orchestration-research/08-claudeclaw-deep-dive.md.
 */

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");

// In-memory registry of running agents (PID, status, metadata).
// Keyed by handle id (UUID). Entries persist across an agent's lifecycle so
// the route layer can poll status and read tail buffers after exit.
const agents = new Map();

/**
 * Returns a copy of process.env with OAuth/provider env vars removed so the
 * spawned `claude` process re-resolves credentials from Keychain. Mirrors the
 * pattern from claudeclaw src/runner.ts:84-117 — survives parent's 8h OAuth
 * expiry.
 */
function cleanSpawnEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

/**
 * Build the argv list for `claude`. Defaults to acceptEdits permission mode
 * — never bypassPermissions implicitly. Caller may override via preset.
 */
function buildArgs({ prompt, preset = {} }) {
  const args = ["-p", prompt];
  args.push("--output-format", "stream-json");
  args.push("--verbose");
  const permMode = preset.permissionMode || "acceptEdits";
  args.push("--permission-mode", permMode);
  if (preset.effort) args.push("--effort", preset.effort);
  if (preset.maxBudgetUsd) args.push("--max-budget-usd", String(preset.maxBudgetUsd));
  if (preset.model) args.push("--model", preset.model);
  if (preset.allowedTools && preset.allowedTools.length) {
    args.push("--allowedTools", preset.allowedTools.join(","));
  }
  if (preset.appendSystemPrompt) args.push("--append-system-prompt", preset.appendSystemPrompt);
  return args;
}

/**
 * Spawn a `claude` child process with a clean env and registered handle.
 * Returns the handle synchronously; status transitions happen via stdio events.
 */
function spawnAgent({ prompt, preset, channelId, cwd }) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("prompt is required");
  }
  const id = randomUUID();
  const args = buildArgs({ prompt, preset });
  const child = spawn("claude", args, {
    env: cleanSpawnEnv(),
    cwd: cwd || process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const handle = {
    id,
    pid: child.pid,
    status: "spawning",
    startedAt: Date.now(),
    channelId: channelId || null,
    preset: preset || null,
    child,
    stdoutBuffer: "",
    stderrBuffer: "",
  };
  agents.set(id, handle);

  child.stdout.on("data", (chunk) => {
    handle.stdoutBuffer += chunk.toString();
    handle.status = "running";
    // TODO: parse stream-json and broadcast via WS (wired up by parent)
  });
  child.stderr.on("data", (chunk) => {
    handle.stderrBuffer += chunk.toString();
  });
  child.on("exit", (code) => {
    handle.status = code === 0 ? "completed" : "error";
    handle.exitCode = code;
    handle.endedAt = Date.now();
  });
  child.on("error", (err) => {
    handle.status = "error";
    handle.error = err.message;
  });

  return handle;
}

/**
 * Send SIGTERM to the agent. After 5s, escalate to SIGKILL if still alive.
 * Returns false if the handle id is unknown.
 */
function killAgent(id) {
  const handle = agents.get(id);
  if (!handle) return false;
  if (handle.child && !handle.child.killed) {
    handle.child.kill("SIGTERM");
    setTimeout(() => {
      if (handle.child && !handle.child.killed) handle.child.kill("SIGKILL");
    }, 5000);
  }
  return true;
}

function getAgent(id) {
  return agents.get(id);
}

function listAgents() {
  return Array.from(agents.values()).map((h) => ({
    id: h.id,
    pid: h.pid,
    status: h.status,
    startedAt: h.startedAt,
    endedAt: h.endedAt,
    channelId: h.channelId,
    preset: h.preset,
  }));
}

module.exports = { spawnAgent, killAgent, getAgent, listAgents, cleanSpawnEnv, buildArgs };
