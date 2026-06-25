/**
 * @file Local-first backup bundle + idempotent restore engine. Pure-ish data
 * layer with NO Express dependency: it reads the six monitor tables into a
 * versioned, self-describing bundle and merges a bundle back in with
 * append-only INSERT-OR-IGNORE semantics (existing local rows are never
 * overwritten) plus a configurable conflict strategy for the one mutable
 * table (model_pricing).
 *
 * Design invariants:
 *   • Idempotent — reapplying the same bundle inserts zero duplicate rows
 *     (every append-only table is INSERT OR IGNORE by primary key).
 *   • Atomic — applyRestore runs the whole merge inside a single
 *     db.transaction; any error rolls back every table, committing nothing.
 *   • Read-only planning — planRestore (dry-run) inspects the DB with
 *     existence checks only and never writes.
 *   • Migration-safe — inserts use the column intersection of the incoming
 *     row and the REAL table schema (PRAGMA table_info), so a bundle written
 *     by another app version (extra/missing columns) still imports cleanly.
 *   • Compatibility-gated — a bundle whose schema_version is newer than this
 *     server understands is rejected rather than half-read.
 *
 * The HTTP surface lives in server/routes/backup.js; this module owns no
 * routing and performs DB writes only inside applyRestore's transaction.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const path = require("path");

/** Manifest format tag — distinguishes a backup bundle from the legacy raw
 * /api/settings/export dump and from any other JSON the user might POST. */
const BACKUP_FORMAT = "agent-monitor-backup";

/** Bundle schema version. Bump only on a backwards-incompatible bundle shape
 * change; a bundle with a HIGHER version than this is refused (the server
 * can't safely read a format from the future). */
const SCHEMA_VERSION = 1;

/**
 * Append-only tables: history that must never be mutated on restore. Merge is
 * INSERT OR IGNORE by primary key, so an incoming row whose PK already exists
 * locally is skipped (local copy preserved), and reapplying a bundle is a
 * no-op. Each entry maps the table to its primary-key column(s).
 */
const APPEND_ONLY = {
  sessions: ["id"],
  agents: ["id"],
  events: ["id"],
  token_usage: ["session_id", "model", "speed", "inference_geo", "service_tier"],
  dashboard_runs: ["id"],
};

/**
 * Mutable tables: user-tunable configuration where the incoming bundle may
 * legitimately want to update an existing row. Restore takes a conflict
 * strategy (keep_local | use_incoming). model_pricing is keyed by its single
 * model_pattern column.
 */
const MUTABLE = {
  model_pricing: ["model_pattern"],
};

/** Every table the bundle covers, in a stable order (append-only first, then
 * mutable). Restore applies them in this order inside one transaction. */
const BACKUP_TABLES = [...Object.keys(APPEND_ONLY), ...Object.keys(MUTABLE)];

/** Primary key columns for any backed-up table. */
function primaryKey(table) {
  return APPEND_ONLY[table] || MUTABLE[table] || null;
}

/**
 * Read the REAL column set of a table from the live schema. Used to build
 * column-intersection inserts so a bundle from another version (extra or
 * missing columns) still imports against whatever this DB actually has.
 * @returns {string[]} ordered column names
 */
function tableColumns(db, table) {
  // PRAGMA table_info can't be parameterized; table names come only from the
  // fixed BACKUP_TABLES allow-list, never user input, so interpolation is safe.
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
}

/**
 * Build a parameterized INSERT for `table` restricted to the columns present
 * in BOTH `row` and the table's real schema (the column intersection).
 * Unknown columns in the row are ignored; columns missing from the row are
 * omitted (the table default applies). Returns null when the intersection is
 * empty (nothing insertable).
 *
 * @param {object} opts
 * @param {string[]} opts.tableCols  real table columns (from tableColumns)
 * @param {object}   opts.row        the incoming row object
 * @param {"ignore"|"replace"} [opts.conflict="ignore"] OR-clause strategy
 * @returns {{ sql: string, columns: string[] } | null}
 */
function buildInsert({ table, tableCols, row, conflict = "ignore" }) {
  const tableColSet = new Set(tableCols);
  // Preserve table column order for deterministic SQL.
  const columns = tableCols.filter(
    (c) => tableColSet.has(c) && Object.prototype.hasOwnProperty.call(row, c)
  );
  if (columns.length === 0) return null;
  const orClause = conflict === "replace" ? "OR REPLACE" : "OR IGNORE";
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT ${orClause} INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  return { sql, columns };
}

