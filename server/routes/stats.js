/**
 * @file Express router for stats endpoints, providing aggregated statistics about agents, sessions, events, and WebSocket connections. It queries the database for various counts and statuses, and returns a comprehensive overview in JSON format for frontend display on the dashboard.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { getConnectionCount } = require("../websocket");
const { parseSources } = require("../lib/source-filter");
const { parseProviders } = require("../lib/provider-filter");
const scoped = require("../lib/scoped-stats");

const router = Router();

// day_start is the client's local midnight as a UTC instant, which stays right on
// DST transition days. Older clients only send tz_offset, so fall back to a fixed shift.
function localDayStart(dayStart, offsetMin) {
  const parsed = typeof dayStart === "string" ? Date.parse(dayStart) : NaN;
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const local = new Date(Date.now() - offsetMin * 60000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMin * 60000).toISOString();
}

router.get("/", (req, res) => {
  // Client sends tz_offset (minutes from getTimezoneOffset(), e.g. 420 for PDT)
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const offsetMin = Number.isFinite(rawOffset) && Math.abs(rawOffset) <= 840 ? rawOffset : 0;
  const todayStart = localDayStart(req.query.day_start, offsetMin);

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
    ? scoped.countEventsToday(db, sources, providers, todayStart)
    : stmts.countEventsSince.get(todayStart);

  res.json({
    ...overview,
    events_today: eventsToday?.count ?? 0,
    ws_connections: getConnectionCount(),
    agents_by_status: Object.fromEntries(agentsByStatus.map((r) => [r.status, r.count])),
    sessions_by_status: Object.fromEntries(sessionsByStatus.map((r) => [r.status, r.count])),
  });
});

module.exports = router;
