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

// ── Presentation layer ──────────────────────────────────────────────────────
// Styling follows the informal CLI conventions: colors are enabled on a TTY,
// disabled when output is piped or redirected, force-disabled by the NO_COLOR
// env var (https://no-color.org) or a --no-color flag anywhere on the command
// line, and force-enabled by FORCE_COLOR / CCAM_COLOR=1 (useful for `watch`
// or CI logs that render ANSI). Every helper degrades to plain text, so piped
// output stays grep/script-friendly byte-for-byte.
const useColor = (() => {
  if (process.env.NO_COLOR || process.argv.includes("--no-color")) return false;
  const force = process.env.FORCE_COLOR;
  if (force != null && force !== "" && force !== "0" && force !== "false") return true;
  if (process.env.CCAM_COLOR === "1") return true;
  return Boolean(process.stdout.isTTY);
})();

/** Build a style function from SGR open/close codes (close restores state so
 *  styles nest — e.g. bold inside a colored string). */
const sgr = (open, close) => (s) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
const c = {
  bold: sgr(1, 22),
  dim: sgr(2, 22),
  italic: sgr(3, 23),
  underline: sgr(4, 24),
  red: sgr(31, 39),
  green: sgr(32, 39),
  yellow: sgr(33, 39),
  blue: sgr(34, 39),
  magenta: sgr(35, 39),
  cyan: sgr(36, 39),
  gray: sgr(90, 39),
};

/** Per-status icon + color, shared by every table, lane, and detail view. */
const STATUS_THEME = {
  active: { icon: "●", paint: c.green },
  working: { icon: "◐", paint: c.green },
  waiting: { icon: "○", paint: c.yellow },
  completed: { icon: "✔", paint: c.gray },
  error: { icon: "✖", paint: c.red },
  abandoned: { icon: "◦", paint: c.gray },
  connected: { icon: "●", paint: c.green },
  idle: { icon: "·", paint: c.gray },
  running: { icon: "●", paint: c.green },
};

function colorStatus(s) {
  const t = STATUS_THEME[s];
  return t ? t.paint(`${t.icon} ${s}`) : s || "-";
}

/** Hook/event types get stable colors so the feed is scannable at a glance. */
const EVENT_COLOR = {
  SessionStart: c.green,
  SessionEnd: c.gray,
  Stop: c.magenta,
  SubagentStop: c.magenta,
  PreToolUse: c.cyan,
  PostToolUse: c.blue,
  UserPromptSubmit: c.yellow,
  Notification: c.yellow,
  PreCompact: c.gray,
};
const paintEvent = (t) => (EVENT_COLOR[t] || c.cyan)(t);

/** Section heading: a colored sidebar glyph + bold title + dim subtitle. */
function heading(title, sub) {
  console.log(c.cyan("▍") + c.bold(title) + (sub ? c.dim(` — ${sub}`) : ""));
}

/** Aligned key/value line used by detail views. */
function kvLine(key, value, keyWidth = 9) {
  console.log(`  ${c.dim(String(key).padEnd(keyWidth))} ${value}`);
}

/** Horizontal bar for inline charts: value scaled against max. */
function bar(value, max, width = 16, paint = c.cyan) {
  const v = Number(value) || 0;
  const m = Math.max(Number(max) || 0, 1);
  // Any non-zero value renders at least one block so small counts stay visible
  // next to a dominant maximum.
  let filled = Math.min(width, Math.round((v / m) * width));
  if (v > 0 && filled === 0) filled = 1;
  return paint("█".repeat(Math.max(0, filled))) + c.dim("░".repeat(Math.max(0, width - filled)));
}

