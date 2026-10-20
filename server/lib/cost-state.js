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
 * Contract: totals only ever move UP to match `cost-state`. For each model, any
 * field where Claude's figure exceeds the dashboard's effective figure
 * (`current + baseline`, summed over every bucket of that model) is topped up in
 * the `baseline_*` columns of one bucket. Nothing is ever subtracted, so a
 * stale, partial, or foreign record cannot shrink a total.
 *
 * Used by BOTH ingestion paths — the live hook writer (via
 * `server/lib/transcript-cache.js`) and the history importer
 * (`scripts/import-history.js`) — so they agree.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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

function rowSize(row) {
  return (
    (row.input_tokens || 0) +
    (row.output_tokens || 0) +
    (row.cache_read_tokens || 0) +
    (row.cache_write_tokens || 0)
  );
}

/**
 * Work out what to add to the stored buckets so each model's effective total
 * reaches the cost-state figure. `rows` are the session's effective bucket rows
 * (`stmts.getTokensBySession`). Returns one entry per model that needs a top-up:
 * `{ model, speed, geo, tier, ctx, input, output, cacheRead, cacheWrite,
 * cacheWrite1h, webSearch }` — the bucket to credit plus the amounts to add.
 */
function computeCostStateTopUps(rows, costState) {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = modelMatchKey(row.model);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  // cost-state can list one model under several spellings (with and without a
  // `[1m]` tag); they all map onto the same stored buckets, so Claude's figure
  // for the model is their SUM — comparing each separately would under-top-up.
  const claims = new Map();
  for (const [model, c] of Object.entries(costState.models)) {
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
    for (const [field] of FIELDS) claim[field] += c[field] || 0;
  }

  const topUps = [];
  for (const [key, claimed] of claims) {
    const model = claimed.model;
    const group = byKey.get(key) || [];
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
    const owned = group.filter((row) => row.service_tier !== "workflow");
    const target = owned.reduce(
      (best, row) => (!best || rowSize(row) > rowSize(best) ? row : best),
      null
    );

    // cost-state carries one cache-creation figure with no TTL split. Apply the
    // 1h share this model already shows in the session; with no history, treat
    // the unrecorded writes as 5m (the lower rate) rather than over-price them.
    const writes = group.reduce((sum, row) => sum + (row.cache_write_tokens || 0), 0);
    const writes1h = group.reduce((sum, row) => sum + (row.cache_write_1h_tokens || 0), 0);
    const share1h = writes > 0 ? Math.min(writes1h / writes, 1) : 0;

    topUps.push({
      model: target ? target.model : model,
      speed: target ? target.speed : "standard",
      geo: target ? target.inference_geo : "global",
      tier: target ? target.service_tier : "standard",
      ctx: target && target.context_size === "long" ? "long" : "short",
      input: delta.input,
      output: delta.output,
      cacheRead: delta.cacheRead,
      cacheWrite: delta.cacheWrite,
      cacheWrite1h: Math.round(delta.cacheWrite * share1h),
      webSearch: delta.webSearch,
    });
  }
  return topUps;
}

/**
 * Raise `sessionId`'s stored token totals to the cost-state figures. Returns the
 * number of models topped up (0 when the session already matches or the record
 * belongs to a different session). `stmts` is the shared prepared-statement set
 * from `server/db.js`.
 */
function applyCostState(stmts, sessionId, costState) {
  if (!costState || !sessionId) return 0;
  // A forked/resumed transcript can replay an earlier session's cost record;
  // only the record stamped with this session's id describes this session.
  if (costState.sessionId && costState.sessionId !== sessionId) return 0;

  const topUps = computeCostStateTopUps(stmts.getTokensBySession.all(sessionId), costState);
  for (const t of topUps) {
    stmts.addTokenUsageBaseline.run(
      sessionId,
      t.model,
      t.speed,
      t.geo,
      t.tier,
      t.ctx,
      t.input,
      t.output,
      t.cacheRead,
      t.cacheWrite,
      t.cacheWrite1h,
      t.webSearch
    );
  }
  return topUps.length;
}

module.exports = {
  parseCostStateEntry,
  modelMatchKey,
  computeCostStateTopUps,
  applyCostState,
};
