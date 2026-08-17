/**
 * @file tool-collector.ts
 * @description Collects the canonical MCP domain registrations for direct
 * REPL invocation, preserving the same input schemas and policy guards used by
 * stdio and HTTP protocol transports.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";
import { type ToolEntry, createCollectorRegistrar } from "../core/tool-registry.js";
import { registerAllTools } from "../tools/index.js";

/**
 * Collect the canonical tool declarations without constructing an MCP protocol
 * server. The REPL invokes these handlers directly, while schema validation is
 * retained by the collector registrar.
 */
export function collectAllTools(
  config: AppConfig,
  api: DashboardApiClient,
  logger: Logger
): ToolEntry[] {
  const tools: ToolEntry[] = [];
  registerAllTools({
    config,
    api,
    logger,
    register: createCollectorRegistrar(tools),
  });
  return tools;
}
