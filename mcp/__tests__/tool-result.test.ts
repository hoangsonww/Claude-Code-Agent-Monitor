/**
 * @file tool-result.test.ts
 * @description Unit tests for the tool result formatting functions, which are responsible for converting tool outputs and errors into a standardized format that can be rendered in the MCP dashboard. The tests cover the behavior of the jsonResult function, ensuring that it correctly wraps payloads as text content with appropriate titles, and the errorResult function, verifying that it handles different types of errors (ApiError, generic Error, and non-Error values) and formats them into a consistent error result structure. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/tool-result.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the tool result formatting functions, which are responsible for converting tool
 * outputs and errors into a standardized format that can be rendered in the MCP dashboard. The
 * tests cover the behavior of the jsonResult function, ensuring that it correctly wraps payloads as
 * text content with appropriate titles, and the errorResult function, verifying that it handles
 * different types of errors (ApiError, generic Error, and non-Error values) and formats them into a
 * consistent error result structure. The tests use Node's built-in test runner and assert module
 * for assertions.
 *
 * ## Architectural boundary
 * - Protects MCP schema, policy, API-client, formatting, lifecycle, or transport behavior using
 *   Node's test runner.
 * - Tests should exercise public contracts with realistic SDK and HTTP boundaries while keeping
 *   external state local.
 * - Fixtures must not contain usable credentials or depend on the operator's real dashboard
 *   configuration.
 *
 * ## Local dependency edges
 * - `../src/clients/dashboard-api-client.js` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 * - `../src/core/tool-result.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Literal API paths
 * - `/api/sessions/x` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 *
 * ## Named test contracts
 * - `errorResult` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `handles ApiError with status and details` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `handles array payload` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles generic Error` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles non-Error thrown value` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `handles null payload` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `jsonResult` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `wraps payload as text content with title` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the exact protocol or policy contract in each test so a failure identifies the broken
 *   boundary.
 * - Use ephemeral ports, temporary directories, and isolated environment values for concurrent-safe
 *   execution.
 * - Restore process globals, environment variables, clocks, fetch stubs, and listeners after every
 *   case.
 * - Assert structured results and error shapes rather than only checking that a call throws.
 * - Cover redaction and permission denial for every secret-bearing or state-changing path.
 * - Avoid snapshotting unstable SDK internals when a focused schema or result assertion is clearer.
 * - Test cleanup and idempotence because abandoned transports and timers can keep the process
 *   alive.
 * - Keep test doubles behaviorally faithful to the API client methods used by the subject.
 * - Exercise malformed and boundary inputs at schema and direct-function layers where each owns
 *   distinct validation.
 * - Prove regression tests fail against the broken behavior before accepting a fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/tool-result.test.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
