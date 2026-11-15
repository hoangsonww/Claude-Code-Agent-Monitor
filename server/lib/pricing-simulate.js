/**
 * @file Deterministic, offline "what-if" repricing simulator. Given the real
 * `token_usage` rows for a scope and a list of transformations (remap a model,
 * force a speed/geo/tier, expire introductory rates as of a date), it re-prices
 * the exact same usage under the hypothetical and reports actual vs. simulated
 * cost with a per-model delta.
 *
 * Honesty constraint: a model remap is a COST model, not a BEHAVIOR model. The
 * simulator assumes identical token usage; a different model may take more or
 * fewer turns. Callers surface that caveat (see `ASSUMPTION`) rather than
 * presenting the delta as a prediction.
 *
 * Correctness constraint: the simulator never reimplements the rate math. It
 * transforms the usage rows and feeds them back through the production pricing
 * calculator (injected as `calc`), so an empty transform list reprices to
 * exactly what `/api/pricing/cost` reports — a standing guard against drift.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// The transformation vocabulary. Kept deliberately small and declarative so the
// route can validate a request without executing anything.
const TRANSFORM_TYPES = Object.freeze([
  "remap_model",
  "set_speed",
  "set_geo",
  "set_tier",
  "expire_intro_rates",
]);

// Allowed values for the dimension-setting transforms, mirroring the dimensions
// the pricing engine actually understands (see ratesForBucket in routes/pricing).
const SPEED_VALUES = Object.freeze(["standard", "fast"]);
const GEO_VALUES = Object.freeze(["global", "us"]);
const TIER_VALUES = Object.freeze(["standard", "batch"]);

const ASSUMPTION =
  "Assumes identical token usage. A model remap is a cost model, not a behavior " +
  "model — a different model may take more or fewer turns to do the same work.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compile a `*`-glob (as used in transform patterns like `claude-opus-*`) into an
 * anchored, case-insensitive RegExp. `*` is the only wildcard; every other
 * regex metacharacter is escaped so patterns match literally.
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let out = "";
  for (const ch of String(glob || "")) {
    if (ch === "*") out += ".*";
    else out += ch.replace(/[.+?^${}()|[\]\\]/, "\\$&");
  }
  return new RegExp(`^${out}$`, "i");
}

/**
 * True when `value` matches the glob. An empty/missing glob matches everything,
 * so a dimension transform with no `model` filter applies to the whole scope.
 */
function matchGlob(glob, value) {
  if (glob === undefined || glob === null || glob === "") return true;
  return globToRegExp(glob).test(String(value || ""));
}

/**
 * Validate a transforms array. Returns `{ ok: true, transforms }` or
 * `{ ok: false, message }` with a human-readable reason. Pure; never throws on
 * bad input, so the route can turn a failure straight into a 400.
 *
 * @param {unknown} transforms
 */
function validateTransforms(transforms) {
  if (transforms === undefined || transforms === null) return { ok: true, transforms: [] };
  if (!Array.isArray(transforms)) return { ok: false, message: "transforms must be an array" };
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    const at = `transforms[${i}]`;
    if (!t || typeof t !== "object") return { ok: false, message: `${at} must be an object` };
    if (!TRANSFORM_TYPES.includes(t.type)) {
      return {
        ok: false,
        message: `${at}.type must be one of: ${TRANSFORM_TYPES.join(", ")}`,
      };
    }
    if (t.type === "remap_model") {
      if (!t.from || typeof t.from !== "string")
        return { ok: false, message: `${at}.from is required` };
      if (!t.to || typeof t.to !== "string") return { ok: false, message: `${at}.to is required` };
    } else if (t.type === "expire_intro_rates") {
      if (!DATE_RE.test(String(t.as_of || "")))
        return { ok: false, message: `${at}.as_of must be a YYYY-MM-DD date` };
    } else {
      const allowed =
        t.type === "set_speed" ? SPEED_VALUES : t.type === "set_geo" ? GEO_VALUES : TIER_VALUES;
      if (!allowed.includes(t.value))
        return { ok: false, message: `${at}.value must be one of: ${allowed.join(", ")}` };
    }
  }
  return { ok: true, transforms };
}

