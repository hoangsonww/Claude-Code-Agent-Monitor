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
const OTHER_CLAUDE_HOME = path.join(TMP, "other-home");
const DATA_DIR_A = path.join(TMP, "data-a");
const DATA_DIR_B = path.join(TMP, "data-b");

function freshModule(dataDir, claudeHome = CLAUDE_HOME) {
  delete require.cache[require.resolve("../lib/server-info")];
  delete require.cache[require.resolve("../lib/claude-home")];
  process.env.CLAUDE_HOME = claudeHome;
  process.env.DASHBOARD_DATA_DIR = dataDir;
  return require("../lib/server-info");
}

function writeDiscovery(servers, claudeHome = CLAUDE_HOME) {
  const infoPath = path.join(claudeHome, ".agent-dashboard.json");
  fs.mkdirSync(claudeHome, { recursive: true });
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

function writeDataDirOwner(dataDir, pid) {
  const ownerDir = path.join(dataDir, ".agent-dashboard-owners");
  fs.mkdirSync(ownerDir, { recursive: true });
  fs.writeFileSync(
    path.join(ownerDir, `${pid}.json`),
    JSON.stringify({ pid, startedAt: "2026-01-01T00:00:00.000Z" })
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
    delete process.env.DASHBOARD_DB_PATH;
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

  it("proves exclusive data ownership only from unambiguous shared markers", () => {
    const mod = freshModule(DATA_DIR_A);
    mod.writeServerInfo(4820);
    assert.equal(mod.hasExclusiveDataDirOwnership(), true);

    writeDataDirOwner(DATA_DIR_A, process.ppid);
    assert.equal(mod.hasExclusiveDataDirOwnership(), false);
    fs.unlinkSync(mod.getDataDirOwnerPath(process.ppid));
    assert.equal(mod.hasExclusiveDataDirOwnership(), true);

    writeDataDirOwner(DATA_DIR_B, process.ppid);
    assert.equal(mod.hasExclusiveDataDirOwnership(), true);

    const malformed = path.join(DATA_DIR_A, ".agent-dashboard-owners", "malformed.json");
    fs.writeFileSync(malformed, "not json");
    assert.equal(mod.hasExclusiveDataDirOwnership(), false);
    fs.unlinkSync(malformed);

    fs.unlinkSync(mod.getDataDirOwnerPath());
    assert.equal(mod.hasExclusiveDataDirOwnership(), false);
  });

  it("shares ownership signals across Claude homes that use the same data directory", () => {
    const first = freshModule(DATA_DIR_A);
    first.writeServerInfo(4820);
    writeDataDirOwner(DATA_DIR_A, process.ppid);

    const second = freshModule(DATA_DIR_A, OTHER_CLAUDE_HOME);
    writeDiscovery(
      [
        {
          port: 4821,
          pid: process.pid,
          startedAt: "2026-01-02T00:00:00.000Z",
          dataDir: DATA_DIR_A,
        },
      ],
      OTHER_CLAUDE_HOME
    );

    assert.equal(second.hasExclusiveDataDirOwnership(), false);
  });

  it("shares ownership signals across data dirs that point at one explicit database", () => {
    const databasePath = path.join(TMP, "pinned-db", "dashboard.db");
    process.env.DASHBOARD_DB_PATH = databasePath;
    const first = freshModule(DATA_DIR_A);
    first.writeServerInfo(4820);
    writeDataDirOwner(path.dirname(databasePath), process.ppid);

    const second = freshModule(DATA_DIR_B, OTHER_CLAUDE_HOME);
    second.writeServerInfo(4821);

    assert.equal(second.hasExclusiveDataDirOwnership(), false);
  });

  it("keeps its marker through graceful drain and prunes dead owners", () => {
    const mod = freshModule(DATA_DIR_A);
    mod.writeServerInfo(4820);
    assert.equal(fs.existsSync(mod.getDataDirOwnerPath()), true);

    mod.removeServerInfo();

    assert.equal(fs.existsSync(mod.getDataDirOwnerPath()), true);
    assert.equal(mod.hasExclusiveDataDirOwnership(), true);

    const deadPid = 2_147_483_647;
    writeDataDirOwner(DATA_DIR_A, deadPid);
    assert.equal(mod.hasExclusiveDataDirOwnership(), true);
    assert.equal(fs.existsSync(mod.getDataDirOwnerPath(deadPid)), false);
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
