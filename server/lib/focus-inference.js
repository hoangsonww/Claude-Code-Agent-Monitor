/**
 * Focus inference: classifies sessions that never declared a focus.
 *
 * A session that runs without any `ccam focus` declaration is invisible to
 * the focus-time report — its hours become a silent hole. This background
 * job closes that hole with the data the dashboard already captures: it
 * digests a silent session's activity (user prompts, files touched, commands
 * run) and matches it against the cwd's plan items. A confident match is
 * recorded as inferred time on that item; real work matching no item becomes
 * an inferred detour with a short title; anything else stays honestly
 * 'unclassified'. Results live in the focus_inferences table (one row per
 * session) and are consumed by focus-report.js ONLY for sessions with zero
 * declared Focus segments — declarations are ground truth and are never
 * overwritten or mixed with guesses.
 *
 * Primary classifier: a one-shot headless `claude -p` on a small model using
 * the user's existing Claude CLI auth (same hermetic spawn contract as
 * focus-audit.js: hooks disabled, all tools disallowed, cwd = tmpdir,
 * CLAUDECODE stripped). Fallback: a conservative keyword-overlap heuristic
 * that only ever claims an item match, never a detour. Sessions are only
 * classified once they are ended or quiet (no activity for QUIET_MS), and
 * re-classified when they gain activity after their last inference — so an
 * abandoned-then-resumed session converges instead of freezing its first
 * verdict. Env knobs:
 *   DASHBOARD_FOCUS_INFER_MS          tick interval, default 600000; <=0 disables
 *   DASHBOARD_FOCUS_INFER_MODE       llm (default) | heuristic | off
 *   DASHBOARD_FOCUS_INFER_MODEL      model for `claude -p`, default "haiku"
 *   DASHBOARD_FOCUS_INFER_TIMEOUT_MS per-spawn kill timer, default 30000
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const os = require("os");
const spawn = require("cross-spawn");

const DEFAULT_TICK_MS = 600_000;
const BOOT_DELAY_MS = 30_000; // first tick soon after startup = the backfill
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_SESSIONS_PER_TICK = 5;
const QUIET_MS = 10 * 60_000; // a live session must be this quiet to classify
const MAX_DIGEST_EVENTS = 800;
const MAX_PROMPTS = 3;
const MAX_FILES = 15;
const MAX_COMMANDS = 10;
const PROBE_TTL_MS = 10 * 60_000;
const MIN_LLM_CONFIDENCE = 0.6;

// Test seam: replaces the real spawn (same pattern as focus-audit.js).
let spawnImpl = spawn;
function __injectSpawnForTest(fn) {
  spawnImpl = fn || spawn;
  probeCache = null;
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

/** Parses one event's JSON `data` column, tolerating junk. */
function parseData(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Distills a session's raw event stream into the compact facts a classifier
 * can judge: the first few user prompts, the most-touched files, and the
 * shell commands run. Returns null when there's nothing meaningful to judge.
 */
function buildActivityDigest(dbModule, sessionId) {
  const rows = dbModule.db
    .prepare(
      `SELECT event_type, tool_name, data FROM events
       WHERE session_id = ? AND event_type IN ('UserPromptSubmit', 'PreToolUse')
       ORDER BY id ASC LIMIT ?`
    )
    .all(sessionId, MAX_DIGEST_EVENTS);

  const prompts = [];
  const fileCounts = new Map();
  const commands = [];
  const seenCommands = new Set();

  for (const row of rows) {
    const data = parseData(row.data);
    if (row.event_type === "UserPromptSubmit") {
      const prompt = String(data.prompt || "").trim();
      if (prompt && prompts.length < MAX_PROMPTS) prompts.push(prompt.slice(0, 300));
      continue;
    }
    const input = data.tool_input || {};
    if (typeof input.file_path === "string" && input.file_path) {
      fileCounts.set(input.file_path, (fileCounts.get(input.file_path) || 0) + 1);
    }
    if (row.tool_name === "Bash" && typeof input.command === "string" && input.command) {
      const cmd = input.command.slice(0, 120);
      if (!seenCommands.has(cmd) && commands.length < MAX_COMMANDS) {
        seenCommands.add(cmd);
        commands.push(cmd);
      }
    }
  }

  const files = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FILES)
    .map(([file]) => file);

  if (prompts.length === 0 && files.length === 0 && commands.length === 0) return null;
  return { prompts, files, commands };
}

