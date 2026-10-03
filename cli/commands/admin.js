/**
 * @file ccam administration commands: doctor (structured health checks),
 * info, export, cleanup, snapshots (transcript snapshot storage, compression,
 * and dry-run-first prune), clear-data, reinstall-hooks, hooks, config (Claude
 * Code + Codex Config Explorer), api (any JSON endpoint), mcp (launch the
 * bundled MCP server), updates / update-check, metrics (Prometheus), home
 * (CLAUDE_HOME / CODEX_HOME), and push (web-push notifications).
 *
 * Safety model: reads are always safe; writes are confirmed (--yes, or y/N on
 * a TTY); the destructive clear-data needs a literal --yes and the generic
 * `api` route to it additionally needs --confirm CLEAR_ALL_DATA; `snapshots
 * prune` is a dry run unless given --apply --confirm PRUNE_SNAPSHOTS.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { Argument } = require("commander");
const {
  c,
  heading,
  subheading,
  kvCard,
  table,
  printJson,
  renderTree,
  fmtBytes,
  fmtMs,
  onOff,
} = require("../lib/ui");
const { REPO_ROOT, isJson, isPretty, CliError } = require("../lib/runtime");
const { baseUrl, api, get, post, put, del, rawFetch, readBody } = require("../lib/http");
const { requireDb, dbPath } = require("../lib/offline");
const { run, confirm, posIntArg, readJsonInput, jsonBodyOptions } = require("../lib/framework");

const GROUP = "Administration:";

/** Legacy raw-JSON default; `--format pretty` renders the generic tree view. */
function jsonOrTree(data, pretty = renderTree) {
  if (isPretty()) return pretty(data);
  if (typeof data === "string") return console.log(data);
  printJson(data);
}

// ── doctor ──────────────────────────────────────────────────────────────────

/** Render doctor checks: `✔ name detail` lines (or a JSON report). */
function renderChecks(title, checks) {
  const failed = checks.some((k) => k.status === "fail");
  if (failed) process.exitCode = 1;
  if (isJson()) return printJson({ ok: !failed, url: baseUrl(), checks });
  heading(title.name, title.sub);
  const mark = {
    ok: c.green("✔"),
    warn: c.yellow("!"),
    fail: c.red("✖"),
    info: c.dim("·"),
    down: c.red("○"),
  };
  for (const k of checks) {
    console.log(`${mark[k.status] || c.dim("·")}  ${k.name}  ${k.detail}`);
    for (const sub of k.lines || []) console.log(`${c.dim("·")}    ${sub}`);
  }
}

async function cmdDoctor() {
  await get("/api/health");
  const checks = [{ name: "API reachable", status: "ok", detail: baseUrl() }];
  const info = await get("/api/settings/info");
  const hooks = info.hooks || {};
  const claude = hooks.providers?.claude;
  const codex = hooks.providers?.codex;
  checks.push(
    hooks.installed
      ? {
          name: "Claude Code hooks",
          status: claude && !claude.installed ? "warn" : "ok",
          detail:
            claude && !claude.installed
              ? "not installed (Codex hooks are)"
              : `installed (${hooks.path || "~/.claude/settings.json"})`,
        }
      : {
          name: "Claude Code hooks",
          status: "fail",
          detail: "NOT installed — run: npm run install-hooks",
        }
  );
  if (codex) {
    checks.push({
      name: "Codex hooks",
      status: codex.installed ? "ok" : "info",
      detail: codex.installed
        ? `installed${codex.path ? ` (${codex.path})` : ""}`
        : "not installed (optional — ccam hooks install codex)",
    });
  }
  const db = info.db || {};
  checks.push({
    name: "Database",
    status: "ok",
    detail: `${db.path || "?"} (${((db.size || 0) / 1048576).toFixed(1)} MB)`,
    lines: Object.entries(db.counts || {}).map(([t, n]) => `rows: ${t}  ${n}`),
  });
  const srv = info.server || {};
  checks.push({
    name: "Server uptime",
    status: "ok",
    detail: `${Math.floor((srv.uptime || 0) / 60)} min (node ${srv.node_version || "?"})`,
  });
  checks.push({ name: "WS connections", status: "ok", detail: String(srv.ws_connections ?? 0) });
  try {
    const { sources = [] } = await get("/api/remote-sources");
    if (!sources.length)
      checks.push({ name: "Remote sources", status: "ok", detail: "none configured" });
    else {
      const errored = sources.filter((s) => s.status === "error");
      checks.push({
        name: "Remote sources",
        status: errored.length ? "fail" : "ok",
        detail: `${sources.length} configured${errored.length ? ` (${errored.length} in error)` : ""}`,
        lines: sources.map(
          (s) =>
            `${s.label || s.id}  ${s.status}` +
            (s.last_sync_at ? `  last sync ${s.last_sync_at}` : "") +
            (s.last_error ? `  ${c.red(s.last_error)}` : "")
        ),
      });
    }
  } catch (err) {
    checks.push({ name: "Remote sources", status: "fail", detail: err.message || String(err) });
  }
  checks.push(...localChecks());
  renderChecks({ name: "ccam doctor", sub: baseUrl() }, checks);
}

