/**
 * @file Verifies that the production client shell receives the configured base URL.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { configureProductionClient } = require("../index");
const clientDist = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-client-"));
fs.writeFileSync(
  path.join(clientDist, "index.html"),
  '<base href="./" data-dashboard-base /><meta name="dashboard-base-url" content="__DASHBOARD_BASE_URL__" />'
);
fs.mkdirSync(path.join(clientDist, "assets"));
fs.writeFileSync(path.join(clientDist, "assets", "app.js"), "console.log('app');");

const app = express();
configureProductionClient(app, clientDist, "/dashboard");
const server = http.createServer(app);
let listening = false;

after(async () => {
  if (listening) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(clientDist, { recursive: true, force: true });
});

describe("production client under a dashboard base URL", () => {
  it("injects the prefix for the root and explicit index.html requests", async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    listening = true;
    const base = `http://127.0.0.1:${server.address().port}`;

    for (const requestPath of ["/", "/index.html"]) {
      const response = await fetch(`${base}${requestPath}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /<base href="\/dashboard\/" data-dashboard-base \/>/);
      assert.match(html, /dashboard-base-url" content="\/dashboard"/);
    }
  });

  it("reads the current client shell after a rebuild", async () => {
    fs.writeFileSync(
      path.join(clientDist, "index.html"),
      '<base href="./" data-dashboard-base /><meta name="dashboard-base-url" content="__DASHBOARD_BASE_URL__" /><script src="/assets/rebuilt.js"></script>'
    );

    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /assets\/rebuilt\.js/);
  });

  it("does not require a built index while registering production routes", () => {
    const emptyApp = express();
    const missingDist = path.join(clientDist, "missing");
    assert.doesNotThrow(() => configureProductionClient(emptyApp, missingDist, "/dashboard"));
  });
});
