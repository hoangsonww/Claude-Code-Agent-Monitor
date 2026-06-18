/**
 * @file Pure-ish report generator for Scheduled Analytics Reports. Owns the
 * report TEMPLATES catalog, a deterministic next-run-time calculator
 * (computeNextRun), and the windowed report builder (generateReport). All
 * numbers mirror the /api/analytics computations (same columns/grouping) but
 * are scoped to a report period. The HTML artifact is a self-contained,
 * print-friendly document with every dynamic value HTML-escaped.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { calculateCost } = require("../routes/pricing");

/**
 * Report templates. `default_window_days` seeds a definition's window when the
 * user leaves window_days unset. Section coverage is decided in generateReport
 * by template key (see SECTIONS_BY_TEMPLATE).
 */
const TEMPLATES = [
  {
    key: "weekly_health",
    label: "Weekly Health Report",
    description:
      "Full-spectrum snapshot: session throughput, daily events, agent status, top tools, failure-prone operations, and token spend.",
    default_window_days: 7,
  },
  {
    key: "tool_usage",
    label: "Tool Usage Report",
    description: "Most-used tools and the operations most prone to failure over the period.",
    default_window_days: 7,
  },
  {
    key: "token_spend",
    label: "Token & Cost Report",
    description: "Token consumption and estimated cost broken down for the period.",
    default_window_days: 30,
  },
  {
    key: "session_throughput",
    label: "Session Throughput Report",
    description: "Session volume trend, daily events, and agent status distribution.",
    default_window_days: 7,
  },
];

const TEMPLATE_KEYS = new Set(TEMPLATES.map((t) => t.key));

// Which structured sections each template renders. Keeping this declarative
// keeps generateReport's section assembly honest and trivially testable.
const SECTIONS_BY_TEMPLATE = {
  weekly_health: ["sessions", "events", "agents", "tools", "failures", "tokens"],
  tool_usage: ["tools", "failures"],
  token_spend: ["tokens"],
  session_throughput: ["sessions", "events", "agents"],
};

/** HTML-escape a value for safe interpolation into the artifact. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Compute the next occurrence of a schedule, as an ISO-8601 (UTC, `Z`) string.
 *
 * The schedule is expressed in the definition's timezone: `hour` (0-23) is a
 * local hour, `tz_offset` is minutes west of UTC exactly like the browser's
 * `Date.prototype.getTimezoneOffset()` (e.g. 420 for PDT, -480 for CST). We
 * therefore convert "now" into that local frame, find the next local trigger
 * instant for the cadence, then convert back to UTC. Deterministic: pass
 * `fromMs` to pin the reference instant (defaults to Date.now()).
 *
 *   - daily   → next day where local time reaches `hour`.
 *   - weekly  → next `day_of_week` (0=Sun..6=Sat) at `hour`.
 *   - monthly → the 1st of the next month at `hour` (anchored to month start so
 *               the cadence is well-defined regardless of month length).
 */
function computeNextRun({ frequency, day_of_week, hour, tz_offset }, fromMs = Date.now()) {
  const offsetMin = Number.isFinite(tz_offset) ? tz_offset : 0;
  const h = Number.isFinite(hour) ? hour : 9;
  // Local-frame "now": shifting by the offset lets us read UTC getters as if
  // they were local-clock fields. offset is minutes WEST of UTC, so local =
  // utc - offset.
  const localNow = new Date(fromMs - offsetMin * 60_000);

  // Build a candidate local trigger instant and convert local→UTC by adding the
  // offset back. Date.UTC keeps us in the same shifted frame (no host-TZ leak).
  const toUtcMs = (y, mo, d, hr) => Date.UTC(y, mo, d, hr, 0, 0, 0) + offsetMin * 60_000;

  const y = localNow.getUTCFullYear();
  const mo = localNow.getUTCMonth();
  const d = localNow.getUTCDate();

  if (frequency === "monthly") {
    // 1st of the current month at `hour`; if already passed, 1st of next month.
    let candidate = toUtcMs(y, mo, 1, h);
    if (candidate <= fromMs) candidate = toUtcMs(y, mo + 1, 1, h);
    return new Date(candidate).toISOString();
  }

  if (frequency === "weekly") {
    const targetDow = Number.isFinite(day_of_week) ? ((day_of_week % 7) + 7) % 7 : 0;
    const localDow = localNow.getUTCDay();
    let deltaDays = (targetDow - localDow + 7) % 7;
    let candidate = toUtcMs(y, mo, d + deltaDays, h);
    if (candidate <= fromMs) {
      // Today is the target day but the hour has passed → jump a full week.
      deltaDays += 7;
      candidate = toUtcMs(y, mo, d + deltaDays, h);
    }
    return new Date(candidate).toISOString();
  }

  // daily (default)
  let candidate = toUtcMs(y, mo, d, h);
  if (candidate <= fromMs) candidate = toUtcMs(y, mo, d + 1, h);
  return new Date(candidate).toISOString();
}

