/**
 * @file tool-result.ts
 * @description Utility functions for formatting tool results in the MCP server. This module provides helper functions to create standardized result objects for successful tool calls (jsonResult) and error cases (errorResult). The jsonResult function formats the output with a title and pretty-printed JSON payload, while the errorResult function handles both known API errors and generic errors, ensuring that error information is consistently structured for the MCP client to display. These utilities help maintain a clear contract for tool handlers when returning results or errors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "../clients/dashboard-api-client.js";

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
