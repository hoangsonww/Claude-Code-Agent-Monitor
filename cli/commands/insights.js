/**
 * @file ccam insight commands: analytics (token totals, tool/agent-type
 * charts, daily sparklines), workflows (intelligence stats, patterns,
 * per-session drill-in), runs (Workflow-tool run journals), run (agents the
 * dashboard launched — list/history/start/send/follow/stop), and cost (the
 * estimated-cost breakdown with surcharges and unpriced-model warnings).
 *
 * `run` keeps its historical raw-JSON default output (scripts parse it);
 * `--format pretty` renders the human views.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const { Option } = require("commander");
const {
  c,
  table,
  heading,
  subheading,
  kvCard,
  printJson,
  renderTree,
  colorStatus,
  barChart,
  sparkline,
  fmtDuration,
  fmtTime,
  fmtModel,
  fmtCost,
  fmtTokens,
  short,
  trunc,
} = require("../lib/ui");
const { isJson, isPretty, CliError } = require("../lib/runtime");
const { baseUrl, get, post, del, qs, enc, tzOffset } = require("../lib/http");
const {
  run,
  listGroup,
  confirm,
  posIntArg,
  intArg,
  readJsonInput,
  jsonBodyOptions,
} = require("../lib/framework");
const { scopeOptions, scopeParams } = require("./monitor");

const GROUP = "Insights:";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── analytics ───────────────────────────────────────────────────────────────

async function cmdAnalytics({ opts }) {
  const a = await get(`/api/analytics${qs({ tz_offset: tzOffset(), ...scopeParams(opts) })}`);
  if (isJson()) return printJson(a);
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
  if (a.total_cost != null)
    console.log(`\nEstimated cost: ${c.cyan(c.bold(fmtCost(a.total_cost)))}`);
  const tools = (a.tool_usage || []).slice(0, opts.top ?? 10);
  if (tools.length) {
    console.log(`\n${c.bold("Top tools")}`);
    barChart(tools.map((x) => [String(x.tool_name || x.tool), x.count]));
  }
  const types = (a.agent_types || []).slice(0, 8);
  if (types.length) {
    console.log(`\n${c.bold("Agent types")}`);
    barChart(
      types.map((x) => [String(x.subagent_type || x.type || "main"), x.count]),
      { paint: c.magenta }
    );
  }
  const daily = (series, key = "count") =>
    (series || []).slice(-30).map((d) => Number(d[key]) || 0);
  if ((a.daily_events || []).length) {
    const ev = daily(a.daily_events);
    console.log(
      `\n${c.bold("Daily events")}   ${sparkline(ev)} ${c.dim(`last ${ev.length} day(s), peak ${Math.max(...ev)}`)}`
    );
  }
  if ((a.daily_sessions || []).length) {
    const ss = daily(a.daily_sessions);
    console.log(
      `${c.bold("Daily sessions")} ${sparkline(ss)} ${c.dim(`last ${ss.length} day(s), peak ${Math.max(...ss)}`)}`
    );
  }
  if (a.avg_events_per_session != null) {
    console.log(`\nAvg events/session: ${c.cyan(Number(a.avg_events_per_session).toFixed(1))}`);
  }
  if (a.total_subagents != null)
    console.log(`Total subagents:    ${c.cyan(String(a.total_subagents))}`);
}

// ── workflows ───────────────────────────────────────────────────────────────

async function cmdWorkflows({ opts }) {
  if (opts.session) return workflowSession({ args: [opts.session] });
  const w = await get(`/api/workflows${qs(scopeParams(opts))}`);
  if (isJson()) return printJson(w);
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
    const n = opts.patterns ?? 5;
    console.log(`\n${c.bold("Detected patterns")} (top ${Math.min(n, patterns.length)})`);
    for (const p of patterns.slice(0, n)) {
      console.log(
        `  ${c.cyan(String(p.count ?? "-"))}× ${(p.label || p.chain || (p.steps || []).join(" → ") || "").toString().slice(0, 80)}`
      );
    }
  }
}

async function workflowSession({ args }) {
  const d = await get(`/api/workflows/session/${enc(args[0])}`);
  if (isJson()) return printJson(d);
  heading("Workflow drill-in", `session ${args[0]}`);
  const agents = d.agents || d.tree || [];
  console.log(`agents: ${Array.isArray(agents) ? agents.length : "-"}`);
  if (isPretty()) renderTree(d);
}

// ── runs (Workflow-tool journals) ───────────────────────────────────────────

function renderRuns(data, limit) {
  if (isJson()) return printJson(data);
  const runs = data.runs || data.items || [];
  const rows = runs
    .slice(0, limit ?? 20)
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
  const counts = Object.entries(data.counts || {});
  if (counts.length)
    console.log(
      c.dim(
        `\n${counts.map(([k, v]) => `${k} ${v}`).join(" · ")} — ${data.total ?? runs.length} total`
      )
    );
}

function runsListOptions(cmd) {
  return cmd
    .option("--session <id>", "only runs launched in one session")
    .option("--status <status>", "filter by run status")
    .option("--limit <n>", "rows to return", posIntArg, 20)
    .option("--offset <n>", "rows to skip", intArg);
}

async function listRuns({ opts }) {
  renderRuns(
    await get(
      `/api/workflows/runs${qs({ session_id: opts.session, status: opts.status, limit: opts.limit, offset: opts.offset })}`
    ),
    opts.limit
  );
}

async function showWorkflowRun({ args }) {
  const d = await get(`/api/workflows/runs/${enc(args[0])}`);
  if (isJson()) return printJson(d);
  const w = d.workflow || {};
  console.log(`${c.cyan("▍")}${c.bold(w.name || w.run_id)} ${c.dim(`(${w.run_id || args[0]})`)}`);
  kvCard([
    ["Status", colorStatus(w.status)],
    ["Session", w.session_id || "-"],
    ["Started", fmtTime(w.started_at)],
    ["Duration", fmtDuration(w.started_at, w.ended_at)],
    ["Agents", String((d.agents || []).length)],
    w.total_tokens != null ? ["Tokens", fmtTokens(w.total_tokens)] : null,
  ]);
  const phases = w.phases || [];
  if (phases.length) {
    subheading("Phases");
    phases.forEach((p, i) =>
      console.log(
        `  ${c.dim(`${i + 1}.`)} ${c.bold(p.title || p.name || String(p))}${p.detail ? c.dim(` — ${p.detail}`) : ""}`
      )
    );
  }
  const agents = d.agents || [];
  if (agents.length) {
    subheading("Agents");
    table(
      ["ID", "Status", "Name", "Duration"],
      agents.map((a) => [
        short(a.id),
        colorStatus(a.status),
        trunc(a.name || "", 40),
        fmtDuration(a.started_at, a.ended_at),
      ])
    );
  }
  console.log(c.dim(`\n${(d.events || []).length} event(s) attributed to this run`));
}

// ── run (dashboard-launched agents) ─────────────────────────────────────────

/** Legacy default is raw JSON; `--format pretty` gets the human view. */
function jsonOr(data, pretty) {
  if (isPretty()) return pretty(data);
  printJson(data);
}