// ── Windowed queries — mirror the analytics statements, scoped to [start,end).
// Prepared lazily per dbModule and cached, so the generator stays a pure module
// without a hard import-order dependency on db.js.
const stmtCache = new WeakMap();

function windowedStmts(dbModule) {
  let cached = stmtCache.get(dbModule);
  if (cached) return cached;
  const { db } = dbModule;
  cached = {
    // sessions started in the window (mirrors dailySessionCounts shape)
    dailySessions: db.prepare(`
      SELECT DATE(started_at, ?) as date, COUNT(*) as count
      FROM sessions
      WHERE started_at >= ? AND started_at < ?
      GROUP BY 1
      ORDER BY date ASC
    `),
    sessionCount: db.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE started_at >= ? AND started_at < ?"
    ),
    // events created in the window (mirrors dailyEventCounts shape)
    dailyEvents: db.prepare(`
      SELECT DATE(created_at, ?) as date, COUNT(*) as count
      FROM events
      WHERE created_at >= ? AND created_at < ?
      GROUP BY 1
      ORDER BY date ASC
    `),
    eventCount: db.prepare(
      "SELECT COUNT(*) as count FROM events WHERE created_at >= ? AND created_at < ?"
    ),
    // agent status distribution for agents in sessions started in the window
    // (mirrors agentStatusCounts: SELECT status, COUNT(*) ... GROUP BY status)
    agentStatusCounts: db.prepare(`
      SELECT a.status as status, COUNT(*) as count
      FROM agents a
      JOIN sessions s ON s.id = a.session_id
      WHERE s.started_at >= ? AND s.started_at < ?
      GROUP BY a.status
    `),
    // top tools by event volume in the window (mirrors toolUsageCounts)
    toolUsageCounts: db.prepare(`
      SELECT tool_name, COUNT(*) as count
      FROM events
      WHERE tool_name IS NOT NULL AND created_at >= ? AND created_at < ?
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 20
    `),
    // failure-prone operations: error/failed events grouped by tool, in window.
    // Uses the same error convention as sessionErrorCount (event_type or summary
    // prefixed with error/failed).
    failureProneOps: db.prepare(`
      SELECT COALESCE(tool_name, event_type) as operation, COUNT(*) as count
      FROM events
      WHERE created_at >= ? AND created_at < ?
        AND (
          LOWER(event_type) LIKE '%error%'
          OR LOWER(event_type) LIKE '%failed%'
          OR LOWER(summary) LIKE 'error%'
          OR LOWER(summary) LIKE 'failed%'
        )
      GROUP BY operation
      ORDER BY count DESC
      LIMIT 20
    `),
    // token buckets for sessions started in the window (effective = current +
    // baseline, exactly like the analytics/pricing aggregations).
    tokenBuckets: db.prepare(`
      SELECT tu.model as model, tu.speed as speed, tu.inference_geo as inference_geo,
        tu.service_tier as service_tier,
        SUM(tu.input_tokens + tu.baseline_input) as input_tokens,
        SUM(tu.output_tokens + tu.baseline_output) as output_tokens,
        SUM(tu.cache_read_tokens + tu.baseline_cache_read) as cache_read_tokens,
        SUM(tu.cache_write_tokens + tu.baseline_cache_write) as cache_write_tokens,
        SUM(tu.cache_write_1h_tokens + tu.baseline_cache_write_1h) as cache_write_1h_tokens,
        SUM(tu.web_search_requests + tu.baseline_web_search) as web_search_requests,
        SUM(tu.web_fetch_requests + tu.baseline_web_fetch) as web_fetch_requests,
        SUM(tu.code_execution_requests + tu.baseline_code_execution) as code_execution_requests
      FROM token_usage tu
      JOIN sessions s ON s.id = tu.session_id
      WHERE s.started_at >= ? AND s.started_at < ?
      GROUP BY tu.model, tu.speed, tu.inference_geo, tu.service_tier
    `),
  };
  stmtCache.set(dbModule, cached);
  return cached;
}

