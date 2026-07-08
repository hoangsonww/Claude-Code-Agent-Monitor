/**
 * @file index.ts
 * @description Main entry point for registering all tools in the MCP application. This module imports and registers tools from various domains, including observability, session management, agent management, event handling, pricing, and maintenance. The registerAllTools function takes a ToolContext as an argument and calls the respective registration functions for each domain to ensure that all tools are properly set up and available for use within the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { ToolContext } from "../types/tool-context.js";
import { registerObservabilityTools } from "./domains/observability-tools.js";
import { registerSessionTools } from "./domains/session-tools.js";
import { registerAgentTools } from "./domains/agent-tools.js";
import { registerEventTools } from "./domains/event-tools.js";
import { registerPricingTools } from "./domains/pricing-tools.js";
import { registerMaintenanceTools } from "./domains/maintenance-tools.js";

/**
 * Registers all 26 `dashboard_*` tools with the given {@link ToolContext} in
 * one call. `server.ts`'s `buildServer` calls this per `McpServer` instance;
 * `transports/tool-collector.ts`'s `collectAllTools` independently
 * re-implements the same registrations for REPL mode (no live server), so
 * the two files must be kept in sync by hand when a tool changes.
 */
export function registerAllTools(context: ToolContext): void {
  registerObservabilityTools(context);
  registerSessionTools(context);
  registerAgentTools(context);
  registerEventTools(context);
  registerPricingTools(context);
  registerMaintenanceTools(context);
}
