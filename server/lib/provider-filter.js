/**
 * @file provider-filter.js
 * @description Shared SQL filters for the dashboard-wide Claude/Codex provider
 * scope. Provider scope composes with machine source scope; neither replaces it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Kept in sync with INGEST_BATCH_PROVIDERS (routes/hooks.js) -- a provider
// this route can't recognize doesn't error, it silently falls through to
// "no filter" (parseProviders below), so an unlisted value like "grok" would
// make a Grok-only filter return every session instead of scoping to Grok.
const VALID_PROVIDERS = new Set(["claude", "codex", "grok"]);

/** Parse `?providers=claude,codex`; absent means every provider. */
function parseProviders(req) {
  const raw = req.query ? req.query.providers : undefined;
  if (typeof raw !== "string") return null;
  const providers = [
    ...new Set(
      raw
        .split(",")
        .map((v) => v.trim())
        .filter((v) => VALID_PROVIDERS.has(v))
    ),
  ];
  return providers.length > 0 ? providers : null;
}

/** SQL predicate for a query that already aliases sessions. */
function providerColumnClause(providers, col = "s.provider") {
  if (!providers || providers.length === 0) return { clause: "", params: [] };
  return { clause: `${col} IN (${providers.map(() => "?").join(",")})`, params: providers };
}

/** SQL predicate for tables that only carry a session id. */
function sessionIdInProvidersClause(providers, sessionIdCol) {
  if (!providers || providers.length === 0) return { clause: "", params: [] };
  return {
    clause: `${sessionIdCol} IN (SELECT id FROM sessions WHERE provider IN (${providers
      .map(() => "?")
      .join(",")}))`,
    params: providers,
  };
}

module.exports = { parseProviders, providerColumnClause, sessionIdInProvidersClause };