/**
 * Apply a single transform to one usage row, returning a new row (never mutates
 * the input). A transform that does not match the row returns the row unchanged.
 *
 * `expire_intro_rates` works by overriding the row's effective pricing date: the
 * production resolver keys introductory rates off `row.date <= rule.intro_until`,
 * so pricing the usage "as of" a later date naturally drops any expired intro
 * discount — without the simulator knowing a single rate.
 */
function applyOne(row, t) {
  switch (t.type) {
    case "remap_model":
      return matchGlob(t.from, row.model) ? { ...row, model: t.to } : row;
    case "set_speed":
      return matchGlob(t.model, row.model) ? { ...row, speed: t.value } : row;
    case "set_geo":
      return matchGlob(t.model, row.model) ? { ...row, inference_geo: t.value } : row;
    case "set_tier":
      return matchGlob(t.model, row.model) ? { ...row, service_tier: t.value } : row;
    case "expire_intro_rates":
      return matchGlob(t.model, row.model) ? { ...row, date: t.as_of } : row;
    default:
      return row;
  }
}

/**
 * Apply every transform, in order, to every row. Returns a fresh array; the
 * input rows are never mutated.
 * @param {Array<object>} rows
 * @param {Array<object>} transforms
 */
function applyTransforms(rows, transforms) {
  const list = Array.isArray(transforms) ? transforms : [];
  return rows.map((row) => list.reduce((acc, t) => applyOne(acc, t), row));
}

/**
 * Build the per-model delta between the actual and simulated breakdowns. Each
 * breakdown entry is keyed by model; costs are summed per model so a model that
 * split across speed/geo/tier tuples collapses to one comparison row. Models
 * that appear only after a remap (the "to" side) still show up with a zero
 * actual, so the waterfall accounts for every dollar of the difference.
 */
function summarizeDelta(actualBreakdown, simulatedBreakdown) {
  const byModel = new Map();
  const bump = (model, field, cost) => {
    const e = byModel.get(model) || { model, actual_cost: 0, simulated_cost: 0 };
    e[field] += cost || 0;
    byModel.set(model, e);
  };
  for (const b of actualBreakdown || []) bump(b.model, "actual_cost", b.cost);
  for (const b of simulatedBreakdown || []) bump(b.model, "simulated_cost", b.cost);

  const round4 = (n) => Math.round(n * 10000) / 10000;
  return [...byModel.values()]
    .map((e) => {
      const delta = round4(e.simulated_cost - e.actual_cost);
      const pct = e.actual_cost > 0 ? round4((delta / e.actual_cost) * 100) : null;
      return {
        model: e.model,
        actual_cost: round4(e.actual_cost),
        simulated_cost: round4(e.simulated_cost),
        delta,
        delta_pct: pct,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Run the simulation. `calc(rows, asOf)` is the production pricing calculator
 * (injected so this module stays free of the database and the express layer and
 * can never drift into a second implementation of the rate math).
 *
 * @param {{rows: Array<object>, transforms?: Array<object>, asOf?: string}} input
 * @param {(rows: Array<object>, asOf?: string) => {total_cost:number, breakdown:Array, unpriced_models:Array}} calc
 * @returns {{actual, simulated, delta, assumptions, transforms}}
 */
function simulate({ rows, transforms = [], asOf }, calc) {
  if (typeof calc !== "function") throw new TypeError("simulate requires a calc function");
  const source = Array.isArray(rows) ? rows : [];
  const actual = calc(source, asOf);
  const simulatedRows = applyTransforms(source, transforms);
  const simulated = calc(simulatedRows, asOf);

  const round4 = (n) => Math.round(n * 10000) / 10000;
  const totalDelta = round4(simulated.total_cost - actual.total_cost);
  const totalPct = actual.total_cost > 0 ? round4((totalDelta / actual.total_cost) * 100) : null;

  return {
    actual,
    simulated,
    delta: {
      total: totalDelta,
      total_pct: totalPct,
      by_model: summarizeDelta(actual.breakdown, simulated.breakdown),
    },
    assumptions: [ASSUMPTION],
    transforms,
  };
}

module.exports = {
  simulate,
  applyTransforms,
  validateTransforms,
  summarizeDelta,
  globToRegExp,
  matchGlob,
  TRANSFORM_TYPES,
  SPEED_VALUES,
  GEO_VALUES,
  TIER_VALUES,
  ASSUMPTION,
};
