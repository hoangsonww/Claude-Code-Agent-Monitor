/**
 * Focus drift audit.
 *
 * Periodically asks, for each active session with a declared focus: "does the
 * session's recent activity match what it declared?" and stamps a drift
 * verdict on session_focus (badge in the UI — declarations are NEVER
 * rewritten here, and declarations never clear the verdict, so an agent
 * cannot silence its own badge by re-declaring).
 *
 * Primary judge: a one-shot headless `claude -p` on a small model, using the
 * user's existing Claude CLI auth — no API key management. The spawn is
 * hermetic: hooks disabled (or every audit would ingest ITSELF into the
 * dashboard and become a session to audit — a feedback loop), all tools
 * disallowed, cwd = tmpdir, CLAUDECODE stripped (run-spawner precedent).
 * Fallback: a conservative keyword-overlap heuristic. Degrades to "no audit"
 * when both are unavailable. Env knobs:
 *   DASHBOARD_FOCUS_AUDIT_MS       tick interval, default 300000; <=0 disables
 *   DASHBOARD_FOCUS_AUDIT_MODE     llm (default) | heuristic | off
 *   DASHBOARD_FOCUS_AUDIT_MODEL    model for `claude -p`, default "haiku"
 *   DASHBOARD_FOCUS_AUDIT_TIMEOUT_MS  per-spawn kill timer, default 30000
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const os = require("os");
const spawn = require("cross-spawn");

const DEFAULT_TICK_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_SESSIONS_PER_TICK = 5;
const RECENT_EVENT_LIMIT = 15;
const PROBE_TTL_MS = 10 * 60_000;
const LOOKBACK_MS = 60 * 60_000; // only judge activity from the last hour

// Test seam: replaces the real spawn (same pattern as run-spawner's
// __injectChildForTest). Set via __injectSpawnForTest(fn) — fn(cmd, args,
// opts) must return a ChildProcess-like emitter.
let spawnImpl = spawn;
function __injectSpawnForTest(fn) {
  spawnImpl = fn || spawn;
  probeCache = null; // a new fake CLI deserves a fresh probe
}

let probeCache = null; // { available: boolean, at: number }

/** Is the `claude` CLI runnable? Cached for PROBE_TTL_MS. */
function probeClaudeCli() {
  const now = Date.now();
  if (probeCache && now - probeCache.at < PROBE_TTL_MS)
    return Promise.resolve(probeCache.available);
  return new Promise((resolve) => {
    let settled = false;
    const done = (available) => {
      if (settled) return;
      settled = true;
      probeCache = { available, at: Date.now() };
      resolve(available);
    };
    let child;
    try {
      child = spawnImpl("claude", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      return done(false);
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      done(false);
    }, 5_000);
    if (timer.unref) timer.unref();
    child.on("error", () => done(false));
    child.on("exit", (code) => done(code === 0));
  });
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
  return env;
}

/** Tokenize for the heuristic: lowercase words, stopwords and shorties out. */
const STOPWORDS = new Set(
  "the a an and or of to in for on with at by from is are was be this that it as into over under about".split(
    " "
  )
);
function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9_./-]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Conservative keyword-overlap heuristic. Only ever declares drift when
 * there is plenty of recent activity and effectively zero vocabulary overlap
 * with the declared focus. Returns { status, reason }.
 */
function heuristicVerdict(focusText, activityTexts) {
  if (activityTexts.length < 10) return { status: "unknown", reason: "not enough recent activity" };
  const focusTokens = tokenize(focusText);
  if (focusTokens.size === 0) return { status: "unknown", reason: "no focus vocabulary" };
  const activityTokens = tokenize(activityTexts.join(" "));
  let overlap = 0;
  for (const t of focusTokens) if (activityTokens.has(t)) overlap += 1;
  const ratio = overlap / focusTokens.size;
  if (ratio < 0.05)
    return { status: "drift", reason: "heuristic: no keyword overlap with declared focus" };
  return { status: "ok", reason: `heuristic: keyword overlap ${(ratio * 100).toFixed(0)}%` };
}

/** Build the compact judgment prompt for the LLM path. */
function buildPrompt({ focusLine, detourLine, noteLine, activityLines, todoLines }) {
  return [
    "You are auditing whether a coding agent's recent activity matches its declared focus.",
    `DECLARED FOCUS: ${focusLine}`,
    noteLine ? `NOTE: ${noteLine}` : null,
    detourLine
      ? `ACTIVE DETOUR (a declared detour is legitimate, judge against IT): ${detourLine}`
      : null,
    "RECENT ACTIVITY (newest first):",
    ...activityLines.map((l) => `- ${l}`),
    todoLines.length ? "CURRENT TODOS:" : null,
    ...todoLines.map((l) => `- ${l}`),
    'Reply with ONLY JSON: {"match": true|false, "confidence": 0..1, "reason": "<one sentence>"}',
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4_000);
}

/** Parse the `claude -p --output-format json` envelope into a verdict. */
function parseLlmOutput(stdout) {
  try {
    const envelope = JSON.parse(stdout);
    let text = typeof envelope.result === "string" ? envelope.result : stdout;
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const verdict = JSON.parse(text);
    if (typeof verdict.match !== "boolean") return null;
    const confidence = typeof verdict.confidence === "number" ? verdict.confidence : 1;
    if (verdict.match) return { status: "ok", reason: verdict.reason || "activity matches focus" };
    if (confidence >= 0.6) {
      return { status: "drift", reason: verdict.reason || "activity does not match focus" };
    }
    return { status: "ok", reason: verdict.reason || "low-confidence mismatch" };
  } catch {
    return null;
  }
}

