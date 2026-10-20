/**
 * @file Reconciles a session's token totals against the `cost-state` record that
 * Claude Code appends to the transcript when it saves the session's cost.
 *
 * Why this exists: the dashboard derives tokens from the `usage` on assistant
 * messages in the transcript files. Claude Code also makes API calls that never
 * produce a transcript message — the `/compact` summarisation request, and the
 * secondary-model call that WebFetch runs over every fetched page (Haiku) — yet
 * bills them. Those tokens are unrecoverable from the message stream, so a
 * transcript-only total runs a few percent below Claude's own. The `cost-state`
 * entry carries Claude's authoritative per-model running totals (`modelUsage`),
 * which is the one place the unrecorded calls show up.
 *
 * Contract: a model's total only ever moves UP to match `cost-state`. For each
 * model, any field where Claude's figure exceeds the dashboard's effective
 * figure (`current + baseline`, summed over every bucket of that model) is
 * topped up in the `baseline_*` columns of one bucket. A stale, partial, or
 * foreign record cannot shrink a total. The records are running totals, so
 * `trackCostState` also splits Claude's figure by the Claude Code version that
 * ran when each increase was saved; the top-up then credits each version's own
 * rows, and only unversioned ('') usage that a versioned top-up now covers is
 * moved, never removed.
 *
 * Used by BOTH ingestion paths — the live hook writer (via
 * `server/lib/transcript-cache.js`) and the history importer
 * (`scripts/import-history.js`) — so they agree.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { normalizeCcVersion } = require("./token-usage");

/** Non-negative integer from an untrusted JSON value; anything else is 0. */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Parse one `cost-state` transcript entry into per-model token totals, or null
 * when the entry is not a usable cost-state record. `thinkingTokens` is ignored:
 * it is a subset of `outputTokens` (cost matches `outputTokens` alone).
 */
function parseCostStateEntry(entry) {
  if (!entry || entry.type !== "cost-state") return null;
  const usage = entry.modelUsage;
  if (!usage || typeof usage !== "object") return null;
  const models = {};
  for (const [model, u] of Object.entries(usage)) {
    if (!model || !u || typeof u !== "object") continue;
    models[model] = {
      input: toCount(u.inputTokens),
      output: toCount(u.outputTokens),
      cacheRead: toCount(u.cacheReadInputTokens),
      cacheWrite: toCount(u.cacheCreationInputTokens),
      webSearch: toCount(u.webSearchRequests),
    };
  }
  if (Object.keys(models).length === 0) return null;
  return {
    sessionId: typeof entry.sessionId === "string" ? entry.sessionId : null,
    models,
  };
}

/** A model name without its trailing context-window tag (`claude-opus-5-5[1m]`). */
function stripContextTag(model) {
  return String(model || "").replace(/\[[^\]]*\]$/, "");
}

/**
 * Key used to match a cost-state model name to a stored bucket's model name.
 * The same model reaches the dashboard under several spellings — the first-party
 * id (`claude-haiku-4-5-20251001`), a context-window tag (`claude-opus-5-5[1m]`),
 * Bedrock (`us.anthropic.claude-haiku-4-5-20251001-v1:0`), Vertex
 * (`claude-haiku-4-5@20251001`) — and treating two spellings as two models would
 * count one model's tokens twice. The key drops case, the tag, the provider
 * prefix/suffix, and the snapshot date.
 */
function modelMatchKey(model) {
  return stripContextTag(model)
    .toLowerCase()
    .replace(/^(?:[a-z]+\.)?anthropic\./, "")
    .replace(/-v\d+(?::\d+)?$/, "")
    .replace(/[-@]\d{8}$/, "");
}

const FIELDS = [
  ["input", "input_tokens"],
  ["output", "output_tokens"],
  ["cacheRead", "cache_read_tokens"],
  ["cacheWrite", "cache_write_tokens"],
  ["webSearch", "web_search_requests"],
];

/** Share of `rows`' cache writes that are 1h writes, or null when they have none. */
function share1hOf(rows) {
  const writes = rows.reduce((sum, row) => sum + (row.cache_write_tokens || 0), 0);
  const writes1h = rows.reduce((sum, row) => sum + (row.cache_write_1h_tokens || 0), 0);
  return writes > 0 ? Math.min(writes1h / writes, 1) : null;
}

function rowSize(row) {
  return (
    (row.input_tokens || 0) +
    (row.output_tokens || 0) +
    (row.cache_read_tokens || 0) +
    (row.cache_write_tokens || 0)
  );
}

const ROW_COLUMNS = [
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "cache_write_1h_tokens",
  "web_search_requests",
  "web_fetch_requests",
  "code_execution_requests",
];

/** Sum `claims` (model spelling → counts) by modelMatchKey. */
function claimsByModelKey(models) {
  const claims = new Map();
  for (const [model, c] of Object.entries(models || {})) {
    const key = modelMatchKey(model);
    let claim = claims.get(key);
    if (!claim) {
      claim = {
        model: stripContextTag(model),
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        webSearch: 0,
      };
      claims.set(key, claim);
    }
    for (const [field] of FIELDS) claim[field] += (c && c[field]) || 0;
  }
  return claims;
}

