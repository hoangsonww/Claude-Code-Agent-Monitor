/**
 * @file Express router for stats endpoints, providing aggregated statistics about agents, sessions, events, and WebSocket connections. It queries the database for various counts and statuses, and returns a comprehensive overview in JSON format for frontend display on the dashboard.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { readDashboardStats } = require("../db");
const { getConnectionCount } = require("../websocket");
const { parseSources } = require("../lib/source-filter");
const { parseProviders } = require("../lib/provider-filter");

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    // Client sends tz_offset (minutes from getTimezoneOffset(), e.g. 420 for PDT)
    const rawOffset = parseInt(req.query.tz_offset, 10);
    const offsetMin = Number.isFinite(rawOffset) ? rawOffset : 0;
    const toLocal = `${-offsetMin} minutes`; // shift UTC → local
    const toUTC = `${offsetMin} minutes`; // shift local → UTC

    // Data-scope: when the user restricts to a subset of source machines, compute
    // every count against that subset; otherwise use the cached prepared stmts.
    const sources = parseSources(req);
    const providers = parseProviders(req);
    const overview = await readDashboardStats(sources, providers, toLocal, toUTC);

    res.json({
      ...overview,
      ws_connections: getConnectionCount(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
