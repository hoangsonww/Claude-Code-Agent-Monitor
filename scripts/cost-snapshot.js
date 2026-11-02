#!/usr/bin/env node

/**
 * Per-session cost snapshot of a dashboard database, taken read-only, plus a
 * comparison of two snapshots. Use it around an upgrade that recounts tokens at
 * startup (server/index.js token reconciliation): take a snapshot BEFORE
 * deploying, another AFTER, and compare. The comparison separates "a local
 * session changed" (the user's own spend moved) from "a remote-source session
 * changed" (expected when a box keeps working).
 *
 *   node scripts/cost-snapshot.js snapshot [--db <dashboard.db>] --out <file.tsv>
 *   node scripts/cost-snapshot.js compare <before.tsv> <after.tsv> [--limit N] [--fail-on-local-change]
 *
 * The database is opened with `readonly: true` (mode=ro) and is never written.
 * Snapshot output must be a new file; existing paths and aliases are refused.
 * Cost uses the server's own rate-card code (server/routes/pricing.js); loading
 * new module state is pointed at an owned throw-away database and closed before
 * cleanup. An embedding caller keeps its existing connection and environment.
 * Columns: session_id, provider, source,
 * input, output, cache_read, cache_write, cache_write_1h, web_search, web_fetch,
 * code_execution (baselines included), cost_usd.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { getDataDir } = require("../server/lib/claude-home");

const COLUMNS = [
  "session_id",
  "provider",
  "source",
  "input",
  "output",
  "cache_read",
  "cache_write",
  "cache_write_1h",
  "web_search",
  "web_fetch",
  "code_execution",
  "cost_usd",
];

/**
 * The database the server itself opens (server/db.js): an explicit
 * DASHBOARD_DB_PATH wins, else `dashboard.db` in the canonical data dir
 * (DASHBOARD_DATA_DIR, else `<CLAUDE_HOME>/agent-dashboard`). The CLI loads the
 * server's dotenv file first, so overrides saved there (e.g. by Settings) apply.
 */
function defaultDbPath() {
  return process.env.DASHBOARD_DB_PATH || path.join(getDataDir(), "dashboard.db");
}

/**
 * The SQLite driver server/db.js selects: better-sqlite3 when it loads and its
 * lazily resolved native addon opens, else the node:sqlite compatibility
 * wrapper (whose own load failure propagates instead of being swallowed).
 */
function loadDatabaseDriver() {
  try {
    const NativeDatabase = require("better-sqlite3");
    new NativeDatabase(":memory:").close();
    return NativeDatabase;
  } catch {
    return require("../server/compat-sqlite");
  }
}

