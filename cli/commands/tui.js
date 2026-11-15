/**
 * @file `ccam tui` — a full-screen, keyboard-driven terminal dashboard for
 * headless and SSH environments. It is purely a new consumer of the existing
 * API: an initial REST snapshot (sessions, agents, events, stats, cost) is kept
 * live off the same `/ws` broadcast the web client uses, and falls back to REST
 * polling with a reconnecting indicator when the socket drops. Nothing here
 * changes the server, the schema, or any WebSocket message type.
 *
 * Rendering is a pure `buildFrame(state, size)` function (exported for tests, so
 * layout and filtering are verified without a real TTY); the terminal lifecycle
 * (alternate screen, raw-mode input, resize, guaranteed restore) is kept around
 * it. No new dependency: raw ANSI + `node:readline` (as `ccam repl` already
 * does) for the screen and keys, and the project's existing `ws` package for
 * the live feed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { c, stripAnsi, colorStatus, trunc, fmtAgo, fmtCost, fmtTokens } = require("../lib/ui");
const { CliError } = require("../lib/runtime");
const { baseUrl, apiToken, get, qs } = require("../lib/http");
const { run } = require("../lib/framework");
const { scopeOptions, scopeParams } = require("./monitor");

const GROUP = "Insights:";

// ── pure helpers ─────────────────────────────────────────────────────────────

/** Visible (ANSI-stripped) length of a string. */
function visibleLen(s) {
  return stripAnsi(String(s)).length;
}

/** Pad `s` with spaces to `width` visible columns (truncating if longer). */
function padTo(s, width) {
  const vis = visibleLen(s);
  if (vis === width) return s;
  if (vis < width) return s + " ".repeat(width - vis);
  // Too long: trim by visible characters, preserving the no-color common case.
  return stripAnsi(s) === s ? s.slice(0, width) : trunc(s, width);
}

/** Case-insensitive substring match used by the `/` filter on every pane. */
function matchesFilter(text, filter) {
  if (!filter) return true;
  return String(text || "")
    .toLowerCase()
    .includes(filter.toLowerCase());
}

/** The sessions left after the active filter, newest activity first. */
function filterSessions(sessions, filter) {
  return (sessions || []).filter((s) => matchesFilter(`${s.name || ""} ${s.cwd || ""}`, filter));
}

/** The events left after the active filter. */
function filterEvents(events, filter) {
  return (events || []).filter((e) =>
    matchesFilter(`${e.event_type || ""} ${e.tool_name || ""} ${e.summary || ""}`, filter)
  );
}

/** Clamp `index` into `[0, length)`, returning 0 for an empty list. */
function clampIndex(index, length) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

const PANES = ["sessions", "events"];

/** A short one-line label for a session row. */
function sessionRow(s, width, selected) {
  const status = colorStatus(s.status);
  const name = s.name || s.cwd || s.id || "";
  const waiting = s.awaiting_input_since ? c.yellow(" ⏸") : "";
  const label = ` ${status} ${trunc(name, Math.max(4, width - 6))}${waiting}`;
  const line = padTo(label, width);
  return selected ? c.inverse(line) : line;
}

/** A short one-line label for an event row. */
function eventRow(e, width) {
  const time = c.dim((e.created_at ? fmtClock(e.created_at) : "").padEnd(8));
  const type = c.magenta(String(e.event_type || "").padEnd(12));
  const tool = e.tool_name ? c.cyan(`${e.tool_name} `) : "";
  const body = trunc(`${tool}${e.summary || ""}`, Math.max(4, width - 22));
  return padTo(` ${time} ${type} ${body}`, width);
}

/** HH:MM:SS from an ISO timestamp, local time. */
function fmtClock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toTimeString().slice(0, 8);
}

// ── frame builder (pure) ─────────────────────────────────────────────────────

/**
 * Render the whole screen as one string from immutable state. Kept pure so the
 * layout can be unit-tested at any size without a terminal.
 * @param {object} state
 * @param {{cols:number, rows:number}} size
 * @returns {string}
 */
