/**
 * @file tool-result.test.ts
 * @description Unit tests for the tool result formatting functions, which are responsible for converting tool outputs and errors into a standardized format that can be rendered in the MCP dashboard. The tests cover the behavior of the jsonResult function, ensuring that it correctly wraps payloads as text content with appropriate titles, and the errorResult function, verifying that it handles different types of errors (ApiError, generic Error, and non-Error values) and formats them into a consistent error result structure. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `mcp/__tests__/tool-result.test.ts`
 *
 * Scope
 * Unit tests for the tool result formatting functions, which are responsible for converting tool
 * outputs and errors into a standardized format that can be rendered in the MCP dashboard. The tests
 * cover the behavior of the jsonResult function, ensuring that it correctly wraps payloads as text
 * content with appropriate titles, and the errorResult function, verifying that it handles different
 * types of errors (ApiError, generic Error, and non-Error values) and formats them into a consistent
 * error result structure. The tests use Node's built-in test runner and assert module for
 * assertions.
 *
 * Subjects and collaborators
 * - `../src/core/tool-result.js` — local module imported by this suite.
 * - `../src/clients/dashboard-api-client.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `jsonResult`
 * - `errorResult`
 *
 * Protected behavior
 * - wraps payload as text content with title
 * - handles null payload
 * - handles array payload
 * - handles ApiError with status and details
 * - handles generic Error
 * - handles non-Error thrown value
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep MCP assertions aligned with tool schemas and JSON-RPC error semantics; transport failures must
 *   stay diagnosable.
 *
 * Verification
 * - Run `npm run test:mcp`, `npm run mcp:typecheck`, and `npm run mcp:build` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonResult, errorResult } from "../src/core/tool-result.js";
import { ApiError } from "../src/clients/dashboard-api-client.js";

describe("jsonResult", () => {
  it("wraps payload as text content with title", () => {
    const result = jsonResult("my_tool", { status: "ok" });
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
    assert.ok(result.content[0].type === "text" && result.content[0].text.includes("my_tool"));
    assert.ok(
      result.content[0].type === "text" && result.content[0].text.includes('"status": "ok"')
    );
  });

  it("handles null payload", () => {
    const result = jsonResult("null_tool", null);
    assert.equal(result.content.length, 1);
    assert.ok(result.content[0].type === "text" && result.content[0].text.includes("null"));
  });

  it("handles array payload", () => {
    const result = jsonResult("arr_tool", [1, 2, 3]);
    assert.equal(result.content.length, 1);
    assert.ok(result.content[0].type === "text" && result.content[0].text.includes("["));
  });
});

describe("errorResult", () => {
  it("handles ApiError with status and details", () => {
    const apiErr = new ApiError("Not found", {
      status: 404,
      code: "NOT_FOUND",
      details: { path: "/api/sessions/x" },
    });
    const result = errorResult(apiErr);
    assert.equal(result.isError, true);
    assert.equal(result.content.length, 1);
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const parsed = JSON.parse(text);
    assert.equal(parsed.error, "Not found");
    assert.equal(parsed.status, 404);
    assert.equal(parsed.code, "NOT_FOUND");
  });

  it("handles generic Error", () => {
    const result = errorResult(new Error("Something broke"));
    assert.equal(result.isError, true);
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const parsed = JSON.parse(text);
    assert.equal(parsed.error, "Something broke");
    assert.equal(parsed.code, "INTERNAL_ERROR");
  });

  it("handles non-Error thrown value", () => {
    const result = errorResult("string error");
    assert.equal(result.isError, true);
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const parsed = JSON.parse(text);
    assert.equal(parsed.error, "Unknown error");
  });
});
