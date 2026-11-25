/**
 * @file Verifies Express routes are mounted below the configured dashboard base URL.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const previousBaseUrl = process.env.DASHBOARD_BASE_URL;
process.env.DASHBOARD_BASE_URL = "/dashboard";
const { createApp } = require("../index");
const server = http.createServer(createApp());
let listening = false;

after(async () => {
  if (listening) await new Promise((resolve) => server.close(resolve));
  if (previousBaseUrl === undefined) delete process.env.DASHBOARD_BASE_URL;
  else process.env.DASHBOARD_BASE_URL = previousBaseUrl;
});

describe("Express dashboard base URL", () => {
  it("mounts health below the prefix and leaves non-hook root APIs unavailable", async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    listening = true;
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/dashboard/api/health`);
    assert.equal(health.status, 200);
    const rootHealth = await fetch(`${base}/api/health`);
    assert.equal(rootHealth.status, 404);
  });
});