function buildFrame(state, size) {
  const cols = Math.max(40, size.cols || 80);
  const rows = Math.max(12, size.rows || 24);
  const leftW = Math.max(24, Math.floor(cols * 0.4));
  const rightW = cols - leftW - 1; // one column for the divider
  const bodyRows = rows - 2; // title row + footer row
  const out = [];

  // Title bar.
  const title = ` ccam tui · ${state.url}`;
  const conn =
    state.connection === "live"
      ? c.green("● live")
      : state.connection === "reconnecting"
        ? c.yellow("○ reconnecting…")
        : c.gray("○ offline");
  const titleLine = padTo(title, cols - visibleLen(conn) - 1) + conn + " ";
  out.push(c.bold(padTo(titleLine, cols)));

  const sessions = filterSessions(state.sessions, state.filter);
  const events = filterEvents(state.events, state.filter);
  const sel = clampIndex(state.selection.sessions, sessions.length);
  const current = sessions[sel] || null;

  // Left column: a sessions list that leaves room for a stats box at its foot.
  const statsBoxH = 4;
  const sessionsH = bodyRows - statsBoxH;
  const left = [];
  left.push(paneHeader("Sessions", sessions.length, leftW, state.focus === "sessions"));
  const sessWindow = windowAround(sessions.length, sel, sessionsH - 1);
  for (let i = sessWindow.start; i < sessWindow.end; i++) {
    left.push(sessionRow(sessions[i], leftW, i === sel && state.focus === "sessions"));
  }
  while (left.length < sessionsH) left.push(padTo("", leftW));
  for (const line of statsBox(state, leftW, statsBoxH)) left.push(line);

  // Right column: session detail on top, live events below.
  const detailH = Math.max(6, Math.floor(bodyRows * 0.45));
  const eventsH = bodyRows - detailH;
  const right = [];
  right.push(
    paneHeader(
      `Detail${current ? `: ${trunc(current.name || current.id, rightW - 12)}` : ""}`,
      null,
      rightW,
      false
    )
  );
  for (const line of detailLines(current, state, rightW, detailH - 1)) right.push(line);
  while (right.length < detailH) right.push(padTo("", rightW));
  right.push(paneHeader("Events", events.length, rightW, state.focus === "events"));
  const evSel = clampIndex(state.selection.events, events.length);
  const evWindow = windowAround(events.length, evSel, eventsH - 1);
  for (let i = evWindow.start; i < evWindow.end; i++) {
    const row = eventRow(events[i], rightW);
    right.push(
      i === evSel && state.focus === "events" ? c.inverse(stripAnsi(row).padEnd(rightW)) : row
    );
  }
  while (right.length < bodyRows) right.push(padTo("", rightW));

  // Stitch the two columns with a vertical divider.
  for (let i = 0; i < bodyRows; i++) {
    out.push(`${left[i] ?? padTo("", leftW)}${c.gray("│")}${right[i] ?? padTo("", rightW)}`);
  }

  // Footer: the filter prompt when active, otherwise the key legend.
  out.push(footer(state, cols));
  return out.join("\n");
}

/** A window of indices [start,end) of size `height` centered on `sel`. */
function windowAround(length, sel, height) {
  if (height <= 0 || length === 0) return { start: 0, end: 0 };
  let start = Math.max(0, sel - Math.floor(height / 2));
  start = Math.min(start, Math.max(0, length - height));
  return { start, end: Math.min(length, start + height) };
}

function paneHeader(label, count, width, focused) {
  const text = count == null ? ` ${label}` : ` ${label} (${count})`;
  const line = padTo(text, width);
  return focused ? c.bold(c.cyan(line)) : c.bold(line);
}

