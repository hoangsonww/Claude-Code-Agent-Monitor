/**
 * @file Tests for the `ccam stop` CLI command. Verifies: server not running
 * (early exit), graceful SIGTERM shutdown, SIGKILL escalation when the process
 * ignores SIGTERM, stale PID in discovery, and missing discovery file.
 *
 * Each test spawns a disposable child process that serves /api/health AND is
 * the kill target — matching the real dashboard lifecycle where cmdStop()
 * health-checks the same process it later signals.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn } = require("child_process");

const STAMP = `ccam-stop-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const CLAUDE_HOME = path.join(TMP, "home");

const CLI = path.resolve(__dirname, "..", "..", "bin", "ccam.js");

/**
 * Run `ccam stop` with the given env overrides.
 * @param {object} envOverrides
 * @returns {Promise<{code: number, out: string, err: string}>}
 */
function ccamStop(envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, "stop"], {
      env: { ...process.env, CLAUDE_HOME, ...envOverrides },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const killer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code, out, err });
    });
  });
}

/**
 * Write a discovery file with the given servers array.
 * @param {number} port
 * @param {number} pid
 */
function writeDiscovery(port, pid) {
  const infoPath = path.join(CLAUDE_HOME, ".agent-dashboard.json");
  fs.mkdirSync(CLAUDE_HOME, { recursive: true });
  const entry = { port, pid, startedAt: new Date().toISOString(), dataDir: TMP };
  fs.writeFileSync(
    infoPath,
    JSON.stringify({ port, pid, startedAt: entry.startedAt, servers: [entry] }, null, 2)
  );
}

/**
 * Spawn a child process that serves /api/health on a random port and reports
 * the port back via IPC. This child IS the process that cmdStop will signal,
 * matching the real-world flow where the health endpoint and the kill target
 * are the same process.
 *
 * @param {object} opts
 * @param {boolean} [opts.ignoreSigterm=false] If true, the child ignores SIGTERM
 *   (used to test SIGKILL escalation).
 * @returns {Promise<{child: import("child_process").ChildProcess, port: number}>}
 */
function spawnDashboardTarget({ ignoreSigterm = false } = {}) {
  const script = `
    const http = require("http");
    ${ignoreSigterm ? 'process.on("SIGTERM", () => { /* ignore */ });' : ""}
    const srv = http.createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    srv.listen(0, "127.0.0.1", () => {
      process.send({ port: srv.address().port });
    });
  `;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", script], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      detached: true,
    });
    child.on("message", (msg) => {
      child.unref();
      child.disconnect();
      resolve({ child, port: msg.port });
    });
  });
}

/**
 * Check if a process is alive.
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait until the test-owned target has been reaped after it receives a signal.
 * `process.kill(pid, "SIGKILL")` confirms signal delivery, but the parent's
 * immediate PID probe can run before Node has emitted the child's exit event.
 *
 * @param {import("node:child_process").ChildProcess} child
 * @param {number} [timeoutMs=1500]
 * @returns {Promise<void>}
 */
function waitForChildExit(child, timeoutMs = 1500) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      reject(new Error(`target process ${child.pid} did not exit within ${timeoutMs} ms`));
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

describe("ccam stop — server not running", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(CLAUDE_HOME, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("reports nothing to stop when server is not reachable", async () => {
    const { code, out } = await ccamStop({ DASHBOARD_PORT: "1" });
    assert.equal(code, 0);
    assert.match(out, /not running|nothing to stop/i);
  });
});

describe("ccam stop — graceful shutdown", () => {
  let target;

  beforeEach(async () => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(CLAUDE_HOME, { recursive: true });
    target = await spawnDashboardTarget();
    writeDiscovery(target.port, target.child.pid);
  });

  afterEach(() => {
    if (target && isAlive(target.child.pid)) {
      try {
        process.kill(target.child.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("stops the server gracefully via SIGTERM", async () => {
    const { code, out } = await ccamStop({ DASHBOARD_PORT: String(target.port) });
    assert.equal(code, 0);
    assert.match(out, /stopped/i);
    // Verify the target process is actually gone
    assert.equal(isAlive(target.child.pid), false, "target should be dead after stop");
    // Verify the health endpoint is unreachable
    await assert.rejects(
      () =>
        new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${target.port}/api/health`, resolve);
          req.on("error", reject);
        }),
      { code: "ECONNREFUSED" }
    );
  });
});

describe("ccam stop — SIGKILL escalation", () => {
  // On Windows, SIGTERM cannot be trapped/ignored — the OS terminates the
  // process immediately. The SIGKILL escalation path is only exercisable on
  // POSIX systems where a process can install a SIGTERM handler that no-ops.
  const isWindows = process.platform === "win32";
  let target;

  beforeEach(async () => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(CLAUDE_HOME, { recursive: true });
    target = await spawnDashboardTarget({ ignoreSigterm: !isWindows });
    writeDiscovery(target.port, target.child.pid);
  });

  afterEach(() => {
    if (target && isAlive(target.child.pid)) {
      try {
        process.kill(target.child.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("escalates to SIGKILL when process ignores SIGTERM", { skip: isWindows }, async () => {
    const { code, out } = await ccamStop({ DASHBOARD_PORT: String(target.port) });
    assert.equal(code, 0);
    assert.match(out, /stopped.*forced/i);
    await waitForChildExit(target.child);
    assert.equal(isAlive(target.child.pid), false, "target should be dead after forced stop");
  });

  it(
    "stops the process even on platforms where SIGTERM cannot be ignored",
    { skip: !isWindows },
    async () => {
      const { code, out } = await ccamStop({ DASHBOARD_PORT: String(target.port) });
      assert.equal(code, 0);
      assert.match(out, /stopped/i);
      assert.equal(isAlive(target.child.pid), false, "target should be dead after stop");
    }
  );
});

describe("ccam stop — stale PID", () => {
  let target;

  beforeEach(async () => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(CLAUDE_HOME, { recursive: true });
    // Start a real target just for the health check to pass
    target = await spawnDashboardTarget();
    // Write discovery with a PID that doesn't exist
    writeDiscovery(target.port, 2147483647);
  });

  afterEach(() => {
    if (target && isAlive(target.child.pid)) {
      try {
        process.kill(target.child.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("exits 1 when the PID in discovery is not running", async () => {
    const { code, out, err } = await ccamStop({ DASHBOARD_PORT: String(target.port) });
    assert.equal(code, 1);
    assert.match(out + err, /not running|stale/i);
  });
});

describe("ccam stop — missing discovery file", () => {
  let target;

  beforeEach(async () => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(CLAUDE_HOME, { recursive: true });
    // Start a real target for the health check but do NOT write discovery
    target = await spawnDashboardTarget();
  });

  afterEach(() => {
    if (target && isAlive(target.child.pid)) {
      try {
        process.kill(target.child.pid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("exits 1 with helpful error when discovery file is missing", async () => {
    const { code, out, err } = await ccamStop({ DASHBOARD_PORT: String(target.port) });
    assert.equal(code, 1);
    assert.match(out + err, /could not determine|PID/i);
  });
});
