/**
 * @file Ingest-time privacy controls for hook payloads. A configurable policy
 * (persisted in app_settings) redacts, hashes, or drops sensitive data from
 * event payloads and summaries BEFORE they are written to SQLite or broadcast
 * over WebSocket. Built-in detectors cover secret-named keys, bearer tokens,
 * common API key formats, private key blocks, email addresses, and absolute
 * home-directory paths; user-defined rules add custom key/value regex matching.
 * Fail-safe by design: a sanitizer crash degrades to dropping the payload
 * (never storing raw data, never failing hook ingestion).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");
const { stmts } = require("../db");

const POLICY_KEY = "privacy_policy";

const ACTIONS = ["mask", "hash", "drop_field", "drop_event_payload"];
const MATCH_TYPES = ["key", "value"];

// Traversal guards — hook payloads are capped at 1 MB by express.json, but a
// deeply nested or very wide object must not stall ingestion.
const MAX_DEPTH = 32;
const MAX_NODES = 20000;
const MAX_STRING_SCAN = 262144; // strings longer than 256 KB skip value regexes

// Top-level keys kept when a drop_event_payload rule fires — the operational
// minimum the dashboard needs to keep sessions/agents/analytics coherent.
const PRESERVED_KEYS = ["session_id", "tool_name", "hook_event_name", "transcript_path", "cwd"];

// ── Built-in detectors ───────────────────────────────────────────────────────
// Key detector: matches the same secret-shaped key names the Claude Config
// Explorer already redacts, so both layers agree on what "secret-like" means.
const SECRET_KEY_RE = /token|secret|password|api[_-]?key|auth|credential|private[_-]?key/i;

// Value detectors. Each must use the global flag — sanitizeString relies on it.
const VALUE_DETECTORS = [
  {
    id: "bearer_tokens",
    re: /\bBearer\s+[A-Za-z0-9\-._~+/]{8,}=*/g,
  },
  {
    id: "api_key_formats",
    re: /\b(?:sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g,
  },
  {
    id: "private_key_blocks",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  {
    id: "email_addresses",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    id: "home_paths",
    re: /(?:\/(?:Users|home)\/|[A-Za-z]:\\Users\\)[^\s"'/\\]+/g,
  },
];

// Conservative default: obvious secrets are masked out of the box; emails and
// home paths are opt-in because they carry real debugging value (cwd grouping,
// project identification) and are not credentials.
const DEFAULT_POLICY = {
  enabled: true,
  detectors: {
    secret_keys: true,
    bearer_tokens: true,
    api_key_formats: true,
    private_key_blocks: true,
    email_addresses: false,
    home_paths: false,
  },
  default_action: "mask",
  rules: [],
};

// ── Policy persistence ───────────────────────────────────────────────────────

let policyCache = null;

function invalidatePolicyCache() {
  policyCache = null;
}

/**
 * Validate and normalize a policy document. Returns `{ ok: true, policy }`
 * with defaults applied, or `{ ok: false, error }`. Invalid custom-rule
 * regexes are rejected here so runtime evaluation never sees them.
 */
function validatePolicy(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "policy must be an object" };
  }
  const policy = {
    enabled: raw.enabled !== false,
    detectors: { ...DEFAULT_POLICY.detectors },
    default_action: raw.default_action === "hash" ? "hash" : "mask",
    rules: [],
  };
  if (raw.detectors != null) {
    if (typeof raw.detectors !== "object" || Array.isArray(raw.detectors)) {
      return { ok: false, error: "detectors must be an object" };
    }
    for (const key of Object.keys(DEFAULT_POLICY.detectors)) {
      if (raw.detectors[key] != null) policy.detectors[key] = raw.detectors[key] === true;
    }
  }
  if (raw.rules != null) {
    if (!Array.isArray(raw.rules)) return { ok: false, error: "rules must be an array" };
    if (raw.rules.length > 100) return { ok: false, error: "too many rules (max 100)" };
    for (const rule of raw.rules) {
      if (!rule || typeof rule !== "object") {
        return { ok: false, error: "each rule must be an object" };
      }
      if (typeof rule.name !== "string" || !rule.name.trim()) {
        return { ok: false, error: "rule name is required" };
      }
      if (!MATCH_TYPES.includes(rule.match_type)) {
        return { ok: false, error: `rule match_type must be one of: ${MATCH_TYPES.join(", ")}` };
      }
      if (!ACTIONS.includes(rule.action)) {
        return { ok: false, error: `rule action must be one of: ${ACTIONS.join(", ")}` };
      }
      if (rule.match_type === "value" && rule.action === "drop_field") {
        return { ok: false, error: "drop_field requires match_type=key" };
      }
      if (typeof rule.pattern !== "string" || !rule.pattern.trim()) {
        return { ok: false, error: `rule "${rule.name}" needs a pattern` };
      }
      if (rule.pattern.length > 500) {
        return { ok: false, error: `rule "${rule.name}" pattern too long (max 500)` };
      }
      try {
        // Compile once to verify; runtime compiles per sanitize pass with the
        // flags it needs.
        new RegExp(rule.pattern);
      } catch (err) {
        return { ok: false, error: `rule "${rule.name}" has an invalid regex: ${err.message}` };
      }
      policy.rules.push({
        id: typeof rule.id === "string" && rule.id ? rule.id : crypto.randomUUID(),
        name: rule.name.trim(),
        enabled: rule.enabled !== false,
        match_type: rule.match_type,
        pattern: rule.pattern,
        action: rule.action,
      });
    }
  }
  return { ok: true, policy };
}