function statsBox(state, width, height) {
  const s = state.stats || {};
  const lines = [];
  lines.push(padTo(c.gray("─".repeat(width)), width));
  const today = state.cost && state.cost.today != null ? fmtCost(state.cost.today) : "—";
  lines.push(
    padTo(
      ` ${c.dim("Today")} ${c.cyan(today)} · ${c.dim("events")} ${c.cyan(s.events_today ?? 0)}`,
      width
    )
  );
  lines.push(
    padTo(
      ` ${c.dim("Active")} ${c.green(s.active_sessions ?? 0)} · ${c.dim("Waiting")} ${c.yellow(state.waitingCount ?? 0)} · ${c.dim("Agents")} ${c.green(s.active_agents ?? 0)}`,
      width
    )
  );
  while (lines.length < height) lines.push(padTo("", width));
  return lines.slice(0, height);
}

function detailLines(session, state, width, height) {
  const lines = [];
  const kv = (k, v) => padTo(`  ${c.dim(k.padEnd(9))} ${v}`, width);
  if (!session) {
    lines.push(padTo(c.dim("  No session selected."), width));
  } else {
    const agents = (state.agents || []).filter((a) => a.session_id === session.id);
    const working = agents.filter((a) => a.status === "working").length;
    const waiting = agents.filter((a) => a.status === "waiting").length;
    lines.push(kv("Status", colorStatus(session.status)));
    if (session.model) lines.push(kv("Model", c.cyan(session.model)));
    lines.push(
      kv("Started", fmtAgo(session.started_at || session.created_at || session.updated_at))
    );
    if (session.cwd) lines.push(kv("Project", trunc(session.cwd, width - 14)));
    if (session.total_tokens != null) lines.push(kv("Tokens", fmtTokens(session.total_tokens)));
    if (session.cost != null) lines.push(kv("Cost", c.cyan(fmtCost(session.cost))));
    lines.push(kv("Agents", `${c.green(working)} working, ${c.yellow(waiting)} waiting`));
  }
  while (lines.length < height) lines.push(padTo("", width));
  return lines.slice(0, height);
}

function footer(state, width) {
  if (state.mode === "filter") {
    return padTo(c.yellow(` /${state.filterDraft}`) + c.dim("  (Enter apply · Esc cancel)"), width);
  }
  const keys = [
    key("Tab", "pane"),
    key("j/k", "move"),
    key("Enter", "detail"),
    key("s", "essions"),
    key("e", "vents"),
    key("/", "filter"),
    key("q", "uit"),
  ].join(c.dim("  "));
  const active = state.filter ? c.yellow(`filter: ${trunc(state.filter, 20)} `) : "";
  return padTo(` ${active}${keys}`, width);
}

function key(k, label) {
  return `${c.cyan(`[${k}]`)}${c.dim(label)}`;
}

// ── data layer ───────────────────────────────────────────────────────────────

/** Load the full initial snapshot over REST. Optional pieces fail soft. */
async function loadSnapshot(opts) {
  const scope = scopeParams(opts);
  const soft = (p) => p.catch(() => null);
  const [sessions, agents, stats, events, cost] = await Promise.all([
    get(`/api/sessions${qs({ limit: 200, ...scope })}`),
    get(`/api/agents${qs({ limit: 400, ...scope })}`),
    get(`/api/stats${qs({ tz_offset: new Date().getTimezoneOffset(), ...scope })}`),
    get(`/api/events${qs({ limit: 100, ...scope })}`),
    soft(get(`/api/pricing/cost${qs({ tz_offset: new Date().getTimezoneOffset(), ...scope })}`)),
  ]);
  return {
    sessions: sessions.sessions || [],
    agents: agents.agents || [],
    stats: stats || {},
    events: events.events || [],
    cost: cost ? { total: cost.total_cost ?? 0, today: todayCost(cost) } : null,
  };
}

function todayCost(cost) {
  const today = new Date().toLocaleDateString("en-CA");
  return (cost?.daily_costs || []).find((d) => d.date === today)?.cost ?? null;
}

