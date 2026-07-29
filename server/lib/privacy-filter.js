/**
 * @file privacy-filter.js
 * @description Server-side payload redaction for hook event ingestion.
 *
 * Scans event data objects recursively and masks values that match built-in
 * secret-detection patterns before they are written to SQLite or broadcast over
 * WebSocket. Behaviour is opt-in: redaction runs only when
 * MONITOR_PRIVACY_REDACT=true is set in the environment.
 *
 * Exported:
 *   redactPayload(data)   → { data: redactedCopy, redactedCount: number }
 *   PATTERNS              (array, exported for tests)
 *   isRedactionEnabled()  → boolean
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const MASK = "[REDACTED]";

/**
 * Each entry: { name, pattern, scan }
 *   name    – human-readable label surfaced in redaction metadata
 *   pattern – RegExp; when scan:true the pattern is tested against the full
 *             string value (substring match); when scan:false the trimmed value
 *             must match the whole pattern (^...$).
 */
const PATTERNS = [
  // Private / public key blocks
  {
    name: "pem-private-key",
    scan: true,
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  // Generic secret-looking assignments  (FOO=sk-..., "api_key": "...")
  {
    name: "api-key-generic",
    scan: true,
    // eslint-disable-next-line no-useless-escape
    pattern:
      /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_\-\.]{16,}/i,
  },
  // OpenAI / Anthropic / common SDK key prefixes
  {
    name: "sdk-key-prefix",
    scan: false,
    // eslint-disable-next-line no-useless-escape
    pattern:
      /^(?:sk-[A-Za-z0-9\-_]{16,}|sk-ant-[A-Za-z0-9\-_]{16,}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|xoxb-[0-9]+-[A-Za-z0-9]+|xoxp-[0-9]+-[A-Za-z0-9]+|AIza[A-Za-z0-9_\-]{35,}|ya29\.[A-Za-z0-9_\-]+)$/,
  },
  // Bearer tokens in header-like strings
  {
    name: "bearer-token",
    scan: true,
    pattern: /\bBearer\s+[A-Za-z0-9\-_\.~+/]+=*/i,
  },
  // AWS access key IDs
  {
    name: "aws-key",
    scan: false,
    pattern: /^(?:AKIA|ASIA|AROA|AIPA|ANPA|ANVA|APKA)[A-Z0-9]{16}$/,
  },
  // Passwords / tokens in URL credentials  (user:pass@host)
  {
    name: "url-credentials",
    scan: true,
    pattern: /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^@\s/]+:[^@\s/]+@/,
  },
];

/** Returns true when MONITOR_PRIVACY_REDACT=true (case-insensitive). */
function isRedactionEnabled() {
  return (process.env.MONITOR_PRIVACY_REDACT || "").toLowerCase() === "true";
}

// Structural fields that must never be redacted — they are routing keys used
// by hooks.js and the database layer after this filter runs.
const PRESERVED_KEYS = new Set(["session_id", "hook_event_id", "cwd", "transcript_path"]);

/**
 * Test a single string value against all patterns.
 * Returns the name of the first matching pattern, or null.
 */
function matchSecret(value) {
  if (typeof value !== "string" || value.length < 8) return null;
  // Trim once here rather than inside each scan:false pattern.
  const trimmed = value.trim();
  for (const { name, pattern, scan } of PATTERNS) {
    if (scan ? pattern.test(value) : pattern.test(trimmed)) return name;
  }
  return null;
}

/**
 * Deep-clone `obj`, replacing string values that match a secret pattern with
 * MASK. Structural routing fields listed in PRESERVED_KEYS are never touched.
 *
 * @param {*} obj Value to scan (any JSON-compatible type)
 * @param {number} [counter=0] Running count of redactions (internal)
 * @returns {{ value: *, count: number }}
 */
function _redact(obj, counter = 0) {
  if (obj === null || obj === undefined) return { value: obj, count: counter };

  if (typeof obj === "string") {
    const hit = matchSecret(obj);
    if (hit) return { value: MASK, count: counter + 1 };
    return { value: obj, count: counter };
  }

  if (Array.isArray(obj)) {
    let count = counter;
    const arr = obj.map((item) => {
      const r = _redact(item, count);
      count = r.count;
      return r.value;
    });
    return { value: arr, count };
  }

  if (typeof obj === "object") {
    let count = counter;
    const out = {};
    for (const [key, val] of Object.entries(obj)) {
      if (PRESERVED_KEYS.has(key)) {
        out[key] = val;
        continue;
      }
      const r = _redact(val, count);
      count = r.count;
      out[key] = r.value;
    }
    return { value: out, count };
  }

  return { value: obj, count: counter };
}

/**
 * Redact a hook event data object.
 *
 * @param {object} data Raw event payload from req.body.data
 * @returns {{ data: object, redactedCount: number }}
 */
function redactPayload(data) {
  if (!data || typeof data !== "object") return { data, redactedCount: 0 };
  const { value, count } = _redact(data);
  return { data: value, redactedCount: count };
}

module.exports = { redactPayload, isRedactionEnabled, PATTERNS, MASK };
