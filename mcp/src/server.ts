/**
 * @file server.ts
 * @description Main entry point for building the MCP server. This module defines the buildServer function, which initializes a new MCP server instance with the provided configuration, API client, and logger. It also registers all tools by calling the registerAllTools function, which sets up the tool handlers for the server. The buildServer function returns the configured MCP server instance, ready to be started and handle incoming requests from the MCP client. This module serves as the central place for assembling the server components and ensuring that all necessary tools are registered before the server starts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config/app-config.js";
import { DashboardApiClient } from "./clients/dashboard-api-client.js";
import { Logger } from "./core/logger.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Constructs one fully-configured `McpServer` with every `dashboard_*` tool
 * registered. A factory, not a singleton: stdio calls it once, while the
 * HTTP transport calls it once per new client session (Streamable HTTP or
 * legacy SSE), giving each session isolated server state while sharing the
 * same {@link AppConfig}/{@link DashboardApiClient}.
 * @returns A new `McpServer` with all six tool domains registered, ready to
 *   `connect()` to a transport.
 */
export function buildServer(config: AppConfig, api: DashboardApiClient, logger: Logger): McpServer {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerAllTools({
    server,
    config,
    api,
    logger,
  });

  return server;
}
