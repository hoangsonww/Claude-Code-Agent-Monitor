#!/usr/bin/env node
/**
 * Dev orchestrator. Picks a free port for the dev server (starting at the
 * conventional 4820), exports it via `DASHBOARD_PORT`, then spawns the
 * existing concurrently pipeline. Both `dev:server` (server/index.js) and
 * `dev:client` (vite.config.ts) read the same env var, so they stay in
 * lockstep.
 *
 * Why this exists: on machines that hold 4820 via an SSH `LocalForward`,
 * SSH binds the loopback specifically (`127.0.0.1:4820` and `[::1]:4820`),
 * Node's wildcard `server.listen(4820)` "succeeds" without binding the
 * loopback, and every Vite proxy request to `localhost:4820` lands on SSH
 * instead of Express — silent `ECONNRESET`s everywhere. Probing both IP
 * families before we ever try to bind catches that.
 *
 * Built atop the macOS desktop app groundwork in PR #151 by @shuvamk.
 */

const net = require("node:net");
const http = require("node:http");
const { spawn } = require("node:child_process");

const START = parseInt(process.env.DASHBOARD_PORT || "4820", 10);
const RANGE = 40;

/** Resolve true if a healthy dashboard already answers /api/health on `port`. */
function healthyDashboardOn(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 600 }, (res) => {
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (buf += c));
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

function probeHost(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const done = (busy) => {
      sock.destroy();
      resolve(busy);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    sock.once("timeout", () => done(false));
  });
}

async function busy(port) {
  // IPv4 first (most common), IPv6 second. Either bind shadowing Node's
  // wildcard listen is enough to break the proxy.
  if (await probeHost("127.0.0.1", port, 600)) return true;
  if (await probeHost("::1", port, 300)) return true;
  return false;
}

async function pickPort() {
  for (let p = START; p < START + RANGE; p++) {
    if (!(await busy(p))) return p;
  }
  throw new Error(`No free port found in ${START}-${START + RANGE - 1}`);
}

(async () => {
  let port;
  try {
    port = await pickPort();
  } catch (err) {
    console.error(`[dev] ${err.message}`);
    process.exit(1);
  }
  if (port !== START) {
    console.log(
      `[dev] port ${START} is busy (something is on the loopback already — likely an SSH LocalForward); using ${port} instead`
    );
    // If the thing on the conventional port is itself a healthy dashboard, this
    // dev server will run alongside it on the SAME shared database. Claude Code
    // hooks fan out to every live dashboard, so each live event would be written
    // twice — inflating counts. Warn so the developer can stop the other one.
    if (await healthyDashboardOn(START)) {
      console.log(
        `[dev] ⚠ another dashboard is already running on :${START} and shares this database. ` +
          `Live hook events will be counted by BOTH — stop the other dashboard (e.g. the desktop app) for accurate dev data.`
      );
    }
  } else {
    console.log(`[dev] dashboard server will listen on :${port}`);
  }

  // On Windows `npx` is a `npx.cmd` shim that `spawn` can only launch through a
  // shell; without `shell: true` it fails with `spawn npx ENOENT`. POSIX has a
  // real `npx` on PATH and is unaffected. With a shell, Node does not re-quote
  // args, so the two space-containing `concurrently` commands must be quoted
  // ourselves to survive as single tokens (on POSIX they're already one array
  // element each, so we leave them bare).
  const isWin = process.platform === "win32";
  const cmd = (s) => (isWin ? `"${s}"` : s);
  const child = spawn(
    "npx",
    [
      "--no-install",
      "concurrently",
      "-n",
      "server,client",
      "-c",
      "blue,green",
      cmd("npm run dev:server"),
      cmd("npm run dev:client"),
    ],
    {
      stdio: "inherit",
      shell: isWin,
      env: { ...process.env, DASHBOARD_PORT: String(port) },
    }
  );

  // Propagate Ctrl-C / SIGTERM so concurrently can shut both legs down
  // gracefully instead of being orphaned.
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => child.kill(sig));
  }
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code || 0);
  });
})();
