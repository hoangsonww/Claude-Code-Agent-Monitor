/**
 * @file ccam audit — the Tool Risk Audit (#301) in the terminal, for headless
 * and SSH machines: severity totals plus the flagged tool calls (privilege,
 * destructive, remote-exec, credential-access, egress, outside-cwd) with the
 * exact matched text. Reads GET /api/audit/summary and /api/audit/tools;
 * `--json` prints both responses for scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const { Option } = require("commander");
const { c, heading, table, printJson, fmtTime, short, trunc } = require("../lib/ui");
const { isJson, CliError } = require("../lib/runtime");
const { baseUrl, get, qs } = require("../lib/http");
const { run, csvArg, posIntArg } = require("../lib/framework");
const { scopeOptions, scopeParams } = require("./monitor");

const GROUP = "Insights:";
const SEVERITIES = ["low", "medium", "high", "critical"];
const SIGNALS = [
  "privilege",
  "destructive",
  "remote-exec",
  "credential-access",
  "egress",
  "outside-cwd",
];
const PAINT = {
  critical: (s) => c.red(c.bold(s)),
  high: (s) => c.red(s),
  medium: (s) => c.yellow(s),
  low: (s) => c.cyan(s),
};

/**
 * Parse a look-back window such as `30m`, `24h`, `7d` or `2w` into an ISO
 * timestamp that far in the past. `all` (or nothing) means no lower bound.
 */
function sinceToIso(value, now = Date.now()) {
  if (value == null || value === "all") return undefined;
  const m = /^(\d+)\s*([mhdw])$/i.exec(String(value).trim());
  if (!m) {
    throw new CliError(`Invalid --since "${value}"`, {
      code: "USAGE",
      hints: ["Use a number plus m, h, d or w — e.g. 30m, 24h, 7d, 2w — or 'all'."],
    });
  }
  const unit = { m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }[m[2].toLowerCase()];
  return new Date(now - Number(m[1]) * unit).toISOString();
}

async function cmdAudit({ opts }) {
  const signal = opts.signal || undefined;
  const bad = signal?.find((s) => !SIGNALS.includes(s));
  if (bad) {
    throw new CliError(`Unknown signal "${bad}"`, {
      code: "USAGE",
      hints: [`Signals: ${SIGNALS.join(", ")}`],
    });
  }
  const filters = {
    from: sinceToIso(opts.since),
    min_severity: opts.severity,
    signal: signal?.join(","),
    session_id: opts.session,
    project: opts.project,
    host: opts.host,
    q: opts.search,
    ...scopeParams(opts),
  };
  const [summary, list] = await Promise.all([
    get(`/api/audit/summary${qs(filters)}`),
    get(`/api/audit/tools${qs({ ...filters, limit: opts.limit ?? 50 })}`),
  ]);
  if (isJson()) return printJson({ summary, ...list });

  heading("Tool Risk Audit", `${baseUrl()} · since ${opts.since || "all"}`);
  console.log(
    SEVERITIES.slice()
      .reverse()
      .map((s) => `${PAINT[s](s)} ${c.bold(String(summary.by_severity[s] ?? 0))}`)
      .join(c.dim("  ·  "))
  );
  if (!list.indexing?.complete) {
    const { last_event_id: last, max_event_id: max } = list.indexing || {};
    const pct = max ? Math.floor((last / max) * 100) : 0;
    console.log(c.yellow(`Indexing tool history… ${pct}% — re-run for complete results.`));
  }
  if (list.coverage?.degraded > 0) {
    console.log(
      c.dim(
        `${list.coverage.degraded} of ${list.coverage.scanned} tool calls had no stored input; only their summaries were checked.`
      )
    );
  }
  console.log("");
  if (!list.events.length) {
    console.log(c.dim("No flagged tool calls match these filters."));
    return;
  }
  table(
    ["Time", "Severity", "Signals", "Tool", "Command / path", "Session"],
    list.events.map((e) => [
      fmtTime(e.created_at),
      PAINT[e.max_severity](e.max_severity),
      [...new Set(e.signals.map((s) => s.signal))].join(","),
      e.tool_name || "",
      trunc(e.target || "", 70),
      e.session_name ? trunc(e.session_name, 24) : short(e.session_id),
    ])
  );
  if (list.total > list.events.length) {
    console.log(c.dim(`\nShowing ${list.events.length} of ${list.total}; raise --limit for more.`));
  }
}

function register(program) {
  scopeOptions(
    program
      .command("audit")
      .helpGroup(GROUP)
      .description(
        "Tool Risk Audit: risky commands, credential access, egress and writes outside the project"
      )
      .option("--since <window>", "look-back window: 30m, 24h, 7d, 2w or all", "7d")
      .addOption(new Option("--severity <level>", "minimum severity shown").choices(SEVERITIES))
      .option("--signal <list>", `signal families, comma-separated (${SIGNALS.join(", ")})`, csvArg)
      .option("--session <id>", "only one session")
      .option("--project <cwd>", "only one project (session working directory)")
      .option("--host <host>", "only calls that reached this host")
      .option("--search <text>", "match commands, paths and hosts")
      .option("--limit <n>", "rows shown (max 500)", posIntArg, 50)
  ).action(run(cmdAudit, { serverOnly: "the risk index is built and queried by the server" }));
}

module.exports = { register, sinceToIso };
