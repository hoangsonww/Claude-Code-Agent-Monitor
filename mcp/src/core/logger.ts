/**
 * @file logger.ts
 * @description Logger class for the MCP application, responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The logger respects a minimum log level configuration and includes timestamps in ISO format. Each log entry is a single line of JSON containing the timestamp, log level, message, and optional metadata. This structured logging approach allows for easy parsing and analysis of logs. The Logger class provides methods for each log level and a private method to handle the actual writing of log entries to stderr.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/core/logger.ts
 * **Area:** MCP server
 * **Responsibility:**
 * Logger class for the MCP application, responsible for logging messages in JSON format to stderr
 * with different log levels (debug, info, warn, error). The logger respects a minimum log level
 * configuration and includes timestamps in ISO format. Each log entry is a single line of JSON
 * containing the timestamp, log level, message, and optional metadata. This structured logging
 * approach allows for easy parsing and analysis of logs. The Logger class provides methods for each
 * log level and a private method to handle the actual writing of log entries to stderr.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Local dependency edges
 * - `../config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Public surface
 * - `Logger` (class) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `LEVEL_ORDER` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Logger` (class) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/core/logger.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
   * `MCP_LOG_LEVEL=debug`.
   *
   * @param message - Log message.
   * @param meta - Optional structured fields, included when non-empty.
   */
  debug(message: string, meta?: Record<string, unknown>) {
    this.write("debug", message, meta);
  }

  /**
   * Default-visible lifecycle events (server started, new session opened).
   *
   * @param message - Log message.
   * @param meta - Optional structured fields, included when non-empty.
   */
  info(message: string, meta?: Record<string, unknown>) {
    this.write("info", message, meta);
  }

  /**
   * Recoverable/transient issues, e.g. a retried dashboard API request.
   *
   * @param message - Log message.
   * @param meta - Optional structured fields, included when non-empty.
   */
  warn(message: string, meta?: Record<string, unknown>) {
    this.write("warn", message, meta);
  }

  /**
   * Aborted operations, e.g. a thrown tool handler or unhandled rejection.
   *
   * @param message - Log message.
   * @param meta - Optional structured fields, included when non-empty.
   */
  error(message: string, meta?: Record<string, unknown>) {
    this.write("error", message, meta);
  }

  /** Writes one entry if `level` meets {@link minLevel}; `meta` is included
   * only when non-empty.
   *
   * @param level - Severity of the entry.
   * @param message - Log message.
   * @param meta - Optional structured fields.
   */
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
