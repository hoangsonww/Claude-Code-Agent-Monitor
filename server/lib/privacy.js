/**
 * @file Ingest-time privacy redaction for hook/event payloads. Applies a
 * configurable policy before event `data` is written to SQLite so secrets,
 * tokens, emails, and home-directory paths can be masked without breaking
 * session/agent/token processing (which continues to use the raw in-memory
 * payload). Fail-safe: redactor errors never throw out of the hook path.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("node:crypto");
const os = require("node:os");

/** Secret-like JSON key names (matches Claude Config Explorer redaction). */
const SECRET_KEY_RE =
  /token|secret|password|api[_-]?key|auth|authorization|credential|private[_-]?key/i;

/** Common secret value shapes scanned inside nested strings. */
const SECRET_VALUE_PATTERNS = [
  // Anthropic / OpenAI-style API keys
  /\bsk-ant-[A-Za-z0-9_\-]{16,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  // GitHub PATs / tokens
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9]{20,}\b/g,
  // Slack tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  // AWS access key ids
  /\bAKIA[0-9A-Z]{16}\b/g,
  // Bearer headers embedded in strings
  /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}/gi,
  // PEM private key blocks
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
];

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const REDACTED = "<redacted>";
const MAX_DEPTH = 32;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  redact_secret_keys: true,
  redact_secret_values: true,
  redact_emails: false,
  hash_home_paths: false,
});

let settingsCache = null;
let stmtsRef = null;

/**
 * Bind prepared statements from db.js. Called once at module load from routes
 * or lazily on first get/set. Keeping this injectable makes unit tests easy.
 */
function bindStmts(stmts) {
  stmtsRef = stmts;
  settingsCache = null;
}

function invalidateCache() {
  settingsCache = null;
}

function normalizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: src.enabled !== false && src.enabled !== 0,
    redact_secret_keys: src.redact_secret_keys !== false && src.redact_secret_keys !== 0,
    redact_secret_values: src.redact_secret_values !== false && src.redact_secret_values !== 0,
    redact_emails: src.redact_emails === true || src.redact_emails === 1,
    hash_home_paths: src.hash_home_paths === true || src.hash_home_paths === 1,
  };
}

function rowToSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return normalizeSettings(row);
}

function ensureStmts() {
  if (stmtsRef) return stmtsRef;
  try {
    const { stmts } = require("../db");
    stmtsRef = stmts;
    return stmtsRef;
  } catch {
    return null;
  }
}

/** Load privacy settings (cached). Falls back to defaults when DB unavailable. */
function getPrivacySettings() {
  if (settingsCache) return settingsCache;
  const stmts = ensureStmts();
  if (!stmts || !stmts.getPrivacySettings) {
    settingsCache = { ...DEFAULT_SETTINGS };
    return settingsCache;
  }
  try {
    const row = stmts.getPrivacySettings.get();
    settingsCache = rowToSettings(row);
  } catch {
    settingsCache = { ...DEFAULT_SETTINGS };
  }
  return settingsCache;
}

/**
 * Persist privacy settings. Partial updates merge over current values.
 * Returns the normalized settings that were saved.
 */
function setPrivacySettings(partial) {
  const current = getPrivacySettings();
  const next = normalizeSettings({ ...current, ...(partial || {}) });
  const stmts = ensureStmts();
  if (stmts && stmts.upsertPrivacySettings) {
    stmts.upsertPrivacySettings.run(
      next.enabled ? 1 : 0,
      next.redact_secret_keys ? 1 : 0,
      next.redact_secret_values ? 1 : 0,
      next.redact_emails ? 1 : 0,
      next.hash_home_paths ? 1 : 0
    );
  }
  settingsCache = next;
  return next;
}

function homePrefixes() {
  const prefixes = new Set();
  try {
    const home = os.homedir();
    if (home) {
      prefixes.add(home);
      // Also cover /Users/<name> vs /home/<name> style when HOME differs
      const base = home.replace(/\/+$/, "");
      prefixes.add(base);
    }
  } catch {
    /* ignore */
  }
  // Common absolute home roots on Unix / macOS for path hashing even when
  // the process home isn't the path embedded in a payload (e.g. imported
  // history from another machine still shows /Users/<name>/...).
  return [...prefixes].filter(Boolean).sort((a, b) => b.length - a.length);
}