function loadPolicy() {
  if (policyCache) return policyCache;
  try {
    const row = stmts.getAppSetting.get(POLICY_KEY);
    if (row) {
      const validated = validatePolicy(JSON.parse(row.value));
      policyCache = validated.ok ? validated.policy : { ...DEFAULT_POLICY };
    } else {
      policyCache = { ...DEFAULT_POLICY };
    }
  } catch {
    policyCache = { ...DEFAULT_POLICY };
  }
  return policyCache;
}

function savePolicy(raw) {
  const validated = validatePolicy(raw);
  if (!validated.ok) return validated;
  stmts.setAppSetting.run(POLICY_KEY, JSON.stringify(validated.policy));
  invalidatePolicyCache();
  return { ok: true, policy: validated.policy };
}

// ── Sanitization ─────────────────────────────────────────────────────────────

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex").slice(0, 12)}`;
}

function maskLabel(label) {
  return `[REDACTED:${label}]`;
}

/**
 * Apply value detectors + value rules to one string. Returns the transformed
 * string (or the original when nothing matched) and bumps `meta` counters.
 */
function sanitizeString(str, ctx) {
  if (typeof str !== "string" || str.length === 0 || str.length > MAX_STRING_SCAN) return str;
  let out = str;

  for (const detector of VALUE_DETECTORS) {
    if (!ctx.policy.detectors[detector.id]) continue;
    detector.re.lastIndex = 0;
    if (!detector.re.test(out)) continue;
    detector.re.lastIndex = 0;
    if (ctx.policy.default_action === "hash") {
      out = out.replace(detector.re, (m) => hashValue(m));
      ctx.meta.fields_hashed += 1;
    } else {
      out = out.replace(detector.re, maskLabel(detector.id));
      ctx.meta.fields_masked += 1;
    }
    ctx.meta.rules_applied += 1;
  }

  for (const rule of ctx.valueRules) {
    rule.re.lastIndex = 0;
    if (!rule.re.test(out)) continue;
    rule.re.lastIndex = 0;
    if (rule.action === "drop_event_payload") {
      ctx.dropPayload = true;
      ctx.meta.rules_applied += 1;
      continue;
    }
    if (rule.action === "hash") {
      out = out.replace(rule.re, (m) => hashValue(m));
      ctx.meta.fields_hashed += 1;
    } else {
      out = out.replace(rule.re, maskLabel(rule.name));
      ctx.meta.fields_masked += 1;
    }
    ctx.meta.rules_applied += 1;
  }

  return out;
}

