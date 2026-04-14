/**
 * @file tool-collector.test.ts
 * @description Unit tests for the tool-collector module, which is responsible for collecting and registering all tools available in the application. The tests cover the presence of expected tools, their properties, uniqueness of tool names, adherence to naming conventions, inclusion of tools from all domains, and proper handling of mutation and destructive tools based on configuration. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectAllTools } from "../src/transports/tool-collector.js";
import { Logger } from "../src/core/logger.js";
import type { AppConfig } from "../src/config/app-config.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    serverName: "test",
    serverVersion: "1.0.0",
    dashboardBaseUrl: new URL("http://127.0.0.1:4820"),
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
    assert.ok(tools.length >= 25, `Expected at least 25 tools, got ${tools.length}`);
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
