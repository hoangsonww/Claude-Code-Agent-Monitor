/**
 * @file tool-context.ts
 * @description Defines the ToolContext interface, which encapsulates the necessary context for tool handlers in the MCP application. This context includes references to the MCP server instance, application configuration, dashboard API client, and logger. The ToolContext is passed to tool registration functions to provide them with access to these resources when defining and implementing tools. This design promotes modularity and separation of concerns by centralizing shared dependencies in a single context object.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";

/**
 * Shared dependency bundle injected into every `register*Tools` function
 * under `tools/domains/`. Adding a new dependency only requires updating
 * this interface and `server.ts` (the sole place that constructs it).
 */
export interface ToolContext {
  /** MCP server tool modules call `registerTool` on, via a {@link ToolRegistrar}. */
  server: McpServer;
  /** Resolved config — dashboard URL, timeouts/retries, mutation/destructive
   * policy flags checked by `policy/tool-guards.ts`. */
  config: AppConfig;
  /** HTTP client to the dashboard's `/api/*` Express API — the only way
   * tools read or write dashboard state. */
  api: DashboardApiClient;
  /** Shared structured JSON logger (stderr). */
  logger: Logger;
}
