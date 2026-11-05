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
const originalDashboardPort = process.env.CLAUDE_DASHBOARD_PORT;
const originalDashboardDbPath = process.env.DASHBOARD_DB_PATH;
const originalDashboardDataDir = process.env.DASHBOARD_DATA_DIR;
const originalClaudeHomeEnv = process.env.CLAUDE_HOME;
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const originalLocalAppData = process.env.LOCALAPPDATA;
const originalXdgDataHome = process.env.XDG_DATA_HOME;
const originalHomedir = os.homedir;

function freshModule(dataDir, claudeHome = CLAUDE_HOME, claudeConfigDir) {
  delete require.cache[require.resolve("../lib/server-info")];
  delete require.cache[require.resolve("../lib/claude-home")];
  if (claudeHome) process.env.CLAUDE_HOME = claudeHome;
  else delete process.env.CLAUDE_HOME;
  if (claudeConfigDir) process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;
  else delete process.env.CLAUDE_CONFIG_DIR;
  process.env.DASHBOARD_DATA_DIR = dataDir;
  return require("../lib/server-info");
}

function writeDiscovery(infoPath, servers) {
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
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
    delete process.env.CLAUDE_DASHBOARD_PORT;
    delete process.env.CLAUDE_CONFIG_DIR;
    fs.rmSync(TMP, { recursive: true, force: true });
    os.homedir = () => TMP;
    process.env.LOCALAPPDATA = path.join(TMP, "local-app-data");
    process.env.XDG_DATA_HOME = path.join(TMP, "xdg-data");
    fs.mkdirSync(DATA_DIR_A, { recursive: true });
    fs.mkdirSync(DATA_DIR_B, { recursive: true });
  });

  afterEach(() => {
    if (originalDashboardPort === undefined) delete process.env.CLAUDE_DASHBOARD_PORT;
    else process.env.CLAUDE_DASHBOARD_PORT = originalDashboardPort;
    if (originalDashboardDbPath === undefined) delete process.env.DASHBOARD_DB_PATH;
    else process.env.DASHBOARD_DB_PATH = originalDashboardDbPath;
    if (originalDashboardDataDir === undefined) delete process.env.DASHBOARD_DATA_DIR;
    else process.env.DASHBOARD_DATA_DIR = originalDashboardDataDir;
    if (originalClaudeHomeEnv === undefined) delete process.env.CLAUDE_HOME;
    else process.env.CLAUDE_HOME = originalClaudeHomeEnv;
    if (originalClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = originalLocalAppData;
    if (originalXdgDataHome === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = originalXdgDataHome;
    os.homedir = originalHomedir;
    fs.rmSync(TMP, { recursive: true, force: true });
    delete require.cache[require.resolve("../lib/server-info")];
    delete require.cache[require.resolve("../lib/claude-home")];
  });

  it("dedupes hook targets when two live servers share one dataDir", () => {
    const mod = freshModule(DATA_DIR_A);
    const claudeHome = mod.normalizeClaudeHome(CLAUDE_HOME);
    writeDiscovery(mod.getServerInfoPath(), [
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
        claudeHome,
      },
      {
        port: 4821,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_A,
        claudeHome,
      },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820]);
    assert.deepEqual(mod.resolveAllDashboardPorts(), [4820, 4821]);
  });

  it("fans out when live servers use different data directories", () => {
    const mod = freshModule(DATA_DIR_A);
    const claudeHome = mod.normalizeClaudeHome(CLAUDE_HOME);
    writeDiscovery(mod.getServerInfoPath(), [
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
        claudeHome,
      },
      {
        port: 4900,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_B,
        claudeHome,
      },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820, 4900]);
  });

  it("treats legacy entries in the default home's private registry as unique per port", () => {
    const mod = freshModule(DATA_DIR_A, path.join(TMP, ".claude"));
    writeDiscovery(mod.getServerInfoPath(), [
      { port: 4820, pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z" },
      { port: 4821, pid: process.pid, startedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), [4820, 4821]);
  });

  it("scopes shared-registry hook targets to the resolved Claude home", () => {
    const mod = freshModule(DATA_DIR_A);
    const currentHome = mod.normalizeClaudeHome(CLAUDE_HOME);
    const otherHome = mod.normalizeClaudeHome(OTHER_CLAUDE_HOME);
    writeDiscovery(mod.getServerInfoPath(), [
      {
        port: 4820,
        pid: process.pid,
        startedAt: "2026-01-01T00:00:00.000Z",
        dataDir: DATA_DIR_A,
        claudeHome: currentHome,
      },
      {
        port: 4821,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_B,
        claudeHome: currentHome,
      },
      {
        port: 4900,
        pid: process.pid,
        startedAt: "2026-01-03T00:00:00.000Z",
        dataDir: path.join(TMP, "other-data"),
        claudeHome: otherHome,
      },
    ]);

    assert.deepEqual(mod.resolveHookIngestPorts(), [4820, 4821]);

    const configDirMod = freshModule(DATA_DIR_A, null, CLAUDE_HOME);
    assert.deepEqual(configDirMod.resolveHookIngestPorts(), [4820, 4821]);

    const otherHomeMod = freshModule(DATA_DIR_B, OTHER_CLAUDE_HOME);
    assert.deepEqual(otherHomeMod.resolveHookIngestPorts(), [4900]);
  });

  it("does not route relocated-home hooks to ambiguous legacy registry entries", () => {
    const mod = freshModule(DATA_DIR_A);
    writeDiscovery(mod.getServerInfoPath(), [
      { port: 4820, pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    assert.deepEqual(mod.resolveHookIngestPorts(), []);
  });

  it("does not infer hook ownership from port 4820 when the registry is empty", () => {
    const mod = freshModule(DATA_DIR_A);
    assert.deepEqual(mod.resolveHookIngestPorts(), []);
    assert.deepEqual(mod.resolveAllDashboardPorts(), [mod.DEFAULT_PORT]);
  });

  it("records dataDir and the resolved Claude home when writing server info", () => {
    const mod = freshModule(DATA_DIR_A);
    mod.writeServerInfo(4999);
    const raw = JSON.parse(fs.readFileSync(mod.getServerInfoPath(), "utf8"));
    const entry = raw.servers.find((s) => s.port === 4999);
    assert.ok(entry);
    assert.equal(mod.normalizeDataDir(entry.dataDir), mod.normalizeDataDir(DATA_DIR_A));
    assert.equal(entry.claudeHome, mod.normalizeClaudeHome(CLAUDE_HOME));
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
    writeDiscovery(second.getServerInfoPath(), [
      {
        port: 4821,
        pid: process.pid,
        startedAt: "2026-01-02T00:00:00.000Z",
        dataDir: DATA_DIR_A,
      },
    ]);

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

  it(
    "uses one ownership directory for symlink and target database paths",
    { skip: process.platform === "win32" ? "file symlink creation is privilege-dependent" : false },
    () => {
      const targetDir = path.join(TMP, "real-db");
      const databasePath = path.join(targetDir, "dashboard.db");
      const linkedPath = path.join(TMP, "linked-dashboard.db");
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(databasePath, "");
      fs.symlinkSync(databasePath, linkedPath, "file");

      process.env.DASHBOARD_DB_PATH = databasePath;
      const direct = freshModule(DATA_DIR_A);
      const directOwner = direct.getDataDirOwnerPath();

      process.env.DASHBOARD_DB_PATH = linkedPath;
      const linked = freshModule(DATA_DIR_B, OTHER_CLAUDE_HOME);
      assert.equal(linked.getDataDirOwnerPath(), directOwner);
    }
  );

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
    writeDiscovery(mod.getServerInfoPath(), [
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