/** Resolve the running app version from package.json (best-effort). */
function appVersion() {
  try {
    return require(path.join(__dirname, "..", "..", "package.json")).version || "unknown";
  } catch {
    return "unknown";
  }
}

/** Read every row of a table, ordered by primary key for stable bundles. */
function readTable(db, table) {
  const pk = primaryKey(table);
  const orderBy = pk && pk.length ? ` ORDER BY ${pk.join(", ")}` : "";
  return db.prepare(`SELECT * FROM ${table}${orderBy}`).all();
}

/**
 * Build a full backup bundle: every covered table's rows plus a manifest with
 * per-table counts and the running app version.
 * @param {object} dbModule  the require("../db") module ({ db })
 * @returns {object} bundle
 */
function buildBundle(dbModule) {
  const { db } = dbModule;
  const data = {};
  const counts = {};
  for (const table of BACKUP_TABLES) {
    const rows = readTable(db, table);
    data[table] = rows;
    counts[table] = rows.length;
  }
  return {
    manifest: {
      format: BACKUP_FORMAT,
      schema_version: SCHEMA_VERSION,
      app_version: appVersion(),
      created_at: new Date().toISOString(),
      counts,
    },
    data,
  };
}

/**
 * Validate a bundle's structure and compatibility WITHOUT touching the DB.
 *
 * Fatal (compatible:false, ok:false): missing/non-object manifest, wrong
 * `format`, non-integer `schema_version`, a `schema_version` GREATER than this
 * server's SCHEMA_VERSION (a bundle from a newer version we can't safely read),
 * or `data` that isn't an object. An OLDER schema_version is accepted
 * (forward-only gate). Unknown extra tables in `data` are reported as an
 * informational issue but are not fatal.
 *
 * @param {object} bundle
 * @returns {{ ok: boolean, compatible: boolean, manifest: object|null, issues: string[] }}
 */
function validateBundle(bundle) {
  const issues = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return { ok: false, compatible: false, manifest: null, issues: ["bundle is not an object"] };
  }

  const manifest = bundle.manifest;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    issues.push("manifest is missing or not an object");
    return { ok: false, compatible: false, manifest: null, issues };
  }

  if (manifest.format !== BACKUP_FORMAT) {
    issues.push(
      `unexpected manifest.format: expected "${BACKUP_FORMAT}", got "${manifest.format}"`
    );
  }

  const sv = manifest.schema_version;
  if (!Number.isInteger(sv)) {
    issues.push("manifest.schema_version is missing or not an integer");
  } else if (sv > SCHEMA_VERSION) {
    issues.push(
      `bundle schema_version ${sv} is newer than this server supports (${SCHEMA_VERSION})`
    );
  }

  if (!bundle.data || typeof bundle.data !== "object" || Array.isArray(bundle.data)) {
    issues.push("data is missing or not an object");
  } else {
    // Informational only: tables the server doesn't know about are skipped on
    // restore, never an error.
    for (const key of Object.keys(bundle.data)) {
      if (!BACKUP_TABLES.includes(key)) {
        issues.push(`unknown table in data (will be skipped): ${key}`);
      }
    }
  }

  // Compatibility = the gate that decides whether restore may proceed. The
  // unknown-table note is informational, so don't let it flip compatibility.
  const fatal = issues.filter((m) => !m.startsWith("unknown table in data"));
  const compatible = fatal.length === 0;

  // The normalized manifest we echo back to clients (only the safe fields).
  const safeManifest = {
    schema_version: sv,
    app_version: manifest.app_version,
    created_at: manifest.created_at,
    counts: manifest.counts && typeof manifest.counts === "object" ? manifest.counts : {},
  };

  return { ok: compatible, compatible, manifest: compatible ? safeManifest : null, issues };
}

/** Coerce a table's incoming rows to an array (tolerate missing/garbage). */
function rowsOf(bundle, table) {
  const rows = bundle && bundle.data ? bundle.data[table] : undefined;
  return Array.isArray(rows) ? rows : [];
}

