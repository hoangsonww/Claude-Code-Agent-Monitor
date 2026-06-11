/**
 * @file Sets up the Express server with API routes and WebSocket, serves the React client in production, and includes periodic maintenance tasks like session cleanup and compaction scanning.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

// Load .env file (simple key=value, no external dependency needed)
(function loadDotEnv() {
  const fs = require("fs");
  const os = require("os");
  const envPath = require("path").resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val.replace(/^~(?=\/)/, os.homedir());
    }
  }
})();

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const swaggerUi = require("swagger-ui-express");
const { initWebSocket } = require("./websocket");
const { createOpenApiSpec } = require("./openapi");
const { writeServerInfo, removeServerInfo } = require("./lib/server-info");

const sessionsRouter = require("./routes/sessions");
const agentsRouter = require("./routes/agents");
const eventsRouter = require("./routes/events");
const statsRouter = require("./routes/stats");
const hooksRouter = require("./routes/hooks");
const analyticsRouter = require("./routes/analytics");
const pricingRouter = require("./routes/pricing");
const settingsRouter = require("./routes/settings");
const workflowsRouter = require("./routes/workflows");
const pushRouter = require("./routes/push");
const importRouter = require("./routes/import");
const updatesRouter = require("./routes/updates");
const ccConfigRouter = require("./routes/cc-config");
const runRouter = require("./routes/run");

function createApp() {
  const app = express();
  const openApiSpec = createOpenApiSpec();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/sessions", sessionsRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/hooks", hooksRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/workflows", workflowsRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/import", importRouter);
  app.use("/api/updates", updatesRouter);
  app.use("/api/cc-config", ccConfigRouter);
  app.use("/api/run", runRouter);
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "Agent Dashboard API Docs",
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}

function startServer(app, port) {
  const server = http.createServer(app);
  initWebSocket(server);

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    const clientDist = path.join(__dirname, "..", "client", "dist");
    // Cache policy designed to survive client rebuilds without forcing a hard
    // refresh:
    //   - Hashed bundles under /assets/ never change for a given URL, so cache
    //     them aggressively (immutable).
    //   - index.html, /sw.js, and /manifest.json *are* the cache-bust signal,
    //     so they must revalidate every load — without this the browser's
    //     heuristic cache happily serves a stale index.html that references
    //     asset hashes that no longer exist on disk.
    app.use(
      express.static(clientDist, {
        etag: true,
        lastModified: true,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return;
          }
          const base = path.basename(filePath);
          if (base === "index.html" || base === "sw.js" || base === "manifest.json") {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
            return;
          }
          // Other static files (favicon, og-image, etc.): short revalidation
          // window — long enough to be friendly, short enough to recover from
          // a typo without telling users to hard-refresh.
          res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
        },
      })
    );
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return new Promise((resolve) => {
    server.listen(port, () => {
      // Publish the live port so the Claude Code hook handler can find this
      // server even when it bound a non-default port (the desktop app falls
      // back off 4820 when that port is already taken).
      writeServerInfo(port);
      const mode = isProduction ? "production" : "development";
      console.log(`Agent Dashboard server running on http://localhost:${port} (${mode})`);
      if (!isProduction) {
        console.log(`Client dev server expected at http://localhost:5173`);
      }
      resolve(server);
    });
  });
}

/**
 * One-time bootstrap import of legacy Claude Code sessions from `~/.claude/`.
 *
 * Runs at most once per data directory, tracked by a `.legacy-import.done`
 * marker file written next to the database. A marker — rather than an "is the
 * DB empty?" check — is essential: the desktop app captures a live session via
 * hooks before the user ever thinks about history, so an emptiness check would
 * see a non-empty DB and skip the backfill forever, leaving every pre-existing
 * session missing from the dashboard. The import itself is idempotent
 * (per-session dedup), so running it against a DB that already holds some
 * sessions simply adds the missing ones.
 *
 * Fire-and-forget — the server does not await it. It lives in its own function
 * (rather than inline in the `require.main` block, where it used to sit) so
 * embedded hosts that call `startBackgroundServices()` — notably the desktop
 * app — get the same first-launch backfill instead of an empty dashboard.
 */
function autoImportLegacySessions() {
  try {
    const fs = require("fs");
    const dbModule = require("./db");
    const markerPath = path.join(path.dirname(dbModule.DB_PATH), ".legacy-import.done");
    if (fs.existsSync(markerPath)) return;

    const { importAllSessions, backfillCompactions } = require("../scripts/import-history");
    importAllSessions(dbModule)
      .then(({ imported, errors }) => {
        if (imported > 0) console.log(`Imported ${imported} legacy sessions from ~/.claude/`);
        if (errors > 0) console.log(`${errors} session files had errors during import`);
      })
      .then(() => backfillCompactions(dbModule))
      .then(({ backfilled }) => {
        if (backfilled > 0)
          console.log(`Backfilled ${backfilled} compaction events from ~/.claude/`);
      })
      // Write the marker only after the import completes, so a crash mid-import
      // retries on the next start instead of being skipped forever.
      .then(() => {
        try {
          fs.writeFileSync(markerPath, `${new Date().toISOString()}\n`);
        } catch {
          /* non-fatal — worst case the (idempotent) import re-runs next start */
        }
      })
      .catch(() => {});
  } catch (err) {
    console.warn("legacy session auto-import failed:", err.message);
  }
}

