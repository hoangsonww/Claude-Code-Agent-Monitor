/**
 * @file Express router for stats endpoints, providing aggregated statistics about agents, sessions, events, and WebSocket connections. It queries the database for various counts and statuses, and returns a comprehensive overview in JSON format for frontend display on the dashboard.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { getConnectionCount } = require("../websocket");
const { parseSources } = require("../lib/source-filter");
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
  const overview = sources ? scoped.statsOverview(db, sources) : stmts.stats.get();
  const agentsByStatus = sources
    ? scoped.agentStatusCounts(db, sources)
    : stmts.agentStatusCounts.all();
  const sessionsByStatus = sources
    ? scoped.sessionStatusCounts(db, sources)
    : stmts.sessionStatusCounts.all();

  const eventsToday = sources
    ? scoped.countEventsToday(db, sources, toLocal, toUTC)
    : stmts.countEventsToday.get(toLocal, toUTC);

  res.json({
    ...overview,
    events_today: eventsToday?.count ?? 0,
    ws_connections: getConnectionCount(),
    agents_by_status: Object.fromEntries(agentsByStatus.map((r) => [r.status, r.count])),
    sessions_by_status: Object.fromEntries(sessionsByStatus.map((r) => [r.status, r.count])),
  });
});

module.exports = router;