const largestRow = (rows) =>
  rows.reduce((best, row) => (!best || rowSize(row) > rowSize(best) ? row : best), null);

const bucketOf = (row, fallbackModel, ccVersion) => ({
  model: row ? row.model : fallbackModel,
  speed: row ? row.speed : "standard",
  geo: row ? row.inference_geo : "global",
  tier: row ? row.service_tier : "standard",
  ctx: row && row.context_size === "long" ? "long" : "short",
  ccVersion,
});

/**
 * Work out how to bring each model's stored totals up to the cost-state
 * figures. `rows` are the session's effective bucket rows
 * (`stmts.getTokensBySession`). Returns `{ topUps, drains }`:
 *
 * - `topUps`: `{ model, speed, geo, tier, ctx, ccVersion, input, output,
 *   cacheRead, cacheWrite, cacheWrite1h, webSearch }` — a bucket row to credit
 *   and the amounts to add to its baseline.
 * - `drains`: `{ model, speed, geo, tier, ctx, effective }` — an unversioned
 *   ('') row and the effective counts (token_usage column names) it keeps.
 *
 * When the record carries `byVersion` (Claude's figure split by the Claude
 * Code version that ran when each increase was saved, see trackCostState),
 * each version's rows are raised to that version's own figure, and the
 * model's '' rows — usage no version accounted for, typically a pre-version
 * row's top-ups — give up what the versioned top-ups now cover, so the
 * model's total never exceeds max(stored, Claude's). Otherwise, or for a model
 * with workflow rows (owned by workflow-ingest and never split by version),
 * the model's total is raised as a whole on its largest bucket.
 */
function planCostState(rows, costState) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = modelMatchKey(row.model);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const sessionShare1h = share1hOf(rows || []);

  // cost-state can list one model under several spellings (with and without a
  // `[1m]` tag); they all map onto the same stored buckets, so Claude's figure
  // for the model is their SUM — comparing each separately would under-top-up.
  const claims = claimsByModelKey(costState.models);
  const versionClaims = new Map(); // model key → Map(version → claim)
  for (const [version, models] of Object.entries(costState.byVersion || {})) {
    for (const [key, claim] of claimsByModelKey(models)) {
      if (!versionClaims.has(key)) versionClaims.set(key, new Map());
      versionClaims.get(key).set(version, claim);
    }
  }

  const topUps = [];
  const drains = [];
  for (const [key, claimed] of claims) {
    const model = claimed.model;
    const group = byKey.get(key) || [];
    const owned = group.filter((row) => row.service_tier !== "workflow");

    // cost-state carries one cache-creation figure with no TTL split. Apply the
    // 1h share this model already shows in the session; a model with no writes
    // of its own (one seen only through cost-state, e.g. WebFetch's Haiku) takes
    // the session's share, since one Claude Code process requests the same TTL
    // for every model. With no writes anywhere, treat the unrecorded writes as
    // 5m (the lower rate) rather than over-price them.
    const share1h = share1hOf(group) ?? sessionShare1h ?? 0;

    const perVersion = versionClaims.get(key);
    if (perVersion && perVersion.size > 0 && owned.length === group.length) {
      const pool = owned.filter((row) => !row.cc_version);
      const needed = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cacheWrite1h: 0,
        webSearch: 0,
      };
      for (const [version, claim] of perVersion) {
        const mine = owned.filter((row) => row.cc_version === version);
        const delta = {};
        let any = false;
        for (const [field, column] of FIELDS) {
          const effective = mine.reduce((sum, row) => sum + (row[column] || 0), 0);
          delta[field] = Math.max(claim[field] - effective, 0);
          if (delta[field] > 0) any = true;
        }
        if (!any) continue;
        const own1h = share1hOf(mine) ?? share1h;
        delta.cacheWrite1h = Math.round(delta.cacheWrite * own1h);
        for (const field of Object.keys(needed)) needed[field] += delta[field];
        topUps.push({
          ...bucketOf(largestRow(mine) || largestRow(owned), model, version),
          input: delta.input,
          output: delta.output,
          cacheRead: delta.cacheRead,
          cacheWrite: delta.cacheWrite,
          cacheWrite1h: delta.cacheWrite1h,
          webSearch: delta.webSearch,
        });
      }
      // The '' rows give up what the versioned top-ups now cover, largest first.
      const left = {
        input_tokens: needed.input,
        output_tokens: needed.output,
        cache_read_tokens: needed.cacheRead,
        cache_write_tokens: needed.cacheWrite,
        cache_write_1h_tokens: needed.cacheWrite1h,
        web_search_requests: needed.webSearch,
      };
      for (const row of [...pool].sort((a, b) => rowSize(b) - rowSize(a))) {
        const effective = {};
        let changed = false;
        for (const column of ROW_COLUMNS) {
          const have = row[column] || 0;
          const take = Math.min(have, left[column] || 0);
          effective[column] = have - take;
          if (take > 0) {
            left[column] -= take;
            changed = true;
          }
        }
        effective.cache_write_1h_tokens = Math.min(
          effective.cache_write_1h_tokens,
          effective.cache_write_tokens
        );
        if (changed) drains.push({ ...bucketOf(row, model, ""), effective });
      }
      continue;
    }

    const delta = {};
    let any = false;
    for (const [field, column] of FIELDS) {
      const effective = group.reduce((sum, row) => sum + (row[column] || 0), 0);
      delta[field] = Math.max(claimed[field] - effective, 0);
      if (delta[field] > 0) any = true;
    }
    if (!any) continue;

    // Credit the model's largest standard-priced bucket. Workflow rows are
    // owned by workflow-ingest, so they count toward the total above but never
    // receive the top-up; a model seen only there gets a fresh standard bucket.
    const target = largestRow(owned);
    topUps.push({
      ...bucketOf(target, model, (target && target.cc_version) || ""),
      input: delta.input,
      output: delta.output,
      cacheRead: delta.cacheRead,
      cacheWrite: delta.cacheWrite,
      cacheWrite1h: Math.round(delta.cacheWrite * share1h),
      webSearch: delta.webSearch,
    });
  }
  return { topUps, drains };
}

