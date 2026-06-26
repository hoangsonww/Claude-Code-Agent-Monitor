/**
 * @file Supplementary OpenAPI fragments merged into the base spec by
 * `createOpenApiSpec()` (server/openapi.js). Each domain fragment under
 * `server/openapi-extra/` exports `{ tags, schemas, paths }`; this module
 * deep-combines them into one `{ tags, schemas, paths }` object. Extra paths
 * and schemas OVERRIDE base entries with the same key, so a comprehensive
 * entry here can supersede a terser one in the base literal; tags are appended
 * only when their `name` is not already present.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// New endpoint groups (previously-undocumented gaps in the base spec).
const ccConfig = require("./openapi-extra/cc-config");
const run = require("./openapi-extra/run");
const push = require("./openapi-extra/push");
const misc = require("./openapi-extra/misc");
// Enriched overrides of already-documented endpoints — same operationId, tags,
// and request/response `$ref` schemas as the base, with added examples and
// richer descriptions. Listed last so they win the merge.
const overrideSessionsAgents = require("./openapi-extra/override-sessions-agents");
const overrideCore = require("./openapi-extra/override-core");
const overridePricingAlerts = require("./openapi-extra/override-pricing-alerts");
const overrideOps = require("./openapi-extra/override-ops");

/** Combine N fragments into a single { tags, schemas, paths }. Later fragments
 *  override earlier ones on path/schema key collisions; tags dedupe by name. */
function combine(...fragments) {
  const out = { tags: [], schemas: {}, paths: {} };
  const tagNames = new Set();
  for (const frag of fragments) {
    if (!frag) continue;
    for (const tag of frag.tags || []) {
      if (tag && !tagNames.has(tag.name)) {
        tagNames.add(tag.name);
        out.tags.push(tag);
      }
    }
    Object.assign(out.schemas, frag.schemas || {});
    Object.assign(out.paths, frag.paths || {});
  }
  return out;
}

module.exports = combine(
  ccConfig,
  run,
  push,
  misc,
  overrideSessionsAgents,
  overrideCore,
  overridePricingAlerts,
  overrideOps
);
