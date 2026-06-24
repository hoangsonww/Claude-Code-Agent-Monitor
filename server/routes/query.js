/**
 * @file Express router for the safe Query Explorer (mounted at /api/query).
 * Accepts a structured DSL query, validates it against a strict allowlist
 * (server/lib/query-dsl.js), compiles it to fully parameterized SQL, and runs
 * it read-only against the dashboard DB. Also exposes the schema for the UI and
 * CRUD for saved queries. No user value ever reaches SQL except through a `?`
 * placeholder; column/table names come only from the validated allowlist.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const { db } = require("../db");
const { SCHEMA, validateQuery, compile, toCsv } = require("../lib/query-dsl");

const router = Router();

// Wrap an async-free handler so any thrown error becomes a structured 500
// instead of an unhandled crash (matches the repo's structured-error style).
function safe(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  };
}

// Parse a saved_queries row's JSON columns back into objects for the response.
function serializeSaved(row) {
  let query = null;
  let tags = [];
  try {
    query = JSON.parse(row.query);
  } catch {
    /* leave as null rather than failing the whole list */
  }
  try {
    tags = row.tags ? JSON.parse(row.tags) : [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    name: row.name,
    entity: row.entity,
    query,
    tags,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// POST /api/query/run?format=csv|json — validate + run a structured query.
router.post(
  "/run",
  safe((req, res) => {
    const result = validateQuery(req.body);
    if (!result.ok) {
      return res.status(400).json({ error: { message: result.error } });
    }
    const query = result.query;
    const { sql, params, countSql, countParams, columns } = compile(query);

    const start = process.hrtime.bigint();
    const rows = db.prepare(sql).all(...params);
    const { count: total } = db.prepare(countSql).get(...countParams);
    const tookMs = Number(process.hrtime.bigint() - start) / 1e6;

    const warnings = [];
    if (total > query.limit) {
      warnings.push(`Result truncated to ${query.limit} rows; refine filters or paginate.`);
    }

    const format = req.query.format === "csv" ? "csv" : "json";
    if (format === "csv") {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="query-${query.entity}-${ts}.csv"`
      );
      return res.send(toCsv(columns, rows));
    }

    res.json({
      entity: query.entity,
      columns,
      rows,
      total,
      limit: query.limit,
      offset: query.offset,
      truncated: query.offset + rows.length < total,
      tookMs,
      warnings,
    });
  })
);

// GET /api/query/schema — the entity/field/operator allowlist for the UI.
router.get(
  "/schema",
  safe((_req, res) => {
    res.json(SCHEMA);
  })
);

// GET /api/query/saved — list saved queries, newest first.
router.get(
  "/saved",
  safe((_req, res) => {
    const rows = db.prepare("SELECT * FROM saved_queries ORDER BY created_at DESC, id DESC").all();
    res.json({ saved: rows.map(serializeSaved) });
  })
);

// POST /api/query/saved — create a saved query. The DSL is validated before
// it is ever persisted, so a saved query can always be re-run safely.
router.post(
  "/saved",
  safe((req, res) => {
    const { name, query, tags } = req.body || {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: { message: "name is required" } });
    }
    const result = validateQuery(query);
    if (!result.ok) {
      return res.status(400).json({ error: { message: result.error } });
    }
    let tagsJson = null;
    if (tags != null) {
      if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
        return res.status(400).json({ error: { message: "tags must be an array of strings" } });
      }
      tagsJson = JSON.stringify(tags);
    }

    const id = uuidv4();
    db.prepare(
      "INSERT INTO saved_queries (id, name, entity, query, tags) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name.trim(), result.query.entity, JSON.stringify(result.query), tagsJson);

    const row = db.prepare("SELECT * FROM saved_queries WHERE id = ?").get(id);
    res.status(201).json({ saved: serializeSaved(row) });
  })
);

// DELETE /api/query/saved/:id — remove a saved query.
router.delete(
  "/saved/:id",
  safe((req, res) => {
    const info = db.prepare("DELETE FROM saved_queries WHERE id = ?").run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: { message: "Saved query not found" } });
    }
    res.json({ ok: true });
  })
);

module.exports = router;
