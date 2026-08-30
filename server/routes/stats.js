/**
 * @file Express router for stats endpoints, providing aggregated statistics about agents, sessions, events, and WebSocket connections. It queries the database for various counts and statuses, and returns a comprehensive overview in JSON format for frontend display on the dashboard.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { getConnectionCount } = require("../websocket");
const { getStreamClientCount } = require("../lib/sse");
const { parseSources } = require("../lib/source-filter");
const { parseProviders } = require("../lib/provider-filter");
const scoped = require("../lib/scoped-stats");

const router = Router();

router.get("/", (req, res) => {
  // Client sends tz_offset (minutes from getTimezoneOffset(), e.g. 420 for PDT)
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const offsetMin = Number.isFinite(rawOffset) ? rawOffset : 0;
  const toLocal = `${-offsetMin} minutes`; // shift UTC → local
  const toUTC = `${offsetMin} minutes`; // shift local → UTC

  // Data-scope: when the user restricts to a subset of source machines, compute
  // every count against that subset; otherwise use the cached prepared stmts.
  const sources = parseSources(req);
  const providers = parseProviders(req);
  const isScoped = !!sources || !!providers;
  const overview = isScoped ? scoped.statsOverview(db, sources, providers) : stmts.stats.get();
  const agentsByStatus = isScoped
    ? scoped.agentStatusCounts(db, sources, providers)
    : stmts.agentStatusCounts.all();
  const sessionsByStatus = isScoped
    ? scoped.sessionStatusCounts(db, sources, providers)
    : stmts.sessionStatusCounts.all();

  const eventsToday = isScoped
    ? scoped.countEventsToday(db, sources, providers, toLocal, toUTC)
    : stmts.countEventsToday.get(toLocal, toUTC);

  res.json({
    ...overview,
    events_today: eventsToday?.count ?? 0,
    ws_connections: getConnectionCount(),
    sse_connections: getStreamClientCount(),
    agents_by_status: Object.fromEntries(agentsByStatus.map((r) => [r.status, r.count])),
    sessions_by_status: Object.fromEntries(sessionsByStatus.map((r) => [r.status, r.count])),
  });
});

module.exports = router;