/** Checks that need no server: builds present, CLI linkage. */
function localChecks() {
  const out = [];
  const clientBuilt = fs.existsSync(path.join(REPO_ROOT, "client", "dist", "index.html"));
  out.push({
    name: "Client build",
    status: clientBuilt ? "ok" : "info",
    detail: clientBuilt
      ? "client/dist present (ccam start can serve it)"
      : "missing — npm run build (needed by ccam start)",
  });
  const mcpBuilt = fs.existsSync(path.join(REPO_ROOT, "mcp", "build", "index.js"));
  out.push({
    name: "MCP build",
    status: mcpBuilt ? "ok" : "info",
    detail: mcpBuilt
      ? "mcp/build present (ccam mcp)"
      : "missing — npm run mcp:install && npm run mcp:build",
  });
  return out;
}

function offlineDoctor() {
  const checks = [
    {
      name: "Dashboard server",
      status: "down",
      detail: `NOT running ${c.dim(`(tried ${baseUrl()})`)} — start with: ${c.bold("ccam start")}`,
    },
    {
      name: "Remote sources",
      status: "info",
      detail: "require a live server (ccam remote-sources / Settings)",
    },
  ];
  const file = dbPath();
  if (fs.existsSync(file)) {
    const db = requireDb();
    const lines = [];
    for (const t of ["sessions", "agents", "events", "model_pricing", "token_usage"]) {
      try {
        lines.push(`rows: ${t}  ${db.all(`SELECT COUNT(*) AS n FROM ${t}`)[0].n}`);
      } catch {
        /* table may not exist on very old DBs */
      }
    }
    checks.push({
      name: "Database",
      status: "ok",
      detail: `${file} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`,
      lines,
    });
  } else {
    checks.push({ name: "Database", status: "fail", detail: `not found at ${file}` });
  }
  try {
    const settingsPath = path.join(
      process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"),
      "settings.json"
    );
    const installed =
      fs.existsSync(settingsPath) &&
      fs.readFileSync(settingsPath, "utf8").includes("hook-handler.js");
    checks.push(
      installed
        ? { name: "Claude Code hooks", status: "ok", detail: `installed (${settingsPath})` }
        : {
            name: "Claude Code hooks",
            status: "fail",
            detail: "NOT installed — run: npm run install-hooks",
          }
    );
  } catch {
    checks.push({ name: "Claude Code hooks", status: "info", detail: "could not be checked" });
  }
  checks.push(...localChecks());
  renderChecks({ name: "ccam doctor", sub: "offline" }, checks);
  process.exitCode = 1; // offline is always a failure for live monitoring
}

// ── info / export / cleanup / clear-data ────────────────────────────────────

function renderInfo(info) {
  const db = info.db || {};
  const srv = info.server || {};
  heading("System info", baseUrl());
  kvCard([
    ["Version", srv.version || "?"],
    ["Uptime", fmtMs((srv.uptime || 0) * 1000)],
    ["Node", `${srv.node_version} · ${srv.platform}/${srv.arch} · ${srv.cpus} CPU`],
    [
      "Memory",
      `rss ${fmtBytes(srv.memory?.rss)} · heap ${fmtBytes(srv.memory?.heapUsed)} · free ${fmtBytes(srv.free_mem)} of ${fmtBytes(srv.total_mem)}`,
    ],
    ["WS clients", String(srv.ws_connections ?? 0)],
    ["Database", `${db.path} (${fmtBytes(db.size)})`],
    [
      "Load",
      `events 5m ${db.load_stats?.m5 ?? 0} · 15m ${db.load_stats?.m15 ?? 0} · 1h ${db.load_stats?.h1 ?? 0}`,
    ],
    [
      "Hooks",
      `claude ${onOff(info.hooks?.providers?.claude?.installed)} · codex ${onOff(info.hooks?.providers?.codex?.installed)}`,
    ],
  ]);
  subheading("Rows");
  table(
    ["Table", "Rows"],
    Object.entries(db.counts || {}).map(([t, n]) => [t, n])
  );
}

async function cmdExport({ args }) {
  const data = await get("/api/settings/export", { timeoutMs: 600_000 });
  writeExport(args[0], data);
}

