/**
 * @file Executes backend-defined aggregate, cost snapshot, task-event and event-page reads outside the HTTP thread using
 * a read-only connection. Opens no application DB module and runs no migrations.
 * Each connection closes before its result is delivered, including on errors.
 * An event page that carries a size query is measured in SQLite before any row
 * becomes a JS value; a page over the byte budget is reported, not materialized.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { parentPort, workerData } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const scoped = require("./scoped-stats");

let Database;
try {
  if (workerData.driver === "compat") throw new Error("use compatibility driver");
  Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch (error) {
  if (workerData.driver === "native") throw error;
  Database = require("../compat-sqlite");
}

// Page rows are fetched by id after measuring, so the page filter runs once.
// A full probe page is authoritative, exactly as in the "page" op below.
function readEventRows(db, page) {
  if (!page.sizeSql) return readQuery(db, { ...page, op: page.probe ? "page" : "all" });
  if (page.probe) {
    const sizes = readQuery(db, { sql: page.probe.sizeSql, params: page.probe.params, op: "all" });
    if (sizes.length === page.probe.limit) return fetchMeasured(db, page, sizes);
  }
  const sizes = readQuery(db, { sql: page.sizeSql, params: page.params, op: "all" });
  return fetchMeasured(db, page, sizes);
}

function fetchMeasured(db, page, sizes) {
  let bytes = 0;
  for (const row of sizes) bytes += Number(row.bytes) || 0;
  if (bytes > workerData.eventPageBudgetBytes) return null;
  if (!sizes.length) return [];
  const rows = readQuery(db, {
    sql: page.fetchSql,
    params: [JSON.stringify(sizes.map((row) => row.id))],
    op: "all",
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return sizes.map((row) => byId.get(row.id));
}

function readQuery(db, query) {
  if (query.op === "eventPage") {
    const events = readEventRows(db, query.page);
    if (!events) return { overflow: true };
    const { count: total } = readQuery(db, { ...query.count, op: "get" });
    return { events, total };
  }
  if (query.op === "page") {
    const rows = readQuery(db, { op: "all", ...query.probe });
    // A full page inside an ordered global prefix is already authoritative:
    // every unseen row sorts after it. Sparse/old filters use the exact general
    // query on this SAME snapshot, without another queue slot or deadline.
    if (rows.length === query.probe.limit) return rows;
    return readQuery(db, { ...query, op: "all" });
  }
  if (query.op === "cost") {
    return {
      dailyTokens: readQuery(db, { ...query, op: "all" }),
      rules: db.prepare("SELECT * FROM model_pricing ORDER BY display_name ASC").all(),
      gptRules: db.prepare("SELECT * FROM gpt_model_pricing ORDER BY display_name ASC").all(),
      cursorRules: db.prepare("SELECT * FROM cursor_model_pricing ORDER BY display_name ASC").all(),
    };
  }
  if (query.op === "get" || query.op === "all") {
    if (typeof query.sql !== "string" || !/^\s*SELECT\b/i.test(query.sql))
      throw new Error("Only SELECT reads are supported");
    const statement = db.prepare(query.sql);
    return query.op === "get"
      ? statement.get(...(query.params || []))
      : statement.all(...(query.params || []));
  }
  if (query.op !== "stats") throw new Error("Unsupported database read");
  const { sources, providers, todayStart } = query;
  const isScoped = !!sources || !!providers;
  // One read transaction keeps overview, status distributions and today's
  // count on the same snapshot even while the HTTP thread accepts new hooks.
  const overview = isScoped
    ? scoped.statsOverview(db, sources, providers)
    : db.prepare(scoped.GLOBAL_STATS_SQL).get();
  const agents = isScoped
    ? scoped.agentStatusCounts(db, sources, providers)
    : db.prepare("SELECT status, COUNT(*) as count FROM agents GROUP BY status").all();
  const sessions = isScoped
    ? scoped.sessionStatusCounts(db, sources, providers)
    : db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status").all();
  const today = isScoped
    ? scoped.countEventsToday(db, sources, providers, todayStart)
    : db.prepare("SELECT COUNT(*) as count FROM events WHERE created_at >= ?").get(todayStart);
  return {
    ...overview,
    events_today: today?.count ?? 0,
    agents_by_status: Object.fromEntries(agents.map((row) => [row.status, row.count])),
    sessions_by_status: Object.fromEntries(sessions.map((row) => [row.status, row.count])),
  };
}

parentPort.on("message", ({ id, query }) => {
  const receivedAt = Date.now();
  const receivedClock = performance.now();
  const timing = { receivedAt };
  let db;
  let result;
  let error;
  try {
    db = new Database(workerData.dbPath, { readonly: true, fileMustExist: true });
    db.pragma("query_only = ON");
    db.pragma("busy_timeout = 1000");
    db.exec("BEGIN");
    // Pin the WAL read snapshot before reporting start; a concurrent writer
    // cannot change this read's generation halfway through its aggregates.
    db.prepare("SELECT name FROM sqlite_master LIMIT 1").get();
    timing.startedAt = Date.now();
    timing.openMs = performance.now() - receivedClock;
    const readClock = performance.now();
    parentPort.postMessage({ id, started: true, timing: { ...timing } });
    result = readQuery(db, query);
    timing.readMs = performance.now() - readClock;
    db.exec("COMMIT");
  } catch (caught) {
    error = caught.message || String(caught);
  } finally {
    const closeClock = performance.now();
    if (db) {
      try {
        db.close();
      } catch (caught) {
        error = error || caught.message;
      }
    }
    timing.closeMs = performance.now() - closeClock;
    timing.completedAt = Date.now();
  }
  parentPort.postMessage({ id, result, error, timing });
});
