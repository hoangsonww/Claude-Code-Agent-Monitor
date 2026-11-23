/**
 * @file ccam live-monitoring commands: stats, kanban, overview (alias top —
 * a one-screen operational snapshot, optionally auto-refreshing), tail (the
 * Activity Feed in the terminal, polling /api/events), stream (the raw
 * real-time WebSocket feed — pretty for humans, NDJSON for machines), and
 * watch (re-run any ccam command on an interval).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const { spawn } = require("node:child_process");
const {
  c,
  STATUS_THEME,
  stripAnsi,
  heading,
  subheading,
  table,
  bar,
  printJson,
  paintEvent,
  colorStatus,
  fmtTime,
  fmtCost,
  fmtAgo,
  fmtDuration,
  short,
  trunc,
} = require("../lib/ui");
const { ENTRY, isJson, CliError, state } = require("../lib/runtime");
const { baseUrl, apiToken, get, qs, tzOffset } = require("../lib/http");
const {
  requireDb,
  dbPath,
  offlineData,
  livenessCorrect,
  livenessCorrectAgents,
  livenessNote,
} = require("../lib/offline");
const { run, csvArg, posIntArg } = require("../lib/framework");

const GROUP = "Monitoring:";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** --sources / --providers data-scope options (match the UI's scope selector). */
function scopeOptions(cmd) {
  return cmd
    .option("--sources <list>", "restrict to source machines (comma-separated, e.g. local)", csvArg)
    .option("--providers <list>", "restrict to providers (claude,codex,cursor)", csvArg);
}
const scopeParams = (opts) => ({
  sources: opts.sources?.join(","),
  providers: opts.providers?.join(","),
});

// ── stats ───────────────────────────────────────────────────────────────────

function renderStats(s, source) {
  if (isJson()) return printJson(s);
  heading("Dashboard stats", source);
  table(
    ["Metric", "Value"],
    [
      ["Total sessions", s.total_sessions],
      ["Active sessions", s.active_sessions],
      ["Total agents", s.total_agents],
      ["Active agents", s.active_agents],
      ["Total events", s.total_events],
      ["Events today", s.events_today],
      ["WS connections", s.ws_connections],
    ]
  );
  const dist = (title, obj) => {
    const entries = Object.entries(obj || {});
    if (!entries.length) return;
    console.log(`\n${c.bold(title)}`);
    const max = Math.max(...entries.map(([, v]) => v));
    const w = Math.max(...entries.map(([k]) => k.length)) + 2;
    for (const [k, v] of entries) {
      const t = STATUS_THEME[k] || { icon: "·", paint: (x) => x };
      console.log(`  ${t.paint(`${t.icon} ${k}`.padEnd(w))}  ${bar(v, max)} ${c.bold(String(v))}`);
    }
  };
  dist("Sessions by status", s.sessions_by_status);
  dist("Agents by status", s.agents_by_status);
}

async function cmdStats({ opts }) {
  renderStats(
    await get(`/api/stats${qs({ tz_offset: tzOffset(), ...scopeParams(opts) })}`),
    baseUrl()
  );
}

function offlineStats() {
  const db = requireDb();
  const s = offlineData.stats(db);
  // Correct the status distribution the same way the session list is
  // corrected, so counts and rows never disagree.
  const rows = db.all("SELECT id, status, cwd FROM sessions");
  const fix = livenessCorrect(rows);
  if (fix.available) {
    const dist = {};
    for (const r of rows) dist[r.status] = (dist[r.status] || 0) + 1;
    s.sessions_by_status = dist;
    s.active_sessions = dist.active || 0;
  }
  renderStats(s, `${dbPath()} (offline)`);
  livenessNote(fix);
}

// ── kanban ──────────────────────────────────────────────────────────────────

/** Text rendering of the Kanban board: sessions and agents grouped by status
 *  lanes, each lane a colored header rule with tree-branch item rows. */
