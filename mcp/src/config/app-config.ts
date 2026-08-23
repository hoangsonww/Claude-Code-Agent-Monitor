/**
 * @file app-config.ts
 * @description Module for loading and validating application configuration from environment variables. This module defines the AppConfig interface representing the configuration structure, along with functions to parse and validate individual configuration values such as booleans, integers, log levels, dashboard URLs, and transport modes. The loadConfig function aggregates all configuration values into a single AppConfig object, applying defaults and validation as needed. The module ensures that the application is configured correctly before it starts, providing clear error messages for invalid configurations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/config/app-config.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `LogLevel` — exported API; see TSDoc on the symbol for behavior.
 * - `TransportMode` — exported API; see TSDoc on the symbol for behavior.
 * - `AppConfig` — exported API; see TSDoc on the symbol for behavior.
 * - `loadConfig` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */

import fs from "node:fs";
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **LogLevel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TransportMode**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AppConfig**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **loadConfig**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Minimum severity a log line must meet to be written to stderr; see {@link Logger}. */
export type LogLevel = "debug" | "info" | "warn" | "error";
/** Transport `index.ts` starts: `"stdio"` (default, MCP-host subprocess),
 * `"http"` (Streamable HTTP + legacy SSE server), or `"repl"` (interactive CLI). */
export type TransportMode = "stdio" | "http" | "repl";

/**
 * Fully-resolved runtime configuration produced by {@link loadConfig}. Every
 * field has a safe default so the server boots with no env vars set.
 */
export interface AppConfig {
  /** From `MCP_SERVER_NAME`, default `"agent-dashboard-mcp"`. */
  serverName: string;
  /** From `MCP_SERVER_VERSION`, default `"1.0.0"`. */
  serverVersion: string;
  /** Base URL of the local dashboard API {@link DashboardApiClient} calls.
   * Must be http(s) targeting a loopback/local-container host (see
   * {@link parseDashboardUrl}) — a hard boundary against reaching a remote
   * origin. From `MCP_DASHBOARD_BASE_URL`, default `http://127.0.0.1:4820`. */
  dashboardBaseUrl: URL;
  /** Optional bearer token for dashboards started with DASHBOARD_API_TOKEN.
   * Read from MCP_DASHBOARD_API_TOKEN first, then DASHBOARD_API_TOKEN. */
  dashboardApiToken?: string;
  /** Per-attempt timeout (ms) before a request aborts as `TIMEOUT`. From
   * `MCP_DASHBOARD_TIMEOUT_MS`, default `10_000`, clamped `[500, 120_000]`. */
  requestTimeoutMs: number;
  /** Extra attempts after the first for idempotent GET requests on a
   * retryable error (timeout, HTTP 408/429/5xx); writes always run
   * once. From `MCP_DASHBOARD_RETRY_COUNT`, default `2`, clamped `[0, 5]`. */
  retryCount: number;
  /** Base backoff delay (ms), doubled per retry (`* 2^(attempt-1)`). From
   * `MCP_DASHBOARD_RETRY_BACKOFF_MS`, default `250`, clamped `[50, 10_000]`. */
  retryBackoffMs: number;
  /** Master gate for every write tool; `false` makes the server read-only
   * (see `policy/tool-guards.ts`). From `MCP_DASHBOARD_ALLOW_MUTATIONS`,
   * default `false`. */
  allowMutations: boolean;
  /** Gate for `dashboard_clear_all_data` only; requires `allowMutations`
   * too. From `MCP_DASHBOARD_ALLOW_DESTRUCTIVE`, default `false`. */
  allowDestructive: boolean;
  /** From `MCP_LOG_LEVEL`, default `"info"`. */
  logLevel: LogLevel;
  /** Default transport before `index.ts`'s CLI-flag overrides. From
   * `MCP_TRANSPORT`, default `"stdio"`. */
  transport: TransportMode;
  /** HTTP transport bind port (ignored for stdio/repl). From
   * `MCP_HTTP_PORT`, default `8819`, clamped `[1, 65535]`. */
  httpPort: number;
  /** HTTP transport bind host (ignored for stdio/repl). From
   * `MCP_HTTP_HOST`, default `"127.0.0.1"`. */
  httpHost: string;
  /** Optional bearer token for HTTP/SSE clients. Read from
   * `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKEN_FILE`. */
  httpAuthToken?: string;
  /** How long an HTTP/SSE session may sit without a request before the
   * server closes it, reclaiming its `McpServer`. Clients are not required
   * to send `DELETE /mcp` on the way out, so without this a dropped client
   * would hold its session for the life of the process. From
   * `MCP_HTTP_SESSION_TIMEOUT_MS`, default 30 minutes, clamped
   * `[60_000, 86_400_000]`; `0` disables reaping entirely. */
  httpSessionTimeoutMs: number;
}

/** Allowlist of hostnames the dashboard URL may target: loopback addresses
 * plus the special Docker/Podman host-mapping names, so the MCP server can
 * run containerized and still reach a dashboard on the host. Anything else
 * is rejected by {@link parseDashboardUrl}. */
const LOCAL_DASHBOARD_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "host.docker.internal",
  "gateway.docker.internal",
  "host.containers.internal",
  "agent-monitor",
]);
const VALID_LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

