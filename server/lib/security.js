/**
 * @file security.js
 * @description Network-exposure hardening for the dashboard server
 * (GHSA-gr74-4xfh-6jw9). The server historically bound 0.0.0.0 with no auth and
 * `cors()` (Access-Control-Allow-Origin: *), exposing transcripts, data export,
 * local-directory reads, ~/.claude writes, and a claude-spawning endpoint to any
 * host on the network. This module centralizes the defenses:
 *
 *   1. Default bind to loopback (127.0.0.1); opt into a wider bind only via the
 *      explicit DASHBOARD_HOST env (with a startup warning).
 *   2. Host-header allowlist — rejects requests whose Host isn't loopback (or an
 *      operator-allowlisted name), which defeats DNS-rebinding drive-bys.
 *   3. CORS restricted to loopback origins (no more `*`).
 *   4. An OPTIONAL bearer token (DASHBOARD_TOKEN) gating /api/* and the
 *      WebSocket — for operators who deliberately bind to a LAN. Off by default
 *      so the zero-config loopback experience is unchanged.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const crypto = require("node:crypto");
const fs = require("node:fs");

// Hostnames that count as "this machine". "0.0.0.0" is included because a
// browser may resolve a 0.0.0.0 bind via localhost; an empty Host is treated as
// loopback (HTTP/1.0 / local tooling).
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", ""]);

/** The interface to bind. Loopback unless the operator opts into a wider bind. */
function resolveHost() {
  const h = (process.env.DASHBOARD_HOST || "").trim();
  return h || "127.0.0.1";
}

function isLoopbackHostname(name) {
  return LOOPBACK_HOSTS.has(String(name || "").toLowerCase());
}

/** Extra Host-header names the operator allows (set when binding to a LAN). */
function allowedHostnames() {
  const configured = (process.env.DASHBOARD_ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const podIp = (process.env.POD_IP || "").trim().toLowerCase();
  return podIp ? [...new Set([...configured, podIp])] : configured;
}

/** Strip the port from a Host header, preserving bracketed IPv6 literals. */
function hostnameOf(hostHeader) {
  const h = String(hostHeader || "");
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end >= 0 ? h.slice(0, end + 1).toLowerCase() : h.toLowerCase();
  }
  return h.split(":")[0].toLowerCase();
}

function isHostAllowed(hostHeader) {
  const name = hostnameOf(hostHeader);
  return isLoopbackHostname(name) || allowedHostnames().includes(name);
}

/**
 * Express middleware: reject requests whose Host header isn't loopback (or an
 * operator-allowlisted name). This is the primary defense against DNS-rebinding
 * — a rebound attacker domain arrives with its own Host (e.g. evil.example) and
 * is refused even though the TCP connection is local→local.
 */
function hostGuard(req, res, next) {
  if (isHostAllowed(req.headers.host)) return next();
  return res.status(403).json({ error: { code: "EBADHOST", message: "host not allowed" } });
}

/**
 * CORS options: allow same-origin / no-Origin (curl, the server's own client)
 * and loopback origins; refuse everything else (so a cross-origin page cannot
 * read responses). Credentials stay off — the API is token- or trust-gated, not
 * cookie-authed.
 */
function corsOptions() {
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      try {
        const u = new URL(origin);
        if (
          isLoopbackHostname(u.hostname) ||
          allowedHostnames().includes(u.hostname.toLowerCase())
        ) {
          return cb(null, true);
        }
      } catch {
        /* malformed Origin → treat as disallowed */
      }
      return cb(null, false);
    },
    credentials: false,
  };
}

function readSecret(envName, fileEnvName) {
  const direct = process.env[envName];
  if (typeof direct === "string" && direct.trim().length > 0) return direct.trim();
  const filePath = process.env[fileEnvName];
  if (typeof filePath !== "string" || filePath.trim().length === 0) return null;
  try {
    const value = fs.readFileSync(filePath.trim(), "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

/** The configured dashboard auth token, or null when auth is disabled. */
function getDashboardToken() {
  return readSecret("DASHBOARD_TOKEN", "DASHBOARD_TOKEN_FILE");
}

/** Optional independent token for remote hook ingestion. */
function getHookToken() {
  return readSecret("DASHBOARD_HOOK_TOKEN", "DASHBOARD_HOOK_TOKEN_FILE");
}

function tokensMatch(provided, expected) {
  if (typeof provided !== "string" || provided.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  const header = req.headers["x-dashboard-token"];
  if (typeof header === "string" && header) return header;
  if (req.query && typeof req.query.token === "string") return req.query.token;
  return null;
}

function extractHookToken(req) {
  const hookHeader = req.headers["x-ccam-hook-token"];
  if (typeof hookHeader === "string" && hookHeader) return hookHeader;
  return extractToken(req);
}

// API subpaths exempt from the token gate even when a token is set:
//   /health, /openapi.json, /docs — harmless metadata / docs.
//   /hooks  — local Claude Code hook ingestion (the hook handler posts to
//             loopback and carries no token); loopback bind already protects it.
const TOKEN_EXEMPT_PREFIXES = ["/health", "/openapi.json", "/docs", "/hooks"];

/**
 * Express middleware (mount at "/api"): when DASHBOARD_TOKEN is set, require a
 * matching bearer token on every API route except the exempt prefixes. A no-op
 * when no token is configured — preserving the zero-config loopback default.
 */
function tokenGuard(req, res, next) {
  const expected = getDashboardToken();
  if (!expected) return next();
  if (TOKEN_EXEMPT_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"))) {
    return next();
  }
  if (tokensMatch(extractToken(req), expected)) return next();
  return res
    .status(401)
    .json({ error: { code: "EUNAUTHORIZED", message: "missing or invalid dashboard token" } });
}

/**
 * Hook-ingest middleware. Local deployments remain zero-config, but when a
 * dedicated hook token is configured every Claude Code/Codex hook POST must
 * carry it. This lets a cloud ingress expose hook endpoints without reusing the
 * browser/API token.
 */
function hookGuard(req, res, next) {
  const expected = getHookToken();
  if (!expected) return next();
  if (tokensMatch(extractHookToken(req), expected)) return next();
  return res
    .status(401)
    .json({ error: { code: "EUNAUTHORIZED", message: "missing or invalid hook token" } });
}

/**
 * WebSocket upgrade auth. When a token is configured, the client must pass it as
 * `?token=` (or an x-dashboard-token header). No-op when auth is disabled.
 */
function isWebSocketAuthorized(req) {
  const expected = getDashboardToken();
  if (!expected) return true;
  try {
    const u = new URL(req.url, "http://localhost");
    if (tokensMatch(u.searchParams.get("token"), expected)) return true;
  } catch {
    /* fall through */
  }
  const header = req.headers["x-dashboard-token"];
  if (typeof header === "string" && tokensMatch(header, expected)) return true;
  return false;
}

module.exports = {
  LOOPBACK_HOSTS,
  resolveHost,
  isLoopbackHostname,
  allowedHostnames,
  hostnameOf,
  isHostAllowed,
  hostGuard,
  corsOptions,
  getDashboardToken,
  getHookToken,
  tokenGuard,
  hookGuard,
  isWebSocketAuthorized,
  // exported for tests
  tokensMatch,
  extractToken,
  extractHookToken,
};