/** Usable terminal width, with a sane default when not a TTY (pipes, tests). */
function termWidth() {
  const w = process.stdout.columns;
  return Number.isFinite(w) && w > 40 ? w : 120;
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

/** Thrown when the dashboard server does not answer — the dispatcher decides
 *  whether the active command has an offline fallback or must abort. */
class ServerDownError extends Error {}

/** Perform an API request; throws ServerDownError when the server is down. */
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
    throw new ServerDownError();
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

/**
 * Print the standard "server is not running" indicator and exit 1. Every
 * command that needs the API funnels through this, so the guidance is
 * identical everywhere: the ccam CLI talks to the local dashboard server,
 * and `ccam start` (or npm run dev / npm start) brings one up.
 */
function serverDownExit(reason) {
  console.error(`${c.red("○ Dashboard server is NOT running")} ${c.dim(`(tried ${baseUrl()})`)}`);
  if (reason) console.error(c.dim(`  No offline fallback for this command: ${reason}.`));
  console.error(c.dim("  This command needs the server. Start it with one of:"));
  console.error(
    `    ${c.bold("ccam start")}        ${c.dim("# production server in the background")}`
  );
  console.error(
    `    ${c.bold("npm run dev")}       ${c.dim("# dev mode (hot reload), foreground")}`
  );
  console.error(`    ${c.bold("npm start")}         ${c.dim("# production mode, foreground")}`);
  process.exit(1);
}

/** True when the dashboard answers /api/health at the resolved URL. */
async function serverIsUp() {
  try {
    const res = await fetch(`${baseUrl()}/api/health`, { signal: AbortSignal.timeout(2_500) });
    return res.ok;
  } catch {
    return false;
  }
}

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

/**
 * Render rows as a box-drawn table: bold headers, dim borders, right-aligned
 * numeric columns, and width fitting — when the natural table is wider than
 * the terminal, the widest column is progressively narrowed and its cells
 * clipped with an ellipsis, so the frame never wraps mid-row.
 */
function table(headers, rows) {
  const cells = rows.map((r) => r.map((x) => String(x ?? "")));
  // A column is numeric (→ right-aligned) when every non-empty cell looks
  // like a number, money amount, token count, or percentage.
  const numeric = headers.map(
    (_, i) =>
      cells.length > 0 &&
      cells.every((r) => {
        const v = stripAnsi(r[i]).trim();
        return v === "" || v === "-" || /^\$?[\d,.]+[%kMB]?$/.test(v);
      })
  );
  const widths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...cells.map((r) => stripAnsi(r[i]).length), 1)
  );
  const frameWidth = () => widths.reduce((a, w) => a + w + 3, 1);
  while (frameWidth() > termWidth() && Math.max(...widths) > 8) {
    widths[widths.indexOf(Math.max(...widths))]--;
  }
  // Clipping drops per-cell styling for simplicity — a truncated cell is
  // plain text with a trailing ellipsis.
  const clip = (s, w) => {
    const plain = stripAnsi(s);
    return plain.length <= w ? s : `${plain.slice(0, Math.max(0, w - 1))}…`;
  };
  const pad = (s, w, right) => {
    const v = clip(s, w);
    const gap = " ".repeat(Math.max(0, w - stripAnsi(v).length));
    return right ? gap + v : v + gap;
  };
  const rule = (l, m, r) => c.dim(l + widths.map((w) => "─".repeat(w + 2)).join(m) + r);
  const line = (cols, styleFn) =>
    c.dim("│") +
    cols
      .map(
        (cell, i) =>
          ` ${styleFn ? styleFn(pad(cell, widths[i], numeric[i])) : pad(cell, widths[i], numeric[i])} `
      )
      .join(c.dim("│")) +
    c.dim("│");
  console.log(rule("╭", "┬", "╮"));
  console.log(line(headers, c.bold));
  console.log(rule("├", "┼", "┤"));
  for (const r of cells) console.log(line(r));
  if (!cells.length) {
    const inner = widths.reduce((a, w) => a + w + 2, 0) + widths.length - 1;
    console.log(c.dim("│") + c.dim(pad("  (no rows)", inner)) + c.dim("│"));
  }
  console.log(rule("╰", "┴", "╯"));
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
/** Compact relative timestamp ("4m ago") for freshness-at-a-glance columns. */
function fmtAgo(iso) {
  if (!iso) return "-";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "-";
  if (ms < 0) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const fmtModel = (m) => (m ? m.replace(/^claude-/, "").slice(0, 22) : "-");
const fmtCost = (n) => `$${Number(n ?? 0).toFixed(4)}`;
const fmtTokens = (n) => {
  const v = Number(n ?? 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(v);
};

// ── Offline mode ────────────────────────────────────────────────────────────
// When the server is down, read-only commands fall back to reading the
// SQLite database directly (readonly, second reader is safe under WAL).
// Commands that need server-side logic (cost math, analytics aggregation,
// live capture, mutations with broadcasts) refuse instead — running them
// against the raw DB would produce unreliable or divergent results.

/** DB path resolution mirrors server/db.js: env override, then data/. */
function dbPath() {
  return process.env.DASHBOARD_DB_PATH || path.join(REPO_ROOT, "data", "dashboard.db");
}

/**
 * Open the dashboard database for reading. Tries better-sqlite3 from the
 * repo's node_modules first, then Node's built-in node:sqlite (Node 22+).
 * Never creates a database file (existence is checked first), and the CLI
 * only ever issues SELECTs through the returned handle. The connection is
 * deliberately NOT opened with SQLite's readonly flag: a strict readonly
 * connection cannot attach a live WAL's shared-memory index and would
 * silently read the pre-WAL (stale/empty) state when another process has the
 * database open — a normal connection under WAL reads consistently instead.
 */
function openDbReadonly() {
  const file = dbPath();
  if (!fs.existsSync(file)) return null;
  try {
    const Database = require(path.join(REPO_ROOT, "node_modules", "better-sqlite3"));
    const db = new Database(file, { fileMustExist: true });
    return { all: (sql, ...p) => db.prepare(sql).all(...p) };
  } catch {
    /* fall through to node:sqlite */
  }
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file);
    return { all: (sql, ...p) => db.prepare(sql).all(...p) };
  } catch {
    return null;
  }
}

/** One-time banner explaining that results come straight from the DB file. */
function offlineBanner() {
  console.log(
    `${c.yellow("⚠ Offline mode")} ${c.dim(`— server not running; reading ${dbPath()} directly.`)}`
  );
  console.log(
    c.dim("  Data is as of the last capture — live capture and full features need the server: ") +
      c.bold("ccam start")
  );
  console.log();
}