/**
 * Start the background services the dashboard relies on once the HTTP server
 * is listening: a one-time legacy-session import, the upstream update
 * scheduler, the Claude Code config watcher, and a one-time reconciliation of
 * orphaned run rows.
 *
 * Exported so alternative hosts can bring up the same services the standalone
 * `node server/index.js` path does. The desktop Electron shell `require()`s
 * this module instead of running it as the main entry, so the
 * `require.main === module` block below never executes for it.
 */
function startBackgroundServices() {
  // One-time legacy-session backfill (a no-op once its marker file exists).
  autoImportLegacySessions();

  const { startUpdateScheduler } = require("./update-scheduler");
  const { broadcast } = require("./websocket");
  startUpdateScheduler({ broadcast });
  try {
    const { startCcWatcher } = require("./lib/cc-watcher");
    startCcWatcher({ broadcast });
  } catch (err) {
    console.warn("cc-watcher failed to start:", err.message);
  }
  // Flip any dashboard_runs rows the previous process left flagged
  // running/spawning — those handles died with the previous server, so
  // there's no way to attach to them anymore. Marking them abandoned
  // keeps the Run history honest and unblocks Resume on conversation rows.
  try {
    const { reconcileOrphans } = require("./lib/dashboard-runs");
    const reconciled = reconcileOrphans();
    if (reconciled > 0) {
      console.log(`[runs] reconciled ${reconciled} orphan run(s) → abandoned`);
    }
  } catch (err) {
    console.warn("dashboard-runs reconciliation failed:", err.message);
  }
}

/**
 * Resolve true when a healthy dashboard already answers `/api/health` on
 * `port`. Used by the standalone entry point to avoid starting a SECOND server
 * on the now-shared database — two live servers would each persist the
 * fanned-out hook events and double-count them. Never rejects; any
 * error/timeout (nothing listening, or a non-dashboard process) resolves false.
 */
