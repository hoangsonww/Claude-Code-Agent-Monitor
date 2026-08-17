/**
 * @file Privacy controls module for hook payload ingestion. Provides a
 * configurable rule engine that redacts, hashes, or drops sensitive fields
 * from Claude Code event payloads before they are written to SQLite or
 * broadcast over WebSocket. Rules are persisted in the dashboard's
 * own SQLite database and evaluated in priority order. The module is
 * designed to be fail-safe: any rule evaluation error degrades gracefully
 * rather than blocking ingestion.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");
const { db } = require("../db");

// ---------------------------------------------------------------------------
// Schema bootstrap (migration-safe; no-op if tables already exist)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS privacy_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    action      TEXT    NOT NULL DEFAULT 'mask'
                CHECK(action IN ('mask','hash','drop_field','drop_event_payload','preserve_metadata_only')),
    field_path  TEXT    NOT NULL DEFAULT '',
    pattern     TEXT    NOT NULL DEFAULT '',
    enabled     INTEGER NOT NULL DEFAULT 1,
    built_in    INTEGER NOT NULL DEFAULT 0,
    priority    INTEGER NOT NULL DEFAULT 100,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS privacy_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed the built-in detectors once; skip if they already exist.
const BUILT_IN_RULES = [
  {
    name: "Secret-like API keys",
    action: "mask",
    field_path: "",
    pattern: "(sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{32,}(?:key|token|secret|api)[A-Za-z0-9_-]*)",
    priority: 10,
  },
  {
    name: "Bearer tokens",
    action: "mask",
    field_path: "",
    pattern: "Bearer\\s+[A-Za-z0-9._~+/-]+=*",
    priority: 10,
  },
  {
    name: "Private key blocks",
    action: "mask",
    field_path: "",
    pattern: "-----BEGIN [A-Z ]+ PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]+ PRIVATE KEY-----",
    priority: 10,
  },
  {
    name: "AWS access key format",
    action: "mask",
    field_path: "",
    pattern: "(?:AKIA|AGPA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
    priority: 10,
  },
  {
    name: "Home directory paths",
    action: "mask",
    field_path: "",
    pattern: "(?:/home/[^/\\s]+|/Users/[^/\\s]+|C:\\\\Users\\\\[^\\\\\\s]+)",
    priority: 50,
  },
  {
    name: "Email addresses",
    action: "mask",
    field_path: "",
    pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    priority: 50,
  },
];

{
  const existingBuiltIn = db
    .prepare("SELECT COUNT(*) AS n FROM privacy_rules WHERE built_in = 1")
    .get();
  if (existingBuiltIn.n === 0) {
    const ins = db.prepare(
      "INSERT INTO privacy_rules (name, action, field_path, pattern, enabled, built_in, priority) VALUES (?,?,?,?,1,1,?)"
    );
    const seed = db.transaction(() => {
      for (const r of BUILT_IN_RULES) ins.run(r.name, r.action, r.field_path, r.pattern, r.priority);
    });
    seed();
  }
}

// Ensure default global-enabled setting exists
db.prepare("INSERT OR IGNORE INTO privacy_settings (key, value) VALUES ('enabled', '1')").run();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic stable SHA-256 hex of a value (truncated to 16 chars). */
function stableHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

/** Mask a string, keeping first/last 2 chars if long enough. */
function maskString(s) {
  if (typeof s !== "string") return s;
  if (s.length <= 6) return "***";
  return `${s.slice(0, 2)}${"*".repeat(Math.min(s.length - 4, 8))}${s.slice(-2)}`;
}