function writeExport(target, data) {
  if (target === "-") {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const file = target || `ccam-export-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const size = fs.statSync(file).size;
  if (isJson())
    return printJson({
      path: path.resolve(file),
      bytes: size,
      offline: Boolean(data.exported_offline),
    });
  console.log(`${c.green("✔")} Exported to ${c.bold(file)} (${(size / 1048576).toFixed(1)} MB)`);
}

function offlineExport({ args }) {
  const db = requireDb();
  writeExport(args[0], {
    exported_at: new Date().toISOString(),
    exported_offline: true,
    sessions: db.all("SELECT * FROM sessions ORDER BY started_at DESC"),
    agents: db.all("SELECT * FROM agents ORDER BY started_at DESC"),
    events: db.all("SELECT * FROM events ORDER BY created_at DESC"),
    token_usage: db.all("SELECT * FROM token_usage"),
    model_pricing: db.all("SELECT * FROM model_pricing ORDER BY LENGTH(model_pattern) DESC"),
  });
}

async function cmdCleanup({ opts }) {
  if (opts.hours == null && opts.days == null) {
    throw new CliError("Usage: ccam cleanup --hours <N> and/or --days <M>", {
      code: "USAGE",
      hints: [
        "--hours N  abandon active sessions idle for N hours",
        "--days M   purge completed sessions older than M days",
      ],
    });
  }
  const body = {};
  if (opts.hours != null) body.abandon_hours = opts.hours;
  if (opts.days != null) body.purge_days = opts.days;
  const r = await post("/api/settings/cleanup", body);
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Cleanup done: ${JSON.stringify(r)}`);
}

// ── snapshots (issue #358) ──────────────────────────────────────────────────

const SNAPSHOT_ROOTS = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["cursor", "Cursor"],
];

async function cmdSnapshotStatus() {
  const s = await get("/api/settings/snapshots");
  if (isJson()) return printJson(s);
  heading("Transcript snapshots");
  table(
    ["Provider", "Size", "Files", "Compressed", "Path"],
    SNAPSHOT_ROOTS.map(([kind, label]) => {
      const r = s.roots?.[kind] || {};
      return [label, fmtBytes(r.bytes || 0), r.files ?? 0, r.compressed_files ?? 0, r.path || ""];
    })
  );
  const p = s.policy || {};
  kvCard([
    ["Total", `${fmtBytes(s.total_bytes || 0)} · ${s.total_files ?? 0} files`],
    ["Compress", onOff(p.compress)],
    ["Age cap", p.max_age_days ? `${p.max_age_days} days` : "none"],
    ["Size cap", p.max_bytes ? fmtBytes(p.max_bytes) : "none"],
  ]);
}

async function cmdSnapshotCompress() {
  const r = await post("/api/settings/snapshots/compress", undefined, { timeoutMs: 600_000 });
  if (isJson()) return printJson(r);
  console.log(
    `${c.green("✔")} Compressed ${r.compressed} snapshot(s) ` +
      `(${fmtBytes(r.bytes_before)} → ${fmtBytes(r.bytes_after)})` +
      (r.failed ? c.yellow(` · ${r.failed} failed`) : "") +
      (r.skipped_roots?.length
        ? c.dim(` · skipped (source tree unreadable): ${r.skipped_roots.join(", ")}`)
        : "")
  );
}

async function cmdSnapshotPrune({ opts }) {
  const body = {};
  if (opts.days != null) body.max_age_days = opts.days;
  if (opts.maxSize != null) body.max_bytes = String(opts.maxSize);
  if (opts.orphans) body.orphans = true;
  if (body.max_age_days == null && body.max_bytes == null && !body.orphans) {
    throw new CliError(
      "Usage: ccam snapshots prune [--days N] [--max-size 5GB] [--orphans] [--apply]",
      {
        code: "USAGE",
        hints: [
          "--days N        snapshots of finished sessions idle > N days",
          "--max-size S    then oldest-first until the total is under S",
          "--orphans       snapshots whose session is no longer in the DB",
          "Dry run by default. Apply with --apply --confirm PRUNE_SNAPSHOTS.",
        ],
      }
    );
  }
  if (opts.apply) {
    if (opts.confirm !== "PRUNE_SNAPSHOTS") {
      throw new CliError("--apply requires --confirm PRUNE_SNAPSHOTS.", {
        code: "CONFIRMATION_REQUIRED",
        hints: [
          "A pruned snapshot may be the only copy left once the provider deleted the original.",
        ],
      });
    }
    body.dry_run = false;
    body.confirm = "PRUNE_SNAPSHOTS";
  }
  const r = await post("/api/settings/snapshots/prune", body);
  if (isJson()) return printJson(r);
  const shown = (r.candidates || []).slice(0, 20);
  if (shown.length) {
    table(
      ["Provider", "Session", "Size", "Reason", "Last activity"],
      shown.map((row) => [
        row.kind,
        row.session_id,
        fmtBytes(row.bytes),
        row.reason,
        row.last_activity || "no session row",
      ])
    );
    if (r.candidate_sessions > shown.length) {
      console.log(c.dim(`  … and ${r.candidate_sessions - shown.length} more`));
    }
  }
  if (r.dry_run) {
    console.log(
      `${c.cyan("ℹ")} Dry run: ${r.candidate_sessions} session(s), ${r.candidate_files} file(s), ` +
        `${fmtBytes(r.candidate_bytes)} would be removed; ${fmtBytes(r.remaining_bytes)} would remain.`
    );
    if (r.candidate_sessions > 0)
      console.log(c.dim("  Apply with: --apply --confirm PRUNE_SNAPSHOTS"));
  } else {
    console.log(
      `${c.green("✔")} Pruned ${r.candidate_sessions} session(s): ${r.removed_files} file(s), ` +
        fmtBytes(r.removed_bytes) +
        (r.failed_files ? c.yellow(` · ${r.failed_files} locked file(s) left for later`) : "")
    );
  }
  if (r.over_cap_bytes > 0) {
    console.log(
      c.yellow(
        `  Still ${fmtBytes(r.over_cap_bytes)} over the size cap ` +
          "(active sessions and those active in the last 24 h are never pruned)."
      )
    );
  }
}

