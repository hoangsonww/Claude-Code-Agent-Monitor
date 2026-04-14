/**
 * @file tool-context.ts
 * @description Defines the ToolContext interface, which encapsulates the necessary context for tool handlers in the MCP application. This context includes references to the MCP server instance, application configuration, dashboard API client, and logger. The ToolContext is passed to tool registration functions to provide them with access to these resources when defining and implementing tools. This design promotes modularity and separation of concerns by centralizing shared dependencies in a single context object.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";

export interface ToolContext {
  server: McpServer;
  config: AppConfig;
  api: DashboardApiClient;
  logger: Logger;
}