function renderLiveRuns(d) {
  heading("Live runs", `${d.activeCount ?? 0} active · max ${d.maxConcurrent ?? "?"} concurrent`);
  table(
    ["ID", "Status", "Provider", "Mode", "Model", "Cwd", "Prompt"],
    (d.items || []).map((r) => [
      short(r.id),
      colorStatus(r.status),
      r.provider,
      r.mode,
      fmtModel(r.model),
      trunc(r.cwd, 30),
      trunc(r.prompt, 40),
    ])
  );
}

function renderRunHistory(d) {
  table(
    ["ID", "Status", "Live", "Provider", "Started", "Session", "Prompt"],
    (d.items || []).map((r) => [
      short(r.id),
      colorStatus(r.status),
      r.isLive ? c.green("●") : c.dim("·"),
      r.provider,
      fmtTime(r.started_at),
      short(r.session_id),
      trunc(r.prompt_preview, 40),
    ])
  );
}

function renderRunDetail(r) {
  console.log(`${c.cyan("▍")}${c.bold(`Run ${short(r.id)}`)} ${c.dim(`(${r.id})`)}`);
  kvCard([
    ["Status", colorStatus(r.status)],
    ["Provider", r.provider],
    ["Mode", r.mode],
    ["Model", r.model || "-"],
    ["Cwd", r.cwd],
    ["Session", r.sessionId || "-"],
    ["PID", String(r.pid ?? "-")],
    ["Started", fmtTime(r.startedAt)],
    [
      "Duration",
      r.startedAt
        ? fmtDuration(
            new Date(r.startedAt).toISOString(),
            r.endedAt ? new Date(r.endedAt).toISOString() : null
          )
        : "-",
    ],
    r.exitCode != null ? ["Exit code", String(r.exitCode)] : null,
    r.error ? ["Error", c.red(String(r.error))] : null,
    ["Envelopes", String(r.envelopeCount ?? 0)],
    ["Prompt", trunc(r.prompt, 100)],
  ]);
}