/** Tokenize for the heuristic (same shape as focus-audit's). */
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
 * Conservative keyword matcher: claims an item ONLY when one item's
 * vocabulary clearly shows up in the activity and clearly beats the
 * runner-up. It never claims a detour — "matches nothing" and "can't tell"
 * are indistinguishable to keyword overlap, so both come back null and the
 * LLM (or 'unclassified') decides.
 */
function heuristicClassify(digest, items) {
  const activityTokens = tokenize(
    [...digest.prompts, ...digest.files, ...digest.commands].join(" ")
  );
  if (activityTokens.size === 0) return null;

  let best = null;
  let secondRatio = 0;
  for (const item of items) {
    const itemTokens = tokenize(`${item.text} ${item.acceptance || ""}`);
    if (itemTokens.size === 0) continue;
    let overlap = 0;
    for (const t of itemTokens) if (activityTokens.has(t)) overlap += 1;
    const ratio = overlap / itemTokens.size;
    if (!best || ratio > best.ratio) {
      if (best) secondRatio = Math.max(secondRatio, best.ratio);
      best = { item, ratio, overlap };
    } else {
      secondRatio = Math.max(secondRatio, ratio);
    }
  }

  if (!best || best.overlap < 2 || best.ratio < 0.5 || best.ratio < secondRatio * 2) return null;
  return {
    kind: "item",
    item_id: best.item.item_id,
    label: null,
    confidence: Math.min(1, best.ratio),
    method: "heuristic",
    reason: `heuristic: ${best.overlap} keyword hits on "${String(best.item.text).slice(0, 80)}"`,
  };
}

/** Build the classification prompt for the LLM path. */
function buildPrompt(digest, items) {
  return [
    "A coding session ran with no declared focus. Classify which plan item its activity served.",
    "PLAN ITEMS:",
    ...items.map(
      (i) => `${i.item_number}. ${i.text}${i.acceptance ? ` (acceptance: ${i.acceptance})` : ""}`
    ),
    digest.prompts.length ? "USER PROMPTS:" : null,
    ...digest.prompts.map((p) => `- ${p}`),
    digest.files.length ? "FILES TOUCHED:" : null,
    ...digest.files.map((f) => `- ${f}`),
    digest.commands.length ? "COMMANDS RUN:" : null,
    ...digest.commands.map((c) => `- ${c}`),
    "If the activity serves one plan item, give its number. If it is real work matching NO item, item_number is null and detour_title is a 2-5 word name for what it actually was. If you cannot tell, use low confidence.",
    'Reply with ONLY JSON: {"item_number": <number|null>, "detour_title": "<short|null>", "confidence": 0..1, "reason": "<one sentence>"}',
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6_000);
}

/**
 * Parse the `claude -p --output-format json` envelope into a classification.
 * Low-confidence answers degrade to 'unclassified' rather than guessing.
 */
function parseLlmOutput(stdout, items) {
  try {
    const envelope = JSON.parse(stdout);
    let text = typeof envelope.result === "string" ? envelope.result : stdout;
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const verdict = JSON.parse(text);
    const confidence = typeof verdict.confidence === "number" ? verdict.confidence : 0;
    const reason = typeof verdict.reason === "string" ? verdict.reason : null;
    if (confidence < MIN_LLM_CONFIDENCE) {
      return {
        kind: "unclassified",
        item_id: null,
        label: null,
        confidence,
        method: "llm",
        reason,
      };
    }
    if (typeof verdict.item_number === "number") {
      const item = items.find((i) => i.item_number === verdict.item_number);
      if (item) {
        return {
          kind: "item",
          item_id: item.item_id,
          label: null,
          confidence,
          method: "llm",
          reason,
        };
      }
    }
    const title = typeof verdict.detour_title === "string" ? verdict.detour_title.trim() : "";
    if (title) {
      return {
        kind: "detour",
        item_id: null,
        label: title.slice(0, 120),
        confidence,
        method: "llm",
        reason,
      };
    }
    return { kind: "unclassified", item_id: null, label: null, confidence, method: "llm", reason };
  } catch {
    return null;
  }
}

