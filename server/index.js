if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { initWebSocket } = require("./websocket");

const sessionsRouter = require("./routes/sessions");
const agentsRouter = require("./routes/agents");
const eventsRouter = require("./routes/events");
const statsRouter = require("./routes/stats");
const hooksRouter = require("./routes/hooks");
const analyticsRouter = require("./routes/analytics");
const pricingRouter = require("./routes/pricing");
const settingsRouter = require("./routes/settings");

function createApp() {
  const app = express();

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
  startServer(app, PORT);

  // Auto-install Claude Code hooks on every startup so users don't have to
  try {
    const { installHooks } = require("../scripts/install-hooks");
    installHooks(true);
    console.log("Claude Code hooks auto-configured.");
  } catch {
    // Non-fatal — user can run npm run install-hooks manually
  }

  // Periodic maintenance sweep (every 2 min):
  // 1. Mark abandoned sessions that slipped through event-based detection
  // 2. Scan active sessions' JSONL files for new compaction entries
  //    (/compact fires no hooks, so compaction agents only appear on next hook event
  //    without this scanner)
  const cleanupDb = require("./db");
  const { broadcast } = require("./websocket");
  const { importCompactions, findCompactionsInFile } = require("../scripts/import-history");
  setInterval(
    () => {
      // 1. Stale session cleanup
      const stale = cleanupDb.stmts.findStaleSessions.all("__periodic__", 5);
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
          const compactions = findCompactionsInFile(row.tp);
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
    },
    2 * 60 * 1000
  );

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
