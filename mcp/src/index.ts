/**
 * @file index.ts
 * @description The main entry point for the MCP application, responsible for initializing the server, loading configuration, setting up logging, and starting the appropriate transport based on configuration or command-line arguments. The application supports multiple transport modes (stdio, http, repl) and includes graceful shutdown handling. It also collects tools and registers them with the server when using HTTP or REPL transports. The main function orchestrates the startup process and ensures that any unhandled errors are logged before exiting.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/index.ts`
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
 * - `./clients/dashboard-api-client.js`
 * - `./config/app-config.js`
 * - `./core/logger.js`
 * - `./server.js`
 * - `./transports/http-server.js`
 * - `./transports/repl.js`
 * - `./transports/tool-collector.js`
 * - `./ui/banner.js`
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

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DashboardApiClient } from "./clients/dashboard-api-client.js";
import { loadConfig, type TransportMode } from "./config/app-config.js";
import { Logger } from "./core/logger.js";
import { buildServer } from "./server.js";
import { startHttpServer } from "./transports/http-server.js";
import { startRepl, toolDomain } from "./transports/repl.js";
import { collectAllTools } from "./transports/tool-collector.js";
import { printBanner, printServerInfo, printReady, printShutdown } from "./ui/banner.js";

/**
 * Determines the final {@link TransportMode}, letting CLI flags override the
 * `MCP_TRANSPORT` env value passed as `env`. Priority: explicit
 * `--transport=<mode>`, then bare `--repl`/`--http`, then `env`. An
 * unrecognized `--transport=` value falls through rather than throwing.
 */
function resolveTransport(env: TransportMode): TransportMode {
  const cliArg = process.argv.find((a) => a.startsWith("--transport="));
  if (cliArg) {
    const val = cliArg.split("=")[1]?.toLowerCase();
    if (val === "stdio" || val === "http" || val === "repl") return val;
  }
  if (process.argv.includes("--repl")) return "repl";
  if (process.argv.includes("--http")) return "http";
  return env;
}

/**
 * Process entry point. Loads config, resolves the transport, and starts one
 * of three modes: **stdio** (default) — one `McpServer` via
 * {@link buildServer} over `StdioServerTransport`, how an MCP host like
 * Claude Code talks to this process, no console UI since stdout is the
 * JSON-RPC channel; **http** — {@link startHttpServer} builds a fresh
 * `McpServer` per client session; **repl** — tags each
 * {@link collectAllTools} tool with its domain and hands off to
 * {@link startRepl}, which owns the lifecycle from there (this function
 * returns immediately, skipping the signal setup below).
 *
 * For stdio/http, installs `SIGINT`/`SIGTERM` handlers invoking the
 * transport's `shutdownFn`, plus `unhandledRejection`/`uncaughtException`
 * handlers logging via {@link Logger} — the latter sets `process.exitCode = 1`
 * without exiting immediately, letting in-flight work finish.
 */
async function main() {
  const config = loadConfig();
  const transport = resolveTransport(config.transport);
  const logger = new Logger(config.logLevel);
  const api = new DashboardApiClient(config, logger);

  let shutdownFn: (() => Promise<void>) | undefined;

  // ── stdio mode (default, backward compatible) ───────────────
  if (transport === "stdio") {
    const server = buildServer(config, api, logger);
    const stdioTransport = new StdioServerTransport();

    await server.connect(stdioTransport);

    logger.info("Agent Dashboard MCP server started", {
      serverName: config.serverName,
      serverVersion: config.serverVersion,
      dashboardBaseUrl: config.dashboardBaseUrl.toString(),
      allowMutations: config.allowMutations,
      allowDestructive: config.allowDestructive,
      transport: "stdio",
    });

    shutdownFn = async () => {
      await stdioTransport.close?.();
      await server.close();
    };
  }

  // ── HTTP mode (SSE + Streamable HTTP) ───────────────────────
  else if (transport === "http") {
    const toolEntries = collectAllTools(config, api, logger);
    const { shutdown } = await startHttpServer(
      config,
      () => {
        const s = buildServer(config, api, logger);
        return s;
      },
      logger,
      toolEntries.length
    );
    shutdownFn = shutdown;
  }

  // ── REPL mode (interactive CLI) ─────────────────────────────
  else if (transport === "repl") {
    const toolEntries = collectAllTools(config, api, logger);
    const replTools = toolEntries.map((t) => ({
      ...t,
      domain: toolDomain(t.name),
    }));
    await startRepl(config, api, logger, replTools);
    return; // REPL handles its own lifecycle
  }

  // ── Graceful shutdown ───────────────────────────────────────
  const onSignal = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    if (transport !== "stdio") printShutdown();
    await shutdownFn?.();
    process.exit(0);
  };

  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message });
    process.exitCode = 1;
  });
}

// Top-level guard for startup failures (e.g. loadConfig() rejecting an
// invalid MCP_DASHBOARD_BASE_URL). Hand-writes one Logger.error-shaped JSON
// line to stderr, since no Logger instance may exist yet, then exits non-zero.
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        level: "error",
        message: "Fatal startup error",
        meta: { error: message },
      },
      null,
      2
    )}\n`
  );
  process.exit(1);
});