/** Fold one `/ws` broadcast into the state in place (returns true if changed). */
function applyMessage(state, msg) {
  const d = (msg && msg.data) || {};
  if (!msg || !msg.type) return false;
  if (msg.type === "new_event") {
    state.events.unshift({
      id: d.id,
      event_type: d.event_type,
      tool_name: d.tool_name,
      summary: d.summary,
      session_id: d.session_id,
      created_at: d.created_at || new Date().toISOString(),
    });
    if (state.events.length > 500) state.events.length = 500;
    if (state.stats) state.stats.events_today = (state.stats.events_today ?? 0) + 1;
    return true;
  }
  if (/^session_/.test(msg.type) && d.id) {
    upsertById(state.sessions, d);
    recomputeDerived(state);
    return true;
  }
  if (/^agent_/.test(msg.type) && d.id) {
    upsertById(state.agents, d);
    recomputeDerived(state);
    return true;
  }
  return false;
}

/** Merge `row` into `list` by `id` (prepend when new), newest first. */
function upsertById(list, row) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) list.unshift(row);
  else list[i] = { ...list[i], ...row };
}

/** Keep the counts the footer shows in sync with the live lists. */
function recomputeDerived(state) {
  state.waitingCount = (state.sessions || []).filter((s) => s.status === "waiting").length;
  if (state.stats) {
    state.stats.active_sessions = (state.sessions || []).filter((s) =>
      ["active", "working"].includes(s.status)
    ).length;
    state.stats.active_agents = (state.agents || []).filter((a) => a.status === "working").length;
  }
}

// ── terminal lifecycle ───────────────────────────────────────────────────────

const ALT_ON = "\x1b[?1049h\x1b[?25l"; // enter alternate screen, hide cursor
const ALT_OFF = "\x1b[?25h\x1b[?1049l"; // show cursor, leave alternate screen
const HOME = "\x1b[H"; // cursor to top-left

function paint(frame) {
  // Home + clear-to-end avoids the flicker of a full clear each frame.
  process.stdout.write(`${HOME}${frame}\x1b[0J`);
}

// ── command ──────────────────────────────────────────────────────────────────

