/**
 * @file ccam data-browsing commands over sessions, agents, events, and
 * transcripts. Resource groups list by default (`ccam sessions` ≡
 * `ccam sessions list`) and expose detail, stats, facets, transcript, and
 * write subcommands mirroring the REST API (and the MCP tool surface).
 * Legacy top-level forms — `session <id>`, `transcript <id>` (raw JSON), and
 * `transcript-image` — are kept verbatim for scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { Option } = require("commander");
const {
  c,
  table,
  heading,
  subheading,
  kvLine,
  kvCard,
  printJson,
  renderTree,
  colorStatus,
  paintEvent,
  barChart,
  fmtDuration,
  fmtTime,
  fmtAgo,
  fmtModel,
  fmtCost,
  fmtTokens,
  short,
  trunc,
} = require("../lib/ui");
const { isJson, isPretty, CliError } = require("../lib/runtime");
const { get, post, patch, rawFetch, readBody, qs, enc } = require("../lib/http");
const {
  requireDb,
  offlineData,
  livenessCorrect,
  livenessCorrectAgents,
  livenessNote,
} = require("../lib/offline");
const {
  run,
  listGroup,
  confirm,
  intArg,
  posIntArg,
  csvArg,
  readJsonInput,
} = require("../lib/framework");
const { scopeOptions, scopeParams } = require("./monitor");
const { renderCost } = require("./insights");

const GROUP = "Data:";
const SESSION_STATUSES = ["active", "waiting", "completed", "error", "abandoned"];
const AGENT_STATUSES = ["working", "waiting", "completed", "error"];

// ── Sessions ────────────────────────────────────────────────────────────────

function renderSessions(data) {
  if (isJson()) return printJson(data);
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

function sessionListOptions(cmd) {
  cmd
    .addOption(new Option("--status <status>", "filter by status").choices(SESSION_STATUSES))
    .option("--q <text>", "search id, name, and cwd")
    .option("--cwd <dir>", "only sessions in this working directory (repeatable)", csvArg)
    .option("--limit <n>", "rows to return", posIntArg, 20)
    .option("--offset <n>", "rows to skip (pagination)", intArg)
    .addOption(
      new Option("--sort <field>", "sort order").choices(["time", "duration", "price", "tokens"])
    )
    .option("--asc", "ascending instead of descending");
  return scopeOptions(cmd);
}

async function listSessions({ opts }) {
  renderSessions(
    await get(
      `/api/sessions${qs({
        status: opts.status,
        q: opts.q,
        cwd: opts.cwd,
        limit: opts.limit,
        offset: opts.offset,
        sort_by: opts.sort,
        sort_desc: opts.asc ? "false" : undefined,
        ...scopeParams(opts),
      })}`
    )
  );
}

function offlineSessions({ opts }) {
  const data = offlineData.sessions(requireDb(), { ...opts, cwd: opts.cwd?.[0] });
  const fix = livenessCorrect(data.sessions);
  renderSessions(data);
  livenessNote(fix);
}

/** Title + aligned metadata card for one session row. */
function renderSessionMeta(s) {
  console.log(`${c.cyan("▍")}${c.bold(s.name || s.id)} ${c.dim(`(${s.id})`)}`);
  kvLine("Status", colorStatus(s.status));
  kvLine("Model", fmtModel(s.model));
  kvLine("Duration", fmtDuration(s.started_at, s.ended_at));
  kvLine("Cwd", s.cwd || "-");
  if (s.provider && s.provider !== "claude") kvLine("Provider", s.provider);
  if (s.source && s.source !== "local") kvLine("Source", s.source);
  if (s.awaiting_input_since)
    kvLine("Waiting", c.yellow(`awaiting input since ${fmtTime(s.awaiting_input_since)}`));
}