/** One line per stream-json envelope (Claude) with a generic fallback (Codex). */
function envelopeLine(e) {
  const t = e?.type || "?";
  if (t === "assistant" && Array.isArray(e.message?.content)) {
    return e.message.content
      .map((b) =>
        b.type === "text"
          ? `${c.cyan("assistant")} ${trunc(b.text, 160)}`
          : b.type === "tool_use"
            ? `${c.magenta("⚙ tool")} ${c.bold(b.name)} ${c.dim(trunc(JSON.stringify(b.input || {}), 120))}`
            : `${c.dim(b.type)}`
      )
      .join("\n");
  }
  if (t === "user" && Array.isArray(e.message?.content)) {
    return e.message.content
      .map((b) =>
        b.type === "tool_result"
          ? `${c.dim("↳ result")} ${trunc(typeof b.content === "string" ? b.content : JSON.stringify(b.content), 140)}`
          : `${c.yellow("user")} ${trunc(b.text || "", 140)}`
      )
      .join("\n");
  }
  if (t === "result") {
    const cost = e.total_cost_usd != null ? ` ${fmtCost(e.total_cost_usd)}` : "";
    return `${e.is_error ? c.red("✖ result") : c.green("✔ result")}${cost} ${c.dim(trunc(e.result || e.subtype || "", 120))}`;
  }
  if (t === "system")
    return c.dim(`system ${e.subtype || ""} ${e.model ? `model=${e.model}` : ""}`);
  return c.dim(`${t} ${trunc(JSON.stringify(e), 140)}`);
}

/** Poll a run and print new envelopes until it ends (Ctrl+C detaches). */
async function followRun({ args, opts }) {
  const id = args[0];
  let seen = 0;
  let first = true;
  for (;;) {
    const r = await get(`/api/run/${enc(id)}?envelopes=1`);
    const envs = r.envelopes || [];
    const total = r.envelopeCount ?? envs.length;
    // The server keeps only the most recent envelopes in memory; if more
    // arrived since the last poll than it still holds, say how many we lost.
    const missed = first ? 0 : total - seen - envs.length;
    if (missed > 0) {
      if (isJson()) {
        process.stderr.write(
          `${JSON.stringify({ warning: { code: "ENVELOPES_MISSED", missed } })}\n`
        );
      } else {
        console.log(c.yellow(`⚠ ${missed} envelope(s) were evicted before they could be shown`));
      }
    }
    const fresh = first
      ? envs.slice(Math.max(0, envs.length - (opts.backlog ?? 20)))
      : envs.slice(Math.max(0, envs.length - (total - seen)));
    if (first && !isJson()) {
      renderRunDetail(r);
      console.log(
        c.dim(`── following run ${short(id)} — Ctrl+C detaches (the run keeps going) ──`)
      );
    }
    for (const e of fresh) {
      if (isJson()) process.stdout.write(`${JSON.stringify(e)}\n`);
      else console.log(envelopeLine(e));
    }
    seen = total;
    first = false;
    if (!["running", "spawning"].includes(r.status)) {
      if (!isJson())
        console.log(
          `\n${colorStatus(r.status)} ${c.dim(r.exitCode != null ? `exit ${r.exitCode}` : "")}`
        );
      return;
    }
    await sleep(1000);
  }
}

async function runStart({ opts }) {
  const body = readJsonInput(opts) || {
    provider: opts.provider || "claude",
    prompt: opts.prompt || "",
    mode: opts.mode || "conversation",
    cwd: opts.cwd,
    model: opts.model,
    permissionMode: opts.permission,
    resumeSessionId: opts.resume,
    effort: opts.effort,
    sandbox: opts.sandbox,
  };
  if (!body.cwd) {
    throw new CliError("run start requires a cwd (--cwd <dir>, or cwd in the JSON input).", {
      code: "USAGE",
    });
  }
  await confirm(opts, {
    prompt: `Launch a ${body.provider || "claude"} agent in ${body.cwd}?`,
    refusal: "run start requires --yes and a cwd in flags or JSON input.",
  });
  const r = await post("/api/run", body);
  if (opts.follow) return followRun({ args: [r.id], opts });
  jsonOr(r, (x) => {
    console.log(`${c.green("✔")} Launched run ${c.bold(x.id)}`);
    renderRunDetail(x);
    console.log(c.dim(`  Follow it with: ccam run follow ${x.id}`));
  });
}

