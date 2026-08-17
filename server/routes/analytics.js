/**
 * @file Express router for analytics endpoints, providing aggregated statistics on token usage, tool usage, daily events/sessions, agent types, and more. It queries the database for various metrics and returns them in a structured JSON format for frontend consumption.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { parseSources } = require("../lib/source-filter");
const { parseProviders } = require("../lib/provider-filter");
const scoped = require("../lib/scoped-stats");

const { calculateProviderCost } = require("./pricing");

const router = Router();

router.get("/", (req, res) => {
  // Client sends tz_offset (minutes from getTimezoneOffset(), e.g. 420 for PDT)
  // Negate it to get the SQLite modifier: 420 → '-420 minutes'
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const tzModifier = Number.isFinite(rawOffset) ? `${-rawOffset} minutes` : "+0 minutes";

  // Data-scope: restrict every metric to a subset of source machines when the
  // user has chosen one; otherwise use the cached prepared statements.
  const sources = parseSources(req);
  const providers = parseProviders(req);
  const isScoped = !!sources || !!providers;
  const tokenTotals = isScoped
    ? scoped.tokenTotals(db, sources, providers)
    : stmts.getTokenTotals.get();
  const toolUsage = isScoped
    ? scoped.toolUsageCounts(db, sources, providers)
    : stmts.toolUsageCounts.all();
  const dailyEvents = isScoped
    ? scoped.dailyEventCounts(db, sources, providers, tzModifier)
    : stmts.dailyEventCounts.all(tzModifier);
  const dailySessions = isScoped
    ? scoped.dailySessionCounts(db, sources, providers, tzModifier)
    : stmts.dailySessionCounts.all(tzModifier);
  const agentTypes = isScoped
    ? scoped.agentTypeDistribution(db, sources, providers)
    : stmts.agentTypeDistribution.all();
  const overview = isScoped ? scoped.statsOverview(db, sources, providers) : stmts.stats.get();
  const agentsByStatus = isScoped
    ? scoped.agentStatusCounts(db, sources, providers)
    : stmts.agentStatusCounts.all();
  const sessionsByStatus = isScoped
    ? scoped.sessionStatusCounts(db, sources, providers)
    : stmts.sessionStatusCounts.all();
  const totalSubagents = isScoped
    ? scoped.totalSubagentCount(db, sources, providers)
    : stmts.totalSubagentCount.get();
  const eventTypes = isScoped
    ? scoped.eventTypeCounts(db, sources, providers)
    : stmts.eventTypeCounts.all();
  const avgEvents = isScoped
    ? scoped.avgEventsPerSession(db, sources, providers)
    : stmts.avgEventsPerSession.get();

  // Calculate total cost across all sessions
  const pricingRules = stmts.listPricing.all();
  const gptPricingRules = stmts.listGptPricing.all();
  // Join the owning session's start date so each bucket is priced at the rate
  // effective when it was used (date-effective promo rates, e.g. Sonnet 5 intro).
  const allTokenUsage = isScoped
    ? scoped.scopedTokenUsageWithDate(db, sources, providers)
    : db
        .prepare(
          "SELECT tu.*, s.provider, DATE(s.started_at) as date FROM token_usage tu JOIN sessions s ON s.id = tu.session_id"
        )
        .all();

  const totalCost = calculateProviderCost(allTokenUsage, pricingRules, gptPricingRules).total_cost;

  res.json({
    tokens: {
      total_input: tokenTotals?.total_input ?? 0,
      total_output: tokenTotals?.total_output ?? 0,
      total_cache_read: tokenTotals?.total_cache_read ?? 0,
      total_cache_write: tokenTotals?.total_cache_write ?? 0,
    },
    total_cost: totalCost,
    tool_usage: toolUsage,
    daily_events: dailyEvents,
    daily_sessions: dailySessions,
    agent_types: agentTypes,
    event_types: eventTypes,
    avg_events_per_session: avgEvents?.avg ?? 0,
    total_subagents: totalSubagents?.count ?? 0,
    overview,
    agents_by_status: Object.fromEntries(agentsByStatus.map((r) => [r.status, r.count])),
    sessions_by_status: Object.fromEntries(sessionsByStatus.map((r) => [r.status, r.count])),
  });
});

module.exports = router;