/**
 * Display-side staleness correction. While the server is down, its
 * dead-session liveness reap is not running, so sessions that were quit
 * after the server stopped still sit in the DB as active/waiting. Rather
 * than print those stale statuses, run the SAME process-liveness probe the
 * server's watchdog uses (server/lib/session-liveness.js) and correct the
 * DISPLAYED status of any active session whose cwd has no running `claude`
 * process — the database itself is never modified (that stays the server's
 * job). Returns the number of corrected sessions, the set of their ids (so
 * agent rows can be corrected consistently), and whether the probe could
 * answer at all (it can't on Windows or inside containers — in that case a
 * staleness caveat is printed instead).
 */
function livenessCorrect(sessions) {
  let probe;
  try {
    probe = require(path.join(REPO_ROOT, "server", "lib", "session-liveness.js")).probeLiveCwds();
  } catch {
    probe = { available: false };
  }
  const hadActive = sessions.some((s) => s.status === "active");
  if (!probe.available) return { available: false, hadActive, corrected: 0, deadIds: new Set() };
  const deadIds = new Set();
  for (const s of sessions) {
    if (s.status !== "active" || !s.cwd) continue;
    let resolved;
    try {
      resolved = path.resolve(s.cwd);
    } catch {
      continue;
    }
    if (!probe.cwds.has(resolved)) {
      s.status = "completed";
      s.awaiting_input_since = null;
      deadIds.add(s.id);
    }
  }
  return { available: true, corrected: deadIds.size, deadIds };
}

/** Correct agent rows belonging to sessions the probe found dead. */
function livenessCorrectAgents(agents, deadIds) {
  let n = 0;
  for (const a of agents) {
    if (deadIds.has(a.session_id) && a.status !== "completed" && a.status !== "error") {
      a.status = "completed";
      a.awaiting_input_since = null;
      n++;
    }
  }
  return n;
}

/** Footnote for corrected output / caveat when the probe cannot answer. */
function livenessNote(result) {
  if (!result.available) {
    if (!result.hadActive) return; // nothing that could be stale was shown
    console.log(
      c.dim(
        "※ Statuses are as stored: sessions that ended while the server was down may still show active/waiting (liveness probe unavailable on this platform)."
      )
    );
  } else if (result.corrected > 0) {
    console.log(
      c.dim(
        `※ ${result.corrected} session(s) displayed as completed by the process-liveness probe — no running claude process owns them. The database is only updated once the server runs again.`
      )
    );
  }
}