/** Run one LLM classification. Resolves a classification or null on failure. */
function llmClassify(digest, items) {
  const timeoutMs = Number(process.env.DASHBOARD_FOCUS_INFER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const model = process.env.DASHBOARD_FOCUS_INFER_MODEL || "haiku";
  const prompt = buildPrompt(digest, items);
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
      done(parseLlmOutput(stdout, items));
    });
  });
}

/**
 * Sessions worth classifying this tick: in a plan-bearing cwd, zero Focus
 * events, some real activity, ended or quiet, and either never inferred or
 * active again since the last inference.
 */
function listCandidates(dbModule, limit) {
  const quietBefore = new Date(Date.now() - QUIET_MS).toISOString();
  return dbModule.db
    .prepare(
      `SELECT s.id, s.cwd, s.updated_at FROM sessions s
       JOIN plans p ON p.cwd = s.cwd
       WHERE NOT EXISTS (
         SELECT 1 FROM events e WHERE e.session_id = s.id AND e.event_type = 'Focus'
       )
       AND EXISTS (
         SELECT 1 FROM events e WHERE e.session_id = s.id
           AND e.event_type IN ('UserPromptSubmit', 'PreToolUse')
       )
       AND (s.ended_at IS NOT NULL OR s.updated_at < ?)
       AND NOT EXISTS (
         SELECT 1 FROM focus_inferences fi
         WHERE fi.session_id = s.id AND fi.inferred_at >= s.updated_at
       )
       ORDER BY s.updated_at DESC LIMIT ?`
    )
    .all(quietBefore, limit);
}

/** Classify one session and persist the verdict. Never throws. */
async function inferSession(dbModule, row, mode) {
  try {
    const items = dbModule.stmts.listPlanItems.all(row.cwd).filter((i) => i.item_number != null); // top-level items only: sub-items
    // have no ccam-typeable number, and declared focus targets parents too
    if (items.length === 0) return;

    const digest = buildActivityDigest(dbModule, row.id);
    if (!digest) return;

    let result = heuristicClassify(digest, items);
    if (!result && mode === "llm" && (await probeClaudeCli())) {
      result = await llmClassify(digest, items);
    }
    if (!result) {
      result = {
        kind: "unclassified",
        item_id: null,
        label: null,
        confidence: null,
        method: "heuristic",
        reason: "no confident keyword match",
      };
    }

    dbModule.stmts.upsertFocusInference.run(
      row.id,
      row.cwd,
      result.kind,
      result.item_id,
      result.label,
      result.confidence,
      result.method,
      result.reason
    );
  } catch {
    /* fail-safe per session */
  }
}

/**
 * Start the classification loop: one backfill tick shortly after boot, then
 * a slow steady-state interval. Mirrors the other background services —
 * env-disableable, unref'd timers, overlap guard, serial per tick.
 */
function startFocusInference() {
  const mode = (process.env.DASHBOARD_FOCUS_INFER_MODE || "llm").toLowerCase();
  if (mode === "off") return;
  const TICK_MS = process.env.DASHBOARD_FOCUS_INFER_MS
    ? Number(process.env.DASHBOARD_FOCUS_INFER_MS)
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
        rows = listCandidates(dbModule, MAX_SESSIONS_PER_TICK);
      } catch {
        return;
      }
      for (const row of rows) {
        await inferSession(dbModule, row, mode);
      }
    } finally {
      running = false;
    }
  };

  const bootTimer = setTimeout(() => {
    tick().catch(() => {});
  }, BOOT_DELAY_MS);
  if (bootTimer.unref) bootTimer.unref();
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  startFocusInference,
  inferSession,
  listCandidates,
  buildActivityDigest,
  heuristicClassify,
  buildPrompt,
  parseLlmOutput,
  probeClaudeCli,
  __injectSpawnForTest,
};