function sanitizeNode(node, ctx, depth) {
  if (ctx.nodeCount > MAX_NODES || depth > MAX_DEPTH) return node;
  ctx.nodeCount += 1;

  if (typeof node === "string") return sanitizeString(node, ctx);
  if (node === null || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => sanitizeNode(item, ctx, depth + 1));
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    // Key-based rules first — they decide the fate of the whole value.
    let dropped = false;
    let replaced;
    let hasReplacement = false;

    for (const rule of ctx.keyRules) {
      rule.re.lastIndex = 0;
      if (!rule.re.test(key)) continue;
      ctx.meta.rules_applied += 1;
      if (rule.action === "drop_event_payload") {
        ctx.dropPayload = true;
      } else if (rule.action === "drop_field") {
        ctx.meta.fields_dropped += 1;
        dropped = true;
      } else if (rule.action === "hash") {
        replaced = hashValue(value);
        hasReplacement = true;
        ctx.meta.fields_hashed += 1;
      } else {
        replaced = maskLabel(rule.name);
        hasReplacement = true;
        ctx.meta.fields_masked += 1;
      }
      if (dropped || hasReplacement) break;
    }
    if (dropped) continue;
    if (hasReplacement) {
      out[key] = replaced;
      continue;
    }

    // Built-in secret-key detector masks/hashes string values under
    // secret-shaped key names. Non-string values (objects holding e.g.
    // `auth: {...}`) are recursed instead so we only transform leaves.
    if (ctx.policy.detectors.secret_keys && SECRET_KEY_RE.test(key) && typeof value === "string") {
      if (ctx.policy.default_action === "hash") {
        out[key] = hashValue(value);
        ctx.meta.fields_hashed += 1;
      } else {
        out[key] = maskLabel("secret_keys");
        ctx.meta.fields_masked += 1;
      }
      ctx.meta.rules_applied += 1;
      continue;
    }

    out[key] = sanitizeNode(value, ctx, depth + 1);
  }
  return out;
}

function emptyMeta() {
  return {
    rules_applied: 0,
    fields_masked: 0,
    fields_hashed: 0,
    fields_dropped: 0,
    payload_dropped: false,
  };
}

function buildContext(policy) {
  const keyRules = [];
  const valueRules = [];
  for (const rule of policy.rules) {
    if (!rule.enabled) continue;
    let re;
    try {
      re = new RegExp(rule.pattern, rule.match_type === "value" ? "g" : "i");
    } catch {
      continue; // validated at save time; belt-and-braces for hand-edited DB rows
    }
    const compiled = { ...rule, re };
    if (rule.match_type === "key") keyRules.push(compiled);
    else valueRules.push(compiled);
  }
  return { policy, keyRules, valueRules, meta: emptyMeta(), nodeCount: 0, dropPayload: false };
}

/**
 * Sanitize a hook payload object according to the active (or given) policy.
 * Returns `{ data, meta }` where `data` is a transformed deep copy (the input
 * is never mutated) and `meta` is the redaction summary, or null when nothing
 * was touched. Never throws: a sanitizer crash returns a conservative
 * metadata-only stub rather than the raw payload.
 */
function sanitizeEventData(data, policyOverride) {
  const policy = policyOverride || loadPolicy();
  if (!policy.enabled || data == null || typeof data !== "object") {
    return { data, meta: null };
  }
  try {
    const ctx = buildContext(policy);
    let result = sanitizeNode(data, ctx, 0);

    if (ctx.dropPayload) {
      const stub = {};
      for (const key of PRESERVED_KEYS) {
        if (result && typeof result === "object" && result[key] !== undefined) {
          stub[key] = result[key];
        }
      }
      result = stub;
      // The matching rule already counted itself in rules_applied.
      ctx.meta.payload_dropped = true;
    }

    const touched =
      ctx.meta.rules_applied > 0 ||
      ctx.meta.fields_masked > 0 ||
      ctx.meta.fields_hashed > 0 ||
      ctx.meta.fields_dropped > 0 ||
      ctx.meta.payload_dropped;
    if (!touched) return { data: result, meta: null };

    result._privacy = { ...ctx.meta };
    return { data: result, meta: ctx.meta };
  } catch (err) {
    // Conservative fail-safe: never store the raw payload after a sanitizer
    // crash, and never let the error reach the ingest path.
    console.warn("[PRIVACY] sanitize failed — dropping payload:", err?.message || err);
    const meta = emptyMeta();
    meta.payload_dropped = true;
    meta.error = true;
    return { data: { _privacy: { ...meta } }, meta };
  }
}

/**
 * Sanitize a single display string (event summaries, agent task text).
 * Applies value detectors and value rules only. Never throws.
 */
function sanitizeText(text, policyOverride) {
  if (typeof text !== "string" || !text) return text;
  const policy = policyOverride || loadPolicy();
  if (!policy.enabled) return text;
  try {
    const ctx = buildContext(policy);
    const out = sanitizeString(text, ctx);
    // drop_event_payload semantics don't apply to bare strings — mask instead.
    return ctx.dropPayload ? maskLabel("policy") : out;
  } catch {
    return "[REDACTED:error]";
  }
}

module.exports = {
  ACTIONS,
  MATCH_TYPES,
  DEFAULT_POLICY,
  POLICY_KEY,
  validatePolicy,
  loadPolicy,
  savePolicy,
  invalidatePolicyCache,
  sanitizeEventData,
  sanitizeText,
};
