/**
 * @file tool-registry.ts
 * @description Core functions for registering tools in the MCP server. This module defines the ToolRegistrar type, which is a function that can be used to register a tool with a name, description, input schema, and handler function. It also provides factory functions to create different types of registrars: one that registers tools directly with the MCP server and collects entries for REPL mode, and another that only collects entries without registering with the MCP server (for pure REPL mode). The registrars handle error logging and result formatting to ensure consistent behavior across different tool implementations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Logger } from "./logger.js";
import { errorResult, jsonResult } from "./tool-result.js";

type GenericInput = Record<string, unknown>;

export type ToolHandler = (args: GenericInput) => Promise<unknown>;

export interface ToolRegistrar {
  (
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    handler: ToolHandler
  ): void;
}

export interface ToolEntry {
  name: string;
  description: string;
  handler: ToolHandler;
}

export function createToolRegistrar(server: McpServer, logger: Logger): ToolRegistrar {
  return (name, description, inputSchema, handler) => {
    server.registerTool(name, { description, inputSchema }, async (args) => {
      try {
        logger.debug("Tool invocation started", { tool: name });
        const result = await handler(args as GenericInput);
        logger.debug("Tool invocation completed", { tool: name });
        return jsonResult(name, result);
      } catch (error) {
        logger.error("Tool invocation failed", {
          tool: name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return errorResult(error);
      }
    });
  };
}

/** Registrar that also collects tool entries for REPL mode */
export function createDualRegistrar(
  server: McpServer,
  logger: Logger,
  collector: ToolEntry[]
): ToolRegistrar {
  const mcpRegistrar = createToolRegistrar(server, logger);
  return (name, description, inputSchema, handler) => {
    mcpRegistrar(name, description, inputSchema, handler);
    collector.push({ name, description, handler });
  };
}

/** Registrar that only collects (no MCP server, for pure REPL mode) */
export function createCollectorRegistrar(collector: ToolEntry[]): ToolRegistrar {
  return (name, description, _inputSchema, handler) => {
    collector.push({ name, description, handler });
  };
}