function renderKanban(sess, ag, perLane = 10) {
  const group = (items, key) => {
    const g = {};
    for (const it of items) (g[it[key]] ||= []).push(it);
    return g;
  };
  if (isJson()) {
    return printJson({
      sessions: group(sess.sessions || [], "status"),
      agents: group(ag.agents || [], "status"),
    });
  }
  const lane = (col, items, render) => {
    const t = STATUS_THEME[col] || { icon: "·", paint: (x) => x };
    const label = `${t.icon} ${col} (${items.length})`;
    const ruleLen = Math.max(2, 34 - stripAnsi(label).length);
    console.log(`\n  ${t.paint(label)} ${c.dim("─".repeat(ruleLen))}`);
    const shown = items.slice(0, perLane);
    shown.forEach((it, i) => {
      const branch = i === items.length - 1 ? "└─" : "├─";
      render(it, c.dim(branch));
    });
    if (items.length > perLane) console.log(c.dim(`  └─ … ${items.length - perLane} more`));
  };
  heading("Sessions");
  const sg = group(sess.sessions || [], "status");
  for (const col of ["active", "waiting", "completed", "error", "abandoned"]) {
    lane(col, sg[col] || [], (s, branch) => {
      console.log(`  ${branch} ${c.dim(s.id.slice(0, 8))}  ${(s.name || "").slice(0, 52)}`);
    });
  }
  console.log();
  heading("Agents");
  const agr = group(ag.agents || [], "status");
  for (const col of ["working", "waiting", "completed", "error"]) {
    lane(col, agr[col] || [], (a, branch) => {
      const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
      console.log(`  ${branch} ${c.dim(a.id.slice(0, 8))}  ${(a.name || "").slice(0, 48)}${tool}`);
    });
  }
}

async function cmdKanban({ opts }) {
  const scope = scopeParams(opts);
  const [sess, ag] = await Promise.all([
    get(`/api/sessions${qs({ limit: 200, ...scope })}`),
    get(`/api/agents${qs({ limit: 400, ...scope })}`),
  ]);
  renderKanban(sess, ag, opts.perLane);
}

function offlineKanban({ opts }) {
  const db = requireDb();
  const sess = offlineData.sessions(db, { limit: "200" });
  const ag = offlineData.agents(db, { limit: "400" });
  const fix = livenessCorrect(sess.sessions);
  if (fix.deadIds.size) livenessCorrectAgents(ag.agents, fix.deadIds);
  renderKanban(sess, ag, opts.perLane);
  livenessNote(fix);
}

// ── overview / top ──────────────────────────────────────────────────────────

/** Gather the one-screen operational snapshot (mirrors the MCP
 *  dashboard_get_operational_snapshot tool). Optional pieces fail soft. */
async function gatherOverview(opts) {
  const scope = scopeParams(opts);
  const soft = (p) => p.catch(() => null);
  const [health, stats, active, working, alerts, runs, cost] = await Promise.all([
    get("/api/health"),
    get(`/api/stats${qs({ tz_offset: tzOffset(), ...scope })}`),
    get(`/api/sessions${qs({ status: "active", limit: 8, ...scope })}`),
    get(`/api/agents${qs({ status: "working", limit: 8, ...scope })}`),
    soft(get("/api/alerts?unacked=true&limit=5")),
    soft(get("/api/run")),
    soft(get(`/api/pricing/cost${qs({ tz_offset: tzOffset(), ...scope })}`)),
  ]);
  const today = new Date().toLocaleDateString("en-CA");
  const todayCost = (cost?.daily_costs || []).find((d) => d.date === today)?.cost ?? null;
  return {
    generated_at: new Date().toISOString(),
    url: baseUrl(),
    version: health.version || null,
    stats,
    active_sessions: active.sessions || [],
    working_agents: working.agents || [],
    unacked_alerts: alerts ? { count: alerts.unacked ?? 0, recent: alerts.alerts || [] } : null,
    live_runs: runs
      ? (runs.items || []).filter((r) => ["running", "spawning"].includes(r.status))
      : [],
    cost: cost ? { total: cost.total_cost ?? 0, today: todayCost } : null,
  };
}

