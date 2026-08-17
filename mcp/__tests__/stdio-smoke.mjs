/**
 * @file stdio-smoke.mjs
 * @description End-to-end MCP stdio smoke test. It connects a real MCP client
 * to the built CCAM server, verifies the complete tool catalog, and calls the
 * dashboard health tool through an optionally authenticated local API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const dashboardPort = process.env.DASHBOARD_PORT;
assert.ok(dashboardPort, "DASHBOARD_PORT is required");

const transport = new StdioClientTransport({
  command: process.env.CCAM_MCP_COMMAND || process.execPath,
  args: process.env.CCAM_MCP_COMMAND
    ? ["mcp", "stdio"]
    : [path.join(packageRoot, "build", "index.js")],
  cwd: path.resolve(packageRoot, ".."),
  env: {
    MCP_DASHBOARD_BASE_URL: `http://127.0.0.1:${dashboardPort}`,
    MCP_DASHBOARD_API_TOKEN: process.env.DASHBOARD_API_TOKEN || "",
    MCP_LOG_LEVEL: "error",
  },
  stderr: "pipe",
});
const client = new Client({ name: "ccam-stdio-smoke", version: "1.0.0" });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 97);
  assert.ok(listed.tools.some((tool) => tool.name === "dashboard_get_transcript_image"));
  assert.ok(listed.tools.some((tool) => tool.name === "dashboard_start_run"));

  const health = await client.callTool({ name: "dashboard_health_check", arguments: {} });
  assert.equal(health.isError, undefined);
  const text = health.content.find((item) => item.type === "text")?.text || "";
  assert.match(text, /"status":\s*"ok"/);
  process.stdout.write("stdio_mcp_smoke=ok tools=97 auth=ok\n");
} finally {
  await client.close();
}
