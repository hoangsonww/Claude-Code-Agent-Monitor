/**
 * @file Tests for multi-server discovery and hook-ingest deduplication by
 * SQLite data directory (`server/lib/server-info.js`).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STAMP = `server-info-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const CLAUDE_HOME = path.join(TMP, "home");
const DATA_DIR_A = path.join(TMP, "data-a");
const DATA_DIR_B = path.join(TMP, "data-b");

function freshModule(dataDir) {
  delete require.cache[require.resolve("../lib/server-info")];
  delete require.cache[require.resolve("../lib/claude-home")];
  process.env.CLAUDE_HOME = CLAUDE_HOME;
  process.env.DASHBOARD_DATA_DIR = dataDir;
  return require("../lib/server-info");
}

function writeDiscovery(servers) {
  const infoPath = path.join(CLAUDE_HOME, ".agent-dashboard.json");
  fs.mkdirSync(CLAUDE_HOME, { recursive: true });
  const recent = servers.reduce((a, b) =>
    Date.parse(b.startedAt) > Date.parse(a.startedAt) ? b : a
  );
  fs.writeFileSync(
    infoPath,
    JSON.stringify(
      { port: recent.port, pid: recent.pid, startedAt: recent.startedAt, servers },
      null,
      2
    )
  );
}

describe("server-info hook ingest deduplication", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(DATA_DIR_A, { recursive: true });
    fs.mkdirSync(DATA_DIR_B, { recursive: true });
  });

  afterEach(() => {
    delete process.env.CLAUDE_DASHBOARD_PORT;
    fs.rmSync(TMP, { recursive: true, force: true });
    delete require.cache[require.resolve("../lib/server-info")];
    delete require.cache[require.resolve("../lib/claude-home")];
  });

  it("dedupes hook targets when two live servers share one dataDir", () => {
    const mod = freshModule(DATA_DIR_A);
    writeDiscovery([
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
      },
      {
        port: 4821,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_A,
      },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820]);
    assert.deepEqual(mod.resolveAllDashboardPorts(), [4820, 4821]);
  });

  it("fans out when live servers use different data directories", () => {
    const mod = freshModule(DATA_DIR_A);
    writeDiscovery([
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
      },
      {
        port: 4900,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_B,
      },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820, 4900]);
  });

  it("treats legacy entries without dataDir as unique per port", () => {
    const mod = freshModule(DATA_DIR_A);
    writeDiscovery([
      { port: 4820, pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z" },
      { port: 4821, pid: process.pid, startedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820, 4821]);
  });

  it("records dataDir when writing server info", () => {
    const mod = freshModule(DATA_DIR_A);
    mod.writeServerInfo(4999);
    const raw = JSON.parse(fs.readFileSync(mod.getServerInfoPath(), "utf8"));
    const entry = raw.servers.find((s) => s.port === 4999);
    assert.ok(entry);
    assert.equal(mod.normalizeDataDir(entry.dataDir), mod.normalizeDataDir(DATA_DIR_A));
  });

  it("honors CLAUDE_DASHBOARD_PORT for hook ingest", () => {
    const mod = freshModule(DATA_DIR_A);
    process.env.CLAUDE_DASHBOARD_PORT = "7777";
    writeDiscovery([
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
      },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [7777]);
  });
});