/** Offline data providers shaped exactly like their API counterparts. */
const offlineData = {
  sessions(db, flags) {
    const conds = [];
    const params = [];
    if (flags.status) {
      conds.push("s.status = ?");
      params.push(flags.status);
    }
    if (flags.q) {
      conds.push("(s.id LIKE ? OR s.name LIKE ? OR s.cwd LIKE ?)");
      const like = `%${flags.q}%`;
      params.push(like, like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const limit = Number(flags.limit || 20);
    const rows = db.all(
      `SELECT s.*, (SELECT COUNT(*) FROM agents a WHERE a.session_id = s.id) AS agent_count
       FROM sessions s ${where} ORDER BY s.updated_at DESC LIMIT ?`,
      ...params,
      limit
    );
    const total = db.all(`SELECT COUNT(*) AS n FROM sessions s ${where}`, ...params)[0].n;
    return { sessions: rows, total };
  },
  agents(db, flags) {
    const conds = [];
    const params = [];
    if (flags.status) {
      conds.push("status = ?");
      params.push(flags.status);
    }
    if (flags.session) {
      conds.push("session_id = ?");
      params.push(flags.session);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    return {
      agents: db.all(
        `SELECT * FROM agents ${where} ORDER BY started_at DESC LIMIT ?`,
        ...params,
        Number(flags.limit || 20)
      ),
    };
  },
  events(db, flags) {
    const conds = [];
    const params = [];
    if (flags.session) {
      conds.push("session_id = ?");
      params.push(flags.session);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    return {
      events: db.all(
        `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT ?`,
        ...params,
        Number(flags.limit || 20)
      ),
    };
  },
  stats(db) {
    const one = (sql, ...p) => db.all(sql, ...p)[0].n;
    const dist = {};
    for (const r of db.all("SELECT status, COUNT(*) AS n FROM sessions GROUP BY status")) {
      dist[r.status] = r.n;
    }
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return {
      total_sessions: one("SELECT COUNT(*) AS n FROM sessions"),
      active_sessions: one("SELECT COUNT(*) AS n FROM sessions WHERE status = 'active'"),
      total_agents: one("SELECT COUNT(*) AS n FROM agents"),
      active_agents: one("SELECT COUNT(*) AS n FROM agents WHERE status = 'working'"),
      total_events: one("SELECT COUNT(*) AS n FROM events"),
      events_today: one(
        "SELECT COUNT(*) AS n FROM events WHERE created_at >= ?",
        midnight.toISOString()
      ),
      ws_connections: 0,
      sessions_by_status: dist,
    };
  },
};

// ── Monitoring ──────────────────────────────────────────────────────────────

async function cmdHealth() {
  const h = await get("/api/health");
  console.log(`${c.green("●")} Dashboard ${c.bold("up")} at ${baseUrl()} (${h.timestamp})`);
}

function renderStats(s, source) {
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
  const entries = Object.entries(s.sessions_by_status || {});
  if (entries.length) {
    console.log(`\n${c.bold("Sessions by status")}`);
    const max = Math.max(...entries.map(([, v]) => v));
    const w = Math.max(...entries.map(([k]) => k.length)) + 2;
    for (const [k, v] of entries) {
      const t = STATUS_THEME[k] || { icon: "·", paint: (x) => x };
      console.log(`  ${t.paint(`${t.icon} ${k}`.padEnd(w))}  ${bar(v, max)} ${c.bold(String(v))}`);
    }
  }
}

async function cmdStats() {
  renderStats(await get("/api/stats"), baseUrl());
}

/** Text rendering of the Kanban board: sessions and agents grouped by status
 *  lanes, each lane a colored header rule with tree-branch item rows. */
function renderKanban(sess, ag) {
  const group = (items, key) => {
    const g = {};
    for (const it of items) (g[it[key]] ||= []).push(it);
    return g;
  };
  const lane = (col, items, render) => {
    const t = STATUS_THEME[col] || { icon: "·", paint: (x) => x };
    const label = `${t.icon} ${col} (${items.length})`;
    const ruleLen = Math.max(2, 34 - stripAnsi(label).length);
    console.log(`\n  ${t.paint(label)} ${c.dim("─".repeat(ruleLen))}`);
    const shown = items.slice(0, 10);
    shown.forEach((it, i) => {
      const branch = i === items.length - 1 ? "└─" : "├─";
      render(it, c.dim(branch));
    });
    if (items.length > 10) console.log(c.dim(`  └─ … ${items.length - 10} more`));
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

async function cmdKanban() {
  const [sess, ag] = await Promise.all([
    get("/api/sessions?limit=200"),
    get("/api/agents?limit=400"),
  ]);
  renderKanban(sess, ag);
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
  await get(`/api/health`); // fail fast (and route offline messaging) before announcing
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
          `${c.dim(fmtTime(e.created_at))}  ${paintEvent((e.event_type || "").padEnd(16))}  ${(e.summary || "").slice(0, 90)}`
        );
      }
      lastSeen = e.id != null ? Number(e.id) : key;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ── Data browsing ───────────────────────────────────────────────────────────

function renderSessions(data) {
  const rows = (data.sessions || []).map((s) => [
    s.id.slice(0, 8),
    colorStatus(s.status),
    (s.name || "").slice(0, 44),
    s.agent_count ?? "-",
    fmtDuration(s.started_at, s.ended_at),
    fmtModel(s.model),
    c.dim(fmtAgo(s.updated_at || s.started_at)),
  ]);
  table(["ID", "Status", "Name", "Agents", "Duration", "Model", "Updated"], rows);
  console.log(c.dim(`\n${rows.length} of ${data.total ?? rows.length} session(s)`));
}

// ── Session detail building blocks (shared by online and offline paths so
//    the two render byte-identically) ────────────────────────────────────────

/** Title + aligned metadata card for one session row. */
function renderSessionMeta(s) {
  console.log(`${c.cyan("▍")}${c.bold(s.name || s.id)} ${c.dim(`(${s.id})`)}`);
  kvLine("Status", colorStatus(s.status));
  kvLine("Model", fmtModel(s.model));
  kvLine("Duration", fmtDuration(s.started_at, s.ended_at));
  kvLine("Cwd", s.cwd || "-");
}

/** Agent hierarchy as a real tree (├─/└─ with continuation rails). */
function renderAgentTree(agents) {
  console.log(`\n${c.cyan("▍")}${c.bold("Agents")} ${c.dim(`(${agents.length})`)}`);
  const byParent = {};
  for (const a of agents) (byParent[a.parent_agent_id || ""] ||= []).push(a);
  const walk = (parentId, prefix) => {
    const kids = byParent[parentId] || [];
    kids.forEach((a, i) => {
      const last = i === kids.length - 1;
      const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
      console.log(
        `  ${c.dim(prefix + (last ? "└─ " : "├─ "))}${colorStatus(a.status)} ` +
          `${a.type === "main" ? c.bold(a.name) : a.name}${tool} ${c.dim(fmtDuration(a.started_at, a.ended_at))}`
      );
      walk(a.id, prefix + (last ? "   " : "│  "));
    });
  };
  walk("", "");
}

/** Recent-events block with per-type colors. */
function renderEventLines(events) {
  console.log(`\n${c.cyan("▍")}${c.bold("Recent events")}`);
  for (const e of events) {
    console.log(
      `  ${c.dim(fmtTime(e.created_at))}  ${paintEvent((e.event_type || "").padEnd(16))}  ${(e.summary || "").slice(0, 70)}`
    );
  }
}

async function cmdSessions(flags) {
  const params = new URLSearchParams();
  if (flags.status) params.set("status", flags.status);
  if (flags.q) params.set("q", flags.q);
  params.set("limit", flags.limit || "20");
  renderSessions(await get(`/api/sessions?${params}`));
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
  renderSessionMeta(s);
  let cost = null;
  try {
    cost = await get(`/api/pricing/cost/${encodeURIComponent(id)}`);
  } catch {
    /* pricing may 404 for unknown ids */
  }
  if (cost) kvLine("Cost", c.cyan(c.bold(fmtCost(cost.total_cost))));

  const agents = d.agents || [];
  if (agents.length) renderAgentTree(agents);

  const events = (d.events || []).slice(0, 10);
  if (events.length) renderEventLines(events);
}

function renderAgents(data) {
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

async function cmdAgents(flags) {
  const params = new URLSearchParams();
  if (flags.status) params.set("status", flags.status);
  if (flags.session) params.set("session_id", flags.session);
  params.set("limit", flags.limit || "20");
  renderAgents(await get(`/api/agents?${params}`));
}

function renderEvents(data) {
  const rows = (data.events || []).map((e) => [
    fmtTime(e.created_at),
    e.event_type,
    e.tool_name || "-",
    (e.summary || "").slice(0, 60),
  ]);
  table(["Time", "Type", "Tool", "Summary"], rows);
}

async function cmdEvents(flags) {
  const params = new URLSearchParams();
  if (flags.session) params.set("session_id", flags.session);
  params.set("limit", flags.limit || "20");
  renderEvents(await get(`/api/events?${params}`));
}

// ── Insights ────────────────────────────────────────────────────────────────

async function cmdAnalytics() {
  const a = await get("/api/analytics");
  heading("Analytics", baseUrl());
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
    const max = Math.max(...tools.map((x) => Number(x.count) || 0));
    const w = Math.max(...tools.map((x) => String(x.tool_name || x.tool).length));
    for (const x of tools) {
      console.log(
        `  ${String(x.tool_name || x.tool).padEnd(w)}  ${bar(x.count, max)} ${c.bold(String(x.count))}`
      );
    }
  }
  const types = (a.agent_types || []).slice(0, 8);
  if (types.length) {
    console.log(`\n${c.bold("Agent types")}`);
    const max = Math.max(...types.map((x) => Number(x.count) || 0));
    const w = Math.max(...types.map((x) => String(x.subagent_type || x.type || "main").length));
    for (const x of types) {
      const name = String(x.subagent_type || x.type || "main");
      console.log(
        `  ${name.padEnd(w)}  ${bar(x.count, max, 16, c.magenta)} ${c.bold(String(x.count))}`
      );
    }
  }
  if (a.avg_events_per_session != null) {
    console.log(`\nAvg events/session: ${c.cyan(Number(a.avg_events_per_session).toFixed(1))}`);
  }
}

async function cmdWorkflows(flags) {
  if (flags.session) {
    const d = await get(`/api/workflows/session/${encodeURIComponent(flags.session)}`);
    heading("Workflow drill-in", `session ${flags.session}`);
    const agents = d.agents || d.tree || [];
    console.log(`agents: ${Array.isArray(agents) ? agents.length : "-"}`);
    return;
  }
  const w = await get("/api/workflows");
  const s = w.stats || {};
  heading("Workflow intelligence", baseUrl());
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
  console.log(`${c.bold("Total estimated cost:")} ${c.cyan(c.bold(fmtCost(cost.total_cost)))}`);
  const breakdown = (cost.breakdown || []).slice(0, 15);
  if (breakdown.length) {
    console.log();
    const max = Math.max(...breakdown.map((b) => Number(b.cost) || 0));
    const w = Math.max(...breakdown.map((b) => fmtModel(b.model).length));
    for (const b of breakdown) {
      console.log(
        `  ${fmtModel(b.model).padEnd(w)}  ${bar(b.cost, max, 20, c.green)} ${c.bold(fmtCost(b.cost))}`
      );
    }
  }
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
  await get("/api/health");
  heading("ccam doctor", baseUrl());
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

/**
 * Start the dashboard server in the background (production mode, serving the
 * built client) and wait until /api/health answers. No-ops with a pointer to
 * the live URL when a server is already up. The child is fully detached with
 * its output appended to data/ccam-server.log, so closing this terminal does
 * not stop the dashboard; stop it later with `kill <pid>` (the PID is
 * printed and registered in ~/.claude/.agent-dashboard.json).
 */
async function cmdStart(flags) {
  if (await serverIsUp()) {
    console.log(`${c.green("●")} Dashboard already running at ${c.bold(baseUrl())}`);
    return;
  }
  const clientDist = path.join(REPO_ROOT, "client", "dist", "index.html");
  if (!fs.existsSync(clientDist)) {
    console.error(c.red("✖ client/dist is missing — the production server needs a built client."));
    console.error(c.dim("  Build it once with: npm run build   (then re-run: ccam start)"));
    console.error(c.dim("  Or run the dev servers instead:     npm run dev"));
    process.exit(1);
  }
  const logDir = path.join(REPO_ROOT, "data");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "ccam-server.log");
  const out = fs.openSync(logFile, "a");
  const env = { ...process.env, NODE_ENV: "production" };
  if (flags.port) env.DASHBOARD_PORT = String(flags.port);
  const child = spawn(process.execPath, [path.join(REPO_ROOT, "server", "index.js")], {
    detached: true,
    stdio: ["ignore", out, out],
    env,
    cwd: REPO_ROOT,
  });
  child.unref();
  // On a TTY, animate a braille spinner in place; when piped, fall back to a
  // dot-per-poll trail so progress still shows without cursor control.
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const live = Boolean(process.stdout.isTTY);
  let tick = 0;
  const announce = `Starting dashboard server (pid ${child.pid}, log ${logFile})`;
  if (live) {
    process.stdout.write(`${c.cyan(spinner[0])} ${c.dim(announce)}`);
  } else {
    process.stdout.write(c.dim(`${announce} `));
  }
  const clearLine = () => {
    if (live) process.stdout.write("\r\x1b[K");
    else process.stdout.write("\n");
  };
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await serverIsUp()) {
      clearLine();
      console.log(
        `${c.green("●")} Dashboard ${c.bold("up")} at ${c.bold(baseUrl())} ${c.dim(`(pid ${child.pid})`)}`
      );
      console.log(c.dim(`  Stop it with: kill ${child.pid}`));
      return;
    }
    tick++;
    if (live) {
      process.stdout.write(`\r${c.cyan(spinner[tick % spinner.length])} ${c.dim(announce)}`);
    } else {
      process.stdout.write(c.dim("."));
    }
    await new Promise((r) => setTimeout(r, live ? 250 : 500));
  }
  clearLine();
  console.error(`${c.red("✖ Server did not become healthy within 30 s")} — check ${logFile}`);
  process.exit(1);
}

/** Up/down indicator without exiting non-zero noise — the at-a-glance check. */
async function cmdStatus() {
  if (await serverIsUp()) {
    const h = await get("/api/health");
    console.log(
      `${c.green("●")} Dashboard server is ${c.bold("running")} at ${baseUrl()} (${h.timestamp})`
    );
  } else {
    console.log(
      `${c.red("○")} Dashboard server is ${c.bold("NOT running")} ${c.dim(`(tried ${baseUrl()})`)}`
    );
    console.log(c.dim("  Start it with: ccam start   (or npm run dev / npm start)"));
    process.exit(1);
  }
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
  const cmd = (name, args, desc) => {
    const left = `${c.cyan(name)}${args ? ` ${c.dim(args)}` : ""}`;
    const pad = " ".repeat(Math.max(2, 28 - stripAnsi(left).length));
    return `  ${left}${pad}${desc}`;
  };
  const section = (title) => `\n${c.cyan("▍")}${c.bold(title)}`;
  console.log(`${c.cyan("▍")}${c.bold("ccam")} — Claude Code Agent Monitor CLI

${c.bold("Usage:")} ccam <command> [options]
${section("Server")}
${cmd("status", "", "Up/down indicator for the dashboard server")}
${cmd("start", "[--port N]", "Start the server in the background and wait for healthy")}
${section("Monitoring")}
${cmd("health", "", "Check the dashboard is up")}
${cmd("stats", "", "Totals, today's events, status distribution chart")}
${cmd("kanban", "", "Sessions + agents grouped by status columns")}
${cmd("tail", "[--session id]", "Live event feed in the terminal (Ctrl+C stops)")}
${section("Data")}
${cmd("sessions", "[opts]", "List sessions   (--status, --q, --limit)")}
${cmd("session <id>", "", "Session detail: agents tree, cost, recent events")}
${cmd("agents", "[opts]", "List agents     (--status, --session, --limit)")}
${cmd("events", "[opts]", "List events     (--session, --limit)")}
${section("Insights")}
${cmd("analytics", "", "Token totals, top-tool and agent-type charts")}
${cmd("workflows", "[--session id]", "Workflow intelligence stats and patterns")}
${cmd("runs", "[--session id]", "Dynamic Workflow-tool runs")}
${cmd("cost", "", "Total estimated cost (per-model chart)")}
${section("Alerts & Webhooks")}
${cmd("alerts", "[--unacked]", "Fired-alert feed")}
${cmd("alerts ack <id>", "", "Acknowledge one alert")}
${cmd("alerts ack-all", "", "Acknowledge every unacked alert")}
${cmd("rules", "", "List alert rules")}
${cmd("webhooks", "", "List webhook targets")}
${cmd("webhooks test <id>", "", "Send a synthetic test alert to a target")}
${section("Pricing")}
${cmd("pricing", "", "List model pricing rules")}
${cmd("pricing set <pattern>", "", "--input N --output N [--cache-read N --cache-write N]")}
${cmd("pricing delete <pattern>", "", "Delete a pricing rule")}
${cmd("pricing reset", "", "Reset pricing rules to defaults")}
${section("Import")}
${cmd("import rescan", "", "Re-scan ~/.claude/projects")}
${cmd("import path <dir>", "", "Import every .jsonl under a directory")}
${section("Administration")}
${cmd("doctor", "", "Connectivity, hooks, and database diagnosis")}
${cmd("info", "", "Raw system info JSON")}
${cmd("export", "[file.json]", "Export all data as JSON")}
${cmd("cleanup", "--hours N --days M", "Abandon stale / purge old sessions")}
${cmd("reinstall-hooks", "", "Reinstall Claude Code hooks")}
${cmd("clear-data", "--yes", "Delete ALL data (requires --yes)")}
${cmd("open", "", "Open the dashboard in your browser")}
${cmd("version", "", "Print the ccam version (also: --version, -v)")}

${c.bold("Server discovery:")} CLAUDE_DASHBOARD_PORT / DASHBOARD_PORT env vars win,
otherwise the live server is found via ~/.claude/.agent-dashboard.json,
falling back to http://127.0.0.1:4820.

${c.bold("Output:")} colors auto-enable on a TTY and turn off when piped.
Disable with --no-color or NO_COLOR=1; force with FORCE_COLOR=1 / CCAM_COLOR=1.

${c.bold("Note:")} ccam talks to the local dashboard server — API-backed commands
require it to be running (${c.bold("ccam start")} brings one up in the background).`);
}

/** Print the CLI/package version (single source of truth: package.json). */
function cmdVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    console.log(`ccam ${pkg.version}`);
  } catch {
    console.log("ccam (version unknown)");
  }
}

// ── Offline command handlers & dispatch ────────────────────────────────────
// Each handler mirrors its online command's output using offlineData
// providers. Commands absent from this map cannot run correctly without the
// server (live capture, server-side aggregation/cost math, or mutations that
// must go through the server's transaction + broadcast path) — the
// dispatcher tells the user so, with the reason.

const OFFLINE_HANDLERS = {
  async stats() {
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
  },
  async sessions(flags) {
    const data = offlineData.sessions(requireDb(), flags);
    const fix = livenessCorrect(data.sessions);
    renderSessions(data);
    livenessNote(fix);
  },
  async agents(flags) {
    const db = requireDb();
    const data = offlineData.agents(db, flags);
    const sessions = db.all("SELECT id, status, cwd FROM sessions WHERE status = 'active'");
    const fix = livenessCorrect(sessions);
    if (fix.deadIds.size) livenessCorrectAgents(data.agents, fix.deadIds);
    renderAgents(data);
    livenessNote(fix);
  },
  async events(flags) {
    renderEvents(offlineData.events(requireDb(), flags));
  },
  async kanban() {
    const db = requireDb();
    const sess = offlineData.sessions(db, { limit: "200" });
    const ag = offlineData.agents(db, { limit: "400" });
    const fix = livenessCorrect(sess.sessions);
    if (fix.deadIds.size) livenessCorrectAgents(ag.agents, fix.deadIds);
    renderKanban(sess, ag);
    livenessNote(fix);
  },
  async session(flags, positional) {
    const id = positional[0];
    if (!id) {
      console.error(c.red("✖ Usage: ccam session <session-id>"));
      process.exit(1);
    }
    const db = requireDb();
    const rows = db.all("SELECT * FROM sessions WHERE id = ?", id);
    if (!rows.length) {
      console.error(c.red(`✖ Session not found: ${id}`));
      process.exit(1);
    }
    const s = rows[0];
    const fix = livenessCorrect([s]);
    renderSessionMeta(s);
    kvLine("Cost", c.dim("requires the server (pricing math runs server-side)"));
    const agents = db.all("SELECT * FROM agents WHERE session_id = ? ORDER BY started_at ASC", id);
    if (fix.deadIds.size) livenessCorrectAgents(agents, fix.deadIds);
    if (agents.length) renderAgentTree(agents);
    const events = db.all(
      "SELECT * FROM events WHERE session_id = ? ORDER BY created_at DESC LIMIT 10",
      id
    );
    if (events.length) renderEventLines(events);
    livenessNote(fix);
  },
  async pricing(flags, positional) {
    if (positional[0]) {
      serverDownExit(
        "pricing changes must go through the server (cache invalidation + broadcasts)"
      );
    }
    const db = requireDb();
    const rows = db
      .all("SELECT * FROM model_pricing ORDER BY LENGTH(model_pattern) DESC")
      .map((p) => [
        p.model_pattern,
        (p.display_name || "").slice(0, 24),
        `$${p.input_per_mtok}`,
        `$${p.output_per_mtok}`,
        `$${p.cache_read_per_mtok}`,
        `$${p.cache_write_per_mtok}`,
      ]);
    table(["Pattern", "Name", "In/M", "Out/M", "CacheR/M", "CacheW/M"], rows);
  },
  async alerts(flags, positional) {
    if (positional[0]) {
      serverDownExit("acknowledging alerts is a server-side mutation");
    }
    const db = requireDb();
    const conds = flags.unacked ? "WHERE acknowledged_at IS NULL" : "";
    const rows = db
      .all(
        `SELECT * FROM alert_events ${conds} ORDER BY triggered_at DESC LIMIT ?`,
        Number(flags.limit || 20)
      )
      .map((a) => [
        a.id,
        a.acknowledged_at ? c.dim("acked") : c.yellow("open"),
        fmtTime(a.triggered_at),
        (a.rule_name || "").slice(0, 24),
        (a.message || "").slice(0, 52),
      ]);
    const unacked = db.all(
      "SELECT COUNT(*) AS n FROM alert_events WHERE acknowledged_at IS NULL"
    )[0].n;
    const total = db.all("SELECT COUNT(*) AS n FROM alert_events")[0].n;
    table(["ID", "State", "Triggered", "Rule", "Message"], rows);
    console.log(c.dim(`\n${unacked} unacknowledged of ${total}`));
  },
  async rules() {
    const db = requireDb();
    const rows = db
      .all("SELECT * FROM alert_rules ORDER BY id")
      .map((r) => [
        r.id,
        r.enabled ? c.green("on") : c.dim("off"),
        r.rule_type,
        (r.name || "").slice(0, 32),
        `${r.cooldown_minutes ?? "-"}m`,
      ]);
    table(["ID", "Enabled", "Type", "Name", "Cooldown"], rows);
  },
  async export(flags, positional) {
    const db = requireDb();
    const file = positional[0] || `ccam-export-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = {
      exported_at: new Date().toISOString(),
      exported_offline: true,
      sessions: db.all("SELECT * FROM sessions ORDER BY started_at DESC"),
      agents: db.all("SELECT * FROM agents ORDER BY started_at DESC"),
      events: db.all("SELECT * FROM events ORDER BY created_at DESC"),
      token_usage: db.all("SELECT * FROM token_usage"),
      model_pricing: db.all("SELECT * FROM model_pricing ORDER BY LENGTH(model_pattern) DESC"),
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    console.log(
      `${c.green("✔")} Exported to ${c.bold(file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`
    );
  },
  async doctor() {
    heading("ccam doctor", "offline");
    console.log(
      `${c.red("○")}  Dashboard server  NOT running ${c.dim(`(tried ${baseUrl()})`)} — start with: ${c.bold("ccam start")}`
    );
    const file = dbPath();
    if (fs.existsSync(file)) {
      const db = requireDb();
      console.log(
        `${c.green("✔")}  Database  ${file} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`
      );
      for (const t of ["sessions", "agents", "events", "model_pricing", "token_usage"]) {
        try {
          console.log(
            `${c.dim("·")}    rows: ${t}  ${db.all(`SELECT COUNT(*) AS n FROM ${t}`)[0].n}`
          );
        } catch {
          /* table may not exist on very old DBs */
        }
      }
    } else {
      console.log(`${c.red("✖")}  Database  not found at ${file}`);
    }
    try {
      const settingsPath = path.join(
        process.env.CLAUDE_HOME || path.join(require("node:os").homedir(), ".claude"),
        "settings.json"
      );
      const installed =
        fs.existsSync(settingsPath) &&
        fs.readFileSync(settingsPath, "utf8").includes("hook-handler.js");
      console.log(
        `${installed ? c.green("✔") : c.red("✖")}  Claude Code hooks  ${installed ? `installed (${settingsPath})` : "NOT installed — run: npm run install-hooks"}`
      );
    } catch {
      console.log(`${c.dim("·")}  Claude Code hooks  could not be checked`);
    }
  },
};

/** Reasons shown when a server-only command is attempted offline. */
const SERVER_ONLY_REASONS = {
  tail: "live capture needs the running server (hooks only post to a live server)",
  analytics: "analytics aggregation runs server-side",
  workflows: "workflow intelligence is computed server-side",
  runs: "workflow-run reconstruction runs server-side",
  cost: "cost math (pricing rules, compaction baselines) runs server-side",
  webhooks: "webhook configuration and test deliveries are server-side",
  import: "imports must go through the server's ingestion pipeline",
  cleanup: "cleanup is a server-side mutation",
  "clear-data": "data wipes must go through the server",
  "reinstall-hooks": "hook installation is performed by the server",
  info: "system info (uptime, memory, WS connections) only exists on a running server",
  health: "health is, by definition, a check against the running server",
};

/** Open the DB read-only or exit with guidance. */
function requireDb() {
  const db = openDbReadonly();
  if (!db) {
    console.error(c.red(`✖ No readable database at ${dbPath()}`));
    console.error(c.dim("  Nothing has been captured yet, or no SQLite driver is available."));
    console.error(c.dim("  Start the server to begin capturing: ccam start"));
    process.exit(1);
  }
  return db;
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  // --no-color is a global presentation flag (already consumed by the color
  // detector at module load) — strip it so it can appear anywhere without
  // being mistaken for a command or a subcommand flag.
  const argv = process.argv.slice(2).filter((a) => a !== "--no-color");
  const [cmd, ...rest] = argv;
  const { flags, positional } = parseArgs(rest);
  switch (cmd) {
    case "health":
      return cmdHealth();
    case "status":
      return cmdStatus();
    case "start":
      return cmdStart(flags);
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
    case "version":
    case "--version":
    case "-v":
      return cmdVersion();
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

main().catch(async (err) => {
  if (err instanceof ServerDownError) {
    const argv = process.argv.slice(2).filter((a) => a !== "--no-color");
    const cmd = argv[0];
    const { flags, positional } = parseArgs(argv.slice(1));
    const handler = OFFLINE_HANDLERS[cmd];
    if (handler) {
      offlineBanner();
      try {
        await handler(flags, positional);
        return;
      } catch (offErr) {
        console.error(c.red(`✖ Offline read failed: ${offErr?.message || offErr}`));
        process.exit(1);
      }
    }
    serverDownExit(SERVER_ONLY_REASONS[cmd]);
  }
  console.error(c.red(`✖ ${err?.message || err}`));
  process.exit(1);
});
