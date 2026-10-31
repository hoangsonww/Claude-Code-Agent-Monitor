/**
 * @file Executes backend-defined aggregate and event-page reads outside the HTTP thread using
 * a read-only connection. Opens no application DB module and runs no migrations.
 * Each connection closes before its result is delivered, including on errors.
 * An event page that carries a size query is measured in SQLite before any row
 * becomes a JS value; a page over the byte budget is reported, not materialized.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { parentPort, workerData } = require("node:worker_threads");
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
function readEventRows(db, page) {
  if (!page.sizeSql) return readQuery(db, { ...page, op: "all" });
  const sizes = readQuery(db, { sql: page.sizeSql, params: page.params, op: "all" });
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
    parentPort.postMessage({ id, started: true });
    result = readQuery(db, query);
    db.exec("COMMIT");
  } catch (caught) {
    error = caught.message || String(caught);
  } finally {
    if (db) {
      try {
        db.close();
      } catch (caught) {
        error = error || caught.message;
      }
    }
  }
  parentPort.postMessage({ id, result, error });
});