/** The top-ups of planCostState — what to add to which bucket row. */
function computeCostStateTopUps(rows, costState) {
  return planCostState(rows, costState).topUps;
}

/**
 * Raise `sessionId`'s stored token totals to the cost-state figures. Returns the
 * number of bucket rows changed (0 when the session already matches or the
 * record belongs to a different session). `stmts` is the shared
 * prepared-statement set from `server/db.js`; callers own the transaction.
 */
function applyCostState(stmts, sessionId, costState) {
  if (!costState || !sessionId) return 0;
  // A forked/resumed transcript can replay an earlier session's cost record;
  // only the record stamped with this session's id describes this session.
  if (costState.sessionId && costState.sessionId !== sessionId) return 0;

  const { topUps, drains } = planCostState(stmts.getTokensBySession.all(sessionId), costState);
  for (const d of drains) {
    const key = [sessionId, d.model, d.speed, d.geo, d.tier, d.ctx, ""];
    stmts.deleteTokenUsageRow.run(...key);
    if (ROW_COLUMNS.some((column) => d.effective[column] > 0)) {
      stmts.insertTokenUsageRow.run(
        ...key,
        ...ROW_COLUMNS.map(() => 0),
        ...ROW_COLUMNS.map((column) => d.effective[column])
      );
    }
  }
  for (const t of topUps) {
    stmts.addTokenUsageBaseline.run(
      sessionId,
      t.model,
      t.speed,
      t.geo,
      t.tier,
      t.ctx,
      t.ccVersion,
      t.input,
      t.output,
      t.cacheRead,
      t.cacheWrite,
      t.cacheWrite1h,
      t.webSearch
    );
  }
  return topUps.length + drains.length;
}

/** Fresh state for trackCostState: the running version and one run per session id. */
function newCostStateTracker() {
  return { version: "", runs: {} };
}

/** Note a transcript entry's Claude Code version (call for every entry, in order). */
function trackEntryVersion(tracker, entry) {
  const version = normalizeCcVersion(entry && entry.version);
  if (version) tracker.version = version;
}

/**
 * Fold one parsed cost-state record (parseCostStateEntry) into `tracker` and
 * return it with `byVersion`: Claude's per-model figures split by the Claude
 * Code version that was running when each increase was saved. The records are
 * running totals (a resumed process restores them), so the increase between
 * consecutive records of one session belongs to the version of the entries
 * just before the later one. `byVersion` is left off when that does not hold
 * — a figure went down, or rose before any versioned entry — and the record
 * then tops up by its total alone. The tracker is plain data, so a parser can
 * persist it between incremental reads.
 */
function trackCostState(tracker, costState) {
  const sid = costState.sessionId || "";
  const run = tracker.runs[sid] || (tracker.runs[sid] = { prev: {}, byVersion: {}, ok: true });
  const version = tracker.version;
  for (const model of new Set([...Object.keys(run.prev), ...Object.keys(costState.models)])) {
    for (const [field] of FIELDS) {
      const delta =
        ((costState.models[model] || {})[field] || 0) - ((run.prev[model] || {})[field] || 0);
      if (delta < 0 || (delta > 0 && !version)) run.ok = false;
      if (delta <= 0 || !version) continue;
      const models = run.byVersion[version] || (run.byVersion[version] = {});
      const claim = models[model] || (models[model] = {});
      claim[field] = (claim[field] || 0) + delta;
    }
  }
  run.prev = JSON.parse(JSON.stringify(costState.models));
  return run.ok
    ? { ...costState, byVersion: JSON.parse(JSON.stringify(run.byVersion)) }
    : costState;
}

module.exports = {
  parseCostStateEntry,
  modelMatchKey,
  planCostState,
  computeCostStateTopUps,
  applyCostState,
  newCostStateTracker,
  trackEntryVersion,
  trackCostState,
};