function hashHomePath(str, prefixes) {
  if (typeof str !== "string" || !str) return { value: str, changed: false };
  let out = str;
  let changed = false;
  for (const prefix of prefixes) {
    if (!prefix) continue;
    // Match prefix at start or after whitespace / quotes / equals
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[\\s"'=\`])${escaped}(?=[/\\\\]|$)`, "g");
    const next = out.replace(re, (match, lead) => {
      const digest = crypto.createHash("sha256").update(prefix).digest("hex").slice(0, 12);
      changed = true;
      return `${lead}~/<home:${digest}>`;
    });
    out = next;
  }
  return { value: out, changed };
}

function redactStringValue(str, settings, prefixes, meta) {
  if (typeof str !== "string" || str.length === 0) return str;
  let out = str;
  let changed = false;

  if (settings.redact_secret_values) {
    for (const re of SECRET_VALUE_PATTERNS) {
      // Reset lastIndex for global regexes reused across calls
      re.lastIndex = 0;
      if (re.test(out)) {
        re.lastIndex = 0;
        out = out.replace(re, REDACTED);
        changed = true;
        meta.rules_applied += 1;
      }
    }
  }

  if (settings.redact_emails) {
    EMAIL_RE.lastIndex = 0;
    if (EMAIL_RE.test(out)) {
      EMAIL_RE.lastIndex = 0;
      out = out.replace(EMAIL_RE, REDACTED);
      changed = true;
      meta.rules_applied += 1;
    }
  }

  if (settings.hash_home_paths) {
    const hashed = hashHomePath(out, prefixes);
    if (hashed.changed) {
      out = hashed.value;
      changed = true;
      meta.rules_applied += 1;
    }
  }

  if (changed) meta.fields_redacted += 1;
  return out;
}

/**
 * Deep-walk a value applying the active policy. Mutates `meta` counters.
 * Returns a new structure (does not mutate the input).
 */
function walk(value, settings, prefixes, meta, depth, keyHint) {
  if (depth > MAX_DEPTH) return value;

  if (typeof value === "string") {
    // Key-name redaction: replace the whole string when the parent key looks secret
    if (settings.redact_secret_keys && keyHint && SECRET_KEY_RE.test(keyHint)) {
      meta.rules_applied += 1;
      meta.fields_redacted += 1;
      return REDACTED;
    }
    return redactStringValue(value, settings, prefixes, meta);
  }

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, settings, prefixes, meta, depth + 1, null));
  }

  if (value && typeof value === "object") {
    // Preserve Date / Buffer-like by treating unknowns as opaque
    if (Object.getPrototypeOf(value) !== Object.prototype && !(value instanceof Object)) {
      return value;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Never recurse into our own metadata key if re-processing
      if (k === "_privacy") {
        out[k] = v;
        continue;
      }
      if (settings.redact_secret_keys && SECRET_KEY_RE.test(k) && typeof v === "string") {
        out[k] = REDACTED;
        meta.rules_applied += 1;
        meta.fields_redacted += 1;
        continue;
      }
      if (settings.redact_secret_keys && SECRET_KEY_RE.test(k) && v && typeof v === "object") {
        // Drop nested secret objects to a redacted marker rather than walking
        // (avoids leaking nested values under keys like `auth` / `credentials`)
        out[k] = REDACTED;
        meta.rules_applied += 1;
        meta.fields_redacted += 1;
        meta.fields_dropped += 1;
        continue;
      }
      out[k] = walk(v, settings, prefixes, meta, depth + 1, k);
    }
    return out;
  }

  return value;
}

/**
 * Apply the privacy policy to an event payload destined for SQLite.
 * Returns `{ data, meta }` where `data` is safe to persist. Never throws.
 *
 * @param {*} payload Raw event data (typically an object from a hook).
 * @param {object} [settingsOverride] Optional settings (for preview / tests).
 */
function redactForStorage(payload, settingsOverride) {
  const settings = normalizeSettings(settingsOverride || getPrivacySettings());
  const meta = {
    redacted: false,
    rules_applied: 0,
    fields_redacted: 0,
    fields_dropped: 0,
    error: false,
  };

  if (!settings.enabled) {
    return { data: payload, meta, settings };
  }

  // null / undefined / primitives: still scan strings
  try {
    const prefixes = settings.hash_home_paths ? homePrefixes() : [];
    let data = walk(payload, settings, prefixes, meta, 0, null);
    meta.redacted = meta.rules_applied > 0 || meta.fields_redacted > 0 || meta.fields_dropped > 0;

    if (meta.redacted && data && typeof data === "object" && !Array.isArray(data)) {
      data = {
        ...data,
        _privacy: {
          redacted: true,
          rules_applied: meta.rules_applied,
          fields_redacted: meta.fields_redacted,
          fields_dropped: meta.fields_dropped,
        },
      };
    } else if (meta.redacted) {
      // Primitive / array payloads: wrap so metadata is retained
      data = {
        value: data,
        _privacy: {
          redacted: true,
          rules_applied: meta.rules_applied,
          fields_redacted: meta.fields_redacted,
          fields_dropped: meta.fields_dropped,
        },
      };
    }

    return { data, meta, settings };
  } catch (err) {
    // Conservative fail-safe: drop the payload contents rather than store secrets
    return {
      data: {
        _privacy: {
          redacted: true,
          error: true,
          message: err && err.message ? String(err.message).slice(0, 200) : "redaction_failed",
        },
      },
      meta: { ...meta, redacted: true, error: true, rules_applied: meta.rules_applied + 1 },
      settings,
    };
  }
}

/**
 * JSON-stringify a payload after applying the active privacy policy.
 * Drop-in replacement for `JSON.stringify(eventData)` at insert sites.
 */
function serializeEventData(payload, settingsOverride) {
  const { data } = redactForStorage(payload, settingsOverride);
  if (data == null) return null;
  return JSON.stringify(data);
}

/**
 * Preview redaction without persisting anything. Returns before/after + meta.
 */
function previewRedaction(payload, settingsOverride) {
  const settings = normalizeSettings(settingsOverride || getPrivacySettings());
  const { data, meta } = redactForStorage(payload, settings);
  return {
    settings,
    before: payload,
    after: data,
    meta,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  SECRET_KEY_RE,
  SECRET_VALUE_PATTERNS,
  REDACTED,
  bindStmts,
  invalidateCache,
  normalizeSettings,
  getPrivacySettings,
  setPrivacySettings,
  redactForStorage,
  serializeEventData,
  previewRedaction,
};
