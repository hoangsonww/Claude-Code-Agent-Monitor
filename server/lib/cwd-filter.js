/**
 * @file Ingest-time CWD ignore filter.
 *
 * Reads MONITOR_IGNORE_CWD (comma-separated path patterns) at module-load
 * time and exposes a single predicate that hooks.js calls before writing any
 * event to the database.
 *
 * Supported pattern forms (forward-slash normalised, case-sensitive):
 *   /exact/path     — strict equality
 *   /prefix/*       — direct children only (no deeper nesting)
 *   /prefix/**      — /prefix itself and all descendants
 *
 * See also: .env.example → MONITOR_IGNORE_CWD
 */

"use strict";

/**
 * Build an array of matcher functions from a raw MONITOR_IGNORE_CWD string.
 * Exported so tests can call it with arbitrary input without touching process.env.
 *
 * @param {string} raw - comma-separated pattern string (may be empty / undefined)
 * @returns {Array<(cwd: string) => boolean>}
 */
function buildPatterns(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Normalise Windows backslashes and strip trailing slashes
      const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
      if (norm.endsWith("/**")) {
        const prefix = norm.slice(0, -3);
        return (cwd) => cwd === prefix || cwd.startsWith(prefix + "/");
      }
      if (norm.endsWith("/*")) {
        const prefix = norm.slice(0, -2);
        return (cwd) => {
          if (!cwd.startsWith(prefix + "/")) return false;
          return !cwd.slice(prefix.length + 1).includes("/");
        };
      }
      return (cwd) => cwd === norm;
    });
}

// Patterns compiled once at startup from the live env variable.
const PATTERNS = buildPatterns(process.env.MONITOR_IGNORE_CWD);

/**
 * Returns true when the given working directory matches any configured
 * ignore pattern and the hook event should be silently discarded.
 *
 * @param {unknown} cwd - the cwd field from the hook payload (may be any type)
 * @returns {boolean}
 */
function isCwdIgnored(cwd) {
  if (typeof cwd !== "string" || !cwd || PATTERNS.length === 0) return false;
  const norm = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  return PATTERNS.some((test) => test(norm));
}

module.exports = { isCwdIgnored, buildPatterns };