async function runSend({ args, opts }) {
  await confirm(opts, {
    prompt: `Send a message to run ${args[0]}?`,
    refusal: "run send <id> requires --yes and --text <message>.",
  });
  const provider = opts.provider || (await get(`/api/run/${enc(args[0])}`)).provider || "claude";
  const r = await post(`/api/run/${enc(args[0])}/message`, { text: opts.text, provider });
  jsonOr(r, () => console.log(`${c.green("✔")} Message sent to run ${args[0]}`));
}

async function runStop({ args, opts }) {
  await confirm(opts, { prompt: `Stop run ${args[0]}?`, refusal: "run stop <id> requires --yes." });
  const r = await del(`/api/run/${enc(args[0])}`);
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Stopped run ${args[0]}`);
}

// ── cost ────────────────────────────────────────────────────────────────────

function renderCost(cost, sessionId, opts = {}) {
  if (isJson()) return printJson(cost);
  if (sessionId) heading("Session cost", sessionId);
  console.log(`${c.bold("Total estimated cost:")} ${c.cyan(c.bold(fmtCost(cost.total_cost)))}`);
  const breakdown = (cost.breakdown || []).slice(0, 15);
  if (breakdown.length) {
    console.log();
    barChart(
      breakdown.map((b) => [fmtModel(b.model), Number(b.cost) || 0]),
      { paint: c.green, width: 20, format: fmtCost }
    );
  }
  // Server-tool surcharges billed on top of tokens (web search $/1k, code
  // execution container-time beyond the org free allowance). Shown only when
  // something is actually billed so a plain token-only total stays clean.
  const fc = cost.feature_costs || {};
  const featureLines = [];
  if ((fc.web_search_cost || 0) > 0)
    featureLines.push(`web search ${c.bold(fmtCost(fc.web_search_cost))}`);
  if ((fc.code_execution_cost || 0) > 0)
    featureLines.push(`code execution ${c.bold(fmtCost(fc.code_execution_cost))}`);
  if (featureLines.length) {
    console.log();
    console.log(`${c.dim("Server-tool surcharges:")} ${featureLines.join(c.dim(" · "))}`);
  }
  const daily = (cost.daily_costs || []).slice(-(opts.days ?? 14));
  if (opts.daily && daily.length) {
    console.log(`\n${c.bold("Daily cost")}`);
    barChart(
      daily.map((d) => [d.date, Number(d.cost?.total_cost ?? d.cost) || 0]),
      { paint: c.green, width: 20, format: fmtCost }
    );
  } else if (daily.length > 1) {
    const series = daily.map((d) => Number(d.cost?.total_cost ?? d.cost) || 0);
    console.log(
      `\n${c.dim("Daily")} ${sparkline(series)} ${c.dim(`last ${series.length} day(s) — --daily for the table`)}`
    );
  }
  // The API prices unmatched models at $0 and reports them in unpriced_models
  // so the total stays honest — surface that instead of silently showing an
  // under-reported number (e.g. right after a brand-new model id ships).
  const unpriced = cost.unpriced_models || [];
  if (unpriced.length) {
    console.log();
    console.log(
      c.yellow(
        `⚠ ${unpriced.length} model(s) have usage but no pricing rule — excluded from the total:`
      )
    );
    for (const u of unpriced) {
      const tokens =
        (u.input_tokens || 0) +
        (u.output_tokens || 0) +
        (u.cache_read_tokens || 0) +
        (u.cache_write_tokens || 0);
      console.log(`  ${c.bold(u.model)}  ${c.dim(`${fmtTokens(tokens)} tokens`)}`);
    }
    console.log(c.dim("  Add a rule with: ccam pricing set <pattern> --input N --output N"));
  }
}

async function cmdCost({ opts }) {
  const cost = opts.session
    ? await get(`/api/pricing/cost/${enc(opts.session)}${qs({ tz_offset: tzOffset() })}`)
    : await get(`/api/pricing/cost${qs({ tz_offset: tzOffset(), ...scopeParams(opts) })}`);
  renderCost(cost, opts.session, opts);
}

// ── Registration ────────────────────────────────────────────────────────────

const RUN_ONLY = "dashboard-launched runs are managed by the running server";

// ── Budgets ──────────────────────────────────────────────────────────────────

async function cmdBudgets() {
  const data = await get("/api/budgets");
  if (isJson()) return printJson(data);
  const budgets = data.budgets || [];
  if (!budgets.length) return void console.log(c.dim("No budgets configured."));
  table(
    ["Name", "Scope", "Period", "Limit", "Warn", "On"],
    budgets.map((b) => [
      trunc(b.name, 28),
      b.scope_type === "global" ? "all" : `${b.scope_type}:${trunc(b.scope_value || "", 24)}`,
      b.period,
      fmtCost(b.limit_usd),
      `${b.warn_at_percent}%`,
      b.enabled ? c.green("yes") : c.dim("no"),
    ])
  );
}

async function cmdBudgetStatus() {
  const data = await get(`/api/budgets/status${qs({ tz_offset: tzOffset() })}`);
  if (isJson()) return printJson(data);
  const budgets = data.budgets || [];
  if (!budgets.length) return void console.log(c.dim("No budgets configured."));
  const paint = (s) =>
    s === "over" ? c.red : s === "warn" ? c.yellow : s === "projected_over" ? c.magenta : c.green;
  table(
    ["Name", "Period", "Spent", "Limit", "Used", "Burn/h", "Proj.", "Runs out", "Status"],
    budgets.map((b) => {
      const p = paint(b.status);
      return [
        trunc(b.name, 24),
        b.period,
        fmtCost(b.spent_usd),
        fmtCost(b.limit_usd),
        b.percent_used === null ? "-" : `${b.percent_used}%`,
        b.burn_rate_usd_per_hour === null ? "-" : fmtCost(b.burn_rate_usd_per_hour),
        b.projected_end_usd === null ? "-" : fmtCost(b.projected_end_usd),
        b.projected_exhaustion_at ? b.projected_exhaustion_at.slice(0, 10) : "-",
        p(b.status),
      ];
    })
  );
}

function register(program) {
  scopeOptions(
    program
      .command("analytics")
      .helpGroup(GROUP)
      .description("Token totals, top tools, agent types, daily activity sparklines")
      .option("--top <n>", "tools shown in the chart", posIntArg, 10)
  ).action(run(cmdAnalytics, { serverOnly: "analytics aggregation runs server-side" }));

  const workflows = scopeOptions(
    program
      .command("workflows")
      .helpGroup(GROUP)
      .description("Workflow intelligence: stats, detected patterns, per-session drill-in")
      .option("--session <id>", "drill into one session (same as `workflows session <id>`)")
      .option("--patterns <n>", "patterns to show", posIntArg, 5)
  );
  workflows.action(
    run(cmdWorkflows, { serverOnly: "workflow intelligence is computed server-side" })
  );
  workflows
    .command("session")
    .description("Workflow drill-in for one session")
    .argument("<id>", "session id")
    .action(run(workflowSession, { serverOnly: "workflow intelligence is computed server-side" }));

  const runs = listGroup(program, "runs", {
    group: GROUP,
    description: "Workflow-tool runs reconstructed from on-disk journals (default: list)",
    configure: runsListOptions,
    handler: listRuns,
    serverOnly: "workflow-run reconstruction runs server-side",
  });
  runs
    .command("get")
    .alias("show")
    .description("One Workflow-tool run: phases, inner agents, event count")
    .argument("<run-id>", "workflow run id")
    .action(run(showWorkflowRun, { serverOnly: "workflow-run reconstruction runs server-side" }));

  const r = program
    .command("run")
    .helpGroup(GROUP)
    .description(
      "Inspect and control agents launched by the dashboard (raw JSON; --format pretty for views)"
    )
    .allowExcessArguments();
  r.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        jsonOr(await get("/api/run"), renderLiveRuns);
      },
      { serverOnly: RUN_ONLY }
    )
  );
  r.command("list")
    .alias("ls")
    .description("Live (in-memory) runs")
    .action(
      run(async () => jsonOr(await get("/api/run"), renderLiveRuns), { serverOnly: RUN_ONLY })
    );
  r.command("history")
    .description("Persistent history of dashboard-launched runs")
    .option("--limit <n>", "rows to return", posIntArg, 50)
    .action(
      run(
        async ({ opts }) =>
          jsonOr(await get(`/api/run/history?limit=${opts.limit}`), renderRunHistory),
        {
          serverOnly: RUN_ONLY,
        }
      )
    );
  for (const [name, desc] of [
    ["models", "Models the provider CLI can run"],
    ["binary", "Resolved provider binary path and version"],
  ]) {
    r.command(name)
      .description(desc)
      .argument("[provider]", "claude or codex")
      .option("--provider <provider>", "claude or codex")
      .action(
        run(
          async ({ args, opts }) =>
            jsonOr(
              await get(`/api/run/${name}?provider=${enc(args[0] || opts.provider || "claude")}`),
              renderTree
            ),
          { serverOnly: RUN_ONLY }
        )
      );
  }
  r.command("cwds")
    .description("Suggested working directories")
    .action(
      run(async () => jsonOr(await get("/api/run/cwds"), renderTree), { serverOnly: RUN_ONLY })
    );
  r.command("files")
    .description("Files under a working directory (for @-mentions)")
    .requiredOption("--cwd <dir>", "directory to list")
    .option("--query <text>", "filter")
    .action(
      run(
        async ({ opts }) =>
          jsonOr(await get(`/api/run/files${qs({ cwd: opts.cwd, q: opts.query })}`), renderTree),
        {
          serverOnly: RUN_ONLY,
        }
      )
    );
  r.command("get")
    .alias("show")
    .description("One run's detail")
    .argument("<id>", "run id")
    .option("--envelopes", "include the in-memory stream envelopes")
    .action(
      run(
        async ({ args, opts }) =>
          jsonOr(
            await get(`/api/run/${enc(args[0])}${opts.envelopes ? "?envelopes=1" : ""}`),
            renderRunDetail
          ),
        { serverOnly: RUN_ONLY }
      )
    );
  r.command("follow")
    .alias("logs")
    .description("Stream a run's output until it ends (Ctrl+C detaches; NDJSON with --json)")
    .argument("<id>", "run id")
    .option("--backlog <n>", "recent envelopes printed on attach", posIntArg, 20)
    .action(run(followRun, { serverOnly: RUN_ONLY }));
  jsonBodyOptions(
    r
      .command("start")
      .description("Launch a Claude Code or Codex agent (requires --yes)")
      .addOption(new Option("--provider <provider>", "agent CLI").choices(["claude", "codex"]))
      .option("--prompt <text>", "initial prompt")
      .addOption(new Option("--mode <mode>", "run mode").choices(["conversation", "headless"]))
      .option("--cwd <dir>", "working directory (required)")
      .option("--model <model>", "model id or alias")
      .option("--permission <mode>", "permission / approval mode")
      .option("--resume <session-id>", "resume a previous session")
      .option("--effort <level>", "reasoning effort")
      .option("--sandbox <mode>", "Codex sandbox mode")
      .option("-f, --follow", "stream the run's output after launching")
      .option("-y, --yes", "confirm launching an agent"),
    "run spec"
  ).action(run(runStart, { serverOnly: RUN_ONLY }));
  r.command("send")
    .description("Send a follow-up message to a conversation run (requires --yes)")
    .argument("<id>", "run id")
    .requiredOption("--text <message>", "message text")
    .addOption(new Option("--provider <provider>", "agent CLI").choices(["claude", "codex"]))
    .option("-y, --yes", "confirm sending")
    .action(run(runSend, { serverOnly: RUN_ONLY }));
  r.command("stop")
    .alias("kill")
    .description("Stop a running agent (requires --yes)")
    .argument("<id>", "run id")
    .option("-y, --yes", "confirm stopping")
    .action(run(runStop, { serverOnly: RUN_ONLY }));

  scopeOptions(
    program
      .command("cost")
      .helpGroup(GROUP)
      .description("Total estimated cost with per-model chart (--session scopes to one)")
      .option("--session <id>", "one session's cost")
      .option("--daily", "show a per-day cost table")
      .option("--days <n>", "days in the daily view", posIntArg, 14)
  ).action(
    run(cmdCost, { serverOnly: "cost math (pricing rules, compaction baselines) runs server-side" })
  );

  const budgets = listGroup(program, "budgets", {
    group: GROUP,
    description: "Spending budgets: list, status (default: list)",
    handler: cmdBudgets,
    serverOnly: "budget spend is repriced from usage server-side",
    listDescription: "List configured budgets",
  });
  budgets
    .command("status")
    .helpGroup(GROUP)
    .description("Spend vs. limit with a burn-down forecast per budget")
    .action(
      run(cmdBudgetStatus, { serverOnly: "budget spend is repriced from usage server-side" })
    );
}

module.exports = { register, renderCost };
