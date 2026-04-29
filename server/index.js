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
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return new Promise((resolve) => {
    server.listen(port, () => {
      const mode = isProduction ? "production" : "development";
      console.log(`Agent Dashboard server running on http://localhost:${port} (${mode})`);
      if (!isProduction) {
        console.log(`Client dev server expected at http://localhost:5173`);
      }
      resolve(server);
    });
  });
}

if (require.main === module) {
  const PORT = parseInt(process.env.DASHBOARD_PORT || "4820", 10);
  const app = createApp();
  startServer(app, PORT).then(() => {
    const { startUpdateScheduler } = require("./update-scheduler");
    const { broadcast } = require("./websocket");
    startUpdateScheduler({ broadcast });
  });

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
    // 1. Stale session cleanup
    const stale = cleanupDb.stmts.findStaleSessions.all("__periodic__", STALE_MINUTES);
    const now = new Date().toISOString();
    for (const s of stale) {
      const agents = cleanupDb.stmts.listAgentsBySession.all(s.id);
      for (const agent of agents) {
        if (agent.status !== "completed" && agent.status !== "error") {
          cleanupDb.stmts.updateAgent.run(null, "completed", null, null, now, null, agent.id);
          broadcast("agent_updated", cleanupDb.stmts.getAgent.get(agent.id));
        }
      }
      cleanupDb.stmts.updateSession.run(null, "abandoned", now, null, s.id);
      broadcast("session_updated", cleanupDb.stmts.getSession.get(s.id));

      // Evict transcript cache for abandoned sessions to bound memory growth
      const tpRow = cleanupDb.db
        .prepare(
          "SELECT json_extract(data, '$.transcript_path') as tp FROM events WHERE session_id = ? AND json_extract(data, '$.transcript_path') IS NOT NULL LIMIT 1"
        )
        .get(s.id);
      if (tpRow?.tp) transcriptCache.invalidate(tpRow.tp);
    }

    // 2. Scan active sessions for new compaction entries
    const active = cleanupDb.db
      .prepare(
        "SELECT DISTINCT e.session_id, json_extract(e.data, '$.transcript_path') as tp FROM events e JOIN sessions s ON s.id = e.session_id WHERE s.status = 'active' AND json_extract(e.data, '$.transcript_path') IS NOT NULL GROUP BY e.session_id ORDER BY MAX(e.id) DESC"
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
      } catch {
        continue;
      }
    }
  }, SWEEP_INTERVAL_MS);

  // Auto-import legacy sessions and backfill compaction tracking on startup
  const { importAllSessions, backfillCompactions } = require("../scripts/import-history");
  const dbModule = require("./db");
  importAllSessions(dbModule)
    .then(({ imported, skipped, errors }) => {
      if (imported > 0) console.log(`Imported ${imported} legacy sessions from ~/.claude/`);
      if (errors > 0) console.log(`${errors} session files had errors during import`);
    })
    .then(() => backfillCompactions(dbModule))
    .then(({ backfilled }) => {
      if (backfilled > 0) console.log(`Backfilled ${backfilled} compaction events from ~/.claude/`);
    })
    .catch(() => {
      // Non-fatal — legacy import is best-effort
    });
}

module.exports = { createApp, startServer };