/** Agent hierarchy as a real tree (├─/└─ with continuation rails). */
function renderAgentTree(agents) {
  console.log(`\n${c.cyan("▍")}${c.bold("Agents")} ${c.dim(`(${agents.length})`)}`);
  const ids = new Set(agents.map((a) => a.id));
  const byParent = {};
  for (const a of agents) {
    const parent = a.parent_agent_id && ids.has(a.parent_agent_id) ? a.parent_agent_id : "";
    (byParent[parent] ||= []).push(a);
  }
  const walk = (parentId, prefix) => {
    const kids = byParent[parentId] || [];
    kids.forEach((a, i) => {
      const last = i === kids.length - 1;
      const tool = a.current_tool ? c.cyan(` [${a.current_tool}]`) : "";
      const cost = a.cost ? c.dim(` ${fmtCost(a.cost)}`) : "";
      console.log(
        `  ${c.dim(prefix + (last ? "└─ " : "├─ "))}${colorStatus(a.status)} ` +
          `${a.type === "main" ? c.bold(a.name) : a.name}${tool} ${c.dim(fmtDuration(a.started_at, a.ended_at))}${cost}`
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

/** Session detail: metadata, cost, agent tree, workflows, recent events. */
async function showSession({ args, opts }) {
  const id = args[0];
  const d = await get(`/api/sessions/${enc(id)}`);
  const s = d.session || d;
  let cost = null;
  try {
    cost = await get(`/api/pricing/cost/${enc(id)}`);
  } catch {
    /* pricing may 404 for unknown ids */
  }
  const nEvents = opts.events ?? 10;
  if (isJson()) {
    return printJson({ ...d, events: (d.events || []).slice(0, nEvents), cost });
  }
  renderSessionMeta(s);
  if (cost) kvLine("Cost", c.cyan(c.bold(fmtCost(cost.total_cost))));
  if (s.prompt_preview) kvLine("Prompt", c.dim(trunc(s.prompt_preview, 90)));
  const agents = d.agents || [];
  if (agents.length) renderAgentTree(agents);
  const workflows = d.workflows || [];
  if (workflows.length) {
    subheading("Workflow runs", `(${workflows.length})`);
    for (const w of workflows) {
      console.log(
        `  ${colorStatus(w.status)}  ${c.dim(trunc(w.run_id || w.id, 14))}  ${trunc(w.name || "", 40)}  ${c.dim(fmtDuration(w.started_at, w.ended_at))}`
      );
    }
  }
  const events = (d.events || []).slice(0, nEvents);
  if (events.length) renderEventLines(events);
}

function offlineSession({ args, opts }) {
  const id = args[0];
  const db = requireDb();
  const rows = db.all("SELECT * FROM sessions WHERE id = ?", id);
  if (!rows.length) throw new CliError(`Session not found: ${id}`, { code: "NOT_FOUND" });
  const s = rows[0];
  const fix = livenessCorrect([s]);
  const agents = db.all("SELECT * FROM agents WHERE session_id = ? ORDER BY started_at ASC", id);
  if (fix.deadIds.size) livenessCorrectAgents(agents, fix.deadIds);
  const events = db.all(
    "SELECT * FROM events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
    id,
    opts.events ?? 10
  );
  if (isJson()) return printJson({ session: s, agents, events, cost: null });
  renderSessionMeta(s);
  kvLine("Cost", c.dim("requires the server (pricing math runs server-side)"));
  if (agents.length) renderAgentTree(agents);
  if (events.length) renderEventLines(events);
  livenessNote(fix);
}

async function sessionStats({ args }) {
  const d = await get(`/api/sessions/${enc(args[0])}/stats`);
  if (isJson()) return printJson(d);
  heading("Session stats", d.session_id);
  const t = d.tokens || {};
  kvCard([
    ["Events", c.bold(String(d.total_events ?? 0))],
    ["Errors", d.error_count ? c.red(String(d.error_count)) : c.dim("0")],
    ["First event", fmtTime(d.first_event_at)],
    ["Last event", fmtTime(d.last_event_at)],
    ["Span", fmtDuration(d.first_event_at, d.last_event_at)],
    [
      "Agents",
      `${d.agents?.total ?? 0} (main ${d.agents?.main ?? 0} · sub ${d.agents?.subagent ?? 0} · compactions ${d.agents?.compaction ?? 0})`,
    ],
    [
      "Tokens",
      `in ${fmtTokens(t.input_tokens)} · out ${fmtTokens(t.output_tokens)} · cache r ${fmtTokens(t.cache_read_tokens)} / w ${fmtTokens(t.cache_write_tokens)}`,
    ],
  ]);
  const tools = (d.tools_used || []).slice(0, 12);
  if (tools.length) {
    subheading("Tools");
    barChart(tools.map((x) => [String(x.tool_name), x.count]));
  }
  const types = d.events_by_type || [];
  if (types.length) {
    subheading("Event types");
    barChart(
      types.map((x) => [paintEvent(String(x.event_type)), x.count]),
      { paint: c.blue }
    );
  }
  const subs = d.subagent_types || [];
  if (subs.length) {
    subheading("Subagent types");
    barChart(
      subs.map((x) => [String(x.subagent_type || "?"), x.count]),
      { paint: c.magenta }
    );
  }
}

async function sessionFacets({ opts }) {
  const d = await get(`/api/sessions/facets${qs(scopeParams(opts))}`);
  if (isJson()) return printJson(d);
  heading("Session facets");
  kvLine("Sources", (d.sources || []).join(", ") || "-");
  kvLine("Providers", (d.providers || []).join(", ") || "-");
  subheading("Working directories", `(${(d.cwds || []).length})`);
  for (const cwd of d.cwds || []) console.log(`  ${c.dim("•")} ${cwd}`);
}

async function sessionRename({ args, opts }) {
  const [id, words] = args;
  const name = words.join(" ").trim();
  if (!name) throw new CliError("rename requires a non-empty name", { code: "USAGE" });
  await confirm(opts, {
    prompt: `Rename session ${id} to "${name}"?`,
    refusal: "Session writes require --yes.",
  });
  const r = await patch(`/api/sessions/${enc(id)}`, { name });
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Renamed ${c.dim(short(id))} → ${c.bold(r.session?.name || name)}`);
}

async function sessionUpdate({ args, opts }) {
  const body = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.status !== undefined) body.status = opts.status;
  if (opts.endedAt !== undefined) body.ended_at = opts.endedAt;
  const metadata = readJsonInput(opts, "metadata");
  if (metadata !== undefined) body.metadata = metadata;
  if (!Object.keys(body).length) {
    throw new CliError("Nothing to update — pass --name, --status, --ended-at, or --metadata.", {
      code: "USAGE",
    });
  }
  await confirm(opts, {
    prompt: `Update session ${args[0]}?`,
    refusal: "Session writes require --yes.",
  });
  const r = await patch(`/api/sessions/${enc(args[0])}`, body);
  if (isJson()) return printJson(r);
  console.log(
    `${c.green("✔")} Updated session ${c.bold(r.session?.id || args[0])} ${colorStatus(r.session?.status)}`
  );
}

async function sessionCreate({ opts }) {
  const body = { id: opts.id, name: opts.name, cwd: opts.cwd, model: opts.model };
  const metadata = readJsonInput(opts, "metadata");
  if (metadata !== undefined) body.metadata = metadata;
  await confirm(opts, {
    prompt: `Create session ${opts.id}?`,
    refusal: "Session writes require --yes.",
  });
  const r = await post("/api/sessions", body);
  if (isJson()) return printJson(r);
  console.log(
    r.created
      ? `${c.green("✔")} Created session ${c.bold(r.session.id)}`
      : `${c.dim("·")} Session ${c.bold(r.session.id)} already exists — unchanged`
  );
}

async function sessionTranscripts({ args }) {
  const d = await get(`/api/sessions/${enc(args[0])}/transcripts`);
  if (isJson()) return printJson(d);
  const list = d.transcripts || [];
  heading("Transcripts", args[0]);
  if (!Array.isArray(list)) return renderTree(list);
  table(
    ["Agent", "Kind", "Name", "Path"],
    list.map((t) => [
      short(t.agent_id || t.id || "main"),
      t.kind || t.type || (t.agent_id ? "subagent" : "main"),
      trunc(t.name || t.label || "", 30),
      t.path || t.transcript_path || "-",
    ])
  );
}

// ── Transcript ──────────────────────────────────────────────────────────────

function transcriptQuery(opts) {
  return qs({
    agent_id: opts.agent,
    run_id: opts.run,
    limit: opts.limit,
    offset: opts.offset,
    after: opts.after,
    before: opts.before,
    ...scopeParams(opts),
  });
}

/** Flatten a tool-result payload (string, content blocks, or object) to text. */
function blockText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((b) => (typeof b === "string" ? b : b.text || blockText(b.content) || ""))
      .join("\n");
  if (typeof v === "object") return v.text || JSON.stringify(v);
  return String(v);
}

/** Readable chat-log rendering of the transcript DTO. */
function renderTranscript(d, { full = false } = {}) {
  const clip = (s, n) => {
    const text = String(s || "").trimEnd();
    if (full) return text;
    const lines = text.split("\n");
    const head = lines.slice(0, n).join("\n");
    return lines.length > n
      ? `${head}\n${c.dim(`… ${lines.length - n} more line(s) — use --full`)}`
      : head;
  };
  const indent = (s, pre) =>
    s
      .split("\n")
      .map((l) => pre + l)
      .join("\n");
  for (const m of d.messages || []) {
    const who = m.sender || m.type;
    const paint = who === "user" ? c.yellow : who === "assistant" ? c.cyan : c.dim;
    const blocks = Array.isArray(m.content)
      ? m.content
      : [{ type: "text", text: blockText(m.content) }];
    console.log(`\n${paint("▍")}${paint(c.bold(who))} ${c.dim(fmtTime(m.timestamp))}`);
    for (const b of blocks) {
      if (b.type === "text") console.log(indent(clip(b.text, 40), "  "));
      else if (b.type === "thinking")
        console.log(indent(c.dim(c.italic(clip(b.thinking || b.text, 6))), "  "));
      else if (b.type === "tool_use") {
        const input = typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? {});
        console.log(
          `  ${c.magenta("⚙")} ${c.bold(b.name || "tool")} ${c.dim(trunc(input, full ? 4000 : 160))}`
        );
      } else if (b.type === "tool_result") {
        const text = blockText(b.output ?? b.content);
        const mark = b.is_error ? c.red("↳ error") : c.dim("↳");
        const [firstLine, ...rest] = clip(text, 8).split("\n");
        console.log(`  ${mark} ${firstLine}`);
        if (rest.length) console.log(indent(rest.join("\n"), "    "));
      } else if (b.type === "image") console.log(`  ${c.dim("[image]")}`);
      else console.log(`  ${c.dim(`[${b.type}]`)}`);
    }
  }
  console.log(
    c.dim(
      `\n${(d.messages || []).length} of ${d.total ?? "?"} message(s)${d.has_more ? " — more available (--offset / --after)" : ""}`
    )
  );
}

function transcriptOptions(cmd) {
  cmd
    .option("--agent <id>", "a subagent's transcript instead of the main one")
    .option("--run <id>", "a Workflow-tool run's transcript")
    .option("--limit <n>", "messages to return", posIntArg)
    .option("--offset <n>", "messages to skip", intArg)
    .option("--after <line>", "only messages after this transcript line")
    .option("--before <line>", "only messages before this transcript line")
    .option("--full", "do not clip long messages in the text view");
  return scopeOptions(cmd);
}

/** `ccam sessions transcript` — human chat log by default, JSON with --json. */
async function sessionTranscript({ args, opts }) {
  const d = await get(`/api/sessions/${enc(args[0])}/transcript${transcriptQuery(opts)}`);
  if (isJson()) return printJson(d);
  heading("Transcript", args[0]);
  renderTranscript(d, opts);
}

/** Legacy `ccam transcript` — raw JSON by default (scripts depend on it). */
async function legacyTranscript({ args, opts }) {
  const d = await get(`/api/sessions/${enc(args[0])}/transcript${transcriptQuery(opts)}`);
  if (isPretty() || opts.text) {
    heading("Transcript", args[0]);
    return renderTranscript(d, opts);
  }
  printJson(d);
}

async function transcriptImage({ args, opts }) {
  const sessionId = args[0];
  const query = qs({
    line: opts.line,
    index: opts.index,
    agent_id: opts.agent,
    run_id: opts.run,
    ...scopeParams(opts),
  });
  const response = await rawFetch(`/api/sessions/${enc(sessionId)}/transcript-image${query}`);
  if (!response.ok) {
    const body = await readBody(response).catch(() => ({}));
    throw new CliError(`Image download failed: ${body?.error?.message || response.status}`, {
      code: "IMAGE_DOWNLOAD_FAILED",
    });
  }
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const extension =
    { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp" }[
      contentType
    ] || ".bin";
  const output = path.resolve(
    process.cwd(),
    String(opts.output || `transcript-${sessionId}-${opts.line}-${opts.index}${extension}`)
  );
  const buf = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(output, buf);
  if (isJson()) return printJson({ path: output, bytes: buf.length, content_type: contentType });
  console.log(`${c.green("✔")} Saved transcript image to ${c.bold(output)}`);
}

// ── Agents ──────────────────────────────────────────────────────────────────

function renderAgents(data) {
  if (isJson()) return printJson(data);
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

function agentListOptions(cmd) {
  cmd
    .addOption(new Option("--status <status>", "filter by status").choices(AGENT_STATUSES))
    .option("--session <id>", "only agents of one session")
    .option("--limit <n>", "rows to return", posIntArg, 20)
    .option("--offset <n>", "rows to skip (pagination)", intArg);
  return scopeOptions(cmd);
}

async function listAgents({ opts }) {
  renderAgents(
    await get(
      `/api/agents${qs({
        status: opts.status,
        session_id: opts.session,
        limit: opts.limit,
        offset: opts.offset,
        ...scopeParams(opts),
      })}`
    )
  );
}

function offlineAgents({ opts }) {
  const db = requireDb();
  const data = offlineData.agents(db, opts);
  const sessions = db.all("SELECT id, status, cwd FROM sessions WHERE status = 'active'");
  const fix = livenessCorrect(sessions);
  if (fix.deadIds.size) livenessCorrectAgents(data.agents, fix.deadIds);
  renderAgents(data);
  livenessNote(fix);
}

async function showAgent({ args }) {
  const { agent: a } = await get(`/api/agents/${enc(args[0])}`);
  if (isJson()) return printJson({ agent: a });
  console.log(`${c.cyan("▍")}${c.bold(a.name || a.id)} ${c.dim(`(${a.id})`)}`);
  kvCard([
    ["Status", colorStatus(a.status)],
    ["Type", `${a.type}${a.subagent_type ? c.dim(` · ${a.subagent_type}`) : ""}`],
    ["Session", a.session_id],
    a.parent_agent_id ? ["Parent", a.parent_agent_id] : null,
    ["Tool", a.current_tool || "-"],
    ["Started", fmtTime(a.started_at)],
    ["Ended", fmtTime(a.ended_at)],
    ["Duration", fmtDuration(a.started_at, a.ended_at)],
    a.task ? ["Task", trunc(a.task, 100)] : null,
  ]);
}

async function agentUpdate({ args, opts }) {
  const body = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.status !== undefined) body.status = opts.status;
  if (opts.task !== undefined) body.task = opts.task;
  if (opts.currentTool !== undefined)
    body.current_tool = opts.currentTool === "" ? null : opts.currentTool;
  if (opts.endedAt !== undefined) body.ended_at = opts.endedAt;
  const metadata = readJsonInput(opts, "metadata");
  if (metadata !== undefined) body.metadata = metadata;
  if (!Object.keys(body).length) {
    throw new CliError(
      "Nothing to update — pass --name, --status, --task, --current-tool, --ended-at, or --metadata.",
      {
        code: "USAGE",
      }
    );
  }
  await confirm(opts, {
    prompt: `Update agent ${args[0]}?`,
    refusal: "Agent writes require --yes.",
  });
  const r = await patch(`/api/agents/${enc(args[0])}`, body);
  if (isJson()) return printJson(r);
  console.log(
    `${c.green("✔")} Updated agent ${c.bold(r.agent?.id || args[0])} ${colorStatus(r.agent?.status)}`
  );
}

async function agentCreate({ opts }) {
  const body = {
    id: opts.id,
    session_id: opts.session,
    name: opts.name,
    type: opts.type,
    subagent_type: opts.subagentType,
    status: opts.status,
    task: opts.task,
    parent_agent_id: opts.parent,
  };
  const metadata = readJsonInput(opts, "metadata");
  if (metadata !== undefined) body.metadata = metadata;
  await confirm(opts, {
    prompt: `Create agent ${opts.id}?`,
    refusal: "Agent writes require --yes.",
  });
  const r = await post("/api/agents", body);
  if (isJson()) return printJson(r);
  console.log(
    r.created
      ? `${c.green("✔")} Created agent ${c.bold(r.agent.id)}`
      : `${c.dim("·")} Agent ${c.bold(r.agent.id)} already exists — unchanged`
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

function renderEvents(data) {
  if (isJson()) return printJson(data);
  const rows = (data.events || []).map((e) => [
    fmtTime(e.created_at),
    e.event_type,
    e.tool_name || "-",
    (e.summary || "").slice(0, 60),
  ]);
  table(["Time", "Type", "Tool", "Summary"], rows);
  if (data.total != null) console.log(c.dim(`\n${rows.length} of ${data.total} event(s)`));
}

function eventListOptions(cmd) {
  cmd
    .option("--session <id>", "only events of one session")
    .option("--agent <id>", "only events of one agent")
    .option("--type <types>", "event types, comma-separated", csvArg)
    .option("--tool <tools>", "tool names, comma-separated", csvArg)
    .option("--q <text>", "search summary, tool name, and payload")
    .option("--from <iso>", "only events at/after this ISO timestamp")
    .option("--to <iso>", "only events at/before this ISO timestamp")
    .option("--limit <n>", "rows to return", posIntArg, 20)
    .option("--offset <n>", "rows to skip (pagination)", intArg);
  return scopeOptions(cmd);
}

async function listEvents({ opts }) {
  renderEvents(
    await get(
      `/api/events${qs({
        session_id: opts.session,
        agent_id: opts.agent,
        event_type: opts.type?.join(","),
        tool_name: opts.tool?.join(","),
        q: opts.q,
        from: opts.from,
        to: opts.to,
        limit: opts.limit,
        offset: opts.offset,
        ...scopeParams(opts),
      })}`
    )
  );
}

function offlineEvents({ opts }) {
  renderEvents(offlineData.events(requireDb(), opts));
}

async function eventFacets({ opts }) {
  const d = await get(`/api/events/facets${qs(scopeParams(opts))}`);
  if (isJson()) return printJson(d);
  heading("Event facets");
  kvLine("Types", (d.event_types || []).map(paintEvent).join(c.dim(", ")) || "-", 6);
  kvLine("Tools", (d.tool_names || []).join(", ") || "-", 6);
}

// ── Registration ────────────────────────────────────────────────────────────

const SESSION_SERVER_ONLY = "session writes go through the server (validation + broadcasts)";

function register(program) {
  const sessions = listGroup(program, "sessions", {
    group: GROUP,
    description: "Browse and manage sessions (default: list)",
    listDescription: "List sessions (--status, --q, --cwd, --sort, --limit, --offset)",
    configure: sessionListOptions,
    handler: listSessions,
    offline: offlineSessions,
  });
  sessions
    .command("get")
    .alias("show")
    .description("Session detail: agents tree, cost, workflow runs, recent events")
    .argument("<id>", "session id")
    .option("--events <n>", "recent events to show", intArg, 10)
    .action(run(showSession, { offline: offlineSession }));
  sessions
    .command("stats")
    .description("Aggregated counts: tools, event types, agents, tokens")
    .argument("<id>", "session id")
    .action(run(sessionStats, { serverOnly: "session stats aggregate server-side" }));
  sessions
    .command("cost")
    .description("Estimated cost for one session, per model")
    .argument("<id>", "session id")
    .action(
      run(async ({ args }) => renderCost(await get(`/api/pricing/cost/${enc(args[0])}`), args[0]), {
        serverOnly: "cost math (pricing rules, compaction baselines) runs server-side",
      })
    );
  sessions
    .command("agents")
    .description("A session's agents as a tree")
    .argument("<id>", "session id")
    .action(
      run(async ({ args }) => {
        const d = await get(`/api/sessions/${enc(args[0])}`);
        if (isJson()) return printJson({ agents: d.agents || [] });
        renderAgentTree(d.agents || []);
      })
    );
  sessions
    .command("events")
    .description("A session's events (same filters as `ccam events`)")
    .argument("<id>", "session id")
    .option("--type <types>", "event types, comma-separated", csvArg)
    .option("--tool <tools>", "tool names, comma-separated", csvArg)
    .option("--limit <n>", "rows to return", posIntArg, 50)
    .option("--offset <n>", "rows to skip", intArg)
    .action(run(({ args, opts }) => listEvents({ opts: { ...opts, session: args[0] } })));
  transcriptOptions(
    sessions
      .command("transcript")
      .description("Read a session's conversation as a chat log (--json for the raw DTO)")
      .argument("<id>", "session id")
  ).action(run(sessionTranscript, { serverOnly: "transcripts are parsed server-side" }));
  sessions
    .command("transcripts")
    .description("List a session's transcript files (main + subagents)")
    .argument("<id>", "session id")
    .action(run(sessionTranscripts, { serverOnly: "transcript discovery runs server-side" }));
  scopeOptions(
    sessions.command("facets").description("Distinct working directories, sources, and providers")
  ).action(run(sessionFacets));
  sessions
    .command("rename")
    .description("Rename a session")
    .argument("<id>", "session id")
    .argument("<name...>", "new name")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(run(sessionRename, { serverOnly: SESSION_SERVER_ONLY }));
  sessions
    .command("update")
    .description("Update a session's name / status / end time / metadata")
    .argument("<id>", "session id")
    .option("--name <name>", "new name")
    .addOption(new Option("--status <status>", "new status").choices(SESSION_STATUSES))
    .option("--ended-at <iso>", "end timestamp")
    .option("--metadata <json>", "metadata JSON (or @file, or -)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(run(sessionUpdate, { serverOnly: SESSION_SERVER_ONLY }));
  sessions
    .command("create")
    .description("Create a session record manually (idempotent by id)")
    .requiredOption("--id <id>", "session id")
    .option("--name <name>", "display name")
    .option("--cwd <dir>", "working directory")
    .option("--model <model>", "model id")
    .option("--metadata <json>", "metadata JSON (or @file, or -)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(run(sessionCreate, { serverOnly: SESSION_SERVER_ONLY }));

  program
    .command("session")
    .helpGroup(GROUP)
    .description("Session detail (same as `sessions get`)")
    .argument("<id>", "session id")
    .option("--events <n>", "recent events to show", intArg, 10)
    .action(run(showSession, { offline: offlineSession }));

  const agents = listGroup(program, "agents", {
    group: GROUP,
    description: "Browse and manage agents (default: list)",
    listDescription: "List agents (--status, --session, --limit, --offset)",
    configure: agentListOptions,
    handler: listAgents,
    offline: offlineAgents,
  });
  agents
    .command("get")
    .alias("show")
    .description("One agent's detail")
    .argument("<id>", "agent id")
    .action(run(showAgent));
  agents
    .command("update")
    .description("Update an agent's name / status / task / current tool")
    .argument("<id>", "agent id")
    .option("--name <name>", "new name")
    .addOption(new Option("--status <status>", "new status").choices(AGENT_STATUSES))
    .option("--task <text>", "task description")
    .option("--current-tool <tool>", 'current tool ("" clears it)')
    .option("--ended-at <iso>", "end timestamp")
    .option("--metadata <json>", "metadata JSON (or @file, or -)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(
      run(agentUpdate, {
        serverOnly: "agent writes go through the server (validation + broadcasts)",
      })
    );
  agents
    .command("create")
    .description("Create an agent record manually (idempotent by id)")
    .requiredOption("--id <id>", "agent id")
    .requiredOption("--session <id>", "owning session id")
    .requiredOption("--name <name>", "display name")
    .addOption(new Option("--type <type>", "agent type").choices(["main", "subagent"]))
    .option("--subagent-type <type>", "subagent type (e.g. Explore)")
    .addOption(new Option("--status <status>", "initial status").choices(AGENT_STATUSES))
    .option("--task <text>", "task description")
    .option("--parent <id>", "parent agent id")
    .option("--metadata <json>", "metadata JSON (or @file, or -)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(
      run(agentCreate, {
        serverOnly: "agent writes go through the server (validation + broadcasts)",
      })
    );

  const events = listGroup(program, "events", {
    group: GROUP,
    description: "Browse the event log (default: list)",
    listDescription: "List events (--session, --type, --tool, --q, --from, --to, --limit)",
    configure: eventListOptions,
    handler: listEvents,
    offline: offlineEvents,
  });
  scopeOptions(events.command("facets").description("Distinct event types and tool names")).action(
    run(eventFacets)
  );

  transcriptOptions(
    program
      .command("transcript")
      .helpGroup(GROUP)
      .description("Transcript as raw JSON (legacy; `sessions transcript` renders a chat log)")
      .argument("<session-id>", "session id")
      .option("--text", "render as a readable chat log instead of JSON")
  ).action(run(legacyTranscript, { serverOnly: "transcripts are parsed server-side" }));

  scopeOptions(
    program
      .command("transcript-image")
      .helpGroup(GROUP)
      .description("Download a persisted transcript image")
      .argument("<session-id>", "session id")
      .requiredOption("--line <n>", "transcript line of the message")
      .requiredOption("--index <n>", "image index within the message")
      .option("--agent <id>", "subagent transcript")
      .option("--run <id>", "Workflow-tool run transcript")
      .option("--output <file>", "where to save the image")
  ).action(run(transcriptImage, { serverOnly: "images are read from transcripts server-side" }));
}

module.exports = { register, renderSessions, renderAgentTree, renderEventLines };