function renderOverview(o) {
  if (isJson()) return printJson(o);
  const s = o.stats || {};
  heading(
    "ccam overview",
    `${o.url}${o.version ? ` · v${o.version}` : ""} · ${fmtTime(o.generated_at)}`
  );
  const tile = (label, value, paint = c.bold) => `${c.dim(label)} ${paint(String(value ?? "-"))}`;
  console.log(
    "  " +
      [
        tile("sessions", `${s.active_sessions ?? 0}/${s.total_sessions ?? 0}`, c.green),
        tile("agents", `${s.active_agents ?? 0}/${s.total_agents ?? 0}`, c.green),
        tile("events today", s.events_today ?? 0, c.cyan),
        o.cost ? tile("cost", fmtCost(o.cost.total), c.cyan) : null,
        o.cost && o.cost.today != null ? tile("today", fmtCost(o.cost.today), c.cyan) : null,
        o.unacked_alerts
          ? tile("alerts", o.unacked_alerts.count, o.unacked_alerts.count ? c.yellow : c.dim)
          : null,
        tile("live runs", o.live_runs.length, o.live_runs.length ? c.green : c.dim),
      ]
        .filter(Boolean)
        .join(c.dim("  ·  "))
  );
  subheading("Active sessions", `(${o.active_sessions.length})`);
  if (!o.active_sessions.length) console.log(c.dim("  none"));
  for (const x of o.active_sessions) {
    const waiting = x.awaiting_input_since ? c.yellow(" ⏸ awaiting input") : "";
    console.log(
      `  ${colorStatus(x.status)}  ${c.dim(short(x.id))}  ${trunc(x.name || x.cwd || "", 50)}${waiting}  ${c.dim(fmtAgo(x.last_activity || x.updated_at))}`
    );
  }
  subheading("Working agents", `(${o.working_agents.length})`);
  if (!o.working_agents.length) console.log(c.dim("  none"));
  for (const a of o.working_agents) {
    const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
    console.log(
      `  ${colorStatus(a.status)}  ${c.dim(short(a.id))}  ${trunc(a.name || "", 44)}${tool}  ${c.dim(fmtDuration(a.started_at))}`
    );
  }
  if (o.unacked_alerts?.recent.length) {
    subheading("Unacknowledged alerts", `(${o.unacked_alerts.count})`);
    for (const al of o.unacked_alerts.recent) {
      console.log(
        `  ${c.yellow("!")} ${c.dim(fmtTime(al.triggered_at))}  ${trunc(al.message || al.rule_name, 70)}`
      );
    }
  }
  if (o.live_runs.length) {
    subheading("Live runs", `(${o.live_runs.length})`);
    for (const r of o.live_runs) {
      console.log(
        `  ${colorStatus(r.status)}  ${c.dim(short(r.id))}  ${r.provider}  ${trunc(r.prompt || "", 50)}`
      );
    }
  }
}

async function cmdOverview({ opts }) {
  if (opts.watch === undefined) return renderOverview(await gatherOverview(opts));
  const secs = opts.watch === true ? 2 : Number(opts.watch);
  if (!Number.isFinite(secs) || secs <= 0) {
    throw new CliError("--watch expects a positive number of seconds", { code: "USAGE" });
  }
  const tty = Boolean(process.stdout.isTTY) && !isJson();
  for (;;) {
    const snap = await gatherOverview(opts);
    if (tty) process.stdout.write("\x1b[2J\x1b[H");
    renderOverview(snap);
    if (tty) console.log(c.dim(`\n⟳ refreshing every ${secs}s — Ctrl+C to stop`));
    await sleep(secs * 1000);
  }
}

// ── tail ────────────────────────────────────────────────────────────────────

function eventLine(e) {
  const tool = c.dim(trunc(e.tool_name || "", 12).padEnd(12));
  return `${c.dim(fmtTime(e.created_at))}  ${paintEvent((e.event_type || "").padEnd(16))}  ${tool}  ${trunc(e.summary || "", 90)}`;
}

/**
 * Live event feed (the Activity Feed, in the terminal). Polls /api/events on
 * a short interval and prints only rows newer than the last one seen. In
 * JSON mode each event is one NDJSON line, so `ccam tail --json | jq` works.
 */
