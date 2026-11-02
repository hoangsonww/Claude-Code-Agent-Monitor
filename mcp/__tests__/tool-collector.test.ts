/**
 * @file tool-collector.test.ts
 * @description Unit tests for the tool-collector module, which is responsible for collecting and registering all tools available in the application. The tests cover the presence of expected tools, their properties, uniqueness of tool names, adherence to naming conventions, inclusion of tools from all domains, and proper handling of mutation and destructive tools based on configuration. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/tool-collector.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the tool-collector module, which is responsible for collecting and registering all
 * tools available in the application. The tests cover the presence of expected tools, their
 * properties, uniqueness of tool names, adherence to naming conventions, inclusion of tools from
 * all domains, and proper handling of mutation and destructive tools based on configuration. The
 * tests use Node's built-in test runner and assert module for assertions.
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
 * - `../src/config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../src/core/logger.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../src/transports/repl.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../src/transports/tool-collector.js` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `fakeConfig` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `classifies every collected tool into a known REPL domain` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `cleanup tool requires at least one parameter` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `collectAllTools` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `destructive tool throws on wrong token` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `destructive tool throws when destructive disabled` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `every tool has name, description, and handler` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `includes tools from all domains` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `mutation tools throw when mutations disabled` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `registers all expected tools` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `snapshot prune accepts a byte count or a size string for max_bytes` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `snapshot prune requires criteria and gates applying as destructive` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `tool names are unique` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `tool names follow naming convention` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/tool-collector.test.ts` .
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
 * Path: `mcp/__tests__/tool-collector.test.ts`
 *
 * Scope
 * Unit tests for the tool-collector module, which is responsible for collecting and registering all
 * tools available in the application. The tests cover the presence of expected tools, their
 * properties, uniqueness of tool names, adherence to naming conventions, inclusion of tools from all
 * domains, and proper handling of mutation and destructive tools based on configuration. The tests
 * use Node's built-in test runner and assert module for assertions.
 *
 * Subjects and collaborators
 * - `../src/transports/tool-collector.js` — local module imported by this suite.
 * - `../src/core/logger.js` — local module imported by this suite.
 * - `../src/config/app-config.js` — local module imported by this suite.
 * - `../src/clients/dashboard-api-client.js` — local module imported by this suite.
 * - `../src/transports/repl.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `collectAllTools`
 *
 * Protected behavior
 * - registers all expected tools
 * - every tool has name, description, and handler
 * - tool names are unique
 * - tool names follow naming convention
 * - classifies every collected tool into a known REPL domain
 * - includes tools from all domains
 * - mutation tools throw when mutations disabled
 * - destructive tool throws when destructive disabled
 * - destructive tool throws on wrong token
 * - snapshot prune requires criteria and gates applying as destructive
 * - snapshot prune accepts a byte count or a size string for max_bytes
 * - cleanup tool requires at least one parameter
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
import { collectAllTools } from "../src/transports/tool-collector.js";
import { Logger } from "../src/core/logger.js";
import type { AppConfig } from "../src/config/app-config.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";
import { toolDomain } from "../src/transports/repl.js";

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    serverName: "test",
    serverVersion: "1.0.0",
    dashboardBaseUrl: new URL("http://127.0.0.1:4820"),
    dashboardApiToken: undefined,
    requestTimeoutMs: 10_000,
    retryCount: 0,
    retryBackoffMs: 250,
    allowMutations: false,
    allowDestructive: false,
    logLevel: "error",
    transport: "stdio",
    httpPort: 8819,
    httpHost: "127.0.0.1",
    ...overrides,
  };
}

describe("collectAllTools", () => {
  const config = fakeConfig();
  const logger = new Logger("error");
  const api = new DashboardApiClient(config, logger);

  it("registers all expected tools", () => {
    const tools = collectAllTools(config, api, logger);
    assert.ok(tools.length >= 97, `Expected at least 97 tools, got ${tools.length}`);
  });

  it("every tool has name, description, and handler", () => {
    const tools = collectAllTools(config, api, logger);
    for (const tool of tools) {
      assert.ok(tool.name, `Tool missing name`);
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.equal(typeof tool.handler, "function", `Tool ${tool.name} handler is not a function`);
    }
  });

  it("tool names are unique", () => {
    const tools = collectAllTools(config, api, logger);
    const names = tools.map((t) => t.name);
    const unique = new Set(names);
    assert.equal(names.length, unique.size, "Duplicate tool names found");
  });

  it("tool names follow naming convention", () => {
    const tools = collectAllTools(config, api, logger);
    for (const tool of tools) {
      assert.ok(
        tool.name.startsWith("dashboard_"),
        `Tool ${tool.name} should start with 'dashboard_'`
      );
      assert.ok(/^[a-z_]+$/.test(tool.name), `Tool ${tool.name} should be lowercase snake_case`);
    }
  });

  it("classifies every collected tool into a known REPL domain", () => {
    const tools = collectAllTools(config, api, logger);
    for (const tool of tools) {
      assert.notEqual(toolDomain(tool.name), "other", `${tool.name} must have a REPL domain`);
    }
    for (const name of [
      "dashboard_get_update_status",
      "dashboard_check_for_updates",
      "dashboard_get_agent_homes",
      "dashboard_set_claude_home",
      "dashboard_set_codex_home",
      "dashboard_install_hooks",
    ]) {
      assert.equal(toolDomain(name), "settings");
    }
  });

  it("includes tools from all domains", () => {
    const tools = collectAllTools(config, api, logger);
    const names = new Set(tools.map((t) => t.name));

    // Observability
    assert.ok(names.has("dashboard_health_check"));
    assert.ok(names.has("dashboard_get_stats"));
    assert.ok(names.has("dashboard_get_analytics"));
    assert.ok(names.has("dashboard_get_system_info"));
    assert.ok(names.has("dashboard_export_data"));
    assert.ok(names.has("dashboard_get_operational_snapshot"));

    // Sessions
    assert.ok(names.has("dashboard_list_sessions"));
    assert.ok(names.has("dashboard_get_session"));
    assert.ok(names.has("dashboard_create_session"));
    assert.ok(names.has("dashboard_update_session"));

    // Agents
    assert.ok(names.has("dashboard_list_agents"));
    assert.ok(names.has("dashboard_get_agent"));
    assert.ok(names.has("dashboard_create_agent"));
    assert.ok(names.has("dashboard_update_agent"));

    // Events
    assert.ok(names.has("dashboard_list_events"));
    assert.ok(names.has("dashboard_ingest_hook_event"));

    // Pricing
    assert.ok(names.has("dashboard_get_pricing_rules"));
    assert.ok(names.has("dashboard_get_total_cost"));
    assert.ok(names.has("dashboard_get_session_cost"));
    assert.ok(names.has("dashboard_upsert_pricing_rule"));
    assert.ok(names.has("dashboard_delete_pricing_rule"));
    assert.ok(names.has("dashboard_reset_pricing_defaults"));

    // Maintenance
    assert.ok(names.has("dashboard_cleanup_data"));
    assert.ok(names.has("dashboard_reimport_history"));
    assert.ok(names.has("dashboard_reinstall_hooks"));
    assert.ok(names.has("dashboard_clear_all_data"));
    assert.ok(names.has("dashboard_get_snapshot_storage"));
    assert.ok(names.has("dashboard_compress_snapshots"));
    assert.ok(names.has("dashboard_prune_snapshots"));

    // Remote Data Sources
    assert.ok(names.has("dashboard_list_remote_sources"));
    assert.ok(names.has("dashboard_sync_remote_source"));
    assert.ok(names.has("dashboard_sync_all_remote_sources"));

    // Workflows, alerts, webhooks, imports, config, runs, and settings
    assert.ok(names.has("dashboard_get_workflows"));
    assert.ok(names.has("dashboard_list_alerts"));
    assert.ok(names.has("dashboard_list_webhooks"));
    assert.ok(names.has("dashboard_get_import_guide"));
    assert.ok(names.has("dashboard_get_claude_config"));
    assert.ok(names.has("dashboard_get_codex_config"));
    assert.ok(names.has("dashboard_list_runs"));
    assert.ok(names.has("dashboard_install_hooks"));
    assert.ok(names.has("dashboard_get_session_transcript"));
    assert.ok(names.has("dashboard_upload_history_files"));
    assert.ok(names.has("dashboard_get_push_public_key"));
    assert.ok(names.has("dashboard_get_prometheus_metrics"));
    assert.ok(names.has("dashboard_get_transcript_image"));
  });

  it("mutation tools throw when mutations disabled", async () => {
    const mutConfig = fakeConfig({ allowMutations: false });
    const tools = collectAllTools(mutConfig, api, logger);
    const createSession = tools.find((t) => t.name === "dashboard_create_session");
    assert.ok(createSession);

    await assert.rejects(
      () => createSession.handler({ id: "x", name: "y" }),
      /Mutating tools are disabled/
    );
  });

  it("destructive tool throws when destructive disabled", async () => {
    const destConfig = fakeConfig({ allowMutations: true, allowDestructive: false });
    const tools = collectAllTools(destConfig, api, logger);
    const clearAll = tools.find((t) => t.name === "dashboard_clear_all_data");
    assert.ok(clearAll);

    await assert.rejects(
      () => clearAll.handler({ confirmation_token: "CLEAR_ALL_DATA" }),
      /Destructive tools are disabled/
    );
  });

  it("destructive tool throws on wrong token", async () => {
    const destConfig = fakeConfig({ allowMutations: true, allowDestructive: true });
    const tools = collectAllTools(destConfig, api, logger);
    const clearAll = tools.find((t) => t.name === "dashboard_clear_all_data");
    assert.ok(clearAll);

    await assert.rejects(
      () => clearAll.handler({ confirmation_token: "WRONG" }),
      /Invalid confirmation_token/
    );
  });

  it("snapshot prune requires criteria and gates applying as destructive", async () => {
    const readOnly = fakeConfig({ allowMutations: false, allowDestructive: false });
    const prune = collectAllTools(readOnly, api, logger).find(
      (t) => t.name === "dashboard_prune_snapshots"
    );
    assert.ok(prune);
    await assert.rejects(() => prune.handler({}), /At least one of max_age_days/);
    await assert.rejects(
      () => prune.handler({ max_age_days: 30, dry_run: false }),
      /Mutating tools are disabled/
    );

    const destructive = fakeConfig({ allowMutations: true, allowDestructive: true });
    const armed = collectAllTools(destructive, api, logger).find(
      (t) => t.name === "dashboard_prune_snapshots"
    );
    assert.ok(armed);
    await assert.rejects(
      () =>
        armed.handler({ max_age_days: 30, dry_run: false, confirmation_token: "CLEAR_ALL_DATA" }),
      /Expected exact value: "PRUNE_SNAPSHOTS"/
    );
  });

  it("snapshot prune accepts a byte count or a size string for max_bytes", async () => {
    // Collected handlers validate input with the declared schema first, so a
    // valid size gets past validation and stops at the mutation gate, while an
    // invalid one fails validation before any request is made.
    const readOnly = fakeConfig({ allowMutations: false });
    const prune = collectAllTools(readOnly, api, logger).find(
      (t) => t.name === "dashboard_prune_snapshots"
    );
    assert.ok(prune);
    for (const size of [5368709120, "5GB", "1.5 GiB", "500mb"]) {
      await assert.rejects(
        () => prune.handler({ max_bytes: size, dry_run: false }),
        /Mutating tools are disabled/,
        `max_bytes=${size} should pass validation`
      );
    }
    for (const bad of ["lots", -1, 0]) {
      await assert.rejects(
        () => prune.handler({ max_bytes: bad, dry_run: false }),
        (err: Error) => !/Mutating tools are disabled/.test(err.message),
        `max_bytes=${bad} should fail validation`
      );
    }
  });

  it("cleanup tool requires at least one parameter", async () => {
    const mutConfig = fakeConfig({ allowMutations: true });
    const tools = collectAllTools(mutConfig, api, logger);
    const cleanup = tools.find((t) => t.name === "dashboard_cleanup_data");
    assert.ok(cleanup);

    await assert.rejects(
      () => cleanup.handler({}),
      /At least one of abandon_hours or purge_days is required/
    );
  });
});