/** Load the cost function with the server's db module aimed at a temp database. */
function loadPricing() {
  const dbModuleId = require.resolve("../server/db");
  // An embedding caller may already own this singleton. Reuse the calculator
  // without redirecting its environment or taking ownership of its database.
  if (require.cache[dbModuleId]) {
    return { pricing: require("../server/routes/pricing"), tmp: null, ownedDb: null };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cost-snapshot-"));
  const scratchPath = path.join(tmp, "scratch.db");
  const priorEnv = {
    DASHBOARD_DB_PATH: process.env.DASHBOARD_DB_PATH,
    DASHBOARD_DATA_DIR: process.env.DASHBOARD_DATA_DIR,
  };
  const priorModules = new Set(Object.keys(require.cache));
  // Undo the redirect for the caller: its environment comes back, and every
  // module loaded against the scratch database leaves the require cache, so a
  // later require("../server/db") opens the caller's database, not a closed one.
  const restore = () => {
    for (const [key, value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const id of Object.keys(require.cache)) {
      if (!priorModules.has(id)) delete require.cache[id];
    }
  };
  process.env.DASHBOARD_DB_PATH = scratchPath;
  process.env.DASHBOARD_DATA_DIR = path.join(tmp, "data");
  try {
    const pricing = require("../server/routes/pricing");
    const loadedDb = require.cache[dbModuleId]?.exports;
    const ownedDb = loadedDb?.DB_PATH === scratchPath ? loadedDb.db : null;
    return { pricing, tmp, ownedDb, restore };
  } catch (error) {
    try {
      const loadedDb = require.cache[dbModuleId]?.exports;
      if (loadedDb?.DB_PATH === scratchPath) loadedDb.db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    } finally {
      restore();
    }
    throw error;
  }
}

function takeSnapshot(dbPath, outPath) {
  if (!fs.existsSync(dbPath)) throw new Error(`database not found: ${dbPath}`);
  // Open the target read-only BEFORE the scratch module is loaded; the scratch
  // environment and modules are undone in the finally block below.
  // Same driver selection as the server, so a missing native addon falls back
  // to node:sqlite opened read-only instead of failing the snapshot.
  const Database = loadDatabaseDriver();
  const ro = new Database(dbPath, { readonly: true, fileMustExist: true });
  let context;
  try {
    context = loadPricing();
    const { pricing } = context;
    // Capture rates, membership and usage together while other processes write
    // to the WAL. Release the read snapshot before calculating or writing TSV.
    ro.exec("BEGIN");
    const claudeRules = ro.prepare("SELECT * FROM model_pricing").all();
    const gptRules = ro.prepare("SELECT * FROM gpt_model_pricing").all();
    let cursorRules = [];
    try {
      cursorRules = ro.prepare("SELECT * FROM cursor_model_pricing").all();
    } catch {
      /* older databases have no cursor table */
    }
    const sessions = ro
      .prepare(
        "SELECT id, COALESCE(provider,'claude') AS provider, COALESCE(NULLIF(source,''),'local') AS source, started_at FROM sessions ORDER BY id"
      )
      .all();
    const tokenRows = ro
      .prepare(
        `SELECT session_id, model, speed, inference_geo, service_tier, context_size,
           input_tokens + baseline_input AS input_tokens,
           output_tokens + baseline_output AS output_tokens,
           cache_read_tokens + baseline_cache_read AS cache_read_tokens,
           cache_write_tokens + baseline_cache_write AS cache_write_tokens,
           cache_write_1h_tokens + baseline_cache_write_1h AS cache_write_1h_tokens,
           web_search_requests + baseline_web_search AS web_search_requests,
           web_fetch_requests + baseline_web_fetch AS web_fetch_requests,
           code_execution_requests + baseline_code_execution AS code_execution_requests
         FROM token_usage ORDER BY session_id`
      )
      .all();
    ro.exec("COMMIT");
    const bySession = new Map();
    for (const row of tokenRows) {
      if (!bySession.has(row.session_id)) bySession.set(row.session_id, []);
      bySession.get(row.session_id).push(row);
    }
    const lines = [COLUMNS.join("\t")];
    for (const s of sessions) {
      const rows = (bySession.get(s.id) || []).map((r) => ({ ...r, provider: s.provider }));
      const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
      const cost = pricing.calculateProviderCost(
        rows,
        claudeRules,
        gptRules,
        cursorRules,
        s.started_at
      ).total_cost;
      lines.push(
        [
          s.id,
          s.provider,
          s.source,
          sum("input_tokens"),
          sum("output_tokens"),
          sum("cache_read_tokens"),
          sum("cache_write_tokens"),
          sum("cache_write_1h_tokens"),
          sum("web_search_requests"),
          sum("web_fetch_requests"),
          sum("code_execution_requests"),
          Number(cost || 0).toFixed(6),
        ].join("\t")
      );
    }
    fs.writeFileSync(outPath, lines.join("\n") + "\n", { flag: "wx" });
    return { sessions: sessions.length, tokenRows: tokenRows.length };
  } finally {
    try {
      ro.close();
    } finally {
      try {
        context?.ownedDb?.close();
      } finally {
        try {
          if (context?.tmp) fs.rmSync(context.tmp, { recursive: true, force: true });
        } finally {
          context?.restore?.();
        }
      }
    }
  }
}

const DECIMAL = /^-?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/;

function readSnapshot(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const head = lines.shift().split("\t");
  if (head.join("\t") !== COLUMNS.join("\t"))
    throw new Error(`${file}: unsupported cost snapshot columns; regenerate both snapshots`);
  const map = new Map();
  for (const [index, line] of lines.entries()) {
    const fields = line.split("\t");
    // A short row or a non-numeric value would compare as NaN, and NaN never
    // differs, so the local-change gate could pass on an unreadable row. Accept
    // only finite plain decimals: Number() would read " " as 0, "0x10" as 16,
    // and "1e400" as Infinity (which never differs from another Infinity).
    if (
      fields.length !== COLUMNS.length ||
      !fields.slice(3).every((v) => DECIMAL.test(v) && Number.isFinite(+v))
    )
      throw new Error(
        `${file}: row ${index + 2} is incomplete or not numeric; regenerate the snapshot`
      );
    const [
      id,
      provider,
      source,
      input,
      output,
      cacheRead,
      cacheWrite,
      cacheWrite1h,
      webSearch,
      webFetch,
      codeExecution,
      cost,
    ] = fields;
    // A second row for the same session would silently replace the first, so a
    // local change could hide behind the duplicate.
    if (map.has(id))
      throw new Error(`${file}: row ${index + 2} duplicates session_id; regenerate the snapshot`);
    map.set(id, {
      provider,
      source,
      input: +input,
      output: +output,
      cacheRead: +cacheRead,
      cacheWrite: +cacheWrite,
      cacheWrite1h: +cacheWrite1h,
      webSearch: +webSearch,
      webFetch: +webFetch,
      codeExecution: +codeExecution,
      cost: +cost,
    });
  }
  return map;
}

/**
 * Compare two snapshots. A session counts as "local" when it is local in BOTH
 * snapshots; "source" when it belongs to a remote source in both; a session
 * whose owner (source or provider) differs between the two is reported apart
 * ("reassigned").
 */
function compareSnapshots(before, after) {
  const out = {
    local: { changed: [], unchanged: 0 },
    source: { changed: [], unchanged: 0 },
    reassigned: [],
    added: [],
    removed: [],
  };
  const differs = (a, b) =>
    a.input !== b.input ||
    a.output !== b.output ||
    a.cacheRead !== b.cacheRead ||
    a.cacheWrite !== b.cacheWrite ||
    a.cacheWrite1h !== b.cacheWrite1h ||
    a.webSearch !== b.webSearch ||
    a.webFetch !== b.webFetch ||
    a.codeExecution !== b.codeExecution ||
    Math.abs(a.cost - b.cost) >= 0.000001;
  for (const [id, a] of before) {
    const b = after.get(id);
    if (!b) {
      out.removed.push({ id, source: a.source, cost: a.cost });
      continue;
    }
    const entry = { id, source: b.source, before: a, after: b, delta: b.cost - a.cost };
    if (a.source !== b.source || a.provider !== b.provider) {
      out.reassigned.push({
        ...entry,
        from: a.source,
        to: b.source,
        fromProvider: a.provider,
        toProvider: b.provider,
      });
      continue;
    }
    const bucket = a.source === "local" ? out.local : out.source;
    if (differs(a, b)) bucket.changed.push(entry);
    else bucket.unchanged++;
  }
  for (const [id, b] of after) {
    if (!before.has(id)) out.added.push({ id, source: b.source, cost: b.cost });
  }
  return out;
}

function formatReport(result, limit = 20) {
  const sum = (arr, f) => arr.reduce((acc, x) => acc + f(x), 0);
  const money = (n) => (n >= 0 ? "+" : "") + n.toFixed(4);
  const lines = [];
  for (const [name, bucket] of [
    ["LOCAL sessions", result.local],
    ["SOURCE sessions", result.source],
  ]) {
    lines.push(
      `${name}: changed=${bucket.changed.length} unchanged=${bucket.unchanged} cost_delta_usd=${money(
        sum(bucket.changed, (e) => e.delta)
      )}`
    );
    const top = [...bucket.changed].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    for (const e of top.slice(0, limit)) {
      lines.push(
        `  ${e.id}\t${e.source}\t${e.before.cost.toFixed(4)} -> ${e.after.cost.toFixed(4)}\t(${money(e.delta)})`
      );
    }
  }
  lines.push(`REASSIGNED (owner differs between snapshots): ${result.reassigned.length}`);
  for (const e of result.reassigned.slice(0, limit)) {
    lines.push(
      `  ${e.id}\t${e.fromProvider}/${e.from} -> ${e.toProvider}/${e.to}\t(${money(e.delta)})`
    );
  }
  lines.push(`ADDED sessions: ${result.added.length}  REMOVED sessions: ${result.removed.length}`);
  return lines.join("\n");
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === "snapshot") {
    const out = flag("--out");
    if (!out) throw new Error("--out <file.tsv> is required");
    const info = takeSnapshot(flag("--db") || defaultDbPath(), out);
    console.log(`snapshot: ${info.sessions} sessions, ${info.tokenRows} token rows -> ${out}`);
    return 0;
  }
  if (cmd === "compare") {
    const files = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--limit"));
    if (files.length !== 2) throw new Error("compare needs <before.tsv> <after.tsv>");
    const result = compareSnapshots(readSnapshot(files[0]), readSnapshot(files[1]));
    console.log(formatReport(result, Number(flag("--limit")) || 20));
    const localChanged =
      result.local.changed.length > 0 ||
      result.reassigned.some((entry) => entry.from === "local" || entry.to === "local") ||
      result.removed.some((entry) => entry.source === "local");
    return rest.includes("--fail-on-local-change") && localChanged ? 1 : 0;
  }
  throw new Error(
    "usage: cost-snapshot.js snapshot [--db f] --out f.tsv | compare before.tsv after.tsv [--limit N] [--fail-on-local-change]"
  );
}

if (require.main === module) {
  require("../server/lib/dotenv").loadDotEnv();
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
  }
}

module.exports = { takeSnapshot, readSnapshot, compareSnapshots, formatReport };