async function cmdTail({ opts }) {
  const params = {
    session_id: opts.session,
    event_type: opts.type?.join(","),
    tool_name: opts.tool?.join(","),
    limit: 50,
  };
  let lastId = null;
  await get("/api/health"); // fail fast (and route offline messaging) before announcing
  if (!isJson()) console.log(c.dim(`Tailing events from ${baseUrl()} — Ctrl+C to stop`));
  const backlog = opts.backlog ?? 10;
  for (let first = true; ; first = false) {
    const data = await get(`/api/events${qs(params)}`);
    const events = (data.events || []).slice().reverse(); // oldest → newest
    const fresh =
      lastId == null
        ? events.slice(Math.max(0, events.length - backlog))
        : events.filter((e) => Number(e.id) > lastId);
    for (const e of fresh) {
      if (isJson()) process.stdout.write(`${JSON.stringify(e)}\n`);
      else console.log(eventLine(e));
    }
    const maxId = events.reduce((m, e) => Math.max(m, Number(e.id) || 0), lastId ?? 0);
    lastId = first ? maxId : Math.max(lastId, maxId);
    await sleep((opts.interval ?? 2) * 1000);
  }
}

// ── stream (WebSocket) ──────────────────────────────────────────────────────

/** One human line per WebSocket message, by message type. */
function streamLine(msg) {
  const d = msg.data || {};
  const t = c.dim(fmtTime(msg.timestamp));
  const type = c.magenta(String(msg.type).padEnd(18));
  let detail = "";
  if (msg.type === "new_event")
    detail = `${paintEvent(d.event_type || "")} ${trunc(d.summary || "", 80)}`;
  else if (/^session_/.test(msg.type))
    detail = `${colorStatus(d.status)} ${c.dim(short(d.id))} ${trunc(d.name || "", 50)}`;
  else if (/^agent_/.test(msg.type))
    detail = `${colorStatus(d.status)} ${c.dim(short(d.id))} ${trunc(d.name || "", 40)}${d.current_tool ? c.cyan(` [${d.current_tool}]`) : ""}`;
  else if (msg.type === "run_stream") detail = `${c.dim(short(d.id))} ${d.envelope?.type || ""}`;
  else detail = c.dim(trunc(JSON.stringify(d), 100));
  return `${t}  ${type} ${detail}`;
}

/**
 * Subscribe to the dashboard's WebSocket (/ws) and print every broadcast —
 * the exact real-time channel the web UI uses. --type filters by message
 * type; JSON mode emits one NDJSON object per message.
 */
async function cmdStream({ opts }) {
  let WebSocket;
  try {
    WebSocket = require("ws");
  } catch {
    throw new CliError("The ws package is not installed — run npm install in the repo.", {
      code: "MISSING_DEPENDENCY",
    });
  }
  await get("/api/health"); // route offline messaging before connecting
  const wsUrl = new URL(baseUrl().replace(/^http/, "ws"));
  wsUrl.pathname = `${wsUrl.pathname.replace(/\/+$/, "")}/ws`;
  wsUrl.search = "";
  wsUrl.hash = "";
  // Send the token as a header (accepted by the /ws upgrade check) rather
  // than a query parameter, which would land in proxy and access logs.
  const token = apiToken();
  const types = opts.type ? new Set(opts.type) : null;
  let count = 0;
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(
      wsUrl.toString(),
      token ? { headers: { "x-dashboard-token": token } } : undefined
    );
    ws.on("open", () => {
      if (!isJson())
        console.log(
          c.dim(
            `Streaming ${wsUrl}${types ? ` (types: ${[...types].join(", ")})` : ""} — Ctrl+C to stop`
          )
        );
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (types && !types.has(msg.type)) return;
      if (isJson()) process.stdout.write(`${JSON.stringify(msg)}\n`);
      else console.log(streamLine(msg));
      count++;
      if (opts.count && count >= opts.count) {
        ws.close();
      }
    });
    ws.on("error", (err) =>
      reject(new CliError(`WebSocket error: ${err.message}`, { code: "WS_ERROR" }))
    );
    ws.on("close", () => resolve());
  });
}

// ── watch ───────────────────────────────────────────────────────────────────

/**
 * `ccam watch [-n secs] <command…>` — re-run any ccam command on a timer,
 * screen-clearing on a TTY. The inner command is taken verbatim from the raw
 * argv after `watch` (so its own flags are never parsed by watch), and global
 * output options are forwarded to each run.
 */