async function cmdClearData({ opts }) {
  if (opts.yes !== true) {
    throw new CliError("clear-data deletes ALL sessions, agents, events, and token usage.", {
      code: "CONFIRMATION_REQUIRED",
      hints: ["Re-run with --yes to confirm: ccam clear-data --yes"],
    });
  }
  const r = await post("/api/settings/clear-data");
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} All data cleared (schema preserved)`);
}

// ── hooks ───────────────────────────────────────────────────────────────────

function renderHooks(h) {
  heading("Hook status");
  table(
    ["Provider", "Installed", "Settings file"],
    Object.entries(h.providers || { claude: h }).map(([name, p]) => [
      name,
      onOff(p.installed),
      p.path || "-",
    ])
  );
}

// ── config ──────────────────────────────────────────────────────────────────

const CLAUDE_SURFACES = [
  "overview",
  "skills",
  "agents",
  "commands",
  "output-styles",
  "plugins",
  "mcp",
  "hooks",
  "settings",
  "memory",
  "marketplaces",
  "keybindings",
  "statusline",
  "hook-scripts",
  "backups",
];

async function claudeSurface(surface, opts) {
  const q = new URLSearchParams();
  if (opts.scope) q.set("scope", String(opts.scope));
  if (opts.cwd) q.set("cwd", String(opts.cwd));
  if (opts.type) q.set("type", String(opts.type));
  jsonOrTree(await get(`/api/cc-config/${surface}${q.size ? `?${q}` : ""}`));
}

const surfaceOptions = (cmd) =>
  cmd
    .option("--scope <scope>", "user | project | local | …")
    .option("--cwd <dir>", "project directory for project-scoped surfaces")
    .option("--type <type>", "artifact type filter (backups)");

// ── metrics ─────────────────────────────────────────────────────────────────

/** Parse Prometheus text exposition into { name, labels, value } samples. */
function parsePrometheus(text) {
  const samples = [];
  for (const line of String(text).split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_:][\w:]*)(\{([^}]*)\})?\s+(\S+)/);
    if (!m) continue;
    const labels = {};
    for (const pair of (m[3] || "").match(/(\w+)="((?:[^"\\]|\\.)*)"/g) || []) {
      const [, k, v] = pair.match(/(\w+)="(.*)"/);
      labels[k] = v;
    }
    samples.push({ name: m[1], labels, value: Number(m[4]) });
  }
  return samples;
}

async function cmdMetrics({ opts }) {
  const res = await rawFetch("/api/metrics");
  const text = String((await readBody(res)) ?? "");
  if (!res.ok)
    throw new CliError(`GET /api/metrics → HTTP ${res.status}`, { code: `HTTP_${res.status}` });
  const re = opts.grep ? new RegExp(opts.grep) : null;
  if (isJson()) {
    return printJson({ samples: parsePrometheus(text).filter((s) => !re || re.test(s.name)) });
  }
  const lines = text.split("\n").filter((l) => !re || (!l.startsWith("#") && re.test(l)));
  process.stdout.write(lines.join("\n").replace(/\n*$/, "\n"));
}

// ── mcp ─────────────────────────────────────────────────────────────────────

function cmdMcp({ args }) {
  const mode = args[0] || "stdio";
  const script = path.join(REPO_ROOT, "mcp", "build", "index.js");
  if (!fs.existsSync(script)) {
    throw new CliError("MCP build is missing.", {
      code: "MCP_NOT_BUILT",
      hints: ["Run: npm run mcp:install && npm run mcp:build"],
    });
  }
  const argv = [script];
  if (mode === "http") argv.push("--transport=http");
  else if (mode === "repl") argv.push("--transport=repl");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, argv, { stdio: "inherit", env: process.env });
    child.on("error", (error) => {
      process.exitCode = 1;
      console.error(c.red(`✖ Failed to start MCP server: ${error.message}`));
      console.error(c.dim("  Run npm run mcp:install && npm run mcp:build, then retry."));
      resolve();
    });
    child.on("exit", (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}

// ── updates ─────────────────────────────────────────────────────────────────

function renderUpdate(s) {
  if (isJson()) return printJson(s);
  heading("Dashboard updates", s.repo_root || baseUrl());
  if (!s.git_repo) return console.log(`${c.yellow("○")}  ${s.message}`);
  if (s.fetch_error)
    return console.log(`${c.yellow("!")}  ${s.message} ${c.dim(`(${s.fetch_error})`)}`);
  if (s.update_available) {
    console.log(`${c.yellow("⬆")}  ${s.message}`);
    if (s.situation_note) console.log(c.dim(`   ${s.situation_note}`));
    if (s.manual_command) {
      console.log(`\n  ${c.bold("To update, run:")}`);
      console.log(`  ${c.cyan(s.manual_command)}`);
    }
  } else {
    console.log(`${c.green("✔")}  ${s.message || "Your checkout is up to date."}`);
  }
}

async function updateCheck() {
  if (!isJson()) console.log(c.dim("Checking the canonical remote — this can take a few seconds…"));
  // POST /check (rather than GET /status) so a dashboard open in the browser
  // sees the same fresh result via the update_status websocket broadcast.
  renderUpdate(await post("/api/updates/check", undefined, { timeoutMs: 180_000 }));
}

// ── Registration ────────────────────────────────────────────────────────────

function register(program) {
  program
    .command("doctor")
    .helpGroup(GROUP)
    .description(
      "Diagnose connectivity, hooks, database, remote sources, and builds (exit 1 on failure)"
    )
    .action(run(cmdDoctor, { offline: offlineDoctor }));

  program
    .command("info")
    .helpGroup(GROUP)
    .description(
      "System info: version, uptime, memory, DB stats, hooks (raw JSON; --format pretty)"
    )
    .action(
      run(async () => jsonOrTree(await get("/api/settings/info"), renderInfo), {
        serverOnly: "system info (uptime, memory, WS connections) only exists on a running server",
      })
    );

  program
    .command("export")
    .helpGroup(GROUP)
    .description("Export all data as JSON (file, or - for stdout; works offline)")
    .argument("[file]", "output file (default ccam-export-YYYY-MM-DD.json)")
    .action(run(cmdExport, { offline: offlineExport }));

  program
    .command("cleanup")
    .helpGroup(GROUP)
    .description("Abandon stale active sessions and/or purge old finished ones")
    .option("--hours <n>", "abandon active sessions idle for N hours", posIntArg)
    .option("--days <n>", "purge completed/error/abandoned sessions older than N days", posIntArg)
    .action(run(cmdCleanup, { serverOnly: "cleanup is a server-side mutation" }));

  const SNAPSHOTS_ONLY = "snapshot storage and retention are managed by the running server";
  const snapshots = program
    .command("snapshots")
    .helpGroup(GROUP)
    .description("Transcript snapshot storage per provider + retention policy (default: status)")
    .allowExcessArguments();
  snapshots.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await cmdSnapshotStatus();
      },
      { serverOnly: SNAPSHOTS_ONLY }
    )
  );
  snapshots
    .command("status")
    .description("Snapshot size, file counts, compressed share, and the retention policy")
    .action(run(cmdSnapshotStatus, { serverOnly: SNAPSHOTS_ONLY }));
  snapshots
    .command("compress")
    .description("Losslessly compress snapshots whose original transcript is gone")
    .action(run(cmdSnapshotCompress, { serverOnly: SNAPSHOTS_ONLY }));
  snapshots
    .command("prune")
    .description("Dry-run a prune of old snapshots (apply: --apply --confirm PRUNE_SNAPSHOTS)")
    .option("--days <n>", "snapshots of finished sessions idle longer than N days", posIntArg)
    .option("--max-size <size>", "then oldest-first until the total is under this (e.g. 5GB)")
    .option("--orphans", "also snapshots whose session row no longer exists")
    .option("--apply", "actually delete (requires --confirm PRUNE_SNAPSHOTS)")
    .option("--confirm <token>", "must be PRUNE_SNAPSHOTS to apply")
    .action(run(cmdSnapshotPrune, { serverOnly: SNAPSHOTS_ONLY }));

  program
    .command("clear-data")
    .helpGroup(GROUP)
    .description("Delete ALL sessions, agents, events, and token usage (requires --yes)")
    .option("--yes", "confirm the irreversible wipe")
    .action(run(cmdClearData, { serverOnly: "data wipes must go through the server" }));

  program
    .command("reinstall-hooks")
    .helpGroup(GROUP)
    .description("Reinstall the Claude Code hooks")
    .action(
      run(
        async () => {
          const r = await post("/api/settings/reinstall-hooks");
          if (isJson()) return printJson(r);
          console.log(`${c.green("✔")} Claude Code hooks reinstalled`);
        },
        { serverOnly: "hook installation is performed by the server" }
      )
    );

  const HOOKS_ONLY = "hook status and installation are served by the running server";
  const hooks = program
    .command("hooks")
    .helpGroup(GROUP)
    .description("Inspect or install Claude Code / Codex hooks (default: status)")
    .allowExcessArguments();
  const hookStatus = async () => jsonOrTree((await get("/api/settings/info")).hooks, renderHooks);
  hooks.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await hookStatus();
      },
      { serverOnly: HOOKS_ONLY }
    )
  );
  hooks
    .command("status")
    .description("Hook installation status per provider (raw JSON; --format pretty)")
    .action(run(hookStatus, { serverOnly: HOOKS_ONLY }));
  hooks
    .command("install")
    .description("Install hooks for the given providers (requires --yes)")
    .addArgument(new Argument("[providers...]", "claude and/or codex").choices(["claude", "codex"]))
    .option("-y, --yes", "confirm writing agent settings files")
    .action(
      run(
        async ({ args, opts }) => {
          await confirm(opts, {
            prompt: `Install ${(args[0] || []).join(" + ") || "default"} hooks?`,
            refusal: "Hook installation requires --yes.",
          });
          jsonOrTree(await post("/api/settings/install-hooks", { providers: args[0] || [] }));
        },
        { serverOnly: HOOKS_ONLY }
      )
    );

  // config claude|codex …
  const CONFIG_ONLY = "the Config Explorer reads agent configuration through the server";
  const config = program
    .command("config")
    .helpGroup(GROUP)
    .description("Inspect and edit Claude Code / Codex configuration (raw JSON; --format pretty)");
  const claude = surfaceOptions(
    config
      .command("claude")
      .description("Claude Code Config Explorer (default: overview)")
      .allowExcessArguments()
  );
  claude.action(
    run(
      async ({ cmd, opts }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await claudeSurface("overview", opts);
      },
      { serverOnly: CONFIG_ONLY }
    )
  );
  for (const surface of CLAUDE_SURFACES) {
    surfaceOptions(claude.command(surface).description(`Claude Code ${surface}`)).action(
      run(({ opts }) => claudeSurface(surface, opts), { serverOnly: CONFIG_ONLY })
    );
  }
  surfaceOptions(
    claude
      .command("list")
      .description("Any surface by name (legacy form)")
      .addArgument(new Argument("[surface]", "surface").choices(CLAUDE_SURFACES))
  ).action(
    run(({ args, opts }) => claudeSurface(args[0] || "overview", opts), { serverOnly: CONFIG_ONLY })
  );
  claude
    .command("read")
    .description("Read one config file")
    .argument("<path>", "file path")
    .action(
      run(
        async ({ args }) =>
          jsonOrTree(await get(`/api/cc-config/file?path=${encodeURIComponent(args[0])}`)),
        {
          serverOnly: CONFIG_ONLY,
        }
      )
    );
  for (const [name, method, route, desc] of [
    [
      "write",
      "PUT",
      "/api/cc-config/file",
      "Write a config artifact from --data JSON (requires --yes)",
    ],
    [
      "delete",
      "DELETE",
      "/api/cc-config/file",
      "Delete a config artifact per --data JSON (requires --yes)",
    ],
    [
      "keybindings-write",
      "PUT",
      "/api/cc-config/keybindings",
      "Replace keybindings from --data JSON (requires --yes)",
    ],
  ]) {
    jsonBodyOptions(claude.command(name).description(desc))
      .option("-y, --yes", "confirm the write")
      .action(
        run(
          async ({ opts }) => {
            await confirm(opts, {
              prompt: `${name} Claude Code config?`,
              refusal: "Config writes require --yes.",
            });
            jsonOrTree(await api(method, route, readJsonInput(opts) || {}));
          },
          { serverOnly: CONFIG_ONLY }
        )
      );
  }

  const codex = config
    .command("codex")
    .description("Codex Config Explorer (default: overview)")
    .allowExcessArguments();
  const codexOverview = async () => jsonOrTree(await get("/api/codex-config/overview"));
  codex.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await codexOverview();
      },
      { serverOnly: CONFIG_ONLY }
    )
  );
  codex
    .command("overview")
    .description("Codex configuration overview")
    .action(run(codexOverview, { serverOnly: CONFIG_ONLY }));
  for (const [name, route] of [
    ["read", "file"],
    ["edit", "edit-file"],
  ]) {
    codex
      .command(name)
      .description(name === "read" ? "Read one Codex config file" : "Read a file in editable form")
      .argument("<path>", "file path")
      .action(
        run(
          async ({ args }) =>
            jsonOrTree(await get(`/api/codex-config/${route}?path=${encodeURIComponent(args[0])}`)),
          {
            serverOnly: CONFIG_ONLY,
          }
        )
      );
  }
  for (const [name, method] of [
    ["write", "PUT"],
    ["delete", "DELETE"],
  ]) {
    jsonBodyOptions(
      codex
        .command(name)
        .description(
          `${name === "write" ? "Write" : "Delete"} a Codex config file from --data JSON (requires --yes)`
        )
    )
      .option("-y, --yes", "confirm the write")
      .action(
        run(
          async ({ opts }) => {
            await confirm(opts, {
              prompt: `${name} Codex config?`,
              refusal: "Config writes require --yes.",
            });
            jsonOrTree(await api(method, "/api/codex-config/file", readJsonInput(opts) || {}));
          },
          { serverOnly: CONFIG_ONLY }
        )
      );
  }
  codex
    .command("profile")
    .description("Create a Codex profile (requires --yes)")
    .argument("<name>", "profile name")
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ args, opts }) => {
          await confirm(opts, {
            prompt: `Create Codex profile ${args[0]}?`,
            refusal: "Config writes require --yes.",
          });
          jsonOrTree(await post("/api/codex-config/profiles", { name: args[0] }));
        },
        { serverOnly: CONFIG_ONLY }
      )
    );

  jsonBodyOptions(
    program
      .command("api")
      .helpGroup(GROUP)
      .description("Call any JSON API endpoint (writes require --yes)")
      .argument("[method]", "GET, POST, PUT, PATCH, DELETE (default GET)")
      .argument("[path]", "/api/… path (query string allowed)")
      .option("-y, --yes", "confirm a non-GET request")
      .option("--confirm <token>", "extra confirmation token for destructive routes")
  ).action(
    run(async ({ args, opts }) => {
      let [method, pathname] = args;
      if (method && method.startsWith("/")) [method, pathname] = ["GET", method];
      method = String(method || "GET").toUpperCase();
      if (!pathname || !pathname.startsWith("/api/")) {
        throw new CliError("Usage: ccam api <METHOD> /api/<path> [--data JSON|--file path]", {
          code: "USAGE",
        });
      }
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        throw new CliError(`Unsupported method: ${method}`, { code: "USAGE" });
      }
      if (method !== "GET" && !opts.yes) {
        throw new CliError("Generic API writes require --yes.", { code: "CONFIRMATION_REQUIRED" });
      }
      if (
        pathname.split("?")[0] === "/api/settings/clear-data" &&
        opts.confirm !== "CLEAR_ALL_DATA"
      ) {
        throw new CliError("clear-data requires --confirm CLEAR_ALL_DATA in addition to --yes.", {
          code: "CONFIRMATION_REQUIRED",
        });
      }
      const result = await api(method, pathname, readJsonInput(opts), { timeoutMs: 600_000 });
      if (typeof result === "string")
        process.stdout.write(result.endsWith("\n") ? result : `${result}\n`);
      else if (isPretty()) renderTree(result);
      else printJson(result);
    })
  );

  program
    .command("mcp")
    .helpGroup(GROUP)
    .description(
      "Launch the bundled MCP server (stdio for agent hosts, http, or an interactive repl)"
    )
    .addArgument(
      new Argument("[mode]", "transport").choices(["stdio", "http", "repl"]).default("stdio")
    )
    .action(run(cmdMcp));

  const UPDATE_ONLY = "the update check runs server-side (git fetch against the canonical remote)";
  const updates = program
    .command("updates")
    .helpGroup(GROUP)
    .description("Dashboard update status (default: cached status; `check` fetches now)")
    .allowExcessArguments();
  const updateStatus = async () =>
    renderUpdate(await get("/api/updates/status", { timeoutMs: 180_000 }));
  updates.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await updateStatus();
      },
      { serverOnly: UPDATE_ONLY }
    )
  );
  updates
    .command("status")
    .description("Current update status")
    .action(run(updateStatus, { serverOnly: UPDATE_ONLY }));
  updates
    .command("check")
    .description("Check the canonical remote now (broadcast to open dashboards)")
    .action(run(updateCheck, { serverOnly: UPDATE_ONLY }));
  program
    .command("update-check")
    .helpGroup(GROUP)
    .description("Check whether the checkout is behind upstream (same as `updates check`)")
    .action(run(updateCheck, { serverOnly: UPDATE_ONLY }));

  program
    .command("metrics")
    .helpGroup(GROUP)
    .description("Prometheus metrics (text; --json parses samples)")
    .option("--grep <regex>", "only metrics whose name/line matches")
    .action(run(cmdMetrics, { serverOnly: "metrics are exported by the running server" }));

  const HOME_ONLY = "agent home directories are configured on the running server";
  const home = program
    .command("home")
    .helpGroup(GROUP)
    .description("Show or change the Claude / Codex home directories the dashboard watches")
    .allowExcessArguments();
  const showHomes = async () => {
    const [a, b] = await Promise.all([
      get("/api/settings/claude-home"),
      get("/api/settings/codex-home"),
    ]);
    const data = { claude_home: a.claude_home, codex_home: b.codex_home };
    if (isJson()) return printJson(data);
    heading("Agent homes");
    kvCard([
      ["Claude", data.claude_home],
      ["Codex", data.codex_home],
    ]);
  };
  home.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        await showHomes();
      },
      { serverOnly: HOME_ONLY }
    )
  );
  home
    .command("show")
    .description("Show both home directories")
    .action(run(showHomes, { serverOnly: HOME_ONLY }));
  home
    .command("set")
    .description("Repoint the dashboard at a different home directory (requires --yes)")
    .addArgument(new Argument("<provider>", "which home").choices(["claude", "codex"]))
    .argument("<path>", "directory")
    .option("-y, --yes", "confirm the change")
    .action(
      run(
        async ({ args, opts }) => {
          const [provider, dir] = args;
          const abs = path.resolve(process.cwd(), dir);
          await confirm(opts, {
            prompt: `Set the ${provider} home to ${abs}?`,
            refusal: "home set requires --yes.",
          });
          const r = await put(`/api/settings/${provider}-home`, { path: abs });
          if (isJson()) return printJson(r);
          console.log(`${c.green("✔")} ${provider} home → ${c.bold(r[`${provider}_home`] || abs)}`);
        },
        { serverOnly: HOME_ONLY }
      )
    );

  const PUSH_ONLY = "push notifications are sent by the running server";
  const push = program
    .command("push")
    .helpGroup(GROUP)
    .description("Web-push notifications: key, send (test), subscribe, unsubscribe");
  push
    .command("key")
    .description("The VAPID public key browsers subscribe with")
    .action(
      run(
        async () => {
          const r = await get("/api/push/vapid-public-key");
          if (isJson()) return printJson(r);
          console.log(r.publicKey || c.dim("(no key configured)"));
        },
        { serverOnly: PUSH_ONLY }
      )
    );
  push
    .command("send")
    .description("Send a notification to every subscriber (and the desktop app)")
    .requiredOption("--title <text>", "notification title")
    .requiredOption("--body <text>", "notification body")
    .action(
      run(
        async ({ opts }) => {
          const r = await post("/api/push/send", { title: opts.title, body: opts.body });
          if (isJson()) return printJson(r);
          console.log(
            `${c.green("✔")} Sent — ${r.pushed ?? 0} push subscriber(s), native ${r.native ? c.green("yes") : c.dim("no")}${r.failed ? c.red(`, ${r.failed} failed`) : ""}`
          );
        },
        { serverOnly: PUSH_ONLY }
      )
    );
  jsonBodyOptions(
    push
      .command("subscribe")
      .description("Register a push subscription from --data JSON {endpoint, keys}"),
    "subscription"
  )
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ opts }) => {
          const body = readJsonInput(opts);
          if (!body)
            throw new CliError("subscribe requires --data JSON {endpoint, keys:{p256dh, auth}}", {
              code: "USAGE",
            });
          await confirm(opts, {
            prompt: "Register this push subscription?",
            refusal: "Push subscription writes require --yes.",
          });
          jsonOrTree(await post("/api/push/subscribe", body));
        },
        { serverOnly: PUSH_ONLY }
      )
    );
  push
    .command("unsubscribe")
    .description("Remove a push subscription")
    .requiredOption("--endpoint <url>", "subscription endpoint")
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ opts }) => {
          await confirm(opts, {
            prompt: "Remove this push subscription?",
            refusal: "Push subscription writes require --yes.",
          });
          jsonOrTree(await del("/api/push/subscribe", { endpoint: opts.endpoint }));
        },
        { serverOnly: PUSH_ONLY }
      )
    );
}

module.exports = { register, parsePrometheus };
