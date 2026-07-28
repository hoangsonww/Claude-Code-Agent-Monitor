/**
 * @file Stakeholder-readable window summaries for the Focus report —
 * the synthesis layer behind `GET /api/focus-report/summary`
 * (server/routes/focus-report.js). Compresses a window's per-session focus
 * segments — labels, kinds, one-sentence inferred reasons, wall/active
 * time — into plain-language bullets a non-technical stakeholder can read
 * ("what did we actually do in this window").
 *
 * Two paths, split at DIRECT_WINDOW_MAX_DAYS local calendar days:
 *  - **Direct** (≤2 days): one LLM shot over the window's raw session facts,
 *    up to 4 bullets. When the window holds more than 40 sessions, the MOST
 *    RECENT are kept (earlier ones dropped with an explicit note) — never
 *    the reverse, which would silently cut the newest work.
 *  - **Hierarchical** (wider): summarize each local calendar day via the
 *    direct path (each day cached under its own scope-qualified key —
 *    permanently, once the day's data stops changing), then ONE rollup shot
 *    synthesizes the window from the per-day bullets, with a bullet budget
 *    that scales with the span (6 up to a week, 8 beyond — `bulletBudget`).
 *    This is what keeps a three-week summary concrete: day summaries stay
 *    specific, no session cap ever drops a whole day, and a day whose own
 *    synthesis fails degrades to its raw fact lines instead of vanishing.
 *    Repeat views of an unchanged window serve straight from cache with
 *    ZERO LLM calls (the pre-generation digest fast path).
 *
 * Reuses focus-inference.js's hermetic spawn contract verbatim via its
 * exported `runClaudePromptJson` (hooks disabled, all tools disallowed,
 * cwd = tmpdir, `DASHBOARD_FOCUS_INFER_TIMEOUT_MS` kill timer) — never
 * a second, slightly-different `claude -p` invocation path. The model is
 * `DASHBOARD_FOCUS_SUMMARY_MODEL` when set, falling back to the shared
 * `DASHBOARD_FOCUS_INFER_MODEL`, then `haiku` (see {@link summaryModel}).
 * Availability
 * follows the same gate as inference's LLM path: `DASHBOARD_FOCUS_INFER_MODE`
 * must be `llm` (the default) and the `claude` CLI must probe as runnable;
 * otherwise `generateWindowSummary` resolves null and the route reports the
 * summary as unavailable rather than erroring.
 *
 * Caching: one `focus_summaries` row per cache key (the route's normalized
 * scope+window request string). `computeInputDigest` hashes the summary-
 * relevant slice of the report (per-session segment kinds/labels/reasons/
 * times); a cached row is served only while its stored digest still matches,
 * so a finished day is generated exactly once and served forever, while a
 * still-running day regenerates whenever new activity actually changed the
 * input — not on every page view.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");
const { runClaudePromptJson, probeClaudeCli } = require("./focus-inference");
const { buildProjectFocusReport } = require("./focus-report");

const MAX_SESSIONS_IN_PROMPT = 40;
const MAX_BULLETS = 4;
// Runaway-output guard only — generous enough that a legitimate two-sentence
// rollup bullet is never chopped mid-word (the prompt asks for ≤2 sentences).
const MAX_BULLET_LENGTH = 500;
/** Absolute ceiling any window may ask for / any parse may keep. */
const MAX_BULLETS_CEILING = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Windows spanning more than this many local calendar days summarize
 *  hierarchically (per-day, then rollup) instead of in one direct shot. */
const DIRECT_WINDOW_MAX_DAYS = 2;

/**
 * How many bullets a window of `days` calendar days may use: 4 for a day or
 * two (the original budget), 6 up to a week, 8 beyond. Without this, a
 * three-week window compresses ~56 sessions into the same 4 bullets a
 * single day gets (~14 segments per bullet) and every concrete deliverable
 * averages away into "ongoing housekeeping".
 */
