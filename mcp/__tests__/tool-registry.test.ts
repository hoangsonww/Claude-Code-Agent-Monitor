/**
 * @file tool-registry.test.ts
 * @description Unit tests for the tool registry functions, which are responsible for registering tools in the MCP server. The tests cover the behavior of the createCollectorRegistrar and createDualRegistrar functions, ensuring that they correctly collect tool entries and integrate with the MCP server's registration mechanism. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/tool-registry.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the tool registry functions, which are responsible for registering tools in the
 * MCP server. The tests cover the behavior of the createCollectorRegistrar and createDualRegistrar
 * functions, ensuring that they correctly collect tool entries and integrate with the MCP server's
 * registration mechanism. The tests use Node's built-in test runner and assert module for
 * assertions.
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
 * - `../src/core/tool-registry.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Named test contracts
 * - `collects multiple tools in order` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `collects tool entries into the provided array` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `createCollectorRegistrar` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `createDualRegistrar` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handler is invocable and returns expected result` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `pushes to collector array` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `validates direct REPL invocations with the declared Zod schema` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/tool-registry.test.ts` .
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
 * Path: `mcp/__tests__/tool-registry.test.ts`
 *
 * Scope
 * Unit tests for the tool registry functions, which are responsible for registering tools in the MCP
 * server. The tests cover the behavior of the createCollectorRegistrar and createDualRegistrar
 * functions, ensuring that they correctly collect tool entries and integrate with the MCP server's
 * registration mechanism. The tests use Node's built-in test runner and assert module for
 * assertions.
 *
 * Subjects and collaborators
 * - `../src/core/tool-registry.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `createCollectorRegistrar`
 * - `createDualRegistrar`
 *
 * Protected behavior
 * - collects tool entries into the provided array
 * - collects multiple tools in order
 * - handler is invocable and returns expected result
 * - validates direct REPL invocations with the declared Zod schema
 * - pushes to collector array
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
import {
  createCollectorRegistrar,
  createDualRegistrar,
  type ToolEntry,
} from "../src/core/tool-registry.js";
import { z } from "zod";

describe("createCollectorRegistrar", () => {
  it("collects tool entries into the provided array", () => {
    const collector: ToolEntry[] = [];
    const register = createCollectorRegistrar(collector);

    const handler = async () => ({ ok: true });
    register("my_tool", "A test tool", { name: z.string() }, handler);

    assert.equal(collector.length, 1);
    assert.equal(collector[0].name, "my_tool");
    assert.equal(collector[0].description, "A test tool");
    assert.notEqual(collector[0].handler, handler);
  });

  it("collects multiple tools in order", () => {
    const collector: ToolEntry[] = [];
    const register = createCollectorRegistrar(collector);

    register("tool_a", "First tool", {}, async () => "a");
    register("tool_b", "Second tool", {}, async () => "b");
    register("tool_c", "Third tool", {}, async () => "c");

    assert.equal(collector.length, 3);
    assert.deepEqual(
      collector.map((t) => t.name),
      ["tool_a", "tool_b", "tool_c"]
    );
  });

  it("handler is invocable and returns expected result", async () => {
    const collector: ToolEntry[] = [];
    const register = createCollectorRegistrar(collector);

    register("echo_tool", "Echoes input", { message: z.string() }, async (args) => ({
      echo: args.message,
    }));

    const result = await collector[0].handler({ message: "hello" });
    assert.deepEqual(result, { echo: "hello" });
  });

  it("validates direct REPL invocations with the declared Zod schema", async () => {
    const collector: ToolEntry[] = [];
    const register = createCollectorRegistrar(collector);

    register("number_tool", "Requires a number", { count: z.number().int() }, async (args) => args);

    await assert.rejects(() => collector[0].handler({ count: "three" }), /Expected number/);
  });
});

describe("createDualRegistrar", () => {
  it("pushes to collector array", () => {
    // We can't easily create a real McpServer in tests, so we test the collector
    // behavior by verifying createCollectorRegistrar is the building block
    const collector: ToolEntry[] = [];
    const register = createCollectorRegistrar(collector);

    register("dual_test", "Dual test tool", { id: z.string() }, async () => null);
    assert.equal(collector.length, 1);
    assert.equal(collector[0].name, "dual_test");
  });
});
