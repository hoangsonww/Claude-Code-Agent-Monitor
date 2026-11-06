/**
 * @file HTTP client for the ccam CLI: dashboard URL resolution, bearer-token
 * auth, JSON request helpers, raw fetches (binary downloads, multipart
 * uploads, Prometheus text), and the health probe.
 *
 * URL resolution order: --server / CCAM_URL (a full base URL, e.g. a dashboard
 * behind a reverse proxy), then an explicit CLAUDE_DASHBOARD_PORT /
 * DASHBOARD_PORT (matching the hook handler's contract), then the live-server
 * discovery file .agent-dashboard.json (PID-liveness-checked on
 * read), then the default http://127.0.0.1:4820.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const path = require("node:path");
const { REPO_ROOT, state, ApiError, CliError, ServerDownError } = require("./runtime");

/** Resolve the dashboard base URL (no trailing slash). */
function baseUrl() {
  const explicit = state.url || process.env.CCAM_URL;
  if (explicit) return String(explicit).replace(/\/+$/, "");
  const envPort = process.env.CLAUDE_DASHBOARD_PORT || process.env.DASHBOARD_PORT;
  if (envPort) return `http://127.0.0.1:${envPort}`;
  try {
    const { resolveDashboardPort } = require(
      path.join(REPO_ROOT, "server", "lib", "server-info.js")
    );
    const port = resolveDashboardPort();
    if (port) return `http://127.0.0.1:${port}`;
  } catch {
    /* discovery unavailable — fall through to the default */
  }
  return "http://127.0.0.1:4820";
}

/** The API token, when the dashboard is protected by DASHBOARD_API_TOKEN. */
function apiToken() {
  return state.token || process.env.DASHBOARD_API_TOKEN || process.env.CCAM_API_TOKEN || null;
}

function authHeaders() {
  const token = apiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** An AbortSignal.timeout() rejection — the server answered too slowly,
 *  which is not the same as it being down (no offline fallback applies). */
const isTimeout = (err) => err?.name === "TimeoutError";

function timeoutError(method, pathname, timeoutMs) {
  return new CliError(`${method} ${pathname} timed out after ${Math.round(timeoutMs / 1000)} s`, {
    code: "TIMEOUT",
    hints: ["The server is reachable but slow to respond — retry, or check `ccam logs`."],
  });
}

/**
 * Low-level fetch against the dashboard. A timeout becomes a TIMEOUT
 * CliError; any other network failure (nothing listening, DNS, reset) becomes
 * ServerDownError; HTTP errors are returned to the caller.
 */
async function rawFetch(pathname, init = {}, timeoutMs = 30_000) {
  try {
    return await fetch(`${baseUrl()}${pathname}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isTimeout(err)) throw timeoutError(init.method || "GET", pathname, timeoutMs);
    throw new ServerDownError();
  }
}

/** Parse a response body as JSON when possible, else keep the raw text. */
async function readBody(res) {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Perform an API request and return the parsed body. Throws ServerDownError
 * when the server is down and ApiError on a non-2xx response.
 */
async function api(method, pathname, body, { timeoutMs = 30_000 } = {}) {
  const res = await rawFetch(
    pathname,
    {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    timeoutMs
  );
  let data;
  try {
    data = await readBody(res);
  } catch (err) {
    // The timeout signal also covers streaming the body.
    if (isTimeout(err)) throw timeoutError(method, pathname, timeoutMs);
    throw err;
  }
  if (!res.ok) throw new ApiError(method, pathname, res.status, data);
  return data;
}

const get = (p, o) => api("GET", p, undefined, o);
const post = (p, b, o) => api("POST", p, b, o);
const put = (p, b, o) => api("PUT", p, b, o);
const patch = (p, b, o) => api("PATCH", p, b, o);
const del = (p, b, o) => api("DELETE", p, b, o);

/** True when the dashboard answers /api/health at the resolved URL. */
async function serverIsUp(timeoutMs = 2_500) {
  try {
    const res = await fetch(`${baseUrl()}/api/health`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Build a query string from an object, skipping empty values. */
function qs(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) {
      for (const item of v) q.append(k, String(item));
    } else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Path segment encoder shorthand. */
const enc = (s) => encodeURIComponent(String(s));

/** The browser's timezone offset convention, sent so "today" matches the UI. */
const tzOffset = () => new Date().getTimezoneOffset();

module.exports = {
  baseUrl,
  apiToken,
  authHeaders,
  rawFetch,
  readBody,
  api,
  get,
  post,
  put,
  patch,
  del,
  serverIsUp,
  qs,
  enc,
  tzOffset,
};
