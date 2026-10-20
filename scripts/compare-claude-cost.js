#!/usr/bin/env node

/**
 * Lists every Claude session whose dashboard cost differs from the cost Claude
 * Code itself recorded. Read-only: it reads sessions from the running
 * dashboard's API and Claude's figure from each transcript's last `cost-state`
 * entry (`totalCostUSD`, per-model `costUSD`), falling back to the
 * `lastCost` that `~/.claude.json` keeps for a project's most recent session.
 * Both sides are compared unrounded: the dashboard's figure is the
 * `total_cost_exact` of `/api/pricing/cost/:sessionId`, and differences below
 * $1e-9 (floating-point summation noise) count as equal.
 *
 * Usage:
 *   node scripts/compare-claude-cost.js                  Every session that differs
 *   node scripts/compare-claude-cost.js --threshold 0.5  Only differences >= $0.50
 *   node scripts/compare-claude-cost.js --models         Add a per-model breakdown
 *   node scripts/compare-claude-cost.js --json           Machine-readable output
 *   node scripts/compare-claude-cost.js --server URL     Dashboard other than :4820
 *
 * Exit code 0 when no session differs, 1 when some do, 2 on error.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { modelMatchKey } = require("../server/lib/cost-state");

const USAGE = `Usage: node scripts/compare-claude-cost.js [--threshold USD] [--models] [--json] [--server URL]`;

// Two float sums of the same charges can differ in the last few bits.
const FLOAT_TOLERANCE = 1e-9;

function parseArgs(argv) {
  const opts = {
    threshold: 0,
    models: false,
    json: false,
    server: process.env.CCAM_URL || "http://127.0.0.1:4820",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--models") opts.models = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--threshold" || arg === "--server") {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      if (arg === "--server") opts.server = value.replace(/\/+$/, "");
      else {
        opts.threshold = Number(value);
        if (!Number.isFinite(opts.threshold) || opts.threshold < 0) {
          throw new Error(`--threshold must be a non-negative number, got "${value}"`);
        }
      }
    } else if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else throw new Error(`unknown option "${arg}"\n${USAGE}`);
  }
  return opts;
}

async function getJson(server, pathname) {
  const token = process.env.DASHBOARD_API_TOKEN || process.env.CCAM_API_TOKEN;
  let res;
  try {
    res = await fetch(server + pathname, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const reason = err?.cause?.code || err?.cause?.message || err.message;
    throw new Error(
      `cannot reach the dashboard at ${server} (${reason}) — start it with \`ccam start\` or pass --server`
    );
  }
  if (!res.ok) throw new Error(`GET ${pathname} → HTTP ${res.status}`);
  return res.json();
}

async function allSessions(server) {
  const sessions = [];
  for (let offset = 0; ; offset += 200) {
    const page = await getJson(server, `/api/sessions?limit=200&offset=${offset}`);
    sessions.push(...page.sessions);
    if (page.sessions.length === 0 || offset + 200 >= page.total) return sessions;
  }
}

/** The last `cost-state` entry of a transcript that belongs to `sessionId`. */
async function lastCostState(filePath, sessionId) {
  let latest = null;
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.includes('"cost-state"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "cost-state") continue;
    // A resumed or forked transcript can carry another session's record.
    if (entry.sessionId && entry.sessionId !== sessionId) continue;
    latest = entry;
  }
  return latest;
}

/** `~/.claude.json` keeps the cost of each project's most recent session. */
function claudeJsonLastCosts() {
  const bySession = new Map();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
    for (const project of Object.values(config.projects || {})) {
      if (project && typeof project === "object" && project.lastSessionId) {
        bySession.set(project.lastSessionId, project);
      }
    }
  } catch {
    /* no config or unreadable — the transcript is the main source anyway */
  }
  return bySession;
}

/** Claude's figure for one session, or null when Claude recorded none. */
async function claudeCost(session, lastCosts) {
  if (session.transcript_path && fs.existsSync(session.transcript_path)) {
    const entry = await lastCostState(session.transcript_path, session.id);
    if (entry) {
      return {
        source: "cost-state",
        total: Number(entry.totalCostUSD) || 0,
        models: entry.modelUsage || {},
      };
    }
  }
  const project = lastCosts.get(session.id);
  if (project) {
    return {
      source: "claude.json",
      total: Number(project.lastCost) || 0,
      models: project.lastModelUsage || {},
    };
  }
  return null;
}

/** The dashboard's unrounded cost detail for one session. */
function sessionCost(server, sessionId) {
  return getJson(server, `/api/pricing/cost/${encodeURIComponent(sessionId)}`);
}

/** Unrounded figure, or the rounded one from a dashboard that predates it. */
const exact = (value, rounded) => Number(value ?? rounded) || 0;

