/**
 * @file Desktop smoke test.
 *
 * Boots the compiled main process under Electron, then probes the embedded
 * dashboard server's /api/health endpoint. This is intentionally minimal:
 * it does not exercise the BrowserWindow (which requires a display) so it
 * runs on headless CI without xvfb. The window itself is covered by manual
 * QA in the PR description.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, "..");
const MAIN_JS = path.join(DESKTOP_ROOT, "out", "main.js");
// Resolve the actual Electron executable (electron.exe on Windows, the binary
// under Electron.app on macOS). The `.bin/electron` shim is extension-less and
// cannot be spawned without a shell on Windows; `require("electron")` returns
// the real binary path on every platform.
const ELECTRON_BIN = createRequire(import.meta.url)("electron");

const HEALTH_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

/** Resolve when GET /api/health on any of these ports answers ok. */
async function waitForHealth(ports, deadline) {
  while (Date.now() < deadline) {
    for (const port of ports) {
      const ok = await probeHealth(port);
      if (ok) return port;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`No port answered /api/health within ${HEALTH_TIMEOUT_MS}ms (tried ${ports})`);
}

function probeHealth(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1500 }, (res) => {
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (buf += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(buf)?.status === "ok");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

let electronProc;
// Pick a unique high port for each test run so we never accidentally probe an
// unrelated server (e.g. the user's own `npm start` on 4820). The env var
// `CCAM_DESKTOP_BIND_PORT` tells the desktop process to bind exactly this port,
// skipping the "adopt an existing healthy server" code path.
const TEST_PORT = 50000 + Math.floor(Math.random() * 5000);

// On POSIX, spawn the Electron parent as a process-group leader so we can
// signal the whole tree (helpers, embedded server) with one kill(-pid).
// Without this, SIGTERM only hits the parent and leaves helpers alive,
// keeping the stdio pipes open and hanging `node --test` indefinitely.
const IS_POSIX = process.platform !== "win32";

/** Kill the Electron process tree and resolve when it's actually gone. */
async function killElectronTree(proc, { timeoutMs = 5_000 } = {}) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  proc.killedByTest = true;

  const signalGroup = (sig) => {
    try {
      if (IS_POSIX && proc.pid) process.kill(-proc.pid, sig);
      else proc.kill(sig);
    } catch {
      /* group may already be gone */
    }
  };

  const exited = once(proc, "exit");
  signalGroup("SIGTERM");

  const timer = new Promise((resolve) => setTimeout(resolve, timeoutMs, "timeout"));
  const winner = await Promise.race([exited.then(() => "exit"), timer]);
  if (winner === "timeout") {
    signalGroup("SIGKILL");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 2_000))]);
  }
}

describe("desktop smoke", () => {
  before(async () => {
    electronProc = spawn(ELECTRON_BIN, [MAIN_JS], {
      cwd: DESKTOP_ROOT,
      detached: IS_POSIX,
      env: {
        ...process.env,
        // Suppress the BrowserWindow on the test runner; we only care that
        // the server boots cleanly.
        ELECTRON_DISABLE_GPU: "1",
        ELECTRON_ENABLE_LOGGING: "1",
        CCAM_DESKTOP_VERBOSE: "1",
        CCAM_DESKTOP_BIND_PORT: String(TEST_PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    electronProc.stdout.on("data", (b) => process.stdout.write(`[electron] ${b}`));
    electronProc.stderr.on("data", (b) => process.stderr.write(`[electron] ${b}`));

    electronProc.on("exit", (code, signal) => {
      if (!electronProc.killedByTest) {
        // eslint-disable-next-line no-console
        console.error(`electron exited unexpectedly: code=${code} signal=${signal}`);
      }
    });
  });

  after(async () => {
    await killElectronTree(electronProc);
  });

  it("brings up the embedded server and serves /api/health on the bound port", async () => {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const port = await waitForHealth([TEST_PORT], deadline);
    assert.equal(
      port,
      TEST_PORT,
      `desktop process should have bound CCAM_DESKTOP_BIND_PORT=${TEST_PORT}`
    );
    assert.ok(
      electronProc && !electronProc.killed && electronProc.exitCode === null,
      "electron process should still be alive when /api/health answers"
    );
  });
});
