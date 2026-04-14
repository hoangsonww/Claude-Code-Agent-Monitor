/**
 * @file app-config.ts
 * @description Module for loading and validating application configuration from environment variables. This module defines the AppConfig interface representing the configuration structure, along with functions to parse and validate individual configuration values such as booleans, integers, log levels, dashboard URLs, and transport modes. The loadConfig function aggregates all configuration values into a single AppConfig object, applying defaults and validation as needed. The module ensures that the application is configured correctly before it starts, providing clear error messages for invalid configurations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type TransportMode = "stdio" | "http" | "repl";

export interface AppConfig {
  serverName: string;
  serverVersion: string;
  dashboardBaseUrl: URL;
  requestTimeoutMs: number;
  retryCount: number;
  retryBackoffMs: number;
  allowMutations: boolean;
  allowDestructive: boolean;
  logLevel: LogLevel;
  transport: TransportMode;
  httpPort: number;
  httpHost: string;
}

const LOCAL_DASHBOARD_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "host.docker.internal",
  "gateway.docker.internal",
  "host.containers.internal",
]);
const VALID_LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

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

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase() as LogLevel | undefined;
  return normalized && VALID_LOG_LEVELS.has(normalized) ? normalized : "info";
}

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

function parseTransport(value: string | undefined): TransportMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "http" || normalized === "repl" || normalized === "stdio") return normalized;
  return "stdio";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    serverName: env.MCP_SERVER_NAME?.trim() || "agent-dashboard-mcp",
    serverVersion: env.MCP_SERVER_VERSION?.trim() || "1.0.0",
    dashboardBaseUrl: parseDashboardUrl(env.MCP_DASHBOARD_BASE_URL),
    requestTimeoutMs: parseInteger(env.MCP_DASHBOARD_TIMEOUT_MS, 10_000, 500, 120_000),
    retryCount: parseInteger(env.MCP_DASHBOARD_RETRY_COUNT, 2, 0, 5),
    retryBackoffMs: parseInteger(env.MCP_DASHBOARD_RETRY_BACKOFF_MS, 250, 50, 10_000),
    allowMutations: parseBoolean(env.MCP_DASHBOARD_ALLOW_MUTATIONS, false),
    allowDestructive: parseBoolean(env.MCP_DASHBOARD_ALLOW_DESTRUCTIVE, false),
    logLevel: parseLogLevel(env.MCP_LOG_LEVEL),
    transport: parseTransport(env.MCP_TRANSPORT),
    httpPort: parseInteger(env.MCP_HTTP_PORT, 8819, 1, 65535),
    httpHost: env.MCP_HTTP_HOST?.trim() || "127.0.0.1",
  };
}
