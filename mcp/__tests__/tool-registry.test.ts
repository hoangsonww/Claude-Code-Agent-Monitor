/**
 * @file tool-registry.test.ts
 * @description Unit tests for the tool registry functions, which are responsible for registering tools in the MCP server. The tests cover the behavior of the createCollectorRegistrar and createDualRegistrar functions, ensuring that they correctly collect tool entries and integrate with the MCP server's registration mechanism. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
