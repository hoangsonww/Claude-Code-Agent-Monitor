/**
 * @file tool-result.ts
 * @description Utility functions for formatting tool results in the MCP server. This module provides helper functions to create standardized result objects for successful tool calls (jsonResult) and error cases (errorResult). The jsonResult function formats the output with a title and pretty-printed JSON payload, while the errorResult function handles both known API errors and generic errors, ensuring that error information is consistently structured for the MCP client to display. These utilities help maintain a clear contract for tool handlers when returning results or errors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
