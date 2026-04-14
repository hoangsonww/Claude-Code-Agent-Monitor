/**
 * @file index.ts
 * @description The main entry point for the MCP application, responsible for initializing the server, loading configuration, setting up logging, and starting the appropriate transport based on configuration or command-line arguments. The application supports multiple transport modes (stdio, http, repl) and includes graceful shutdown handling. It also collects tools and registers them with the server when using HTTP or REPL transports. The main function orchestrates the startup process and ensures that any unhandled errors are logged before exiting.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DashboardApiClient } from "./clients/dashboard-api-client.js";
import { loadConfig, type TransportMode } from "./config/app-config.js";
import { Logger } from "./core/logger.js";
import { buildServer } from "./server.js";
import { startHttpServer } from "./transports/http-server.js";
import { startRepl } from "./transports/repl.js";
import { collectAllTools } from "./transports/tool-collector.js";
import { printBanner, printServerInfo, printReady, printShutdown } from "./ui/banner.js";

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
    const TOOL_DOMAINS: Record<string, string> = {
      dashboard_health_check: "observability",
      dashboard_get_stats: "observability",
      dashboard_get_analytics: "observability",
      dashboard_get_system_info: "observability",
      dashboard_export_data: "observability",
      dashboard_get_operational_snapshot: "observability",
      dashboard_list_sessions: "sessions",
      dashboard_get_session: "sessions",
      dashboard_create_session: "sessions",
      dashboard_update_session: "sessions",
      dashboard_list_agents: "agents",
      dashboard_get_agent: "agents",
      dashboard_create_agent: "agents",
      dashboard_update_agent: "agents",
      dashboard_list_events: "events",
      dashboard_ingest_hook_event: "events",
      dashboard_get_pricing_rules: "pricing",
      dashboard_get_total_cost: "pricing",
      dashboard_get_session_cost: "pricing",
      dashboard_upsert_pricing_rule: "pricing",
      dashboard_delete_pricing_rule: "pricing",
      dashboard_reset_pricing_defaults: "pricing",
      dashboard_cleanup_data: "maintenance",
      dashboard_reimport_history: "maintenance",
      dashboard_reinstall_hooks: "maintenance",
      dashboard_clear_all_data: "maintenance",
    };

    const toolEntries = collectAllTools(config, api, logger);
    const replTools = toolEntries.map((t) => ({
      ...t,
      domain: TOOL_DOMAINS[t.name] ?? "unknown",
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