/** Build a prepared existence-check ("does this PK already exist?") for a table. */
function makeExistsStmt(db, table) {
  const pk = primaryKey(table);
  const where = pk.map((c) => `${c} = ?`).join(" AND ");
  return db.prepare(`SELECT 1 FROM ${table} WHERE ${where} LIMIT 1`);
}

/** Extract a row's primary-key values, in PK column order. Missing columns are
 * coerced to null so the value always binds (never throws on a partial row). */
function pkValues(row, pk) {
  return pk.map((c) => (Object.prototype.hasOwnProperty.call(row, c) ? row[c] : null));
}

/** True when a row carries every primary-key column with a non-null value. A
 * row without a complete PK can be neither deduped nor restored idempotently
 * (it would insert a NULL-keyed row, or duplicate on every re-apply), so such
 * rows are reported and skipped rather than written. */
function hasCompletePk(row, pk) {
  return pk.every((c) => row[c] != null);
}

/** Compare an incoming row to a local row across the table's real columns
 * (intersection). Returns true when any shared, non-PK column differs. */
function rowDiffers(incoming, local, tableCols, pk) {
  const pkSet = new Set(pk);
  for (const col of tableCols) {
    if (pkSet.has(col)) continue;
    if (!Object.prototype.hasOwnProperty.call(incoming, col)) continue;
    // Loose compare: SQLite stores numbers/strings; normalize via String() so a
    // numeric 5 and "5" don't register as a spurious conflict.
    const a = incoming[col];
    const b = local[col];
    if (a === b) continue;
    if (a == null && b == null) continue;
    if (String(a) !== String(b)) return true;
  }
  return false;
}

/**
 * Dry-run: compute a per-table merge preview with ZERO mutation. Uses
 * existence checks (and, for model_pricing, a value comparison) only.
 *
 * @param {object} dbModule
 * @param {object} bundle
 * @param {{ pricingStrategy?: "keep_local"|"use_incoming" }} [opts]
 * @returns {{ compatible: boolean, issues: string[], summary: object, pricing_strategy: string }}
 */
function planRestore(dbModule, bundle, { pricingStrategy = "keep_local" } = {}) {
  const { db } = dbModule;
  const strategy = pricingStrategy === "use_incoming" ? "use_incoming" : "keep_local";
  const validation = validateBundle(bundle);
  const summary = {};

  if (!validation.compatible) {
    return {
      compatible: false,
      issues: validation.issues,
      summary,
      pricing_strategy: strategy,
    };
  }

  // Append-only tables: to_insert vs already_present by PK existence.
  for (const table of Object.keys(APPEND_ONLY)) {
    const pk = APPEND_ONLY[table];
    const exists = makeExistsStmt(db, table);
    const rows = rowsOf(bundle, table);
    let toInsert = 0;
    let alreadyPresent = 0;
    let invalid = 0;
    for (const row of rows) {
      if (!hasCompletePk(row, pk)) {
        invalid++;
        continue;
      }
      const present = exists.get(...pkValues(row, pk));
      if (present) alreadyPresent++;
      else toInsert++;
    }
    summary[table] = {
      incoming: rows.length,
      to_insert: toInsert,
      already_present: alreadyPresent,
      invalid,
    };
  }

  // model_pricing: classify into new / identical / conflicting; would_update is
  // the subset use_incoming would overwrite (only conflicts, never identicals).
  {
    const table = "model_pricing";
    const pk = MUTABLE[table];
    const tableCols = tableColumns(db, table);
    const getLocal = db.prepare(`SELECT * FROM ${table} WHERE ${pk[0]} = ? LIMIT 1`);
    const rows = rowsOf(bundle, table);
    let toInsert = 0;
    let conflicts = 0;
    let invalid = 0;
    for (const row of rows) {
      if (!hasCompletePk(row, pk)) {
        invalid++;
        continue;
      }
      const local = getLocal.get(row[pk[0]]);
      if (!local) {
        toInsert++;
      } else if (rowDiffers(row, local, tableCols, pk)) {
        conflicts++;
      }
      // present + identical → neither inserted nor a conflict (true no-op)
    }
    summary[table] = {
      incoming: rows.length,
      to_insert: toInsert,
      conflicts,
      invalid,
      would_update: strategy === "use_incoming" ? conflicts : 0,
    };
  }

  return { compatible: true, issues: validation.issues, summary, pricing_strategy: strategy };
}