/** Run one LLM judgment. Resolves { status, reason } or null on any failure. */
function llmVerdict(prompt) {
  const timeoutMs = Number(process.env.DASHBOARD_FOCUS_AUDIT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const model = process.env.DASHBOARD_FOCUS_AUDIT_MODEL || "haiku";
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    let child;
    try {
      child = spawnImpl(
        "claude",
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--model",
          model,
          "--settings",
          JSON.stringify({ disableAllHooks: true }),
          "--disallowed-tools",
          "*",
        ],
        { env: cleanEnv(), cwd: os.tmpdir(), stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch {
      return done(null);
    }
    let stdout = "";
    child.stdout?.on("data", (c) => (stdout += c));
    child.stderr?.resume?.();
    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
      const hardKill = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }, 5_000);
      if (hardKill.unref) hardKill.unref();
      done(null);
    }, timeoutMs);
    if (killTimer.unref) killTimer.unref();
    child.on("error", () => done(null));
    child.on("exit", (code) => {
      clearTimeout(killTimer);
      if (code !== 0) return done(null);
      done(parseLlmOutput(stdout));
    });
  });
}

/** Gather the audit inputs for one session_focus row. */
function auditContext(dbModule, row) {
  const { stmts } = dbModule;
  let stack = [];
  try {
    stack = JSON.parse(row.detour_stack || "[]");
  } catch {
    stack = [];
  }
  const item =
    row.cwd && row.item_number != null ? stmts.getPlanItem.get(row.cwd, row.item_number) : null;
  const focusLine = item
    ? `item ${row.item_number} — "${item.text}"${item.acceptance ? ` (acceptance: ${item.acceptance})` : ""}`
    : row.item_number != null
      ? `item ${row.item_number}`
      : "detour work only";
  const top = stack.length ? stack[stack.length - 1] : null;

  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const events = stmts.recentEventSummaries.all(row.session_id, sinceIso, RECENT_EVENT_LIMIT);
  const activityLines = events
    .filter((e) => e.event_type !== "Focus")
    .map((e) =>
      `${e.event_type}${e.tool_name ? ` ${e.tool_name}` : ""} — ${e.summary || ""}`.slice(0, 160)
    );

  let todoLines = [];
  try {
    const todoRow = stmts.latestTodoWriteEvent.get(row.session_id);
    if (todoRow) {
      const todos = JSON.parse(todoRow.data)?.tool_input?.todos;
      if (Array.isArray(todos)) {
        todoLines = todos.slice(0, 10).map((t) => `[${t.status}] ${t.content}`.slice(0, 120));
      }
    }
  } catch {
    todoLines = [];
  }

  return {
    focusLine,
    noteLine: row.note || null,
    detourLine: top ? top.description : null,
    activityLines,
    todoLines,
    // What the heuristic judges against: the effective focus is the top
    // detour when one is declared, else the item.
    heuristicFocusText: top
      ? top.description
      : `${item ? item.text : ""} ${item?.acceptance || ""} ${row.note || ""}`,
    activityTexts: [...activityLines, ...todoLines],
  };
}

/** Audit one session; writes the verdict and broadcasts. Never throws. */
async function auditSession(dbModule, broadcast, row, mode) {
  try {
    const ctx = auditContext(dbModule, row);
    if (ctx.activityLines.length === 0) return; // nothing to judge

    let verdict = null;
    if (mode === "llm" && (await probeClaudeCli())) {
      verdict = await llmVerdict(buildPrompt(ctx));
    }
    if (!verdict) {
      verdict = heuristicVerdict(ctx.heuristicFocusText, ctx.activityTexts);
    }
    // A failed/unknown pass never overwrites a real prior verdict.
    if (verdict.status === "unknown" && row.drift_status && row.drift_status !== "unknown") return;

    const now = new Date().toISOString();
    dbModule.stmts.setSessionFocusDrift.run(verdict.status, verdict.reason, now, row.session_id);
    try {
      const { focusWireShape } = require("./focus-commands");
      const updated = dbModule.stmts.getSessionFocus.get(row.session_id);
      broadcast("session_focus", focusWireShape(dbModule, updated));
    } catch {
      /* broadcast is best-effort */
    }
  } catch {
    /* fail-safe per session */
  }
}

/**
 * Start the periodic audit loop. Mirrors the other background services:
 * env-disableable, unref'd timer, overlap guard, serial per tick.
 */
function startFocusAudit(broadcast) {
  const mode = (process.env.DASHBOARD_FOCUS_AUDIT_MODE || "llm").toLowerCase();
  if (mode === "off") return;
  const TICK_MS = process.env.DASHBOARD_FOCUS_AUDIT_MS
    ? Number(process.env.DASHBOARD_FOCUS_AUDIT_MS)
    : DEFAULT_TICK_MS;
  if (!Number.isFinite(TICK_MS) || TICK_MS <= 0) return;

  const dbModule = require("../db");
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      let rows;
      try {
        rows = dbModule.stmts.listActiveFocusSessions.all();
      } catch {
        return;
      }
      const candidates = rows
        // Skip sessions with no new activity since the last verdict.
        .filter((r) => !r.drift_checked_at || r.session_updated_at > r.drift_checked_at)
        .slice(0, MAX_SESSIONS_PER_TICK);
      for (const row of candidates) {
        await auditSession(dbModule, broadcast, row, mode);
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  startFocusAudit,
  auditSession,
  heuristicVerdict,
  parseLlmOutput,
  buildPrompt,
  probeClaudeCli,
  __injectSpawnForTest,
};