function bulletBudget(days) {
  if (days <= DIRECT_WINDOW_MAX_DAYS) return MAX_BULLETS;
  if (days <= 7) return 6;
  return MAX_BULLETS_CEILING;
}

/** The model the window summary spawns: `DASHBOARD_FOCUS_SUMMARY_MODEL` when
 *  set, else the shared `DASHBOARD_FOCUS_INFER_MODEL`, else `haiku`. A
 *  dedicated override because the summary is stakeholder-facing prose worth
 *  a stronger model, while the per-session background classifier runs far
 *  more often and stays cheap on the shared default. */
function summaryModel() {
  return (
    process.env.DASHBOARD_FOCUS_SUMMARY_MODEL || process.env.DASHBOARD_FOCUS_INFER_MODEL || "haiku"
  );
}

/** Formats a millisecond duration as compact "Nh Nm" / "Nm" for the prompt. */
function fmtMinutes(ms) {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The summary-relevant slice of one report session: what the prompt (and the
 * cache digest) are built from. Kept as a single shared extraction so the
 * digest can never drift from what the prompt actually contains.
 */
function summaryFacts(report) {
  return (report.sessions || []).map((s) => ({
    name: s.name || null,
    segments: (s.segments || []).map((seg) => ({
      kind: seg.kind,
      item_number: seg.item_number,
      label: seg.label,
      reason: seg.inferred_reason,
      start: seg.start,
      end: seg.end,
      wall_ms: seg.wall_ms,
      active_ms: seg.active_ms,
    })),
  }));
}

/**
 * Stable content hash of the summary-relevant report slice. Serving a cached
 * summary is valid exactly as long as this digest is unchanged — see file
 * header.
 */
function computeInputDigest(report) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(summaryFacts(report)))
    .digest("hex");
}

/**
 * Builds the direct synthesis prompt: every session's segments as compact
 * fact lines, then the ask for 2-`maxBullets` stakeholder bullets. When the
 * window holds more than {@link MAX_SESSIONS_IN_PROMPT} sessions, the MOST
 * RECENT ones are kept and the EARLIER ones dropped with an explicit "+N
 * earlier sessions omitted" note — never the reverse: sessions arrive
 * oldest-first, so a head-slice would silently cut the newest work (the
 * part a "what did we just do" summary can least afford to lose).
 */
function buildWindowSummaryPrompt(report, maxBullets = MAX_BULLETS) {
  const facts = summaryFacts(report);
  const shown =
    facts.length > MAX_SESSIONS_IN_PROMPT ? facts.slice(-MAX_SESSIONS_IN_PROMPT) : facts;
  const lines = [];
  if (facts.length > shown.length) {
    lines.push(`- (+${facts.length - shown.length} earlier sessions omitted)`);
  }
  for (const s of shown) {
    for (const seg of s.segments) {
      const what =
        seg.kind === "item"
          ? `plan item ${seg.item_number}${seg.label ? ` (${seg.label})` : ""}`
          : seg.kind === "none"
            ? "unplanned work"
            : `${seg.kind}: ${seg.label || "(untitled)"}`;
      const time = `${fmtMinutes(seg.wall_ms)} wall / ${fmtMinutes(seg.active_ms)} active`;
      lines.push(
        `- session "${s.name || "unnamed"}": ${what}, ${time}${seg.reason ? ` — ${seg.reason}` : ""}`
      );
    }
  }
  return [
    "You are summarizing a window of engineering activity for a non-technical stakeholder.",
    "Each line below is one work session's focus record (what it worked on, its time, and a one-sentence machine-inferred description when available).",
    "SESSIONS:",
    ...lines,
    `Write 2-${maxBullets} plain-language bullets describing what was actually accomplished in this window.`,
    "Merge sessions that tell the same story into one bullet instead of repeating them.",
    "Name concrete deliverables and counts where the records carry them - do not average distinct pieces of work into vague themes.",
    "Briefly note substantial time with no description as unclassified activity; ignore trivial slivers.",
    "Do not mention session names, ids, or the word 'session' unless it aids clarity. No preamble.",
    `Reply with ONLY JSON: {"bullets": ["<bullet>", ...]}`,
  ]
    .join("\n")
    .slice(0, 12_000);
}

