/**
 * @file Hosts the existing Express server in-process.
 *
 * The dashboard's `server/index.js` already exports `{ createApp, startServer }`
 * and serves the built React client (`client/dist`) as static assets in
 * production. We import that module directly — no child process, no IPC, no
 * port marshalling — and start it on a free port. The whole thing keeps the
 * desktop shell to "Electron is a window onto the same code."
 *
 * If another process is already listening on the preferred port and that
 * process answers `/api/health` with `{ status: "ok" }`, we adopt it instead
 * of starting a second server. This covers the case where the user already
 * runs `npm start` in a terminal — we should not double-bind.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import * as fs from "node:fs";
import * as http from "node:http";
import Module from "node:module";
import * as net from "node:net";
import * as path from "node:path";
import { app } from "electron";

import { FALLBACK_PORT_RANGE, HEALTH_TIMEOUT_MS, PREFERRED_PORT } from "./constants";
import { log } from "./logger";

/**
 * Redirect `require("better-sqlite3")` from anywhere in the embedded server
 * to the copy in `desktop/node_modules`, which has been rebuilt against
 * Electron's Node ABI by `electron-builder install-app-deps`. The repo-root
 * copy is intentionally left built for the system Node so `npm run test:server`
 * continues to work for contributors. This patch is process-local — it does
 * not affect any other Node process.
 *
 * The patch is installed exactly once before we require the server module.
 */
let nativeModulesPatched = false;
function ensureNativeModulesPatched(): void {
  if (nativeModulesPatched) return;
  nativeModulesPatched = true;

  // Resolve the desktop-local better-sqlite3 from this file's location so we
  // get the ABI-correct binary regardless of where the require originates.
  let desktopBetterSqlite: string;
  try {
    desktopBetterSqlite = require.resolve("better-sqlite3");
  } catch (err) {
    log.warn("could not pre-resolve desktop better-sqlite3; server may fall back", err);
    return;
  }

  // Module._resolveFilename is Node's internal lookup. We override it to
  // short-circuit "better-sqlite3" requests; everything else passes through.
  // Using a typed shim instead of `any` to keep strict mode honest.
  type ResolveFn = (
    request: string,
    parent: NodeJS.Module | null | undefined,
    isMain: boolean,
    options?: { paths?: string[] }
  ) => string;
  const mod = Module as unknown as { _resolveFilename: ResolveFn };
  const original = mod._resolveFilename.bind(Module);
  mod._resolveFilename = function (request, parent, isMain, options) {
    if (request === "better-sqlite3") return desktopBetterSqlite;
    return original(request, parent, isMain, options);
  };
  log.info("native module redirect installed", { betterSqlite3: desktopBetterSqlite });
}

export interface ServerHandle {
  /** Origin (e.g. `http://127.0.0.1:4820`) used by the window. */
  url: string;
  port: number;
  /** True when the server is owned by us (and we should stop it on quit). */
  ownedByUs: boolean;
  stop: () => Promise<void>;
}

interface ServerModule {
  createApp: () => unknown;
  startServer: (app: unknown, port: number) => Promise<http.Server>;
  startBackgroundServices: () => void;
}

/**
 * One-time bootstrap of the services that the standalone `node server/index.js`
 * path runs from its `require.main === module` block — the update scheduler,
 * the Claude Code config watcher, orphaned-run reconciliation, and Claude Code
 * hook installation. The desktop shell `require()`s the server module, so that
 * block never fires; without this the embedded server is a degraded copy.
 *
 * Guarded so a "Restart Server" does not double-register schedulers/watchers.
 */
let backgroundServicesStarted = false;
function bootstrapOwnedServer(appRoot: string, serverModule: ServerModule): void {
  if (backgroundServicesStarted) return;
  backgroundServicesStarted = true;

  try {
    serverModule.startBackgroundServices();
    log.info("background services started");
  } catch (err) {
    log.warn("startBackgroundServices failed", err);
  }

  // Auto-install Claude Code hooks so a DMG-only user gets events flowing
  // without having to run `npm run install-hooks` from a checkout.
  try {
    const hooks = require(path.join(appRoot, "scripts", "install-hooks.js")) as {
      installHooks: (silent?: boolean) => boolean;
    };
    hooks.installHooks(true);
    log.info("Claude Code hooks ensured");
  } catch (err) {
    log.warn("hook auto-install failed", err);
  }
}

