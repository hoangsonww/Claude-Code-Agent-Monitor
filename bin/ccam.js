#!/usr/bin/env node

/**
 * @file ccam — the Claude Code Agent Monitor command-line interface.
 *
 * A dependency-free umbrella CLI that brings the full dashboard feature
 * surface to the terminal. After the normal project setup (`npm run setup`,
 * which links this binary via `npm link`), every command is available
 * directly from any shell as `ccam <command>`.
 *
 * Monitoring            health · stats · kanban · tail
 * Data browsing         sessions · session <id> · agents · events
 * Insights              analytics · workflows · runs · cost
 * Alerting              alerts · alerts ack <id> · alerts ack-all · rules
 * Webhooks              webhooks · webhooks test <id>
 * Pricing               pricing · pricing set/delete/reset
 * Import                import rescan · import path <dir>
 * Administration        doctor · info · export · cleanup · reinstall-hooks ·
 *                       clear-data --yes · open
 *
 * Port resolution mirrors the hook handler: an explicit
 * CLAUDE_DASHBOARD_PORT / DASHBOARD_PORT env var wins, otherwise the live
 * server is discovered from ~/.claude/.agent-dashboard.json (written by every
 * running dashboard, PID-liveness-checked on read), falling back to 4820.
 *
 * Read commands are always safe. Mutating commands are explicit user actions
 * (ack, cleanup, pricing set, import) and the one destructive command —
 * `clear-data` — additionally requires the --yes flag before it will run.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

// Resolve the repo root relative to this script's REAL location so the CLI
// works both from a checkout (./bin/ccam.js) and through the global symlink
// `npm link` creates (which points back into the checkout).
const REPO_ROOT = path.resolve(path.dirname(fs.realpathSync(__filename)), "..");

/** ANSI helpers — degrade to plain text when stdout is not a TTY. */
const tty = process.stdout.isTTY;
const c = {
  bold: (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s),
  green: (s) => (tty ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (tty ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s) => (tty ? `\x1b[31m${s}\x1b[0m` : s),
  cyan: (s) => (tty ? `\x1b[36m${s}\x1b[0m` : s),
  magenta: (s) => (tty ? `\x1b[35m${s}\x1b[0m` : s),
};

const STATUS_COLOR = {
  active: c.green,
  working: c.green,
  waiting: c.yellow,
  completed: c.dim,
  error: c.red,
  abandoned: c.dim,
  connected: c.green,
  idle: c.dim,
  running: c.green,
};

function colorStatus(s) {
  const fn = STATUS_COLOR[s] || ((x) => x);
  return fn(s || "-");
}

/**
 * Resolve the dashboard base URL. Env override first (matches the hook
 * handler's contract), then the live-server discovery file, then the default
 * port. The discovery module is best-effort and never throws.
 */
function baseUrl() {
  const envPort = process.env.CLAUDE_DASHBOARD_PORT || process.env.DASHBOARD_PORT;
  if (envPort) return `http://127.0.0.1:${envPort}`;
  try {
    const { resolveDashboardPort } = require(
      path.join(REPO_ROOT, "server", "lib", "server-info.js")
    );
    const port = resolveDashboardPort();
    if (port) return `http://127.0.0.1:${port}`;
  } catch {
    /* discovery unavailable — fall through to the default */
  }
  return "http://127.0.0.1:4820";
}

/** Perform an API request; exits with a clear hint when the server is down. */
async function api(method, pathname, body) {
  const url = `${baseUrl()}${pathname}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    console.error(c.red(`✖ Cannot reach the dashboard at ${baseUrl()}`));
    console.error(c.dim("  Start it with: npm run dev   (or npm start)"));
    process.exit(1);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    console.error(c.red(`✖ ${method} ${pathname} → ${msg}`));
    process.exit(1);
  }
  return data;
}
const get = (p) => api("GET", p);
const post = (p, b) => api("POST", p, b);

/** Minimal flag parser: --key value / --key. Positionals returned in order. */
function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const stripAnsi = (s) => String(s ?? "").replace(/\x1b\[[0-9;]*m/g, "");

/** Render rows as a padded plain-text table sized to the widest cell. */
function table(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[i]).length), 1)
  );
  const pad = (s, w) => String(s ?? "") + " ".repeat(Math.max(0, w - stripAnsi(s).length));
  console.log(headers.map((h, i) => c.bold(pad(h, widths[i]))).join("  "));
  console.log(c.dim(widths.map((w) => "─".repeat(w)).join("──")));
  for (const r of rows) console.log(r.map((cell, i) => pad(cell, widths[i])).join("  "));
}

function fmtDuration(startIso, endIso) {
  if (!startIso) return "-";
  const ms = (endIso ? new Date(endIso) : new Date()) - new Date(startIso);
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const m = Math.floor(ms / 60000);
  if (m < 1) return `${Math.floor(ms / 1000)}s`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

const fmtTime = (iso) => (iso ? String(iso).replace("T", " ").slice(0, 19) : "-");
const fmtModel = (m) => (m ? m.replace(/^claude-/, "").slice(0, 22) : "-");
const fmtCost = (n) => `$${Number(n ?? 0).toFixed(4)}`;
const fmtTokens = (n) => {
  const v = Number(n ?? 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(v);
};

// ── Monitoring ──────────────────────────────────────────────────────────────

async function cmdHealth() {
  const h = await get("/api/health");
  console.log(`${c.green("●")} Dashboard ${c.bold("up")} at ${baseUrl()} (${h.timestamp})`);
}

async function cmdStats() {
  const s = await get("/api/stats");
  console.log(c.bold("Dashboard stats") + c.dim(` — ${baseUrl()}`));
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
  const dist = Object.entries(s.sessions_by_status || {})
    .map(([k, v]) => `${colorStatus(k)} ${v}`)
    .join("  ");
  if (dist) console.log(`\nSessions by status: ${dist}`);
}

/** Text rendering of the Kanban board: sessions and agents grouped by status. */
async function cmdKanban() {
  const [sess, ag] = await Promise.all([
    get("/api/sessions?limit=200"),
    get("/api/agents?limit=400"),
  ]);
  const group = (items, key) => {
    const g = {};
    for (const it of items) (g[it[key]] ||= []).push(it);
    return g;
  };
  console.log(c.bold("Sessions"));
  const sg = group(sess.sessions || [], "status");
  for (const col of ["active", "waiting", "completed", "error", "abandoned"]) {
    const items = sg[col] || [];
    console.log(`\n  ${colorStatus(col)} (${items.length})`);
    for (const s of items.slice(0, 10)) {
      console.log(`    ${c.dim(s.id.slice(0, 8))}  ${(s.name || "").slice(0, 52)}`);
    }
    if (items.length > 10) console.log(c.dim(`    … ${items.length - 10} more`));
  }
  console.log(`\n${c.bold("Agents")}`);
  const agr = group(ag.agents || [], "status");
  for (const col of ["working", "waiting", "completed", "error"]) {
    const items = agr[col] || [];
    console.log(`\n  ${colorStatus(col)} (${items.length})`);
    for (const a of items.slice(0, 10)) {
      const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
      console.log(`    ${c.dim(a.id.slice(0, 8))}  ${(a.name || "").slice(0, 48)}${tool}`);
    }
    if (items.length > 10) console.log(c.dim(`    … ${items.length - 10} more`));
  }
}

/**
 * Live event feed (the Activity Feed, in the terminal). Polls /api/events on
 * a short interval and prints only rows newer than the last one seen —
 * dependency-free tailing without a WebSocket client. Ctrl+C to stop.
 */
async function cmdTail(flags) {
  const params = new URLSearchParams();
  if (flags.session) params.set("session_id", flags.session);
  params.set("limit", "25");
  let lastSeen = null;
  console.log(c.dim(`Tailing events from ${baseUrl()} — Ctrl+C to stop`));
  for (;;) {
    const data = await get(`/api/events?${params}`);
    const events = (data.events || []).slice().reverse(); // oldest → newest
    for (const e of events) {
      const key = `${e.id ?? e.created_at}:${e.event_type}`;
      if (lastSeen && key <= lastSeen && e.id == null) continue;
      if (e.id != null && lastSeen != null && Number(e.id) <= Number(lastSeen)) continue;
      if (lastSeen !== null || events.indexOf(e) >= events.length - 10) {
        console.log(
          `${c.dim(fmtTime(e.created_at))}  ${c.cyan((e.event_type || "").padEnd(16))}  ${(e.summary || "").slice(0, 90)}`
        );
      }
      lastSeen = e.id != null ? Number(e.id) : key;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ── Data browsing ───────────────────────────────────────────────────────────

async function cmdSessions(flags) {
  const params = new URLSearchParams();
  if (flags.status) params.set("status", flags.status);
  if (flags.q) params.set("q", flags.q);
  params.set("limit", flags.limit || "20");
  const data = await get(`/api/sessions?${params}`);
  const rows = (data.sessions || []).map((s) => [
    s.id.slice(0, 8),
    colorStatus(s.status),
    (s.name || "").slice(0, 44),
    s.agent_count ?? "-",
    fmtDuration(s.started_at, s.ended_at),
    fmtModel(s.model),
  ]);
  table(["ID", "Status", "Name", "Agents", "Duration", "Model"], rows);
  console.log(c.dim(`\n${rows.length} of ${data.total ?? rows.length} session(s)`));
}

/** Session detail: metadata, cost, agent tree, and the most recent events. */
async function cmdSession(positional) {
  const id = positional[0];
  if (!id) {
    console.error(c.red("✖ Usage: ccam session <session-id>"));
    process.exit(1);
  }
  const d = await get(`/api/sessions/${encodeURIComponent(id)}`);
  const s = d.session || d;
  console.log(`${c.bold(s.name || s.id)} ${c.dim(`(${s.id})`)}`);
  console.log(
    `status ${colorStatus(s.status)} · model ${fmtModel(s.model)} · ` +
      `duration ${fmtDuration(s.started_at, s.ended_at)} · cwd ${s.cwd || "-"}`
  );
  let cost = null;
  try {
    cost = await get(`/api/pricing/cost/${encodeURIComponent(id)}`);
  } catch {
    /* pricing may 404 for unknown ids */
  }
  if (cost) console.log(`cost ${c.cyan(fmtCost(cost.total_cost))}`);

  const agents = d.agents || [];
  if (agents.length) {
    console.log(`\n${c.bold("Agents")} (${agents.length})`);
    // Indent children under their parent to approximate the hierarchy tree.
    const byParent = {};
    for (const a of agents) (byParent[a.parent_agent_id || ""] ||= []).push(a);
    const walk = (parentId, depth) => {
      for (const a of byParent[parentId] || []) {
        const pad = "  ".repeat(depth + 1);
        const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
        console.log(
          `${pad}${colorStatus(a.status)} ${a.type === "main" ? c.bold(a.name) : a.name}${tool} ${c.dim(fmtDuration(a.started_at, a.ended_at))}`
        );
        walk(a.id, depth + 1);
      }
    };
    walk("", 0);
    // Orphans whose parent isn't in the list (defensive)
    const seen = new Set(agents.map((a) => a.parent_agent_id || ""));
    void seen;
  }

  const events = (d.events || []).slice(0, Number(10));
  if (events.length) {
    console.log(`\n${c.bold("Recent events")}`);
    for (const e of events) {
      console.log(
        `  ${c.dim(fmtTime(e.created_at))}  ${c.cyan(e.event_type)}  ${(e.summary || "").slice(0, 70)}`
      );
    }
  }
}

async function cmdAgents(flags) {
  const params = new URLSearchParams();
  if (flags.status) params.set("status", flags.status);
  if (flags.session) params.set("session_id", flags.session);
  params.set("limit", flags.limit || "20");
  const data = await get(`/api/agents?${params}`);
  const rows = (data.agents || []).map((a) => [
    a.id.slice(0, 8),
    colorStatus(a.status),
    a.type,
    (a.name || "").slice(0, 40),
    a.current_tool || "-",
    fmtDuration(a.started_at, a.ended_at),
  ]);
  table(["ID", "Status", "Type", "Name", "Tool", "Duration"], rows);
}

async function cmdEvents(flags) {
  const params = new URLSearchParams();
  if (flags.session) params.set("session_id", flags.session);
  params.set("limit", flags.limit || "20");
  const data = await get(`/api/events?${params}`);
  const rows = (data.events || []).map((e) => [
    fmtTime(e.created_at),
    e.event_type,
    e.tool_name || "-",
    (e.summary || "").slice(0, 60),
  ]);
  table(["Time", "Type", "Tool", "Summary"], rows);
}

// ── Insights ────────────────────────────────────────────────────────────────

async function cmdAnalytics() {
  const a = await get("/api/analytics");
  console.log(c.bold("Analytics") + c.dim(` — ${baseUrl()}`));
  const t = a.tokens || {};
  table(
    ["Tokens", "Count"],
    [
      ["Input", fmtTokens(t.total_input)],
      ["Output", fmtTokens(t.total_output)],
      ["Cache read", fmtTokens(t.total_cache_read)],
      ["Cache write", fmtTokens(t.total_cache_write)],
    ]
  );
  const tools = (a.tool_usage || []).slice(0, 10);
  if (tools.length) {
    console.log(`\n${c.bold("Top tools")}`);
    table(
      ["Tool", "Calls"],
      tools.map((x) => [x.tool_name || x.tool, x.count])
    );
  }
  const types = (a.agent_types || []).slice(0, 8);
  if (types.length) {
    console.log(`\n${c.bold("Agent types")}`);
    table(
      ["Type", "Count"],
      types.map((x) => [x.subagent_type || x.type || "main", x.count])
    );
  }
  if (a.avg_events_per_session != null) {
    console.log(`\nAvg events/session: ${c.cyan(Number(a.avg_events_per_session).toFixed(1))}`);
  }
}

async function cmdWorkflows(flags) {
  if (flags.session) {
    const d = await get(`/api/workflows/session/${encodeURIComponent(flags.session)}`);
    console.log(c.bold(`Workflow drill-in — session ${flags.session}`));
    const agents = d.agents || d.tree || [];
    console.log(`agents: ${Array.isArray(agents) ? agents.length : "-"}`);
    return;
  }
  const w = await get("/api/workflows");
  const s = w.stats || {};
  console.log(c.bold("Workflow intelligence") + c.dim(` — ${baseUrl()}`));
  table(
    ["Metric", "Value"],
    [
      ["Sessions analyzed", s.totalSessions ?? "-"],
      ["Total agents", s.totalAgents ?? "-"],
      ["Subagents", s.totalSubagents ?? "-"],
      ["Avg subagents/session", s.avgSubagents ?? "-"],
      ["Success rate", s.successRate != null ? `${s.successRate}%` : "-"],
      ["Avg depth", s.avgDepth ?? "-"],
      ["Compactions", s.totalCompactions ?? "-"],
    ]
  );
  const patterns = (w.patterns && w.patterns.patterns) || [];
  if (patterns.length) {
    console.log(`\n${c.bold("Detected patterns")} (top ${Math.min(5, patterns.length)})`);
    for (const p of patterns.slice(0, 5)) {
      console.log(
        `  ${c.cyan(String(p.count ?? "-"))}× ${(p.label || p.chain || "").toString().slice(0, 80)}`
      );
    }
  }
}

async function cmdRuns(flags) {
  const params = new URLSearchParams();
  if (flags.session) params.set("session_id", flags.session);
  const data = await get(`/api/workflows/runs?${params}`);
  const runs = data.runs || data.items || [];
  const rows = runs
    .slice(0, Number(flags.limit || 20))
    .map((r) => [
      (r.run_id || "").slice(0, 14),
      colorStatus(r.status),
      (r.name || "").slice(0, 28),
      r.agent_count ?? "-",
      fmtTokens(r.total_tokens),
      r.total_tool_calls ?? "-",
      fmtDuration(r.started_at, r.ended_at),
    ]);
  table(["Run", "Status", "Name", "Agents", "Tokens", "Tools", "Duration"], rows);
}

async function cmdCost() {
  const cost = await get("/api/pricing/cost");
  console.log(`${c.bold("Total estimated cost:")} ${c.cyan(fmtCost(cost.total_cost))}`);
  const rows = (cost.breakdown || []).slice(0, 15).map((b) => [b.model, fmtCost(b.cost)]);
  if (rows.length) table(["Model", "Cost"], rows);
}

// ── Alerts & webhooks ───────────────────────────────────────────────────────

async function cmdAlerts(flags, positional) {
  const sub = positional[0];
  if (sub === "ack" && positional[1]) {
    await post(`/api/alerts/${positional[1]}/ack`);
    console.log(`${c.green("✔")} Alert ${positional[1]} acknowledged`);
    return;
  }
  if (sub === "ack-all") {
    const r = await post("/api/alerts/ack-all");
    console.log(`${c.green("✔")} Acknowledged ${r.acknowledged ?? "all"} alert(s)`);
    return;
  }
  const params = new URLSearchParams();
  if (flags.unacked) params.set("unacked", "true");
  params.set("limit", flags.limit || "20");
  const data = await get(`/api/alerts?${params}`);
  const rows = (data.alerts || []).map((a) => [
    a.id,
    a.acknowledged_at ? c.dim("acked") : c.yellow("open"),
    fmtTime(a.triggered_at),
    (a.rule_name || "").slice(0, 24),
    (a.message || "").slice(0, 52),
  ]);
  table(["ID", "State", "Triggered", "Rule", "Message"], rows);
  console.log(c.dim(`\n${data.unacked ?? 0} unacknowledged of ${data.total ?? rows.length}`));
}

async function cmdRules() {
  const data = await get("/api/alerts/rules");
  const rows = (data.rules || []).map((r) => [
    r.id,
    r.enabled ? c.green("on") : c.dim("off"),
    r.rule_type,
    (r.name || "").slice(0, 32),
    `${r.cooldown_minutes ?? "-"}m`,
  ]);
  table(["ID", "Enabled", "Type", "Name", "Cooldown"], rows);
}

async function cmdWebhooks(flags, positional) {
  const sub = positional[0];
  if (sub === "test" && positional[1]) {
    const r = await post(`/api/webhooks/${positional[1]}/test`);
    const ok = r.ok || r.success;
    console.log(
      ok
        ? `${c.green("✔")} Test delivery succeeded (HTTP ${r.status ?? "?"}, ${r.attempts ?? 1} attempt(s))`
        : `${c.red("✖")} Test delivery failed: ${r.error || `HTTP ${r.status}`}`
    );
    process.exit(ok ? 0 : 1);
  }
  const data = await get("/api/webhooks");
  const rows = (data.targets || []).map((t) => [
    t.id,
    t.enabled ? c.green("on") : c.dim("off"),
    t.type,
    (t.name || "").slice(0, 28),
    t.url_masked || t.url || "-",
  ]);
  table(["ID", "Enabled", "Provider", "Name", "URL"], rows);
}

// ── Pricing ─────────────────────────────────────────────────────────────────

async function cmdPricing(flags, positional) {
  const sub = positional[0];
  if (sub === "set" && positional[1]) {
    const body = {
      model_pattern: positional[1],
      display_name: flags.name || positional[1],
      input_per_mtok: Number(flags.input ?? 0),
      output_per_mtok: Number(flags.output ?? 0),
      cache_read_per_mtok: Number(flags["cache-read"] ?? 0),
      cache_write_per_mtok: Number(flags["cache-write"] ?? 0),
    };
    await api("PUT", "/api/pricing", body);
    console.log(`${c.green("✔")} Pricing rule saved for ${c.bold(positional[1])}`);
    return;
  }
  if (sub === "delete" && positional[1]) {
    await api("DELETE", `/api/pricing/${encodeURIComponent(positional[1])}`);
    console.log(`${c.green("✔")} Pricing rule deleted: ${positional[1]}`);
    return;
  }
  if (sub === "reset") {
    await post("/api/settings/reset-pricing");
    console.log(`${c.green("✔")} Pricing rules reset to defaults`);
    return;
  }
  const data = await get("/api/pricing");
  const rows = (data.pricing || data.rules || []).map((p) => [
    p.model_pattern,
    (p.display_name || "").slice(0, 24),
    `$${p.input_per_mtok}`,
    `$${p.output_per_mtok}`,
    `$${p.cache_read_per_mtok}`,
    `$${p.cache_write_per_mtok}`,
  ]);
  table(["Pattern", "Name", "In/M", "Out/M", "CacheR/M", "CacheW/M"], rows);
}

// ── Import ──────────────────────────────────────────────────────────────────

async function cmdImport(flags, positional) {
  const sub = positional[0];
  if (sub === "rescan") {
    console.log(c.dim("Rescanning ~/.claude/projects — this can take a while…"));
    const r = await post("/api/import/rescan");
    console.log(
      `${c.green("✔")} imported ${r.imported ?? 0}, backfilled ${r.backfilled ?? 0}, skipped ${r.skipped ?? 0}, errors ${r.errors ?? 0}`
    );
    return;
  }
  if (sub === "path" && positional[1]) {
    console.log(c.dim(`Scanning ${positional[1]} …`));
    const r = await post("/api/import/scan-path", { path: positional[1] });
    console.log(
      `${c.green("✔")} imported ${r.imported ?? 0}, backfilled ${r.backfilled ?? 0}, skipped ${r.skipped ?? 0}, errors ${r.errors ?? 0}`
    );
    return;
  }
  console.error(c.red("✖ Usage: ccam import rescan | ccam import path <dir>"));
  process.exit(1);
}

// ── Administration ──────────────────────────────────────────────────────────

async function cmdDoctor() {
  console.log(c.bold("ccam doctor") + c.dim(` — ${baseUrl()}`));
  await get("/api/health");
  console.log(`${c.green("✔")}  API reachable  ${baseUrl()}`);
  const info = await get("/api/settings/info");
  const hooks = info.hooks || {};
  console.log(
    `${hooks.installed ? c.green("✔") : c.red("✖")}  Claude Code hooks  ${
      hooks.installed
        ? `installed (${hooks.path || "~/.claude/settings.json"})`
        : "NOT installed — run: npm run install-hooks"
    }`
  );
  const db = info.db || {};
  console.log(
    `${c.green("✔")}  Database  ${db.path || "?"} (${((db.size || 0) / 1048576).toFixed(1)} MB)`
  );
  for (const [t, n] of Object.entries(db.counts || {})) {
    console.log(`${c.dim("·")}    rows: ${t}  ${n}`);
  }
  const srv = info.server || {};
  console.log(
    `${c.green("✔")}  Server uptime  ${Math.floor((srv.uptime || 0) / 60)} min (node ${srv.node_version || "?"})`
  );
  console.log(`${c.green("✔")}  WS connections  ${srv.ws_connections ?? 0}`);
}

async function cmdInfo() {
  const info = await get("/api/settings/info");
  console.log(JSON.stringify(info, null, 2));
}

async function cmdExport(positional) {
  const file = positional[0] || `ccam-export-${new Date().toISOString().slice(0, 10)}.json`;
  const data = await get("/api/settings/export");
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(
    `${c.green("✔")} Exported to ${c.bold(file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`
  );
}

async function cmdCleanup(flags) {
  const body = {};
  if (flags.hours) body.abandon_hours = Number(flags.hours);
  if (flags.days) body.purge_days = Number(flags.days);
  if (!flags.hours && !flags.days) {
    console.error(c.red("✖ Usage: ccam cleanup --hours <N> and/or --days <M>"));
    console.error(c.dim("  --hours N  abandon active sessions idle for N hours"));
    console.error(c.dim("  --days M   purge completed sessions older than M days"));
    process.exit(1);
  }
  const r = await post("/api/settings/cleanup", body);
  console.log(`${c.green("✔")} Cleanup done: ${JSON.stringify(r)}`);
}

async function cmdClearData(flags) {
  if (flags.yes !== true) {
    console.error(c.red("✖ clear-data deletes ALL sessions, agents, events, and token usage."));
    console.error(c.dim("  Re-run with --yes to confirm: ccam clear-data --yes"));
    process.exit(1);
  }
  await post("/api/settings/clear-data");
  console.log(`${c.green("✔")} All data cleared (schema preserved)`);
}

async function cmdReinstallHooks() {
  await post("/api/settings/reinstall-hooks");
  console.log(`${c.green("✔")} Claude Code hooks reinstalled`);
}

function cmdOpen() {
  const url = baseUrl();
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(opener, [url], {
    shell: process.platform === "win32",
    detached: true,
    stdio: "ignore",
  }).unref();
  console.log(`${c.green("✔")} Opening ${url}`);
}

function cmdHelp() {
  console.log(`${c.bold("ccam")} — Claude Code Agent Monitor CLI

${c.bold("Usage:")} ccam <command> [options]

${c.bold("Monitoring")}
  health                      Check the dashboard is up
  stats                       Totals, today's events, status distributions
  kanban                      Sessions + agents grouped by status columns
  tail [--session id]         Live event feed in the terminal (Ctrl+C stops)

${c.bold("Data")}
  sessions [opts]             List sessions   (--status, --q, --limit)
  session <id>                Session detail: agents tree, cost, recent events
  agents   [opts]             List agents     (--status, --session, --limit)
  events   [opts]             List events     (--session, --limit)

${c.bold("Insights")}
  analytics                   Token totals, top tools, agent types
  workflows [--session id]    Workflow intelligence stats and patterns
  runs [--session id]         Dynamic Workflow-tool runs
  cost                        Total estimated cost (per-model breakdown)

${c.bold("Alerts & Webhooks")}
  alerts [--unacked]          Fired-alert feed
  alerts ack <id>             Acknowledge one alert
  alerts ack-all              Acknowledge every unacked alert
  rules                       List alert rules
  webhooks                    List webhook targets
  webhooks test <id>          Send a synthetic test alert to a target

${c.bold("Pricing")}
  pricing                     List model pricing rules
  pricing set <pattern> --input N --output N [--cache-read N --cache-write N]
  pricing delete <pattern>    Delete a pricing rule
  pricing reset               Reset pricing rules to defaults

${c.bold("Import")}
  import rescan               Re-scan ~/.claude/projects
  import path <dir>           Import every .jsonl under a directory

${c.bold("Administration")}
  doctor                      Connectivity, hooks, and database diagnosis
  info                        Raw system info JSON
  export [file.json]          Export all data as JSON
  cleanup --hours N --days M  Abandon stale / purge old sessions
  reinstall-hooks             Reinstall Claude Code hooks
  clear-data --yes            Delete ALL data (requires --yes)
  open                        Open the dashboard in your browser

${c.bold("Server discovery:")} CLAUDE_DASHBOARD_PORT / DASHBOARD_PORT env vars win,
otherwise the live server is found via ~/.claude/.agent-dashboard.json,
falling back to http://127.0.0.1:4820.`);
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  switch (cmd) {
    case "health":
      return cmdHealth();
    case "stats":
      return cmdStats();
    case "kanban":
      return cmdKanban();
    case "tail":
      return cmdTail(flags);
    case "sessions":
      return cmdSessions(flags);
    case "session":
      return cmdSession(positional);
    case "agents":
      return cmdAgents(flags);
    case "events":
      return cmdEvents(flags);
    case "analytics":
      return cmdAnalytics();
    case "workflows":
      return cmdWorkflows(flags);
    case "runs":
      return cmdRuns(flags);
    case "cost":
      return cmdCost();
    case "alerts":
      return cmdAlerts(flags, positional);
    case "rules":
      return cmdRules();
    case "webhooks":
      return cmdWebhooks(flags, positional);
    case "pricing":
      return cmdPricing(flags, positional);
    case "import":
      return cmdImport(flags, positional);
    case "doctor":
      return cmdDoctor();
    case "info":
      return cmdInfo();
    case "export":
      return cmdExport(positional);
    case "cleanup":
      return cmdCleanup(flags);
    case "clear-data":
      return cmdClearData(flags);
    case "reinstall-hooks":
      return cmdReinstallHooks();
    case "open":
      return cmdOpen();
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return cmdHelp();
    default:
      console.error(c.red(`✖ Unknown command: ${cmd}`));
      cmdHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.red(`✖ ${err?.message || err}`));
  process.exit(1);
});
