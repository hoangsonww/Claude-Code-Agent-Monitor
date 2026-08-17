/**
 * @file tool-result.ts
 * @description Utility functions for formatting tool results in the MCP server. This module provides helper functions to create standardized result objects for successful tool calls (jsonResult) and error cases (errorResult). The jsonResult function formats the output with a title and pretty-printed JSON payload, while the errorResult function handles both known API errors and generic errors, ensuring that error information is consistently structured for the MCP client to display. These utilities help maintain a clear contract for tool handlers when returning results or errors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/core/tool-result.ts`
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
 * - `../clients/dashboard-api-client.js`
 *
 * ## Public surface
 * - `jsonResult` — exported API; see TSDoc on the symbol for behavior.
 * - `errorResult` — exported API; see TSDoc on the symbol for behavior.
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
 * **jsonResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **errorResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "../clients/dashboard-api-client.js";

/**
 * Wraps a successful handler return value into the MCP `CallToolResult`
 * shape. Called only from {@link createToolRegistrar}'s handler wrapper.
 * The result is a single `text` block: the tool name as a title, then the
 * payload pretty-printed as JSON — a display convenience, not a
 * machine-readable envelope.
 */
export function jsonResult(title: string, payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `${title}\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  };
}

/**
 * Converts a thrown error into an `isError: true` `CallToolResult`, called
 * only from {@link createToolRegistrar}'s catch block so a failing tool
 * always resolves rather than rejects. An {@link ApiError} (raised by
 * {@link DashboardApiClient} for any non-2xx response, timeout, or network
 * failure) surfaces its own `code`/`status`/`details`; any other error
 * (including policy-guard failures) collapses to a generic `INTERNAL_ERROR`
 * with just the message.
 */
export function errorResult(error: unknown): CallToolResult {
  if (error instanceof ApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.message,
              code: error.code ?? null,
              status: error.status ?? null,
              details: error.details ?? null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: message,
            code: "INTERNAL_ERROR",
          },
          null,
          2
        ),
      },
    ],
  };
}