// Path segments that would otherwise let a user-supplied field_path reach
// into an object's prototype chain (prototype pollution).
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Resolve a dot-path on obj, e.g. "tool_input.command". Returns undefined if missing. */
function resolvePath(obj, path) {
  if (!path) return undefined;
  const keys = path.split(".");
  if (keys.some((k) => UNSAFE_KEYS.has(k))) return undefined;
  return keys.reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

/** Set a dot-path on obj. Creates intermediate objects as needed. */
function setPath(obj, path, value) {
  const keys = path.split(".");
  if (keys.some((k) => UNSAFE_KEYS.has(k))) return;
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Delete a dot-path from obj. */
function deletePath(obj, path) {
  const keys = path.split(".");
  if (keys.some((k) => UNSAFE_KEYS.has(k))) return;
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = cur[keys[i]];
  }
  if (cur != null) delete cur[keys[keys.length - 1]];
}

/**
 * Deep-walk a value (string/object/array) and apply a transform to every
 * string leaf. Returns the transformed clone.
 */
function deepTransformStrings(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((v) => deepTransformStrings(v, transform));
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepTransformStrings(v, transform);
    return out;
  }
  return value;
}

/**
 * Apply a regex pattern globally to a string. Returns a [matched, result] pair
 * where matched=true if any replacement was made.
 */
function applyPatternToString(str, regex, action) {
  if (typeof str !== "string") return [false, str];
  let matched = false;
  const result = str.replace(regex, (m) => {
    matched = true;
    if (action === "mask") return maskString(m);
    if (action === "hash") return `[hashed:${stableHash(m)}]`;
    return m; // other actions handled at higher level
  });
  return [matched, result];
}