/** Per-model dashboard vs Claude cost, keyed so provider spellings line up. */
function modelDiffs(detail, claudeModels, tolerance) {
  const byKey = new Map();
  const slot = (model) => {
    const key = modelMatchKey(model);
    if (!byKey.has(key)) byKey.set(key, { model: key, dashboard: 0, claude: 0 });
    return byKey.get(key);
  };
  for (const row of detail.breakdown || []) {
    slot(row.model).dashboard += exact(row.cost_exact, row.cost);
  }
  for (const [model, usage] of Object.entries(claudeModels)) {
    slot(model).claude += Number(usage?.costUSD) || 0;
  }
  return [...byKey.values()]
    .map((m) => ({ ...m, diff: m.dashboard - m.claude }))
    .filter((m) => Math.abs(m.diff) >= tolerance)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

/** Run `fn` over `items` with at most `limit` in flight, keeping order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const usd = (n) => `$${n.toFixed(6)}`;
// A difference too small for 6 decimals still shows its size.
const signed = (n) => {
  const abs = Math.abs(n);
  return `${n >= 0 ? "+" : "-"}$${abs > 0 && abs < 5e-7 ? abs.toExponential(2) : abs.toFixed(6)}`;
};

function printTable(rows) {
  const header = ["SESSION", "STARTED", "STATUS", "DASHBOARD", "CLAUDE", "DIFF", "SOURCE", "NAME"];
  const lines = rows.map((r) => [
    r.id,
    (r.started_at || "").slice(0, 10),
    r.status || "",
    usd(r.dashboard),
    usd(r.claude),
    signed(r.diff),
    r.source,
    (r.name || "").slice(0, 48),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const right = new Set([3, 4, 5]);
  const fmt = (cells) =>
    cells
      .map((c, i) => (right.has(i) ? c.padStart(widths[i]) : c.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  console.log(fmt(header));
  rows.forEach((r, i) => {
    console.log(fmt(lines[i]));
    for (const m of r.models || []) {
      console.log(
        `    ${m.model.padEnd(28)} dashboard ${usd(m.dashboard).padStart(13)}  claude ${usd(
          m.claude
        ).padStart(13)}  ${signed(m.diff).padStart(13)}`
      );
    }
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sessions = (await allSessions(opts.server)).filter(
    (s) => !s.provider || s.provider === "claude"
  );
  const lastCosts = claudeJsonLastCosts();

  const tolerance = Math.max(opts.threshold, FLOAT_TOLERANCE);

  const compared = await mapLimit(sessions, 8, async (session) => {
    const claude = await claudeCost(session, lastCosts);
    if (!claude) return { session, claude: null };
    const detail = await sessionCost(opts.server, session.id);
    const dashboard = exact(detail.total_cost_exact, detail.total_cost);
    return { session, claude, detail, dashboard, diff: dashboard - claude.total };
  });

  const differing = [];
  for (const { session, claude, detail, dashboard, diff } of compared) {
    if (!claude || Math.abs(diff) < tolerance) continue;
    differing.push({
      id: session.id,
      name: session.name,
      status: session.status,
      started_at: session.started_at,
      dashboard,
      claude: claude.total,
      diff,
      source: claude.source,
      ...(opts.models ? { models: modelDiffs(detail, claude.models, tolerance) } : {}),
    });
  }
  differing.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const withFigure = compared.filter((c) => c.claude);
  const summary = {
    sessions: sessions.length,
    compared: withFigure.length,
    without_claude_figure: sessions.length - withFigure.length,
    differing: differing.length,
    threshold: opts.threshold,
    dashboard_total: withFigure.reduce((sum, c) => sum + c.dashboard, 0),
    claude_total: withFigure.reduce((sum, c) => sum + c.claude.total, 0),
    net_diff: differing.reduce((sum, r) => sum + r.diff, 0),
  };

  if (opts.json) {
    console.log(JSON.stringify({ summary, sessions: differing }, null, 2));
  } else {
    if (differing.length > 0) printTable(differing);
    const limit = opts.threshold > 0 ? `by >= ${usd(opts.threshold)}` : "at all";
    if (differing.length === 0) console.log(`No session differs ${limit}.`);
    console.log(
      `\n${summary.differing} of ${summary.compared} sessions differ ${limit} ` +
        `(net ${signed(summary.net_diff)}). Compared totals: dashboard ${usd(
          summary.dashboard_total
        )}, Claude ${usd(summary.claude_total)}. ` +
        `${summary.without_claude_figure} session(s) have no Claude cost record.`
    );
    if (differing.some((r) => r.status === "active")) {
      console.log("Active sessions can differ until Claude Code saves its cost on exit.");
    }
  }
  return differing.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
);
