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
const { spawn } = require("node:child_process");

const START = parseInt(process.env.DASHBOARD_PORT || "4820", 10);
const RANGE = 40;

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
  } else {
    console.log(`[dev] dashboard server will listen on :${port}`);
  }

  const child = spawn(
    "npx",
    [
      "--no-install",
      "concurrently",
      "-n",
      "server,client",
      "-c",
      "blue,green",
      "npm run dev:server",
      "npm run dev:client",
    ],
    {
      stdio: "inherit",
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