async function cmdTui({ opts }) {
  if (!process.stdout.isTTY || !process.stdin.isTTY || process.env.TERM === "dumb") {
    throw new CliError("ccam tui needs an interactive terminal (a TTY).", {
      code: "NOT_A_TTY",
      hints: ["Use ccam overview, ccam stats, or ccam tail for non-interactive views."],
    });
  }

  const readline = require("node:readline");
  let WebSocket = null;
  try {
    WebSocket = require("ws");
  } catch {
    // No ws: the dashboard is still usable over REST polling only.
    WebSocket = null;
  }

  // Fail fast / route offline messaging before taking over the screen.
  await get("/api/health");
  const snap = await loadSnapshot(opts);

  const state = {
    url: baseUrl(),
    ...snap,
    focus: "sessions",
    selection: { sessions: 0, events: 0 },
    filter: "",
    filterDraft: "",
    mode: "normal",
    connection: WebSocket ? "connecting" : "reconnecting",
    waitingCount: 0,
  };
  recomputeDerived(state);

  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  const size = () => ({ cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 });
  let renderTimer = null;
  const scheduleRender = () => {
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = null;
      if (dirty) {
        dirty = false;
        paint(buildFrame(state, size()));
      }
    }, 80);
  };

  // Terminal setup, with a single guaranteed teardown.
  process.stdout.write(ALT_ON);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let ws = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let closed = false;

  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(
      async () => {
        try {
          const fresh = await loadSnapshot(opts);
          Object.assign(state, fresh);
          recomputeDerived(state);
          markDirty();
          scheduleRender();
        } catch {
          /* keep the last good frame; the reconnect loop will recover */
        }
      },
      (opts.interval ?? 3) * 1000
    );
  };

  const connect = () => {
    if (!WebSocket || closed) {
      state.connection = "reconnecting";
      startPolling();
      return;
    }
    const wsUrl = new URL("/ws", baseUrl().replace(/^http/, "ws"));
    const token = apiToken();
    ws = new WebSocket(
      wsUrl.toString(),
      token ? { headers: { "x-dashboard-token": token } } : undefined
    );
    ws.on("open", () => {
      state.connection = "live";
      stopPolling();
      markDirty();
      scheduleRender();
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (applyMessage(state, msg)) {
        markDirty();
        scheduleRender();
      }
    });
    const drop = () => {
      if (closed) return;
      state.connection = "reconnecting";
      startPolling(); // REST keeps the screen fresh while the socket is down
      markDirty();
      scheduleRender();
      if (!reconnectTimer)
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 2000);
    };
    ws.on("close", drop);
    ws.on("error", () => {
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    });
  };

  return await new Promise((resolve) => {
    const cleanup = () => {
      if (closed) return;
      closed = true;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (renderTimer) clearTimeout(renderTimer);
      try {
        if (ws) ws.close();
      } catch {
        /* ignore */
      }
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* not a raw TTY anymore */
      }
      process.stdin.pause();
      process.stdout.write(ALT_OFF);
      process.stdin.removeListener("keypress", onKey);
      process.stdout.removeListener("resize", onResize);
      resolve();
    };

    const onResize = () => {
      markDirty();
      paint(buildFrame(state, size()));
    };

    const moveSelection = (delta) => {
      const key = state.focus;
      const list =
        key === "sessions"
          ? filterSessions(state.sessions, state.filter)
          : filterEvents(state.events, state.filter);
      state.selection[key] = clampIndex((state.selection[key] || 0) + delta, list.length);
      markDirty();
      scheduleRender();
    };

    const onKey = (str, keyInfo) => {
      const k = keyInfo || {};
      // Filter entry mode captures printable keys until Enter/Esc.
      if (state.mode === "filter") {
        if (k.name === "return") {
          state.filter = state.filterDraft;
          state.mode = "normal";
          state.selection[state.focus] = 0;
        } else if (k.name === "escape") {
          state.mode = "normal";
          state.filterDraft = state.filter;
        } else if (k.name === "backspace") {
          state.filterDraft = state.filterDraft.slice(0, -1);
        } else if (str && !k.ctrl && !k.meta && str >= " ") {
          state.filterDraft += str;
        }
        markDirty();
        scheduleRender();
        return;
      }

      if (k.ctrl && k.name === "c") return cleanup();
      switch (k.name) {
        case "q":
          return cleanup();
        case "tab":
          state.focus = PANES[(PANES.indexOf(state.focus) + 1) % PANES.length];
          break;
        case "s":
          state.focus = "sessions";
          break;
        case "e":
          state.focus = "events";
          break;
        case "a":
        case "w":
          // Analytics / workflows panes are not in this first cut; keep the keys
          // reserved (and documented) rather than silently doing nothing wrong.
          break;
        case "up":
        case "k":
          return moveSelection(-1);
        case "down":
        case "j":
          return moveSelection(1);
        case "pageup":
          return moveSelection(-10);
        case "pagedown":
          return moveSelection(10);
        case "return":
          state.focus = "sessions"; // Enter drills into the highlighted session
          break;
        default:
          if (str === "/") {
            state.mode = "filter";
            state.filterDraft = state.filter;
          } else {
            return; // unknown key: no redraw
          }
      }
      markDirty();
      scheduleRender();
    };

    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
    process.stdin.on("keypress", onKey);
    process.stdout.on("resize", onResize);

    paint(buildFrame(state, size()));
    connect();
  });
}

function register(program) {
  scopeOptions(
    program
      .command("tui")
      .helpGroup(GROUP)
      .description("Full-screen live terminal dashboard (sessions, events, agents, cost)")
      .option("--interval <secs>", "REST poll interval used when the WebSocket is down", Number, 3)
  ).action(
    run(cmdTui, {
      serverOnly: "the live dashboard streams from the running server",
    })
  );
}

module.exports = {
  register,
  buildFrame,
  applyMessage,
  matchesFilter,
  filterSessions,
  filterEvents,
  clampIndex,
  windowAround,
  recomputeDerived,
  upsertById,
};