async function cmdWatch() {
  const raw = process.argv.slice(2).filter((a) => a !== "--no-color");
  let rest = raw.slice(raw.indexOf("watch") + 1);
  let secs = 2;
  if ((rest[0] === "-n" || rest[0] === "--interval") && rest[1]) {
    secs = Number(rest[1]);
    rest = rest.slice(2);
  } else if (/^\d+(\.\d+)?$/.test(rest[0] || "")) {
    secs = Number(rest[0]);
    rest = rest.slice(1);
  }
  if (rest[0] === "--") rest = rest.slice(1);
  if (!rest.length || !Number.isFinite(secs) || secs <= 0) {
    throw new CliError("Usage: ccam watch [-n seconds] <command …>   e.g. ccam watch -n 5 kanban", {
      code: "USAGE",
    });
  }
  if (rest[0] === "watch" || rest[0] === "repl") {
    throw new CliError(`Cannot watch "${rest[0]}".`, { code: "USAGE" });
  }
  const tty = Boolean(process.stdout.isTTY);
  const env = { ...process.env };
  if (tty && !isJson()) env.FORCE_COLOR = "1";
  if (state.url) env.CCAM_URL = state.url;
  process.on("SIGINT", () => process.exit(130));
  for (;;) {
    if (tty) process.stdout.write("\x1b[2J\x1b[H");
    if (!isJson())
      console.log(
        c.dim(
          `⟳ watch: ccam ${rest.join(" ")} — every ${secs}s · ${new Date().toLocaleTimeString()} · Ctrl+C to stop`
        )
      );
    await new Promise((resolve) => {
      const child = spawn(process.execPath, [ENTRY, ...rest], { stdio: "inherit", env });
      child.on("close", resolve);
      child.on("error", resolve);
    });
    await sleep(secs * 1000);
  }
}

function register(program) {
  scopeOptions(
    program
      .command("stats")
      .helpGroup(GROUP)
      .description("Totals, today's events, and session/agent status distributions")
  ).action(run(cmdStats, { offline: offlineStats }));

  scopeOptions(
    program
      .command("kanban")
      .helpGroup(GROUP)
      .description("Sessions + agents grouped into status lanes")
      .option("--per-lane <n>", "items shown per lane", posIntArg, 10)
  ).action(run(cmdKanban, { offline: offlineKanban }));

  scopeOptions(
    program
      .command("overview")
      .alias("top")
      .helpGroup(GROUP)
      .description("One-screen operational snapshot: activity, agents, alerts, runs, cost")
      .option("-w, --watch [secs]", "refresh continuously (default every 2 s)")
  ).action(run(cmdOverview, { serverOnly: "the snapshot combines several live server endpoints" }));

  program
    .command("tail")
    .helpGroup(GROUP)
    .description("Live event feed (polls /api/events; Ctrl+C stops; NDJSON with --json)")
    .option("--session <id>", "only events from one session")
    .option("--type <types>", "event types, comma-separated (e.g. PreToolUse,Stop)", csvArg)
    .option("--tool <tools>", "tool names, comma-separated (e.g. Bash,Edit)", csvArg)
    .option("--interval <secs>", "poll interval in seconds", posIntArg, 2)
    .option("--backlog <n>", "recent events printed on start", posIntArg, 10)
    .action(
      run(cmdTail, {
        serverOnly: "live capture needs the running server (hooks only post to a live server)",
      })
    );

  program
    .command("stream")
    .helpGroup(GROUP)
    .description("Raw real-time WebSocket feed (every broadcast the UI receives)")
    .option(
      "--type <types>",
      "message types, comma-separated (e.g. new_event,agent_updated)",
      csvArg
    )
    .option("--count <n>", "exit after N messages", posIntArg)
    .action(
      run(cmdStream, { serverOnly: "the real-time feed is broadcast by the running server" })
    );

  program
    .command("watch")
    .helpGroup(GROUP)
    .description("Re-run any ccam command on an interval (e.g. ccam watch -n 5 kanban)")
    .usage("[-n seconds] <command …>")
    .allowUnknownOption()
    .allowExcessArguments()
    .helpOption(false)
    .action(run(cmdWatch));
}

module.exports = { register, scopeOptions, scopeParams, renderStats, eventLine };
