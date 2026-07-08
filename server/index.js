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
const { redocBundlePath, renderRedocHtml } = require("./lib/redoc");
const { writeServerInfo, removeServerInfo } = require("./lib/server-info");
const {
  resolveHost,
  isLoopbackHostname,
  corsOptions,
  hostGuard,
  tokenGuard,
  getDashboardToken,
} = require("./lib/security");

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
const alertsRouter = require("./routes/alerts");
const webhooksRouter = require("./routes/webhooks");

function createApp() {
  const app = express();
  const openApiSpec = createOpenApiSpec();

  // Security hardening (GHSA-gr74-4xfh-6jw9): loopback-only CORS, a Host-header
  // allowlist (anti DNS-rebinding), and an optional bearer-token gate on /api/*.
  app.use(cors(corsOptions()));
  app.use(hostGuard);
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", tokenGuard);

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
  app.use("/api/alerts", alertsRouter);
  app.use("/api/webhooks", webhooksRouter);
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

  // ReDoc — a read-optimized, three-panel rendering of the same OpenAPI spec
  // (complements Swagger UI's interactive console at /api/docs). The bundle is
  // served from node_modules, never a CDN, so the reference works offline.
  app.get("/api/redoc/redoc.standalone.js", (_req, res) => {
    res.sendFile(redocBundlePath(), (err) => {
      if (err && !res.headersSent) res.status(500).end();
    });
  });
  app.get("/api/redoc", (_req, res) => {
    res
      .type("html")
      .send(
        renderRedocHtml(
          "/api/openapi.json",
          "/api/redoc/redoc.standalone.js",
          "Agent Dashboard API Reference"
        )
      );
  });

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

  // Bind to loopback by default so the dashboard is not network-reachable out
  // of the box (GHSA-gr74-4xfh-6jw9). Operators opt into a wider bind with
  // DASHBOARD_HOST=0.0.0.0 — and are warned to set DASHBOARD_TOKEN when they do.
  const host = resolveHost();
  const boundLoopback = isLoopbackHostname(host);

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      // Publish the live port so the Claude Code hook handler can find this
      // server even when it bound a non-default port (the desktop app falls
      // back off 4820 when that port is already taken).
      writeServerInfo(port);
      const mode = isProduction ? "production" : "development";
      const shown = boundLoopback ? "localhost" : host;
      console.log(`Agent Dashboard server running on http://${shown}:${port} (${mode})`);
      if (!boundLoopback) {
        console.warn(
          `⚠️  Dashboard bound to ${host} — reachable from the network. ` +
            (getDashboardToken()
              ? "DASHBOARD_TOKEN is set (API + WebSocket require it)."
              : "Set DASHBOARD_TOKEN to require auth, or it is OPEN to anyone who can reach this port.")
        );
      }
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
      // Backfill Workflow-tool run journals (issue #167) for all imported
      // sessions. Inner agents emit no hooks, so this on-disk scan is the only
      // way historical workflows surface.
      .then(() => require("./lib/workflow-ingest").ingestAllWorkflows(dbModule))
      .then(({ workflows }) => {
        if (workflows > 0) console.log(`Backfilled ${workflows} workflow run(s) from ~/.claude/`);
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

  // Boot liveness reap. When the user quit Claude Code while the dashboard
  // was DOWN, the SessionEnd hook was lost and only the process probe can
  // tell the session is dead — without this, such sessions sit in Waiting
  // until a watchdog tick. Two passes, both fail-safe and off the startup
  // critical path:
  //   1. Immediately (next tick): reaps dead sessions ALREADY in the DB from
  //      a previous dashboard run — the common "app was up, app stopped,
  //      session quit, app starts" flow — so they never render as Waiting at
  //      all.
  //   2. ~5 s later: reaps sessions the startup project sync just IMPORTED
  //      (rows that didn't exist at boot). The 15 s watchdog remains the
  //      safety net for anything later (kill -9 / crashes fire no SessionEnd
  //      either), and its probe is skipped whenever no active session
  //      qualifies, so the steady-state cost is nil.
  // Both boot passes run with ignoreIdleGate: at boot the probe alone is the
  // truth — a session quit even ONE second before launch must clear
  // immediately, not after the LIVENESS_IDLE_SECONDS gate ages out (the gate
  // exists to protect long-running steady-state work on watchdog ticks, and
  // there is no in-flight work at boot).
  {
    const bootReap = (label) => {
      try {
        require("./routes/hooks").livenessReap({ ignoreIdleGate: true });
      } catch (err) {
        console.warn(`${label} liveness reap failed:`, err?.message || err);
      }
    };
    setImmediate(() => bootReap("boot"));
    const t = setTimeout(() => bootReap("post-import"), 5_000);
    if (t.unref) t.unref();
  }

  // Backfill per-agent token metadata onto subagent rows that predate per-agent
  // cost tracking, so their cards show their own cost instead of nothing. Runs
  // deferred and non-blocking; self-limiting (rows with a tokens key are
  // skipped), and metadata-only (never touches session token_usage).
  {
    const dbModule = require("./db");
    const { backfillSubagentTokenMetadata } = require("../scripts/import-history");
    const t = setTimeout(() => {
      Promise.resolve()
        .then(() => backfillSubagentTokenMetadata(dbModule))
        .then((r) => {
          if (r && r.stamped > 0)
            console.log(
              `Backfilled per-agent token cost for ${r.stamped} subagent(s) across ${r.sessions} session(s)`
            );
        })
        .catch((err) => console.warn("subagent token backfill failed:", err?.message || err));
    }, 500);
    if (t.unref) t.unref();
  }

  const { startUpdateScheduler } = require("./update-scheduler");
  const { broadcast } = require("./websocket");
  startUpdateScheduler({ broadcast });
  try {
    const { startCcWatcher } = require("./lib/cc-watcher");
    startCcWatcher({ broadcast });
  } catch (err) {
    console.warn("cc-watcher failed to start:", err.message);
  }
  // Near-real-time Workflow-tool run ingestion. The run journal is written when
  // a workflow finishes — which may not coincide with a hook — so a fast,
  // change-fingerprinted poll over active sessions keeps the UI fresh without
  // waiting for the next Stop or the slow maintenance sweep.
  try {
    startWorkflowPoll(broadcast);
  } catch (err) {
    console.warn("workflow poll failed to start:", err.message);
  }
  // Continuous discovery of sessions under ~/.claude/projects. The one-time
  // legacy backfill above runs only once (marker-gated), so a project added
  // later whose sessions never flow through hooks would otherwise stay invisible
  // until a manual rescan. This incremental, mtime-fingerprinted poll keeps the
  // default folder in sync without re-parsing unchanged files.
  try {
    startSessionSync(broadcast);
  } catch (err) {
    console.warn("session sync failed to start:", err.message);
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
 * Fast, change-fingerprinted poll that ingests Workflow-tool run journals for
 * active sessions in near real time. Inner agent() calls emit no hooks and the
 * journal lands at workflow completion, so this fills the gap between disk
 * writes and the next hook/sweep. Skips sessions whose workflow artifacts are
 * unchanged since the last ingest (cheap mtime fingerprint). Unref'd so it
 * never blocks shutdown; disable with DASHBOARD_WORKFLOW_POLL_MS=0.
 */
function startWorkflowPoll(broadcast) {
  const POLL_MS = process.env.DASHBOARD_WORKFLOW_POLL_MS
    ? Number(process.env.DASHBOARD_WORKFLOW_POLL_MS)
    : 12_000;
  if (!Number.isFinite(POLL_MS) || POLL_MS <= 0) return;

  const dbModule = require("./db");
  const { ingestWorkflowsForSession, workflowsMaxMtime } = require("./lib/workflow-ingest");
  const lastSeen = new Map(); // sessionId → newest workflow-artifact mtime ingested

  const timer = setInterval(() => {
    let active;
    try {
      active = dbModule.db
        .prepare(
          "SELECT id, transcript_path AS tp FROM sessions WHERE status = 'active' AND transcript_path IS NOT NULL ORDER BY updated_at DESC LIMIT 50"
        )
        .all();
    } catch {
      return;
    }
    for (const row of active) {
      if (!row.tp) continue;
      let mtime = 0;
      try {
        mtime = workflowsMaxMtime(row.tp);
      } catch {
        mtime = 0;
      }
      if (mtime === 0 || lastSeen.get(row.id) === mtime) continue; // none / unchanged
      lastSeen.set(row.id, mtime);
      ingestWorkflowsForSession(dbModule, { id: row.id, transcript_path: row.tp })
        .then((changed) => {
          if (!changed || changed.length === 0) return;
          for (const wf of changed) broadcast("workflow_upserted", wf);
          const sess = dbModule.stmts.getSession.get(row.id); // nudge cost refresh
          if (sess) broadcast("session_updated", sess);
        })
        .catch(() => {});
    }
  }, POLL_MS);
  if (timer.unref) timer.unref();
}

/**
 * Keep the default `~/.claude/projects` directory in sync via three triggers
 * that share one `mtimeCache` and a single coalesced sweep:
 *
 *   1. **Immediate** — one sweep at startup, so a project the one-time backfill
 *      (`autoImportLegacySessions`, marker-gated) missed surfaces right away
 *      instead of after the first interval.
 *   2. **Watcher** — a debounced `fs.watch` on the projects tree fires a sweep
 *      the instant a *new* session file or project folder appears, so no-hook
 *      sessions show up immediately rather than on the next poll. Events for
 *      files already in `mtimeCache` (active transcripts being appended to) are
 *      ignored, so a busy session never thrashes the importer — the poll picks
 *      up its growth. Recursive watching is used only on macOS/Windows (native,
 *      stable); on Linux, where Node's userland recursive watcher trips on the
 *      high-churn projects tree (see lib/cc-watcher.js), we watch the root plus
 *      each immediate child folder non-recursively instead.
 *   3. **Poll** — a periodic safety-net sweep (watchers can miss events / not
 *      fire on network filesystems). Tunable via `DASHBOARD_SESSION_SYNC_MS`
 *      (default 30 s); `0` disables the poll but leaves the watcher running.
 *
 * Each sweep parses only files whose mtime is new or has advanced, then
 * broadcasts `session_created` for newly imported sessions / `session_updated`
 * for grown ones — the same events hooks emit, so the UI refreshes live. All
 * timers and watchers are `unref`'d and best-effort; nothing here can block
 * shutdown or take down the server.
 */
function startSessionSync(broadcast) {
  const fs = require("fs");
  const dbModule = require("./db");
  const { getProjectsDir } = require("./lib/claude-home");
  const { syncDefaultProjects } = require("../scripts/import-history");

  const projectsDir = getProjectsDir();
  const mtimeCache = new Map(); // filePath → newest mtime (ms) already imported
  let running = false;
  let queued = false; // a trigger arrived mid-sweep → run exactly once more

  function runSweep() {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    syncDefaultProjects(dbModule, { mtimeCache })
      .then(({ changed }) => {
        for (const { sessionId, isNew } of changed) {
          let row;
          try {
            row = dbModule.stmts.getSession.get(sessionId);
          } catch {
            continue;
          }
          if (!row) continue;
          broadcast(isNew ? "session_created" : "session_updated", row);
          // Also surface the session's main agent, so a synced session appears
          // live on the Agents board too (not just the Sessions board). Hooks
          // emit both a session and an agent frame; mirror that here.
          try {
            const mainAgent = dbModule.db
              .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'main' LIMIT 1")
              .get(sessionId);
            if (mainAgent) broadcast(isNew ? "agent_created" : "agent_updated", mainAgent);
          } catch {
            /* best-effort — the session frame already refreshed the UI */
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        running = false;
        if (queued) {
          queued = false;
          runSweep();
        }
      });
  }

  // 1. Deferred initial sweep — let the HTTP server and WebSocket handshake
  //    come up and serve the first page load before the (potentially heavy)
  //    cold catch-up sweep runs. On a machine with many grown transcripts, the
  //    cold sweep re-parses every file whose mtime is newer than its DB
  //    updated_at; running it inline at startup can monopolize the event loop
  //    long enough that the Vite `/ws` proxy handshake times out ("WebSocket is
  //    closed before the connection is established") and the dashboard looks
  //    stuck for a minute-plus. The sweep itself yields between heavy re-parses
  //    (see syncDefaultProjects), so once it starts it stays cooperative.
  const initialSweep = setTimeout(runSweep, 250);
  if (initialSweep.unref) initialSweep.unref();

  // 3. Periodic safety net.
  const POLL_MS = process.env.DASHBOARD_SESSION_SYNC_MS
    ? Number(process.env.DASHBOARD_SESSION_SYNC_MS)
    : 30_000;
  if (Number.isFinite(POLL_MS) && POLL_MS > 0) {
    const timer = setInterval(runSweep, POLL_MS);
    if (timer.unref) timer.unref();
  }

  // 2. Filesystem watcher — debounced, ignoring known-file churn.
  const DEBOUNCE_MS = 800;
  let debounce = null;
  function scheduleSweep() {
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = null;
      runSweep();
    }, DEBOUNCE_MS);
    if (debounce.unref) debounce.unref();
  }
  // Only a path we don't already track is interesting (a new session file or a
  // new project folder). Appends to a known active transcript are left to the
  // poll, so the watcher never re-parses a busy session every write.
  function onFsEvent(fullPath) {
    if (fullPath && mtimeCache.has(fullPath)) return;
    scheduleSweep();
  }

  const watchers = [];
  function addWatcher(w) {
    w.on("error", () => {});
    if (w.unref) w.unref();
    watchers.push(w);
  }
  const recursiveOk = process.platform === "darwin" || process.platform === "win32";
  try {
    if (fs.existsSync(projectsDir)) {
      if (recursiveOk) {
        addWatcher(
          fs.watch(projectsDir, { recursive: true }, (_e, filename) => {
            onFsEvent(filename ? path.join(projectsDir, filename) : null);
          })
        );
      } else {
        // Linux: watch the root (new folders) + each immediate child folder
        // (new session files), adding a child watcher when a folder appears.
        const watchChild = (dir) => {
          try {
            addWatcher(
              fs.watch(dir, (_e, filename) => onFsEvent(filename ? path.join(dir, filename) : null))
            );
          } catch {
            /* best-effort */
          }
        };
        addWatcher(
          fs.watch(projectsDir, (_e, filename) => {
            if (filename) {
              const child = path.join(projectsDir, filename);
              try {
                if (fs.statSync(child).isDirectory()) watchChild(child);
              } catch {
                /* removed before we could stat — ignore */
              }
            }
            onFsEvent(filename ? path.join(projectsDir, filename) : null);
          })
        );
        for (const ent of fs.readdirSync(projectsDir, { withFileTypes: true })) {
          if (ent.isDirectory()) watchChild(path.join(projectsDir, ent.name));
        }
      }
    }
  } catch {
    /* best-effort — the poll still keeps things in sync */
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

    // Drop realtime clients first — open WS sockets otherwise hold the HTTP
    // server open and stall the shutdown until the force-exit backstop fires.
    try {
      require("./websocket").closeWebSocket();
    } catch {
      /* websocket may not be initialised */
    }

    const closeDb = () => {
      try {
        require("./db").db.close();
      } catch {
        /* already closed */
      }
    };

    if (httpServer) {
      // Close the DB only AFTER the HTTP server has fully drained. Closing it
      // while requests are still in flight makes handlers throw "The database
      // connection is not open" (e.g. server/routes/agents.js).
      httpServer.close(() => {
        console.log("HTTP server closed.");
        closeDb();
        process.exit(0);
      });
      // Drop lingering IDLE keep-alive sockets so close() fires promptly (under
      // `node --watch` this turns a multi-second "waiting for graceful
      // termination" stall into a near-instant restart) while letting in-flight
      // requests finish and drain — the whole point of closing the DB in the
      // close() callback. closeAllConnections() would kill in-flight requests
      // too, so use it only as a fallback on runtimes without
      // closeIdleConnections; the 5s backstop below covers a genuinely stuck
      // request either way.
      if (typeof httpServer.closeIdleConnections === "function") {
        httpServer.closeIdleConnections();
      } else if (typeof httpServer.closeAllConnections === "function") {
        httpServer.closeAllConnections();
      }
    } else {
      closeDb();
      process.exit(0);
    }

    // Drop the port discovery file so a later run on a different port is not
    // shadowed by a stale entry. (A crash skips this — the PID-liveness check
    // in resolveDashboardPort() is the backstop for that case.)
    removeServerInfo();
    // Backstop: force exit if something still holds the event loop open. Close
    // the DB here too — if close() never drained (a stuck in-flight request),
    // the callback above never ran, so this is the only path that flushes
    // SQLite before exit (closeDb is idempotent, so a normal drain is fine).
    setTimeout(() => {
      closeDb();
      process.exit(0);
    }, 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Auto-install Claude Code hooks on every startup so users don't have to.
  // Skipped inside containers (issue #193): a container-internal handler path
  // would poison a bind-mounted host ~/.claude and break every host hook, so
  // hooks must be installed on the host (`npm run install-hooks`).
  try {
    const { installHooks, isInsideContainer } = require("../scripts/install-hooks");
    if (installHooks(true)) {
      console.log("Claude Code hooks auto-configured.");
    } else if (isInsideContainer()) {
      console.log(
        "Claude Code hooks NOT auto-configured: running inside a container. " +
          "Run `npm run install-hooks` on the host so hooks point at a host path and " +
          "POST to http://localhost:4820 (this container's published port)."
      );
    }
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
  // Per-session newest workflow-artifact mtime already ingested by this sweep,
  // so step 3 below skips sessions whose workflow files are unchanged (the same
  // cheap fingerprint startWorkflowPoll uses). Declared once so it persists
  // across sweep ticks.
  const sweepWorkflowSeen = new Map();
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

    // 3. Scan active sessions for Workflow-tool run journals (issue #167).
    // Catches workflows that complete without a subsequent hook and flips
    // launch-detected "running" rows to "completed" once their journal lands.
    const { ingestWorkflowsForSession, workflowsMaxMtime } = require("./lib/workflow-ingest");
    // Forget fingerprints for sessions that are no longer active so the map
    // can't grow without bound over the process lifetime.
    const activeIds = new Set(active.map((r) => r.session_id));
    for (const id of sweepWorkflowSeen.keys()) {
      if (!activeIds.has(id)) sweepWorkflowSeen.delete(id);
    }
    for (const row of active) {
      if (!row.tp) continue;
      // Skip sessions whose workflow artifacts are unchanged since the last
      // ingest — the same cheap mtime fingerprint startWorkflowPoll uses.
      // Without this the sweep full-re-parses every workflow journal and every
      // inner agent-*.jsonl for every active session every cycle; on a large
      // corpus that re-parse exceeds the sweep interval, sweeps overlap, and
      // the event loop pegs (dashboard stops responding — white page).
      let mtime = 0;
      try {
        mtime = workflowsMaxMtime(row.tp);
      } catch {
        mtime = 0;
      }
      if (mtime === 0 || sweepWorkflowSeen.get(row.session_id) === mtime) continue;
      sweepWorkflowSeen.set(row.session_id, mtime);
      ingestWorkflowsForSession(cleanupDb, { id: row.session_id, transcript_path: row.tp })
        .then((changed) => {
          if (!changed || changed.length === 0) return;
          for (const wf of changed) broadcast("workflow_upserted", wf);
          const sess = cleanupDb.stmts.getSession.get(row.session_id);
          if (sess) broadcast("session_updated", sess);
        })
        .catch((err) => {
          // Forget the fingerprint so the next sweep retries this session
          // instead of skipping it until its artifacts change again.
          sweepWorkflowSeen.delete(row.session_id);
          console.warn(
            `[SWEEP] Workflow scan failed for session ${row.session_id}:`,
            err?.message || err
          );
        });
    }
  }, SWEEP_INTERVAL_MS);

  // The one-time legacy-session import runs from startBackgroundServices()
  // (called above) so the embedded desktop server backfills history too — not
  // just this standalone path. See autoImportLegacySessions().
}

module.exports = { createApp, startServer, startBackgroundServices };