function probeDashboardHealth(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/api/health", timeout: timeoutMs },
      (res) => {
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
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

if (require.main === module) {
  const PORT = parseInt(process.env.DASHBOARD_PORT || "4820", 10);
  let httpServer = null;

  // Single-server guard: if a healthy dashboard already owns this port, don't
  // start a second one — both would write the fanned-out hook events into the
  // shared database, double-counting them. Point the user at the running
  // instance and exit. (`npm run dev` binds a free fallback port via
  // scripts/dev.js, so this only trips when the conventional port is already
  // serving a healthy dashboard — e.g. the desktop app, or another `npm start`.)
  //
  // Skip the guard under `node --watch` (dev:server): a watch restart briefly
  // races the old process on the same port, and adopting there would wedge
  // hot-reload. Dev already runs its own isolated server by design.
  const isWatchMode = process.execArgv.some((a) => a.startsWith("--watch"));
  probeDashboardHealth(PORT).then((alreadyRunning) => {
    if (alreadyRunning && !isWatchMode) {
      console.log(
        `Agent Dashboard is already running on http://localhost:${PORT} — not starting a ` +
          `second instance. Open that URL, or stop the other dashboard first.`
      );
      process.exit(0);
      return;
    }
    const app = createApp();
    startServer(app, PORT).then((server) => {
      httpServer = server;
      startBackgroundServices();
    });
  });

  // Graceful shutdown — close connections and DB cleanly
  let shutdownInProgress = false;
  const shutdown = (signal) => {
    if (shutdownInProgress) {
      console.log(`\n${signal} received again — forcing immediate exit.`);
      process.exit(1);
    }
    shutdownInProgress = true;
    console.log(`\n${signal} received — shutting down gracefully… (hit Ctrl+C again to force)`);
    if (httpServer) {
      httpServer.close(() => {
        console.log("HTTP server closed.");
      });
    }
    try {
      require("./db").db.close();
    } catch {
      /* already closed */
    }
    // Drop the port discovery file so a later run on a different port is not
    // shadowed by a stale entry. (A crash skips this — the PID-liveness check
    // in resolveDashboardPort() is the backstop for that case.)
    removeServerInfo();
    // Give in-flight work 5s to finish, then force exit
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Auto-install Claude Code hooks on every startup so users don't have to
  try {
    const { installHooks } = require("../scripts/install-hooks");
    installHooks(true);
    console.log("Claude Code hooks auto-configured.");
  } catch {
    // Non-fatal — user can run npm run install-hooks manually
  }

  // Periodic maintenance sweep:
  // 1. Mark abandoned sessions that slipped through event-based detection
  // 2. Scan active sessions' JSONL files for new compaction entries
  //    (/compact fires no hooks, so compaction agents only appear on next hook event
  //    without this scanner)
  //
  // Stale threshold: configurable via DASHBOARD_STALE_MINUTES env var.
  // Default 180 (3 hours) — long enough that a coffee break, lunch, or even
  // a meeting doesn't cause a Waiting session to flip to Abandoned/Completed
  // out from under the user. The previous 5-min default was the main reason
  // agents appeared to "go straight to completed" the moment Claude finished
  // a turn: any pause longer than 5 min reaped the session, marking its main
  // agent completed and emptying the Waiting column.
  const STALE_MINUTES = (() => {
    const raw = parseInt(process.env.DASHBOARD_STALE_MINUTES, 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 180;
  })();
  // Sweep interval: 1/4 of the stale threshold, clamped to [60s, 5 min].
  // Frequent enough to catch real abandonments quickly, cheap enough that
  // we're not hammering SQLite for nothing.
  const SWEEP_INTERVAL_MS = Math.max(60_000, Math.min(300_000, (STALE_MINUTES * 60_000) / 4));

  const cleanupDb = require("./db");
  const { broadcast } = require("./websocket");
  const { importCompactions } = require("../scripts/import-history");
  const { transcriptCache } = require("./routes/hooks");
  setInterval(() => {
    // 1. Stale session cleanup — batch agent updates to avoid N+1 queries
    const stale = cleanupDb.stmts.findStaleSessions.all("__periodic__", STALE_MINUTES);
    const now = new Date().toISOString();
    if (stale.length > 0) {
      const staleIds = stale.map((s) => s.id);
      const placeholders = staleIds.map(() => "?").join(",");

      // Batch update all non-terminal agents across all stale sessions
      cleanupDb.db
        .prepare(
          `UPDATE agents SET status = 'completed', ended_at = COALESCE(ended_at, ?), updated_at = ?
           WHERE session_id IN (${placeholders}) AND status NOT IN ('completed', 'error')`
        )
        .run(now, now, ...staleIds);

      for (const s of stale) {
        cleanupDb.stmts.updateSession.run(null, "abandoned", now, null, s.id);
        broadcast("session_updated", cleanupDb.stmts.getSession.get(s.id));

        // Evict transcript cache for abandoned sessions to bound memory growth.
        // Reads transcript_path off the session row (populated by hooks
        // ensureSession + one-time db.js backfill) instead of scanning events.
        const tpRow = cleanupDb.db
          .prepare("SELECT transcript_path AS tp FROM sessions WHERE id = ?")
          .get(s.id);
        if (tpRow?.tp) transcriptCache.invalidate(tpRow.tp);
      }

      // Broadcast updated agents once per stale session (not per-agent)
      for (const s of stale) {
        const agents = cleanupDb.stmts.listAgentsBySession.all(s.id);
        for (const agent of agents) {
          if (agent.status === "completed") {
            broadcast("agent_updated", agent);
          }
        }
      }
    }

    // 2. Scan active sessions for new compaction entries.
    // Reads from sessions.transcript_path (populated by hooks ensureSession +
    // one-time backfill in db.js migration) rather than scanning events —
    // O(active sessions) instead of O(events rows).
    const active = cleanupDb.db
      .prepare(
        "SELECT id AS session_id, transcript_path AS tp FROM sessions WHERE status = 'active' AND transcript_path IS NOT NULL ORDER BY updated_at DESC"
      )
      .all();
    for (const row of active) {
      if (!row.tp) continue;
      try {
        const compactions = transcriptCache.extractCompactions(row.tp);
        if (compactions.length === 0) continue;
        const mainAgentId = `${row.session_id}-main`;
        const created = importCompactions(cleanupDb, row.session_id, mainAgentId, compactions);
        if (created > 0) {
          broadcast(
            "agent_created",
            cleanupDb.stmts.getAgent.get(
              `${row.session_id}-compact-${compactions[compactions.length - 1].uuid}`
            )
          );
        }
      } catch (err) {
        console.warn(
          `[SWEEP] Compaction scan failed for session ${row.session_id}:`,
          err?.message || err
        );
        continue;
      }
    }
  }, SWEEP_INTERVAL_MS);

  // The one-time legacy-session import runs from startBackgroundServices()
  // (called above) so the embedded desktop server backfills history too — not
  // just this standalone path. See autoImportLegacySessions().
}

module.exports = { createApp, startServer, startBackgroundServices };