/**
 * Status snapshot for the tray menu. Sourced from the live server's
 * `/api/stats` endpoint rather than a direct SQLite read, so the numbers stay
 * correct whether we started the server in-process or adopted an external one
 * already listening on the port. (A second SQLite handle opened from the
 * desktop process can point at a different/empty database file — or fail
 * against the read-only `.app` bundle path — which previously pinned the menu
 * at 0/0/0.)
 *
 * The HTTP fetch is asynchronous but the tray menu is built synchronously on
 * click, so we poll on an interval and serve the last cached value. Returns
 * `null` until the first successful poll completes.
 */
export interface ServerSnapshot {
  activeSessions: number;
  workingAgents: number;
  eventsToday: number;
}

let lastSnapshot: ServerSnapshot | null = null;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

export function getServerSnapshot(): ServerSnapshot | null {
  return lastSnapshot;
}

/**
 * Fetch a fresh snapshot from the running server's stats API. Resolves to
 * `null` on any error (server not up yet, non-200, malformed JSON) so the
 * poller can simply keep the previous cached value.
 */
function fetchSnapshotOverHttp(port: number, timeoutMs = 2500): Promise<ServerSnapshot | null> {
  // Server expects tz_offset in minutes (Date#getTimezoneOffset) to compute
  // "events today" against the user's local midnight.
  const tzOffset = new Date().getTimezoneOffset();
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: `/api/stats?tz_offset=${tzOffset}`,
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (buf += chunk));
        res.on("end", () => {
          try {
            const j = JSON.parse(buf) as {
              active_sessions?: number;
              events_today?: number;
              agents_by_status?: Record<string, number>;
            };
            resolve({
              activeSessions: Number(j.active_sessions) || 0,
              // "working" specifically — waiting/idle agents are not working.
              workingAgents: Number(j.agents_by_status?.working) || 0,
              eventsToday: Number(j.events_today) || 0,
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/** Poll once now and update the cache. Safe to call on demand (e.g. menu open). */
export async function refreshServerSnapshot(port: number | null): Promise<void> {
  if (!port) return;
  const snap = await fetchSnapshotOverHttp(port);
  if (snap) lastSnapshot = snap;
}

/**
 * Begin polling the server's stats endpoint so the tray menu always reflects
 * recent state. Idempotent — a second call (e.g. after "Restart Server") is a
 * no-op. The timer is unref'd so it never keeps the event loop alive on quit.
 */
export function startSnapshotPolling(getPort: () => number | null, intervalMs = 4000): void {
  if (snapshotTimer) return;
  const tick = (): void => {
    void refreshServerSnapshot(getPort());
  };
  tick();
  snapshotTimer = setInterval(tick, intervalMs);
  snapshotTimer.unref?.();
}

/**
 * Close the embedded SQLite handle so WAL is checkpointed cleanly. Call once on
 * application quit — never between restarts, since `server/db.js` is a cached
 * singleton and a closed handle would break a subsequent server start.
 */
export function closeEmbeddedDatabase(): void {
  try {
    const dbModule = require(path.join(resolveAppRoot(), "server", "db.js")) as {
      db?: { open?: boolean; close: () => void };
    };
    if (dbModule.db && dbModule.db.open !== false) {
      dbModule.db.close();
      log.info("embedded database closed");
    }
  } catch (err) {
    log.warn("failed to close embedded database", err);
  }
  // Remove our entry from the multi-server discovery file so the hook
  // handler doesn't try to POST to this PID after the process is gone.
  // (Stale entries also self-prune via the liveness check on read, but the
  // explicit removal closes the window between quit and the next reader.)
  try {
    const serverInfo = require(path.join(resolveAppRoot(), "server", "lib", "server-info.js")) as {
      removeServerInfo: () => void;
    };
    serverInfo.removeServerInfo();
  } catch (err) {
    log.warn("failed to remove discovery file entry", err);
  }
}

/**
 * Resolve the directory that contains the bundled `server/` and `client/dist/`.
 * In the packaged DMG these live under `Resources/app/`. In `npm run dev` they
 * live at the repo root (one directory up from `desktop/`).
 */
function resolveAppRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app");
  }
  // Dev: desktop/out/main.js → ../.. = repo root.
  return path.resolve(__dirname, "..", "..");
}

async function probePort(port: number, timeoutMs = 1500): Promise<"healthy" | "busy" | "free"> {
  // 1. Is anything listening? Try to connect.
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (v: boolean) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });

  if (!reachable) return "free";

  // 2. Does it answer /api/health like our server would?
  const healthy = await new Promise<boolean>((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/api/health", timeout: timeoutMs },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (buf += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(buf);
            resolve(parsed?.status === "ok");
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });

  return healthy ? "healthy" : "busy";
}

async function pickFreePort(): Promise<number> {
  // Prefer the project's documented port. Otherwise scan a private range.
  const initial = await probePort(PREFERRED_PORT);
  if (initial === "free") return PREFERRED_PORT;

  // Try the next 9 well-known fallbacks first (4821..4829) before going random.
  for (let p = PREFERRED_PORT + 1; p < PREFERRED_PORT + 10; p++) {
    if ((await probePort(p)) === "free") return p;
  }
  for (let p = FALLBACK_PORT_RANGE.min; p <= FALLBACK_PORT_RANGE.max; p++) {
    if ((await probePort(p)) === "free") return p;
  }
  throw new Error("Could not find a free TCP port for the dashboard server.");
}

async function waitForHealthy(port: number, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await probePort(port, 500)) === "healthy") return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server on port ${port} did not become healthy within ${timeoutMs}ms.`);
}

/**
 * Bring up the dashboard server. Returns a handle the caller uses to point
 * the BrowserWindow and to shut down cleanly on quit.
 *
 * Two environment overrides exist primarily for testing:
 *   - `CCAM_DESKTOP_BIND_PORT`: bind exactly this port (no adoption, no fallback).
 *     Used by the smoke test to verify the spawned process actually started a
 *     server rather than finding an unrelated one.
 *   - `CCAM_DESKTOP_NO_ADOPT=1`: skip the "is there already a healthy server
 *     on 4820?" check and always start our own.
 */
export async function startEmbeddedServer(): Promise<ServerHandle> {
  const forcedPort = process.env.CCAM_DESKTOP_BIND_PORT
    ? parseInt(process.env.CCAM_DESKTOP_BIND_PORT, 10)
    : null;
  const noAdopt = process.env.CCAM_DESKTOP_NO_ADOPT === "1" || forcedPort !== null;

  if (!noAdopt) {
    // Adopt an already-running healthy server (e.g. user has `npm start` open).
    const adopt = await probePort(PREFERRED_PORT);
    if (adopt === "healthy") {
      log.info("adopting existing healthy server on port", PREFERRED_PORT);
      return {
        url: `http://127.0.0.1:${PREFERRED_PORT}`,
        port: PREFERRED_PORT,
        ownedByUs: false,
        stop: async () => {
          /* not ours to stop */
        },
      };
    }
  }

  const port = forcedPort ?? (await pickFreePort());
  const appRoot = resolveAppRoot();
  const serverEntry = path.join(appRoot, "server", "index.js");

  // The server reads from process.env. Set everything up before require()ing.
  process.env.NODE_ENV = "production";
  process.env.DASHBOARD_PORT = String(port);

  // The server now defaults its writable state (SQLite DB, VAPID keys,
  // transcript snapshots) to the shared user-global `~/.claude/agent-dashboard/`
  // — outside the read-only `.app`/installed bundle AND identical to what
  // `npm start`/`npm run dev` use, so the desktop app and the web app share ONE
  // database. We therefore no longer override DASHBOARD_DATA_DIR to this app's
  // private `userData/data`.
  //
  // Earlier desktop builds DID write there, so point the server's one-time
  // migration at that old per-user DB: on first launch with no shared DB yet,
  // it copies this app's accumulated history into the canonical location
  // (non-destructively — the old file is left untouched as a backup).
  if (!process.env.DASHBOARD_DATA_DIR && !process.env.DASHBOARD_LEGACY_DB_PATH) {
    const legacyDbPath = path.join(app.getPath("userData"), "data", "dashboard.db");
    if (fs.existsSync(legacyDbPath)) {
      process.env.DASHBOARD_LEGACY_DB_PATH = legacyDbPath;
      log.info("legacy desktop database available for migration", { legacyDbPath });
    }
  }

  // Make sure server's `require("better-sqlite3")` finds the ABI-correct copy.
  ensureNativeModulesPatched();

  log.info("starting embedded server", { port, serverEntry, appRoot });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serverModule = require(serverEntry) as ServerModule;

  const expressApp = serverModule.createApp();
  const httpServer = await serverModule.startServer(expressApp, port);

  await waitForHealthy(port);
  log.info("embedded server healthy", { port });

  // Bring up the same background services the standalone server path runs.
  // Skipped automatically on a "Restart Server" via the one-time guard.
  bootstrapOwnedServer(appRoot, serverModule);

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    ownedByUs: true,
    stop: () =>
      new Promise<void>((resolve) => {
        try {
          httpServer.close(() => resolve());
          // Force-close lingering websocket connections after a short grace.
          setTimeout(() => resolve(), 2000).unref();
        } catch {
          resolve();
        }
      }),
  };
}
