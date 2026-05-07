/**
 * @file In-process scheduler that fires due routines. The naturally-honored
 * "only runs while your computer is awake" promise comes from running entirely
 * in the dashboard server process — no external cron, no system service.
 *
 * Tick cadence is configurable; on each tick we look up `dueNow(now)` and
 * spawn each routine through the orchestrator's `spawnAgent` helper. A small
 * randomized jitter (default ±5 min) is applied AFTER the routine's exact
 * fire time to avoid synchronized stampedes — we delay each spawn by
 * `random(0, jitterMs)` so agents trickle in over a window.
 *
 * Triggers are recorded as `routine_runs` rows; child-exit listeners flip
 * the row's status when the spawned `claude` process exits.
 */

const routines = require("./routines");
const { spawnAgent } = require("./spawner");
const { broadcast } = require("../websocket");

const DEFAULT_TICK_MS = 60_000;
const DEFAULT_JITTER_MS = 5 * 60_000;

let _state = null;

function start({ tickMs = DEFAULT_TICK_MS, jitterMs = DEFAULT_JITTER_MS } = {}) {
  if (_state) return _state;
  const interval = setInterval(() => {
    runDueRoutines({ jitterMs }).catch((err) => {
      // Never throw out of the tick — keep the interval alive on errors.
      // eslint-disable-next-line no-console
      console.error("[routine-scheduler] tick error:", err.message);
    });
  }, tickMs);
  // Don't keep the event loop alive solely for this interval (matches existing
  // cleanup interval semantics — we want graceful shutdown).
  if (typeof interval.unref === "function") interval.unref();
  _state = { interval, jitterMs };
  return _state;
}

function stop() {
  if (_state) {
    clearInterval(_state.interval);
    _state = null;
  }
}

async function runDueRoutines({ jitterMs = DEFAULT_JITTER_MS } = {}) {
  const now = Date.now();
  const due = routines.dueNow(now);
  for (const routine of due) {
    // Schedule each fire after its own random jitter. We still update next_run
    // immediately (via recordRun) so a slow tick can't double-spawn.
    const delay = Math.floor(Math.random() * Math.max(0, jitterMs));
    setTimeout(() => {
      _fire(routine, "schedule").catch(() => {});
    }, delay);
  }
}

/**
 * Fire a routine immediately (manual or webhook trigger). Returns the run
 * row + agent handle id so the route can echo them to the client.
 */
async function fireOnce(routineId, trigger) {
  const routine = routines.get(routineId);
  if (!routine) throw new Error("not found");
  return _fire(routine, trigger);
}

async function _fire(routine, trigger) {
  // Record the run BEFORE spawning so a spawn failure still leaves a record
  // (we'll mark it errored). Also, recordRun advances next_run_at so the
  // scheduler can't double-fire.
  const runId = routines.recordRun(routine.id, { trigger, status: "spawning" });
  let handle;
  try {
    const profile = buildProfile(routine);
    const perLaunch = { prompt: routine.instructions, cwd: routine.cwd };
    handle = spawnAgent({ profile, perLaunch });
  } catch (err) {
    routines.completeRun(runId, {
      status: "error",
      output_summary: `spawn failed: ${err.message}`,
      ended_at: Date.now(),
    });
    broadcast("routine_run_updated", { routineId: routine.id, runId, status: "error" });
    return { runId, agentHandleId: null, error: err.message };
  }

  routines.attachAgentHandle(runId, handle.id);
  broadcast("routine_run_updated", {
    routineId: routine.id,
    runId,
    agentHandleId: handle.id,
    status: "spawning",
  });

  // Wire child lifecycle to mark the run completed/errored when the agent
  // exits. spawner.js attaches its own listener that updates handle.status;
  // we attach ours to drive routine_runs.
  const child = handle.child;
  if (child && typeof child.on === "function") {
    child.on("exit", (code) => {
      const status = code === 0 ? "completed" : "error";
      const summary = summarize(handle);
      routines.completeRun(runId, {
        status,
        exit_code: typeof code === "number" ? code : null,
        output_summary: summary,
        ended_at: Date.now(),
      });
      broadcast("routine_run_updated", {
        routineId: routine.id,
        runId,
        agentHandleId: handle.id,
        status,
        exit_code: code,
      });
    });
    child.on("error", () => {
      routines.completeRun(runId, {
        status: "error",
        output_summary: handle.error || "spawn error",
        ended_at: Date.now(),
      });
      broadcast("routine_run_updated", {
        routineId: routine.id,
        runId,
        agentHandleId: handle.id,
        status: "error",
      });
    });
  }
  return { runId, agentHandleId: handle.id };
}

function buildProfile(routine) {
  // Translate routine fields into a ProfileConfig accepted by spawnAgent's
  // validateProfileConfig. We only forward the two configurable knobs the
  // editor exposes (model + permission mode) — everything else is the
  // orchestrator's defaults.
  const profile = {};
  if (routine.model) profile.model = routine.model;
  if (routine.permissionMode) profile.permissionMode = routine.permissionMode;
  return profile;
}

function summarize(handle) {
  const buf = handle?.stdoutBuffer || "";
  if (!buf) return null;
  // Try to extract a result chunk's text first — the stream-json format emits
  // a final {"type":"result", ... "result": "..."} frame. Walk from the tail
  // backwards to find it without parsing the whole buffer.
  const lines = buf.split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.includes('"type":"result"') || line.includes('"type": "result"')) {
      try {
        const obj = JSON.parse(line);
        if (typeof obj.result === "string") return obj.result.slice(-500);
      } catch {
        /* fall through */
      }
    }
  }
  return buf.slice(-500);
}

module.exports = { start, stop, runDueRoutines, fireOnce };