// ---------------------------------------------------------------------------
// Core: evaluate a single rule against a payload clone
// ---------------------------------------------------------------------------
function applyRule(payload, rule, stats) {
  const { action, field_path, pattern } = rule;

  // high-level whole-payload actions
  if (action === "drop_event_payload") {
    stats.dropped_payload = true;
    return null; // signal: drop the entire data field
  }
  if (action === "preserve_metadata_only") {
    stats.preserved_metadata_only = true;
    return null; // handled by caller
  }

  if (action === "drop_field") {
    if (!field_path) return payload;
    const current = resolvePath(payload, field_path);
    if (current === undefined) return payload;
    stats.redacted_fields.push(field_path);
    deletePath(payload, field_path);
    return payload;
  }

  // mask/hash require an explicit pattern — an empty pattern must never
  // fall back to a wildcard that matches (and redacts) every character.
  if (!pattern) return payload;

  // Build regex (gracefully handle bad patterns)
  let regex;
  try {
    regex = new RegExp(pattern, "g");
  } catch {
    return payload; // bad regex → skip rule
  }

  if (field_path) {
    // Targeted field redaction
    const current = resolvePath(payload, field_path);
    if (current === undefined) return payload;

    const transformed = deepTransformStrings(current, (s) => {
      const [matched, result] = applyPatternToString(s, regex, action);
      if (matched) stats.redacted_fields.push(field_path);
      return result;
    });
    setPath(payload, field_path, transformed);
  } else {
    // Global scan: walk all string values in the payload
    const transformed = deepTransformStrings(payload, (s) => {
      const [matched, result] = applyPatternToString(s, regex, action);
      if (matched) stats.matched_patterns.push(rule.name);
      return result;
    });
    return transformed;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load enabled rules ordered by priority (cached, invalidated on writes). */
let _rulesCache = null;
let _enabledGlobal = null;

function invalidateCache() {
  _rulesCache = null;
  _enabledGlobal = null;
}

function isPrivacyEnabled() {
  if (_enabledGlobal === null) {
    try {
      const row = db.prepare("SELECT value FROM privacy_settings WHERE key='enabled'").get();
      _enabledGlobal = row ? row.value === "1" : true;
    } catch {
      // fail-safe: a transient DB error must not block ingestion or throw
      // out of applyPrivacyPolicy's "never throws" contract. Don't cache
      // the failure — retry on the next call instead of disabling privacy
      // filtering for the rest of the process lifetime.
      return false;
    }
  }
  return _enabledGlobal;
}

function loadRules() {
  if (_rulesCache) return _rulesCache;
  _rulesCache = db
    .prepare("SELECT * FROM privacy_rules WHERE enabled=1 ORDER BY priority ASC, id ASC")
    .all();
  return _rulesCache;
}

/**
 * Apply the active privacy policy to a raw hook payload.
 * Returns { data, privacy_meta } where:
 *   - data: redacted payload (may be null if drop_event_payload triggered)
 *   - privacy_meta: { rules_applied, redacted_fields, matched_patterns, dropped }
 *
 * This function NEVER throws — errors degrade to returning the original payload.
 */
function applyPrivacyPolicy(rawData) {
  const meta = {
    rules_applied: 0,
    redacted_fields: [],
    matched_patterns: [],
    dropped: false,
    preserve_metadata_only: false,
  };

  if (rawData == null) return { data: rawData, privacy_meta: null };
  if (!isPrivacyEnabled()) return { data: rawData, privacy_meta: null };

  let rules;
  try {
    rules = loadRules();
  } catch {
    return { data: rawData, privacy_meta: null };
  }

  if (!rules.length) return { data: rawData, privacy_meta: null };

  // Work on a deep clone to avoid mutating the original
  let payload;
  try {
    payload = rawData == null ? rawData : JSON.parse(JSON.stringify(rawData));
  } catch {
    return { data: rawData, privacy_meta: null };
  }

  const stats = { redacted_fields: [], matched_patterns: [], dropped_payload: false, preserved_metadata_only: false };

  // Whole-payload actions (drop_event_payload / preserve_metadata_only) are
  // applied AFTER every rule has run, not the moment they're encountered.
  // Otherwise a whole-payload rule that happens to sort before a
  // higher-priority-number detector (e.g. the priority-50 email/home-path
  // rules) would short-circuit the loop and skip those detectors entirely,
  // leaking unmasked data in the preserved/whole-payload path.
  for (const rule of rules) {
    try {
      const result = applyRule(payload, rule, stats);
      meta.rules_applied++;
      if (result !== null && !stats.dropped_payload) payload = result;
    } catch {
      // fail-safe: skip this rule
    }
  }

  meta.redacted_fields = [...new Set(stats.redacted_fields)];
  meta.matched_patterns = [...new Set(stats.matched_patterns)];

  if (stats.dropped_payload) {
    meta.dropped = true;
    return { data: null, privacy_meta: meta };
  }
  if (stats.preserved_metadata_only) {
    // Keep only top-level scalar fields (no nested objects/arrays with content).
    // By this point every other rule has already run, so any scalar that
    // matched a mask/hash detector is already redacted.
    const stripped = {};
    if (payload && typeof payload === "object") {
      for (const [k, v] of Object.entries(payload)) {
        if (v === null || typeof v !== "object") stripped[k] = v;
      }
    }
    meta.preserve_metadata_only = true;
    return { data: stripped, privacy_meta: meta };
  }

  return { data: payload, privacy_meta: meta };
}

/**
 * Preview transformation for a sample payload without persisting it.
 * Returns { before, after, privacy_meta }.
 */
function previewPrivacyPolicy(sampleData) {
  const before = sampleData;
  const { data: after, privacy_meta } = applyPrivacyPolicy(sampleData);
  return { before, after, privacy_meta };
}

// ---------------------------------------------------------------------------
// CRUD helpers (used by routes/privacy.js)
// ---------------------------------------------------------------------------
const stmts = {
  listRules: db.prepare("SELECT * FROM privacy_rules ORDER BY priority ASC, id ASC"),
  getRule: db.prepare("SELECT * FROM privacy_rules WHERE id = ?"),
  insertRule: db.prepare(
    "INSERT INTO privacy_rules (name, action, field_path, pattern, enabled, built_in, priority) VALUES (?,?,?,?,?,0,?)"
  ),
  updateRule: db.prepare(
    "UPDATE privacy_rules SET name=?, action=?, field_path=?, pattern=?, enabled=?, priority=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND built_in=0"
  ),
  deleteRule: db.prepare("DELETE FROM privacy_rules WHERE id=? AND built_in=0"),
  toggleRule: db.prepare(
    "UPDATE privacy_rules SET enabled=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?"
  ),
  getSetting: db.prepare("SELECT value FROM privacy_settings WHERE key=?"),
  setSetting: db.prepare(
    "INSERT INTO privacy_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ),
};

module.exports = {
  applyPrivacyPolicy,
  previewPrivacyPolicy,
  invalidateCache,
  isPrivacyEnabled,
  stmts: stmts,
};
