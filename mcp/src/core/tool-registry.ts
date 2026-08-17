/**
 * @file tool-registry.ts
 * @description Core functions for registering tools in the MCP server. This module defines the ToolRegistrar type, which is a function that can be used to register a tool with a name, description, input schema, and handler function. It also provides factory functions to create different types of registrars: one that registers tools directly with the MCP server and collects entries for REPL mode, and another that only collects entries without registering with the MCP server (for pure REPL mode). The registrars handle error logging and result formatting to ensure consistent behavior across different tool implementations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/core/tool-registry.ts`
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
 * - `./logger.js`
 * - `./tool-result.js`
 *
 * ## Public surface
 * - `ToolHandler` — exported API; see TSDoc on the symbol for behavior.
 * - `ToolRegistrar` — exported API; see TSDoc on the symbol for behavior.
 * - `ToolEntry` — exported API; see TSDoc on the symbol for behavior.
 * - `createToolRegistrar` — exported API; see TSDoc on the symbol for behavior.
 * - `createDualRegistrar` — exported API; see TSDoc on the symbol for behavior.
 * - `createCollectorRegistrar` — exported API; see TSDoc on the symbol for behavior.
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
 * **ToolHandler**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ToolRegistrar**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ToolEntry**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **createToolRegistrar**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **createDualRegistrar**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **createCollectorRegistrar**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

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
  return (name, description, inputSchema, handler) => {
    const objectSchema = z.object(inputSchema);
    collector.push({
      name,
      description,
      handler: async (args) => handler(objectSchema.parse(args)),
    });
  };
}

/**
 * Resolve the registrar for one tool domain. Protocol transports provide a
 * live MCP server, while the REPL injects a collector registrar. Keeping this
 * decision here lets every domain declaration run unchanged in both surfaces.
 */
export function registrarFor(context: {
  server?: McpServer;
  register?: ToolRegistrar;
  logger: Logger;
}): ToolRegistrar {
  if (context.register) return context.register;
  if (context.server) return createToolRegistrar(context.server, context.logger);
  throw new Error("Tool context requires either an MCP server or a registrar override.");
}