/** Parses `1/true/yes/on` / `0/false/no/off` (case-insensitive); anything
 * else, including `undefined`, resolves to `fallback`. */
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/** Parses and clamps an integer env var into `[min, max]`; non-numeric or
 * missing input falls back to `fallback` rather than throwing. */
function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Normalizes `MCP_LOG_LEVEL`, falling back to `"info"`. */
function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase() as LogLevel | undefined;
  return normalized && VALID_LOG_LEVELS.has(normalized) ? normalized : "info";
}

/**
 * Parses and validates `MCP_DASHBOARD_BASE_URL`. Unlike the other parsers
 * here, invalid input throws rather than falling back — an unsafe dashboard
 * target is startup-fatal, not something to paper over.
 * @throws {Error} on an invalid URL, a non-http(s) scheme, or a hostname
 *   outside {@link LOCAL_DASHBOARD_HOSTS}.
 */
function parseDashboardUrl(raw: string | undefined): URL {
  const value = (raw ?? "http://127.0.0.1:4820").trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid MCP_DASHBOARD_BASE_URL: "${value}"`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `MCP_DASHBOARD_BASE_URL must use http or https, received protocol "${url.protocol}"`
    );
  }

  if (!LOCAL_DASHBOARD_HOSTS.has(url.hostname)) {
    throw new Error(
      `MCP_DASHBOARD_BASE_URL must target a local dashboard host (${Array.from(LOCAL_DASHBOARD_HOSTS).join(", ")}). Received hostname "${url.hostname}".`
    );
  }

  return url;
}

function readDashboardToken(env: NodeJS.ProcessEnv): string | undefined {
  const direct = env.MCP_DASHBOARD_API_TOKEN?.trim() || env.DASHBOARD_API_TOKEN?.trim();
  if (direct) return direct;
  const tokenPath =
    env.MCP_DASHBOARD_API_TOKEN_FILE?.trim() || env.DASHBOARD_API_TOKEN_FILE?.trim();
  if (!tokenPath) return undefined;
  try {
    return fs.readFileSync(tokenPath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

function readSecret(
  env: NodeJS.ProcessEnv,
  directName: string,
  fileName: string
): string | undefined {
  const direct = env[directName]?.trim();
  if (direct) return direct;
  const tokenPath = env[fileName]?.trim();
  if (!tokenPath) return undefined;
  try {
    return fs.readFileSync(tokenPath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

function parseDashboardToken(env: NodeJS.ProcessEnv, dashboardBaseUrl: URL): string | undefined {
  const token = readDashboardToken(env);
  if (
    token &&
    dashboardBaseUrl.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "::1", "agent-monitor"].includes(dashboardBaseUrl.hostname)
  ) {
    throw new Error(
      "Dashboard bearer tokens require HTTPS for container-host aliases; plain HTTP is allowed only on direct loopback."
    );
  }
  return token;
}

/** Normalizes `MCP_TRANSPORT`, falling back to `"stdio"`. This is only the
 * default — `index.ts`'s `resolveTransport` may override it with CLI flags. */
function parseTransport(value: string | undefined): TransportMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "http" || normalized === "repl" || normalized === "stdio") return normalized;
  return "stdio";
}

/**
 * Reads and normalizes all `MCP_*` env vars into one {@link AppConfig}.
 * Called once at startup in `index.ts`; the result is treated as immutable.
 * @param env Defaults to `process.env`; injectable for tests.
 * @throws {Error} if `MCP_DASHBOARD_BASE_URL` is set but invalid/non-local.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dashboardBaseUrl = parseDashboardUrl(env.MCP_DASHBOARD_BASE_URL);
  return {
    serverName: env.MCP_SERVER_NAME?.trim() || "agent-dashboard-mcp",
    serverVersion: env.MCP_SERVER_VERSION?.trim() || "1.0.0",
    dashboardBaseUrl,
    dashboardApiToken: parseDashboardToken(env, dashboardBaseUrl),
    requestTimeoutMs: parseInteger(env.MCP_DASHBOARD_TIMEOUT_MS, 10_000, 500, 120_000),
    retryCount: parseInteger(env.MCP_DASHBOARD_RETRY_COUNT, 2, 0, 5),
    retryBackoffMs: parseInteger(env.MCP_DASHBOARD_RETRY_BACKOFF_MS, 250, 50, 10_000),
    allowMutations: parseBoolean(env.MCP_DASHBOARD_ALLOW_MUTATIONS, false),
    allowDestructive: parseBoolean(env.MCP_DASHBOARD_ALLOW_DESTRUCTIVE, false),
    logLevel: parseLogLevel(env.MCP_LOG_LEVEL),
    transport: parseTransport(env.MCP_TRANSPORT),
    httpPort: parseInteger(env.MCP_HTTP_PORT, 8819, 1, 65535),
    httpHost: env.MCP_HTTP_HOST?.trim() || "127.0.0.1",
    httpAuthToken: readSecret(env, "MCP_HTTP_AUTH_TOKEN", "MCP_HTTP_AUTH_TOKEN_FILE"),
    // `0` is an explicit "never reap" opt-out, so it bypasses the clamp.
    httpSessionTimeoutMs:
      env.MCP_HTTP_SESSION_TIMEOUT_MS?.trim() === "0"
        ? 0
        : parseInteger(env.MCP_HTTP_SESSION_TIMEOUT_MS, 1_800_000, 60_000, 86_400_000),
  };
}