/**
 * Apply a bundle's merge inside a SINGLE transaction (atomic — any throw rolls
 * everything back). Append-only tables use INSERT OR IGNORE; model_pricing
 * uses INSERT OR IGNORE (keep_local) or INSERT OR REPLACE (use_incoming).
 * Inserts are column-intersection + parameterized.
 *
 * @param {object} dbModule
 * @param {object} bundle
 * @param {{ pricingStrategy?: "keep_local"|"use_incoming" }} [opts]
 * @returns {{ applied: object, total_inserted: number }}
 * @throws if the bundle is incompatible (caller should validate first / map to 400)
 */
function applyRestore(dbModule, bundle, { pricingStrategy = "keep_local" } = {}) {
  const { db } = dbModule;
  const strategy = pricingStrategy === "use_incoming" ? "use_incoming" : "keep_local";

  const validation = validateBundle(bundle);
  if (!validation.compatible) {
    const err = new Error("incompatible backup bundle: " + validation.issues.join("; "));
    err.code = "INCOMPATIBLE_BUNDLE";
    err.issues = validation.issues;
    throw err;
  }

  // Pre-compute column intersections so the transaction body stays tight.
  const colsByTable = {};
  for (const table of BACKUP_TABLES) colsByTable[table] = tableColumns(db, table);

  const run = db.transaction(() => {
    const applied = {};
    let totalInserted = 0;

    // Append-only tables — INSERT OR IGNORE by PK.
    for (const table of Object.keys(APPEND_ONLY)) {
      const tableCols = colsByTable[table];
      const pk = APPEND_ONLY[table];
      const rows = rowsOf(bundle, table);
      let inserted = 0;
      let invalid = 0;
      for (const row of rows) {
        // Skip PK-incomplete rows so we never write a NULL-keyed row or one that
        // would duplicate on re-apply (keeps restore idempotent + matches the
        // dry-run preview, which counts these as `invalid`).
        if (!hasCompletePk(row, pk)) {
          invalid++;
          continue;
        }
        const built = buildInsert({ table, tableCols, row, conflict: "ignore" });
        if (!built) continue;
        const info = db.prepare(built.sql).run(...built.columns.map((c) => row[c]));
        inserted += info.changes; // 0 when the PK already existed (ignored)
      }
      applied[table] = { inserted, skipped: rows.length - inserted - invalid, invalid };
      totalInserted += inserted;
    }

    // model_pricing — keep_local (IGNORE) or use_incoming (REPLACE). An overwrite
    // is only counted (and only performed) when the incoming row actually differs
    // from the local one, so `updated` matches the dry-run's `would_update` and
    // identical rows are a true no-op.
    {
      const table = "model_pricing";
      const pk = MUTABLE[table];
      const tableCols = colsByTable[table];
      const getLocal = db.prepare(`SELECT * FROM ${table} WHERE ${pk[0]} = ? LIMIT 1`);
      const rows = rowsOf(bundle, table);
      let inserted = 0;
      let updated = 0;
      let invalid = 0;
      for (const row of rows) {
        if (!hasCompletePk(row, pk)) {
          invalid++;
          continue;
        }
        const local = getLocal.get(row[pk[0]]);
        if (!local) {
          const built = buildInsert({ table, tableCols, row, conflict: "ignore" });
          if (built) {
            db.prepare(built.sql).run(...built.columns.map((c) => row[c]));
            inserted++;
          }
        } else if (strategy === "use_incoming" && rowDiffers(row, local, tableCols, pk)) {
          const built = buildInsert({ table, tableCols, row, conflict: "replace" });
          if (built) {
            db.prepare(built.sql).run(...built.columns.map((c) => row[c]));
            updated++;
          }
        }
        // present + (keep_local OR identical) → kept local, counted as skipped.
      }
      applied[table] = {
        inserted,
        updated,
        skipped: rows.length - inserted - updated - invalid,
        invalid,
      };
      totalInserted += inserted;
    }

    return { applied, total_inserted: totalInserted };
  });

  return run();
}

module.exports = {
  BACKUP_FORMAT,
  SCHEMA_VERSION,
  BACKUP_TABLES,
  APPEND_ONLY,
  MUTABLE,
  buildBundle,
  validateBundle,
  planRestore,
  applyRestore,
  tableColumns,
  buildInsert,
};
