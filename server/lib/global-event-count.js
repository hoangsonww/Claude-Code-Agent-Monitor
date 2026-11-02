/**
 * @file Maintains transactional global and per-session event counts and validates their derived
 * schema, persisted schema version and trust flag in the reader's snapshot.
 * Incomplete or tainted state falls back to COUNT; readers never repair it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const TABLE = "monitor_event_count";
const SESSION_TABLE = "monitor_session_event_counts";
const DEFINITIONS = {
  [TABLE]: `CREATE TABLE monitor_event_count (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    total INTEGER NOT NULL CHECK (total >= 0),
    trusted INTEGER NOT NULL CHECK (trusted IN (0, 1)),
    schema_version INTEGER NOT NULL
  )`,
  [SESSION_TABLE]: `CREATE TABLE monitor_session_event_counts (
    session_id TEXT PRIMARY KEY NOT NULL,
    total INTEGER NOT NULL CHECK (total >= 0)
  ) WITHOUT ROWID`,
  monitor_event_count_insert: `CREATE TRIGGER monitor_event_count_insert AFTER INSERT ON events
    WHEN (SELECT trusted FROM monitor_event_count WHERE singleton = 1) = 1
    BEGIN
      UPDATE monitor_event_count SET total = total + 1 WHERE singleton = 1;
      INSERT INTO monitor_session_event_counts(session_id,total)
        SELECT NEW.session_id,1 WHERE NEW.session_id IS NOT NULL
        ON CONFLICT(session_id) DO UPDATE SET total=total+1;
    END`,
  monitor_event_count_delete: `CREATE TRIGGER monitor_event_count_delete AFTER DELETE ON events
    WHEN (SELECT trusted FROM monitor_event_count WHERE singleton = 1) = 1
    BEGIN
      UPDATE monitor_event_count SET trusted=0 WHERE singleton=1 AND (
        total < 1 OR (OLD.session_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM monitor_session_event_counts WHERE session_id=OLD.session_id AND total>=1)));
      UPDATE monitor_event_count SET total=total-1 WHERE singleton=1 AND trusted=1;
      UPDATE monitor_session_event_counts SET total=total-1 WHERE session_id=OLD.session_id
        AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1;
      DELETE FROM monitor_session_event_counts WHERE session_id=OLD.session_id AND total=0
        AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1;
    END`,
  monitor_event_count_session_update: `CREATE TRIGGER monitor_event_count_session_update
    AFTER UPDATE OF session_id ON events
    WHEN OLD.session_id IS NOT NEW.session_id
      AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1
    BEGIN
      UPDATE monitor_event_count SET trusted=0 WHERE singleton=1 AND OLD.session_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM monitor_session_event_counts WHERE session_id=OLD.session_id AND total>=1);
      UPDATE monitor_session_event_counts SET total=total-1 WHERE session_id=OLD.session_id
        AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1;
      DELETE FROM monitor_session_event_counts WHERE session_id=OLD.session_id AND total=0
        AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1;
      INSERT INTO monitor_session_event_counts(session_id,total)
        SELECT NEW.session_id,1 WHERE NEW.session_id IS NOT NULL
          AND (SELECT trusted FROM monitor_event_count WHERE singleton=1)=1
        ON CONFLICT(session_id) DO UPDATE SET total=total+1;
    END`,
  // Conservatively taint conflicts under either recursive-trigger setting.
  // Ordinary table reads work with trusted_schema OFF; no PRAGMA TVF is used.
  monitor_event_count_conflict_insert: `CREATE TRIGGER monitor_event_count_conflict_insert
    BEFORE INSERT ON events
    WHEN (SELECT trusted FROM monitor_event_count WHERE singleton = 1) = 1
      AND EXISTS (SELECT 1 FROM events WHERE id = NEW.id)
    BEGIN UPDATE monitor_event_count SET trusted = 0 WHERE singleton = 1; END`,
  monitor_event_count_conflict_update: `CREATE TRIGGER monitor_event_count_conflict_update
    BEFORE UPDATE ON events
    WHEN (SELECT trusted FROM monitor_event_count WHERE singleton = 1) = 1
      AND EXISTS (SELECT 1 FROM events WHERE id = NEW.id AND id != OLD.id)
    BEGIN UPDATE monitor_event_count SET trusted = 0 WHERE singleton = 1; END`,
};
const normalize = (sql) => sql.replace(/\s+/g, " ").trim().replace(/;$/, "").toLowerCase();
function hasExtraUniqueIndex(db) {
  return !!db
    .prepare(
      `SELECT 1 FROM pragma_index_list('events') WHERE "unique" = 1 AND origin != 'pk' LIMIT 1`
    )
    .get();
}
function validSchema(db) {
  const names = Object.keys(DEFINITIONS);
  const rows = db
    .prepare(
      `SELECT name, sql FROM sqlite_master WHERE name IN (${names.map(() => "?").join(",")})`
    )
    .all(...names);
  return (
    rows.length === names.length &&
    rows.every((row) => row.sql && normalize(row.sql) === normalize(DEFINITIONS[row.name]))
  );
}
function trustedGlobalEventCount(db) {
  if (!validSchema(db) || hasExtraUniqueIndex(db)) return null;
  const row = db
    .prepare("SELECT total, trusted, schema_version FROM monitor_event_count WHERE singleton = 1")
    .get();
  // DDL, including DROP/recreate of identical triggers, advances the schema
  // version. Even unrelated DDL conservatively disables this shortcut until
  // rebuild. Never cache the cookie: rollback/DDL can make a cached value stale.
  return row?.trusted === 1 &&
    Number.isSafeInteger(row.total) &&
    row.total >= 0 &&
    row.schema_version === db.pragma("schema_version", { simple: true })
    ? row.total
    : null;
}
function resolveEventCountSql(db, sql, counterSql = null) {
  if (counterSql !== null && (typeof counterSql !== "string" || !/^\s*SELECT\b/i.test(counterSql)))
    throw new Error("Only SELECT reads are supported");
  const global = /^\s*SELECT\s+COUNT\(\*\)\s+AS\s+count\s+FROM\s+events\s*$/i.test(sql);
  if ((global || counterSql !== null) && trustedGlobalEventCount(db) !== null)
    return counterSql || "SELECT total AS count FROM monitor_event_count WHERE singleton = 1";
  return sql;
}
function globalEventCountSql(db) {
  return resolveEventCountSql(db, "SELECT COUNT(*) AS count FROM events");
}

/** Rebuild only our derived objects; no event or token data is rewritten. */
function ensureGlobalEventCount(db, { rebuild = false } = {}) {
  const extraUnique = hasExtraUniqueIndex(db);
  if (
    !rebuild &&
    extraUnique &&
    validSchema(db) &&
    db.prepare("SELECT singleton FROM monitor_event_count WHERE singleton=1").get()
  ) {
    db.prepare("UPDATE monitor_event_count SET trusted=0 WHERE singleton=1").run();
    return false;
  }
  if (!rebuild && trustedGlobalEventCount(db) !== null) return false;
  // The write transaction fences COUNT, singleton publication and installation
  // of all triggers. Other readers see the old snapshot or the complete result.
  try {
    db.transaction(() => {
      for (const name of Object.keys(DEFINITIONS).filter(
        (name) => name !== TABLE && name !== SESSION_TABLE
      ))
        db.exec(`DROP TRIGGER IF EXISTS ${name}`);
      db.exec(`DROP TABLE IF EXISTS ${TABLE}`);
      db.exec(`DROP TABLE IF EXISTS ${SESSION_TABLE}`);
      db.exec(DEFINITIONS[TABLE]);
      db.exec(DEFINITIONS[SESSION_TABLE]);
      const total = db.prepare("SELECT COUNT(*) AS count FROM events").get().count;
      db.prepare(
        "INSERT INTO monitor_event_count(singleton,total,trusted,schema_version) VALUES(1,?,?,0)"
      ).run(total, extraUnique ? 0 : 1);
      db.exec(`INSERT INTO monitor_session_event_counts(session_id,total)
        SELECT session_id,COUNT(*) FROM events WHERE session_id IS NOT NULL GROUP BY session_id`);
      for (const [name, sql] of Object.entries(DEFINITIONS))
        if (name !== TABLE && name !== SESSION_TABLE) db.exec(sql);
      const version = db.pragma("schema_version", { simple: true });
      db.prepare("UPDATE monitor_event_count SET schema_version=? WHERE singleton=1").run(version);
      const row = db
        .prepare("SELECT total,trusted,schema_version FROM monitor_event_count WHERE singleton=1")
        .get();
      if (
        !validSchema(db) ||
        row?.total !== total ||
        row.trusted !== (extraUnique ? 0 : 1) ||
        row.schema_version !== version
      )
        throw new Error("Global event count publication failed");
    })();
  } catch (error) {
    // A rolled-back rebuild can restore incomplete old objects. Disable only
    // our triggers in that case so they cannot block ordinary event writes;
    // metadata validation then forces the exact legacy read until next repair.
    try {
      if (trustedGlobalEventCount(db) === null)
        db.transaction(() => {
          for (const name of Object.keys(DEFINITIONS).filter(
            (name) => name !== TABLE && name !== SESSION_TABLE
          ))
            db.exec(`DROP TRIGGER IF EXISTS ${name}`);
        })();
    } catch (cleanupError) {
      throw new Error(
        `Global event count initialization failed: ${error.message}; disabling counter triggers failed: ${cleanupError.message}`,
        { cause: error }
      );
    }
    throw error;
  }
  return true;
}
module.exports = {
  globalEventCountSql,
  resolveEventCountSql,
  trustedGlobalEventCount,
  ensureGlobalEventCount,
};
