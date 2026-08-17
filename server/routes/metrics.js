/**
 * @file metrics.js
 * @description Prometheus / OpenMetrics text-exposition endpoint (GET /api/metrics)
 * so this monitoring dashboard can itself be scraped into Prometheus / Grafana.
 *
 * The dashboard already tracks everything an operator wants on a wall board —
 * live sessions, agent states, event throughput, token burn, connected realtime
 * clients — but only over its own websocket + REST surface. This route re-exposes
 * those same counters in the standard Prometheus text format (v0.0.4) so they can
 * flow into an existing observability stack alongside the rest of a team's infra.
 *
 * All values are read straight from the same prepared statements the REST API
 * uses (`server/db.js`), so the numbers line up exactly with the UI. The endpoint
 * is READ-ONLY, allocates nothing persistent, and — being mounted under `/api` —
 * sits behind the same guards as every other route: the DNS-rebinding Host-header
 * guard and the optional `DASHBOARD_TOKEN` guard. A scraper that reaches the
 * server as anything other than loopback (e.g. Prometheus in Docker via
 * `host.docker.internal`) must therefore be allowlisted with
 * `DASHBOARD_ALLOWED_HOSTS` (and send the token when one is set), so an instance
 * never leaks operational data to an unexpected origin. The turnkey Prometheus +
 * Grafana bundle in `monitoring/` documents the exact setup.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { getConnectionCount } = require("../websocket");

const router = Router();

// Resolved once at load — the dashboard version, surfaced as a build-info label
// (the canonical Prometheus idiom for exposing a version string as a metric).
const APP_VERSION = (() => {
  try {
    return require("../../package.json").version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

// Statuses are enumerated (not just whatever the DB currently holds) so a metric
// series never silently disappears when its count hits zero — a gauge that drops
// out of the exposition breaks rate()/alerting downstream.
const SESSION_STATUSES = ["active", "completed", "error", "abandoned"];
const AGENT_STATUSES = ["working", "waiting", "completed", "error"];

/** Escape a Prometheus label value (backslash, double-quote, newline). */
function escapeLabelValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/**
 * Render one metric family (HELP + TYPE header, then one line per sample) into
 * the `out` line array. Each sample is `{ value, labels? }`. Non-finite values
 * are coerced to 0 so a bad read can never emit an unparseable exposition line.
 */
function appendMetric(out, name, help, type, samples) {
  out.push(`# HELP ${name} ${help}`);
  out.push(`# TYPE ${name} ${type}`);
  for (const sample of samples) {
    const labels = sample.labels
      ? "{" +
        Object.entries(sample.labels)
          .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
          .join(",") +
        "}"
      : "";
    const value = Number.isFinite(sample.value) ? sample.value : 0;
    out.push(`${name}${labels} ${value}`);
  }
}

// GET /api/metrics — Prometheus exposition of the dashboard's live counters.
router.get("/", (_req, res) => {
  const out = [];

  appendMetric(out, "ccam_up", "1 when the dashboard API is serving this scrape.", "gauge", [
    { value: 1 },
  ]);
  appendMetric(
    out,
    "ccam_build_info",
    "Dashboard build info; the value is always 1, the version rides on the label.",
    "gauge",
    [{ labels: { version: APP_VERSION }, value: 1 }]
  );
  appendMetric(
    out,
    "ccam_process_uptime_seconds",
    "Uptime of the dashboard server process in seconds.",
    "gauge",
    [{ value: Math.round(process.uptime()) }]
  );
  appendMetric(
    out,
    "ccam_process_resident_memory_bytes",
    "Resident set size (RSS) of the dashboard server process in bytes.",
    "gauge",
    [{ value: process.memoryUsage().rss }]
  );

  // Sessions by status.
  const sessionCounts = new Map(stmts.sessionStatusCounts.all().map((r) => [r.status, r.count]));
  appendMetric(
    out,
    "ccam_sessions",
    "Number of sessions by lifecycle status.",
    "gauge",
    SESSION_STATUSES.map((status) => ({
      labels: { status },
      value: sessionCounts.get(status) || 0,
    }))
  );

  // Agents by status.
  const agentCounts = new Map(stmts.agentStatusCounts.all().map((r) => [r.status, r.count]));
  appendMetric(
    out,
    "ccam_agents",
    "Number of agents (main + subagents) by status.",
    "gauge",
    AGENT_STATUSES.map((status) => ({ labels: { status }, value: agentCounts.get(status) || 0 }))
  );

  // Event throughput (monotonic — a counter).
  appendMetric(
    out,
    "ccam_events_total",
    "Total hook and synthetic events recorded since the database was created.",
    "counter",
    [{ value: stmts.countEvents.get().count }]
  );

  // Connected realtime (WebSocket) clients.
  let clients = 0;
  try {
    clients = getConnectionCount();
  } catch {
    /* websocket not up (e.g. under test without a server) — report 0 */
  }
  appendMetric(
    out,
    "ccam_websocket_clients",
    "Currently connected realtime (WebSocket) dashboard clients.",
    "gauge",
    [{ value: clients }]
  );

  // Remote Data Sources, split by whether background auto-sync is enabled.
  let enabledSources = 0;
  let totalSources = 0;
  try {
    const rows = stmts.listRemoteSources.all();
    totalSources = rows.length;
    enabledSources = rows.filter((r) => r.enabled).length;
  } catch {
    /* remote_sources table absent on a very old DB — report 0 */
  }
  appendMetric(
    out,
    "ccam_remote_sources",
    "Configured Remote Data Sources, split by auto-sync enabled state.",
    "gauge",
    [
      { labels: { enabled: "true" }, value: enabledSources },
      { labels: { enabled: "false" }, value: totalSources - enabledSources },
    ]
  );

  // Cumulative token usage by kind (baseline_* preserves pre-compaction totals,
  // matching how the pricing endpoints total usage).
  const tokens = db
    .prepare(
      `SELECT
         COALESCE(SUM(input_tokens + baseline_input), 0) AS input,
         COALESCE(SUM(output_tokens + baseline_output), 0) AS output,
         COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) AS cache_read,
         COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) AS cache_write
       FROM token_usage`
    )
    .get();
  appendMetric(
    out,
    "ccam_tokens_total",
    "Cumulative token usage across all sessions, by kind.",
    "counter",
    [
      { labels: { kind: "input" }, value: tokens.input },
      { labels: { kind: "output" }, value: tokens.output },
      { labels: { kind: "cache_read" }, value: tokens.cache_read },
      { labels: { kind: "cache_write" }, value: tokens.cache_write },
    ]
  );

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(out.join("\n") + "\n");
});

module.exports = router;