/**
 * Generate a report over [windowStart, windowEnd). Returns
 * `{ summary, data, html }`:
 *   - `data`   structured JSON (sections vary by template).
 *   - `html`   self-contained print-friendly document (all values escaped).
 *   - `summary` a few headline numbers for the run list.
 *
 * `tzOffset` is minutes west of UTC (browser getTimezoneOffset) and is negated
 * into a SQLite modifier so daily grouping uses local dates — exactly as
 * /api/analytics does.
 */
function generateReport(dbModule, { template, windowStart, windowEnd, tzOffset = 0 }) {
  const stmts = windowedStmts(dbModule);
  const tzModifier = Number.isFinite(tzOffset) ? `${-tzOffset} minutes` : "+0 minutes";
  const sections = SECTIONS_BY_TEMPLATE[template] || SECTIONS_BY_TEMPLATE.weekly_health;
  const want = new Set(sections);

  const data = {
    template,
    window_start: windowStart,
    window_end: windowEnd,
    tz_offset: Number.isFinite(tzOffset) ? tzOffset : 0,
  };

  if (want.has("sessions")) {
    data.session_volume = stmts.dailySessions.all(tzModifier, windowStart, windowEnd);
    data.total_sessions = stmts.sessionCount.get(windowStart, windowEnd).count;
  }
  if (want.has("events")) {
    data.daily_events = stmts.dailyEvents.all(tzModifier, windowStart, windowEnd);
    data.total_events = stmts.eventCount.get(windowStart, windowEnd).count;
  }
  if (want.has("agents")) {
    const rows = stmts.agentStatusCounts.all(windowStart, windowEnd);
    data.agents_by_status = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  }
  if (want.has("tools")) {
    data.top_tools = stmts.toolUsageCounts.all(windowStart, windowEnd);
  }
  if (want.has("failures")) {
    data.failure_prone_operations = stmts.failureProneOps.all(windowStart, windowEnd);
  }
  if (want.has("tokens")) {
    const buckets = stmts.tokenBuckets.all(windowStart, windowEnd);
    const pricingRules = dbModule.stmts.listPricing.all();
    const cost = calculateCost(buckets, pricingRules);
    const totals = buckets.reduce(
      (acc, b) => {
        acc.input += b.input_tokens || 0;
        acc.output += b.output_tokens || 0;
        acc.cache_read += b.cache_read_tokens || 0;
        acc.cache_write += b.cache_write_tokens || 0;
        return acc;
      },
      { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    );
    data.tokens = {
      total_input: totals.input,
      total_output: totals.output,
      total_cache_read: totals.cache_read,
      total_cache_write: totals.cache_write,
    };
    data.cost = {
      total_cost: cost.total_cost,
      breakdown: cost.breakdown,
      feature_costs: cost.feature_costs,
      unpriced_models: cost.unpriced_models,
    };
  }

  const summary = buildSummary(template, data);
  const html = buildHtml(template, data, summary);
  return { summary, data, html };
}

/** A few headline numbers, shown in the run list. */
function buildSummary(template, data) {
  const t = TEMPLATES.find((x) => x.key === template);
  const summary = {
    template,
    template_label: t ? t.label : template,
    window_start: data.window_start,
    window_end: data.window_end,
  };
  if (data.total_sessions != null) summary.total_sessions = data.total_sessions;
  if (data.total_events != null) summary.total_events = data.total_events;
  if (data.top_tools) summary.distinct_tools = data.top_tools.length;
  if (data.failure_prone_operations) {
    summary.total_failures = data.failure_prone_operations.reduce((s, r) => s + r.count, 0);
  }
  if (data.tokens) {
    summary.total_tokens =
      data.tokens.total_input +
      data.tokens.total_output +
      data.tokens.total_cache_read +
      data.tokens.total_cache_write;
  }
  if (data.cost) summary.total_cost = data.cost.total_cost;
  return summary;
}

function table(headers, rows) {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows.length
    ? rows.map((cells) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" class="empty">No data for this period.</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function num(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/**
 * Build the self-contained, print-friendly HTML artifact. EVERY dynamic value
 * is routed through esc() (or num()), so a hostile session/tool name cannot
 * inject markup.
 */
function buildHtml(template, data, summary) {
  const t = TEMPLATES.find((x) => x.key === template);
  const title = t ? t.label : "Analytics Report";
  const blocks = [];

  if (data.session_volume) {
    blocks.push(
      `<section><h2>Session Volume Trend</h2>` +
        `<p class="metric">${num(data.total_sessions)} sessions started</p>` +
        table(
          ["Date", "Sessions"],
          data.session_volume.map((r) => [r.date, num(r.count)])
        ) +
        `</section>`
    );
  }
  if (data.daily_events) {
    blocks.push(
      `<section><h2>Daily Events</h2>` +
        `<p class="metric">${num(data.total_events)} events</p>` +
        table(
          ["Date", "Events"],
          data.daily_events.map((r) => [r.date, num(r.count)])
        ) +
        `</section>`
    );
  }
  if (data.agents_by_status) {
    const rows = Object.entries(data.agents_by_status).map(([status, count]) => [
      status,
      num(count),
    ]);
    blocks.push(
      `<section><h2>Agent Status Distribution</h2>` +
        table(["Status", "Agents"], rows) +
        `</section>`
    );
  }
  if (data.top_tools) {
    blocks.push(
      `<section><h2>Top Tools</h2>` +
        table(
          ["Tool", "Uses"],
          data.top_tools.map((r) => [r.tool_name, num(r.count)])
        ) +
        `</section>`
    );
  }
  if (data.failure_prone_operations) {
    blocks.push(
      `<section><h2>Failure-Prone Operations</h2>` +
        table(
          ["Operation", "Failures"],
          data.failure_prone_operations.map((r) => [r.operation, num(r.count)])
        ) +
        `</section>`
    );
  }
  if (data.tokens) {
    blocks.push(
      `<section><h2>Token Usage</h2>` +
        table(
          ["Category", "Tokens"],
          [
            ["Input", num(data.tokens.total_input)],
            ["Output", num(data.tokens.total_output)],
            ["Cache read", num(data.tokens.total_cache_read)],
            ["Cache write", num(data.tokens.total_cache_write)],
          ]
        ) +
        `</section>`
    );
  }
  if (data.cost) {
    const rows = (data.cost.breakdown || []).map((b) => [b.model, `$${esc(b.cost)}`]);
    blocks.push(
      `<section><h2>Estimated Cost</h2>` +
        `<p class="metric">$${esc(data.cost.total_cost)} total</p>` +
        table(["Model", "Cost"], rows) +
        `</section>`
    );
  }

  const style = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0; padding: 32px; color: #1a1a2e; background: #ffffff; line-height: 1.5; }
    header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 24px; margin: 0 0 4px; color: #312e81; }
    h2 { font-size: 16px; margin: 0 0 12px; color: #4338ca; }
    .meta { font-size: 13px; color: #555; margin: 2px 0; }
    section { margin-bottom: 28px; page-break-inside: avoid; }
    .metric { font-size: 15px; font-weight: 600; margin: 0 0 8px; color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    td.empty { color: #9ca3af; font-style: italic; }
    tbody tr:nth-child(even) { background: #fafafa; }
    footer { margin-top: 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      header { border-bottom-color: #000; }
      th { background: #eee !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      section { page-break-inside: avoid; }
    }
  `;

  return (
    `<!doctype html>\n` +
    `<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(title)}</title><style>${style}</style></head><body>` +
    `<header><h1>${esc(title)}</h1>` +
    `<p class="meta">Window: ${esc(data.window_start)} → ${esc(data.window_end)}</p>` +
    `<p class="meta">Timezone offset: ${esc(data.tz_offset)} min from UTC</p>` +
    `</header>` +
    blocks.join("\n") +
    `<footer>Generated by Agent Dashboard · Scheduled Analytics Reports</footer>` +
    `</body></html>`
  );
}

module.exports = {
  TEMPLATES,
  TEMPLATE_KEYS,
  SECTIONS_BY_TEMPLATE,
  computeNextRun,
  generateReport,
  esc,
};
