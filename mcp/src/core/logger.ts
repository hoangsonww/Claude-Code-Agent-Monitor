/**
 * @file logger.ts
 * @description Logger class for the MCP application, responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The logger respects a minimum log level configuration and includes timestamps in ISO format. Each log entry is a single line of JSON containing the timestamp, log level, message, and optional metadata. This structured logging approach allows for easy parsing and analysis of logs. The Logger class provides methods for each log level and a private method to handle the actual writing of log entries to stderr.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/core/logger.ts`
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
 * ## Internal dependencies
 * - `../config/app-config.js`
 *
 * ## Public surface
 * - `Logger` — exported API; see TSDoc on the symbol for behavior.
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
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **Logger**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { LogLevel } from "../config/app-config.js";

/** Numeric severity ranking; higher is more severe. */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Structured JSON logger for the MCP process. Every entry is one
 * newline-terminated JSON object written to **stderr**, never stdout — for
 * the stdio transport, stdout is the MCP JSON-RPC channel, so logging there
 * would corrupt the protocol stream. One instance is shared process-wide via
 * {@link ToolContext} and {@link DashboardApiClient}.
 */
export class Logger {
  /** @param minLevel Minimum severity written; lower calls are dropped.
   * Sourced from `AppConfig.logLevel` (`MCP_LOG_LEVEL`, default `"info"`). */
  constructor(private readonly minLevel: LogLevel) {}

  /** Per-call tracing, e.g. tool invocation start/completion; silent unless
   * `MCP_LOG_LEVEL=debug`. */
  debug(message: string, meta?: Record<string, unknown>) {
    this.write("debug", message, meta);
  }

  /** Default-visible lifecycle events (server started, new session opened). */
  info(message: string, meta?: Record<string, unknown>) {
    this.write("info", message, meta);
  }

  /** Recoverable/transient issues, e.g. a retried dashboard API request. */
  warn(message: string, meta?: Record<string, unknown>) {
    this.write("warn", message, meta);
  }

  /** Aborted operations, e.g. a thrown tool handler or unhandled rejection. */
  error(message: string, meta?: Record<string, unknown>) {
    this.write("error", message, meta);
  }

  /** Writes one entry if `level` meets {@link minLevel}; `meta` is included
   * only when non-empty. */
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    });
    process.stderr.write(`${line}\n`);
  }
}
