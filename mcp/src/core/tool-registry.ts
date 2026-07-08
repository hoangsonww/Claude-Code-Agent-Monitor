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

/** Signature every domain tool handler implements. Receives the
 * SDK-validated argument bag and returns raw JSON data — handlers do not
 * wrap results or catch their own errors; the registrar does that. */
export type ToolHandler = (args: GenericInput) => Promise<unknown>;

/**
 * Function shape `tools/domains/*.ts` calls once per tool with a
 * `dashboard_*` name, description, Zod input shape, and handler. Two
 * implementations are wired up in `index.ts`: {@link createToolRegistrar}
 * (stdio, per-session HTTP/SSE) and {@link createCollectorRegistrar} (REPL,
 * no server) — so the same domain-registration code runs unmodified across
 * transports. A third, {@link createDualRegistrar}, combines both but isn't
 * currently wired into any transport.
 */
export interface ToolRegistrar {
  (
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    handler: ToolHandler
  ): void;
}

/** Plain-data record of one registered tool, independent of the MCP SDK.
 * Consumed by `transports/tool-collector.ts`/`transports/repl.ts` to invoke
 * tools directly, bypassing the MCP protocol. */
export interface ToolEntry {
  name: string;
  description: string;
  handler: ToolHandler;
}

/**
 * Creates a {@link ToolRegistrar} that registers each tool directly with a
 * live `McpServer`. Its handler wrapper is the one place that logs
 * `debug`-level start/completion (or `error` on failure), converts a
 * success into a `CallToolResult` via {@link jsonResult}, and catches any
 * thrown error — converting it via {@link errorResult} — so a failing call
 * always resolves rather than rejects the MCP request.
 */
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

/**
 * Registrar that also collects tool entries for REPL mode. Delegates to
 * {@link createToolRegistrar} and additionally pushes a plain
 * {@link ToolEntry}, so one call would both register a tool AND make it
 * directly invokable. Not currently used — `index.ts` builds REPL entries
 * via {@link createCollectorRegistrar} instead.
 */
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

/**
 * Registrar that only collects (no MCP server, for pure REPL mode). Used by
 * `collectAllTools` to build the REPL tool list with no protocol overhead —
 * thrown errors propagate as real exceptions to the REPL's own try/catch.
 */
export function createCollectorRegistrar(collector: ToolEntry[]): ToolRegistrar {
  return (name, description, _inputSchema, handler) => {
    collector.push({ name, description, handler });
  };
}