/**
 * Builds the hierarchical rollup prompt from per-day inputs. Each entry is
 * either a day's already-synthesized bullets (the common case - specific,
 * cached, immutable once the day ended) or, when a day's own synthesis
 * failed, its compact raw fact lines - degraded but never silently absent.
 */
function buildRollupPrompt(dayEntries, maxBullets) {
  const lines = [];
  for (const entry of dayEntries) {
    lines.push(`${entry.label}:`);
    for (const bullet of entry.lines) lines.push(`  - ${bullet}`);
  }
  return [
    "You are summarizing a multi-day window of engineering activity for a non-technical stakeholder.",
    "Below are per-day summaries of what was actually accomplished, oldest day first.",
    "DAYS:",
    ...lines,
    `Write 2-${maxBullets} plain-language bullets describing what was accomplished across the whole window.`,
    "Merge days that continue the same story into one bullet; keep distinct deliverables distinct.",
    "Keep each bullet to at most two sentences.",
    "Preserve concrete outcomes, names, and counts from the day summaries - do not flatten them into vague themes like 'ongoing housekeeping'.",
    "Give completed recent work its full weight; note major still-in-progress threads as such.",
    "No preamble.",
    `Reply with ONLY JSON: {"bullets": ["<bullet>", ...]}`,
  ]
    .join("\n")
    .slice(0, 16_000);
}

/**
 * Parse the `claude -p --output-format json` envelope into a clean bullets
 * array. Returns null on garbage output, a missing/empty list, or non-string
 * entries; bullets are trimmed, capped at `maxBullets` (default
 * {@link MAX_BULLETS}, never above {@link MAX_BULLETS_CEILING}) entries of
 * {@link MAX_BULLET_LENGTH} chars.
 */
function parseWindowSummaryOutput(stdout, maxBullets = MAX_BULLETS) {
  const cap = Math.min(maxBullets, MAX_BULLETS_CEILING);
  try {
    const envelope = JSON.parse(stdout);
    let text = typeof envelope.result === "string" ? envelope.result : stdout;
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const verdict = JSON.parse(text);
    if (!Array.isArray(verdict.bullets)) return null;
    const bullets = verdict.bullets
      .filter((b) => typeof b === "string" && b.trim() !== "")
      .map((b) => b.trim().slice(0, MAX_BULLET_LENGTH))
      .slice(0, cap);
    return bullets.length > 0 ? bullets : null;
  } catch {
    return null;
  }
}

/** Reads a valid cached summary row for `cacheKey` gated on `digest`, or
 *  null. Shared by both paths; never spawns anything. */
function readCachedSummary(dbModule, cacheKey, digest) {
  const cached = dbModule.stmts.getFocusSummary.get(cacheKey);
  if (!cached || cached.input_digest !== digest) return null;
  try {
    const bullets = JSON.parse(cached.bullets);
    if (Array.isArray(bullets) && bullets.length > 0) {
      return { bullets, generated_at: cached.created_at, cached: true, model: cached.model };
    }
  } catch {
    /* corrupt cache row - treat as a miss and regenerate */
  }
  return null;
}

/** LLM availability gate shared by both paths: the mode must be `llm` and
 *  the `claude` CLI must probe as runnable. */
async function llmAvailable() {
  const mode = (process.env.DASHBOARD_FOCUS_INFER_MODE || "llm").toLowerCase();
  if (mode !== "llm") return false;
  return probeClaudeCli();
}

/**
 * The direct (single-shot) path: digest-gated cache, then one spawn over the
 * window's raw session facts. Used verbatim for short windows AND for each
 * calendar day inside a hierarchical rollup — a day generated as a rollup
 * building block is byte-identical to one the picker requests directly.
 */
