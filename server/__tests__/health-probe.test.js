/**
 * @file Exercises dashboard detection against prefixed and legacy root servers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { probeDashboardHealth } = require("../lib/health-probe");

it("recognizes the configured prefix and a legacy root dashboard", async () => {
  let activePath = "/dashboard/api/health";
  const paths = [];
  const server = http.createServer((req, res) => {
    paths.push(req.url);
    res.writeHead(req.url === activePath ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: req.url === activePath ? "ok" : "not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    assert.equal(await probeDashboardHealth(port, " /dashboard/ "), true);
    assert.deepEqual(paths.splice(0), ["/dashboard/api/health"]);
    activePath = "/api/health";
    assert.equal(await probeDashboardHealth(port, "/dashboard"), true);
    assert.deepEqual(paths.splice(0), ["/dashboard/api/health", "/api/health"]);
    activePath = "/different/api/health";
    assert.equal(await probeDashboardHealth(port, "/dashboard"), false);
    assert.equal(await probeDashboardHealth(port, ""), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