async function generateDirectSummary(dbModule, cacheKey, report, maxBullets = MAX_BULLETS) {
  if ((report.sessions || []).length === 0) return null;

  const digest = computeInputDigest(report);
  const cached = readCachedSummary(dbModule, cacheKey, digest);
  if (cached) return cached;

  if (!(await llmAvailable())) return null;

  const model = summaryModel();
  const stdout = await runClaudePromptJson(buildWindowSummaryPrompt(report, maxBullets), { model });
  if (stdout == null) return null;
  const bullets = parseWindowSummaryOutput(stdout, maxBullets);
  if (!bullets) return null;

  dbModule.stmts.upsertFocusSummary.run(cacheKey, digest, JSON.stringify(bullets), model);
  const row = dbModule.stmts.getFocusSummary.get(cacheKey);
  return {
    bullets,
    generated_at: row ? row.created_at : new Date().toISOString(),
    cached: false,
    model,
  };
}

/** The next local midnight strictly after `ms` (DST-safe via setHours(24)). */
function nextLocalMidnight(ms) {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** Local `YYYY-MM-DD` label for a day chunk's start. */
function localDayLabel(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Splits `[fromMs, toMs)` at local midnights into per-day chunks. */
function localDayChunks(fromMs, toMs) {
  const chunks = [];
  let t = fromMs;
  while (t < toMs) {
    const end = Math.min(nextLocalMidnight(t), toMs);
    chunks.push({ startMs: t, endMs: end });
    t = end;
  }
  return chunks;
}

/** Session rows (route-selected, whole-window) narrowed to those overlapping
 *  `[startMs, endMs)` — mirrors the route's own overlap rule. */
function sessionsOverlapping(sessions, startMs, endMs) {
  return sessions.filter((s) => {
    const started = Date.parse(s.started_at);
    if (!(started < endMs)) return false;
    if (s.ended_at == null) return true;
    return Date.parse(s.ended_at) >= startMs;
  });
}

/** Compact raw fact lines for one day — the degraded-but-present rollup
 *  input for a day whose own synthesis failed (see buildRollupPrompt). */
function rawDayLines(report, cap = 10) {
  const lines = [];
  for (const s of summaryFacts(report)) {
    for (const seg of s.segments) {
      const what =
        seg.kind === "item"
          ? `plan item ${seg.item_number}${seg.label ? ` (${seg.label})` : ""}`
          : seg.kind === "none"
            ? "unplanned work"
            : `${seg.kind}: ${seg.label || "(untitled)"}`;
      lines.push(
        `${what}, ${fmtMinutes(seg.wall_ms)} wall / ${fmtMinutes(seg.active_ms)} active${seg.reason ? ` — ${seg.reason}` : ""}`
      );
    }
  }
  return lines.slice(-cap); // most recent facts win, same recency bias as the caps
}

/** Stable per-day cache key: local day start + the request's scope identity,
 *  so the same day under two different scopes never shares a summary. */
function dayCacheKey(dayStartMs, scope) {
  return JSON.stringify({ day: dayStartMs, scope: scope ?? null });
}

/**
 * The hierarchical (map-reduce) path for windows wider than
 * {@link DIRECT_WINDOW_MAX_DAYS} local calendar days: summarize each day
 * via {@link generateDirectSummary} (cached permanently once the day's data
 * stops changing), then synthesize the window from the per-day bullets.
 * This is what keeps a three-week summary concrete: single-day summaries
 * are specific, and no session cap ever silently drops a day — a failed
 * day degrades to its raw fact lines instead of vanishing.
 */
async function generateHierarchicalSummary(dbModule, cacheKey, opts) {
  const chunks = localDayChunks(opts.fromMs, opts.toMs)
    .map((c) => {
      const rows = sessionsOverlapping(opts.sessions, c.startMs, c.endMs);
      if (rows.length === 0) return null;
      const report = buildProjectFocusReport(dbModule, rows, c.startMs, c.endMs);
      if ((report.sessions || []).length === 0) return null;
      return { ...c, report, key: dayCacheKey(c.startMs, opts.scope) };
    })
    .filter(Boolean);
  if (chunks.length === 0) return null;

  // Zero-LLM fast path: if every day's cache is fresh AND the window row was
  // built from exactly those bullets, serve it without any spawn.
  const preParts = chunks.map((c) => ({
    day: c.startMs,
    content:
      readCachedSummary(dbModule, c.key, computeInputDigest(c.report))?.bullets ??
      `digest:${computeInputDigest(c.report)}`,
  }));
  const preDigest = crypto.createHash("sha1").update(JSON.stringify(preParts)).digest("hex");
  const preCached = readCachedSummary(dbModule, cacheKey, preDigest);
  if (preCached) return preCached;

  if (!(await llmAvailable())) return null;

  // Map: per-day summaries (cache hits are free; only changed/missing days
  // spawn). A day that still fails contributes its raw facts instead.
  const dayEntries = [];
  const digestParts = [];
  for (const c of chunks) {
    const day = await generateDirectSummary(dbModule, c.key, c.report, MAX_BULLETS);
    const label = localDayLabel(c.startMs);
    if (day) {
      dayEntries.push({ label, lines: day.bullets });
      digestParts.push({ day: c.startMs, content: day.bullets });
    } else {
      dayEntries.push({ label, lines: rawDayLines(c.report) });
      digestParts.push({ day: c.startMs, content: `digest:${computeInputDigest(c.report)}` });
    }
  }

  const digest = crypto.createHash("sha1").update(JSON.stringify(digestParts)).digest("hex");
  const cached = readCachedSummary(dbModule, cacheKey, digest);
  if (cached) return cached;

  // Reduce: one rollup spawn over the day summaries.
  const maxBullets = bulletBudget(chunks.length);
  const model = summaryModel();
  const stdout = await runClaudePromptJson(buildRollupPrompt(dayEntries, maxBullets), { model });
  if (stdout == null) return null;
  const bullets = parseWindowSummaryOutput(stdout, maxBullets);
  if (!bullets) return null;

  dbModule.stmts.upsertFocusSummary.run(cacheKey, digest, JSON.stringify(bullets), model);
  const row = dbModule.stmts.getFocusSummary.get(cacheKey);
  return {
    bullets,
    generated_at: row ? row.created_at : new Date().toISOString(),
    cached: false,
    model,
  };
}

/**
 * Resolve the cached-or-freshly-generated summary for one report window.
 *
 * @param dbModule The shared db module (`server/db`), for the cache stmts.
 * @param cacheKey Normalized scope+window request identity (route-owned).
 * @param report   `buildProjectFocusReport` output for the same window.
 * @param opts     Optional `{ fromMs, toMs, scope, sessions }` (the route's
 *   resolved window bounds, scope identity, and session rows). When present
 *   and the window spans more than {@link DIRECT_WINDOW_MAX_DAYS} local
 *   calendar days, the hierarchical per-day path runs; otherwise (or when
 *   omitted — e.g. by callers that only have a built report) the direct
 *   single-shot path runs exactly as before.
 * @returns `{ bullets, generated_at, cached, model }` or null when no
 *   summary can be produced (LLM path disabled/unavailable, nothing to
 *   summarize, or the call failed) — null is "unavailable", never an error.
 */
async function generateWindowSummary(dbModule, cacheKey, report, opts = undefined) {
  if ((report.sessions || []).length === 0) return null;

  if (opts && opts.fromMs != null && opts.toMs != null && Array.isArray(opts.sessions)) {
    const days = localDayChunks(opts.fromMs, opts.toMs).length;
    if (days > DIRECT_WINDOW_MAX_DAYS) {
      return generateHierarchicalSummary(dbModule, cacheKey, opts);
    }
  }
  return generateDirectSummary(dbModule, cacheKey, report, MAX_BULLETS);
}

module.exports = {
  generateWindowSummary,
  buildWindowSummaryPrompt,
  buildRollupPrompt,
  parseWindowSummaryOutput,
  computeInputDigest,
  summaryModel,
  bulletBudget,
  localDayChunks,
};
