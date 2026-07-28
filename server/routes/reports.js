/**
 * @file Express router for Scheduled Analytics Reports. CRUD for report
 * definitions (saved schedules), synchronous on-demand generation, run history,
 * and artifact download. Numbers mirror /api/analytics, windowed to the report
 * period. Generation never throws out of the handler — a failed run is
 * persisted with status "error" and a populated `error` string. The
 * generate-and-persist path lives in runReportForDefinition() so the scheduler
 * reuses the exact same code.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const { db } = dbModule;
const {
  TEMPLATES,
  TEMPLATE_KEYS,
  computeNextRun,
  generateReport,
} = require("../lib/report-generator");

const router = Router();

const FREQUENCIES = ["daily", "weekly", "monthly"];
const VALID_FORMATS = ["html", "json"];
// ~100 years — an upper bound on the report window so `new Date(now - days)`
// stays well within the representable Date range (a larger value throws).
const MAX_WINDOW_DAYS = 36525;

// ── Prepared statements ─────────────────────────────────────────────────────
const stmts = {
  listDefs: db.prepare("SELECT * FROM report_definitions ORDER BY created_at DESC"),
  getDef: db.prepare("SELECT * FROM report_definitions WHERE id = ?"),
  insertDef: db.prepare(`
    INSERT INTO report_definitions
      (id, name, template, frequency, day_of_week, hour, tz_offset, formats, window_days, enabled, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateDef: db.prepare(`
    UPDATE report_definitions SET
      name = ?, template = ?, frequency = ?, day_of_week = ?, hour = ?, tz_offset = ?,
      formats = ?, window_days = ?, enabled = ?, next_run_at = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `),
  deleteDef: db.prepare("DELETE FROM report_definitions WHERE id = ?"),
  touchAfterRun: db.prepare(
    "UPDATE report_definitions SET last_run_at = ?, next_run_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ),
  // Most-recent run status for a definition (for last_status in the list view).
  latestRunStatus: db.prepare(
    "SELECT status FROM report_runs WHERE definition_id = ? ORDER BY created_at DESC, id DESC LIMIT 1"
  ),
  insertRun: db.prepare(`
    INSERT INTO report_runs
      (id, definition_id, template, status, started_at, finished_at, window_start, window_end, error, summary, artifact_html, artifact_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getRun: db.prepare("SELECT * FROM report_runs WHERE id = ?"),
  listRunsForDef: db.prepare(
    "SELECT * FROM report_runs WHERE definition_id = ? ORDER BY created_at DESC, id DESC"
  ),
  deleteRunsForDef: db.prepare("DELETE FROM report_runs WHERE definition_id = ?"),
};

/** Wrap a route handler so any thrown error becomes a structured 500. */
function safe(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      console.error("[REPORTS] route error:", err?.message || err);
      res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
    }
  };
}

function badRequest(res, message) {
  return res.status(400).json({ error: { code: "INVALID_INPUT", message } });
}

function notFound(res, message) {
  return res.status(404).json({ error: { code: "NOT_FOUND", message } });
}

/** Resolve the effective window length (days) for a definition. */
function effectiveWindowDays(def) {
  if (Number.isInteger(def.window_days) && def.window_days > 0) return def.window_days;
  const t = TEMPLATES.find((x) => x.key === def.template);
  return t ? t.default_window_days : 7;
}

/** Serialize a definition row to the ReportDefinition contract shape. */
function serializeDef(row) {
  let formats = ["html", "json"];
  try {
    const parsed = JSON.parse(row.formats || "[]");
    if (Array.isArray(parsed) && parsed.length) formats = parsed;
  } catch {
    /* tolerate hand-edited bad JSON — fall back to default formats */
  }
  const last = stmts.latestRunStatus.get(row.id);
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    frequency: row.frequency,
    day_of_week: row.day_of_week == null ? null : row.day_of_week,
    hour: row.hour,
    tz_offset: row.tz_offset,
    formats,
    window_days: effectiveWindowDays(row),
    enabled: row.enabled === 1,
    last_run_at: row.last_run_at || null,
    next_run_at: row.next_run_at || null,
    last_status: last ? last.status : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Serialize a run row to the ReportRun contract shape (NO artifact bodies). */
function serializeRun(row) {
  let summary = null;
  try {
    summary = row.summary ? JSON.parse(row.summary) : null;
  } catch {
    summary = null;
  }
  const formats_available = [];
  if (row.artifact_html != null) formats_available.push("html");
  if (row.artifact_json != null) formats_available.push("json");
  return {
    id: row.id,
    definition_id: row.definition_id,
    template: row.template,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at || null,
    window_start: row.window_start || null,
    window_end: row.window_end || null,
    error: row.error || null,
    summary,
    formats_available,
  };
}

/**
 * Validate a (partial) definition payload. `existing` supplies fallback values
 * for fields not present in the body (PATCH). Returns
 * `{ ok: true, values }` (normalized) or `{ ok: false, error }`.
 */
function validateDefinition(body, existing = null) {
  const b = body || {};
  const pick = (key, fallback) => (b[key] === undefined ? fallback : b[key]);

  const name = pick("name", existing ? existing.name : undefined);
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "name must be a non-empty string" };
  }

  const template = pick("template", existing ? existing.template : undefined);
  if (!TEMPLATE_KEYS.has(template)) {
    return { ok: false, error: `template must be one of: ${[...TEMPLATE_KEYS].join(", ")}` };
  }

  const frequency = pick("frequency", existing ? existing.frequency : undefined);
  if (!FREQUENCIES.includes(frequency)) {
    return { ok: false, error: `frequency must be one of: ${FREQUENCIES.join(", ")}` };
  }

  const hourRaw = pick("hour", existing ? existing.hour : 9);
  const hour = hourRaw == null ? 9 : hourRaw;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, error: "hour must be an integer in 0-23" };
  }

  let day_of_week = pick("day_of_week", existing ? existing.day_of_week : null);
  if (frequency === "weekly") {
    if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
      return { ok: false, error: "day_of_week must be an integer in 0-6 for weekly reports" };
    }
  } else {
    day_of_week = null; // ignored for daily/monthly
  }

  const tzRaw = pick("tz_offset", existing ? existing.tz_offset : 0);
  const tz_offset = tzRaw == null ? 0 : tzRaw;
  if (!Number.isInteger(tz_offset)) {
    return { ok: false, error: "tz_offset must be an integer (minutes from UTC)" };
  }

  // formats: subset of VALID_FORMATS, non-empty, deduped.
  let formats;
  if (b.formats === undefined) {
    formats = existing ? safeParseFormats(existing.formats) : ["html", "json"];
  } else {
    if (!Array.isArray(b.formats) || b.formats.length === 0) {
      return { ok: false, error: "formats must be a non-empty array" };
    }
    formats = [...new Set(b.formats)];
    for (const f of formats) {
      if (!VALID_FORMATS.includes(f)) {
        return { ok: false, error: `formats must be a subset of: ${VALID_FORMATS.join(", ")}` };
      }
    }
  }

  let window_days = pick("window_days", existing ? existing.window_days : null);
  if (window_days != null) {
    // Upper bound keeps (now - window_days days) inside the valid Date range —
    // a huge value would otherwise throw RangeError from toISOString().
    if (!Number.isInteger(window_days) || window_days <= 0 || window_days > MAX_WINDOW_DAYS) {
      return {
        ok: false,
        error: `window_days must be a positive integer (<= ${MAX_WINDOW_DAYS})`,
      };
    }
  } else {
    window_days = null;
  }

  let enabled = pick("enabled", existing ? existing.enabled === 1 : true);
  enabled = enabled === false ? 0 : 1;

  return {
    ok: true,
    values: {
      name: name.trim(),
      template,
      frequency,
      day_of_week,
      hour,
      tz_offset,
      formats,
      window_days,
      enabled,
    },
  };
}

function safeParseFormats(json) {
  try {
    const parsed = JSON.parse(json || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* fall through */
  }
  return ["html", "json"];
}

/**
 * Generate a report for a definition NOW and persist a run row. Never throws —
 * a generation failure is captured as an `error`-status run. Returns the
 * inserted run ROW (raw); callers serialize as needed. `nowMs` pins the window
 * end (defaults to Date.now()).
 *
 * Shared by POST /:id/run and the scheduler so both take the identical path.
 */
function runReportForDefinition(def, nowMs = Date.now()) {
  const startedAt = new Date(nowMs).toISOString();
  const windowDays = effectiveWindowDays(def);
  const windowEnd = new Date(nowMs).toISOString();
  const formats = safeParseFormats(def.formats);
  const runId = uuidv4();

  let status = "success";
  let error = null;
  let summaryJson = null;
  let artifactHtml = null;
  let artifactJson = null;
  // Computed inside the try below so a bad stored window_days (which would make
  // `new Date(...).toISOString()` throw RangeError) degrades to an error-status
  // run instead of throwing out of this function and wedging the scheduler.
  let windowStart = null;

  try {
    windowStart = new Date(nowMs - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { summary, data, html } = generateReport(dbModule, {
      template: def.template,
      windowStart,
      windowEnd,
      tzOffset: def.tz_offset,
    });
    summaryJson = JSON.stringify(summary);
    if (formats.includes("html")) artifactHtml = html;
    if (formats.includes("json")) artifactJson = JSON.stringify(data);
  } catch (err) {
    status = "error";
    error = String(err?.message || err || "report generation failed");
  }

  const finishedAt = new Date().toISOString();
  stmts.insertRun.run(
    runId,
    def.id,
    def.template,
    status,
    startedAt,
    finishedAt,
    windowStart,
    windowEnd,
    error,
    summaryJson,
    artifactHtml,
    artifactJson
  );

  // Advance the schedule regardless of success/error so a failing definition
  // doesn't wedge the scheduler on the same overdue instant forever.
  const nextRun = computeNextRun(
    {
      frequency: def.frequency,
      day_of_week: def.day_of_week,
      hour: def.hour,
      tz_offset: def.tz_offset,
    },
    nowMs
  );
  stmts.touchAfterRun.run(startedAt, nextRun, def.id);

  return stmts.getRun.get(runId);
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/reports/templates — MUST be registered before /:id so "templates"
// isn't swallowed as an id.
router.get(
  "/templates",
  safe((_req, res) => {
    res.json({ templates: TEMPLATES, frequencies: FREQUENCIES });
  })
);

// GET /api/reports — list definitions, newest first.
router.get(
  "/",
  safe((_req, res) => {
    res.json({ definitions: stmts.listDefs.all().map(serializeDef) });
  })
);

// POST /api/reports — create a definition.
router.post(
  "/",
  safe((req, res) => {
    const validated = validateDefinition(req.body, null);
    if (!validated.ok) return badRequest(res, validated.error);
    const v = validated.values;
    const id = uuidv4();
    const nextRun = computeNextRun({
      frequency: v.frequency,
      day_of_week: v.day_of_week,
      hour: v.hour,
      tz_offset: v.tz_offset,
    });
    stmts.insertDef.run(
      id,
      v.name,
      v.template,
      v.frequency,
      v.day_of_week,
      v.hour,
      v.tz_offset,
      JSON.stringify(v.formats),
      v.window_days,
      v.enabled,
      nextRun
    );
    res.status(201).json({ definition: serializeDef(stmts.getDef.get(id)) });
  })
);

// GET /api/reports/runs/:runId — run detail (metadata only). Registered before
// /:id so "runs" isn't matched as a definition id.
router.get(
  "/runs/:runId",
  safe((req, res) => {
    const run = stmts.getRun.get(req.params.runId);
    if (!run) return notFound(res, "Report run not found");
    res.json({ run: serializeRun(run) });
  })
);

// GET /api/reports/runs/:runId/artifact?format=html|json — download/view.
router.get(
  "/runs/:runId/artifact",
  safe((req, res) => {
    const run = stmts.getRun.get(req.params.runId);
    if (!run) return notFound(res, "Report run not found");
    const format = req.query.format === "json" ? "json" : "html";
    if (format === "html") {
      if (run.artifact_html == null)
        return notFound(res, "HTML artifact not available for this run");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", "inline");
      return res.send(run.artifact_html);
    }
    if (run.artifact_json == null) return notFound(res, "JSON artifact not available for this run");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="report-${run.id}.json"`);
    return res.send(run.artifact_json);
  })
);

// PATCH /api/reports/:id — partial update.
router.patch(
  "/:id",
  safe((req, res) => {
    const existing = stmts.getDef.get(req.params.id);
    if (!existing) return notFound(res, "Report definition not found");
    const validated = validateDefinition(req.body, existing);
    if (!validated.ok) return badRequest(res, validated.error);
    const v = validated.values;
    const nextRun = computeNextRun({
      frequency: v.frequency,
      day_of_week: v.day_of_week,
      hour: v.hour,
      tz_offset: v.tz_offset,
    });
    stmts.updateDef.run(
      v.name,
      v.template,
      v.frequency,
      v.day_of_week,
      v.hour,
      v.tz_offset,
      JSON.stringify(v.formats),
      v.window_days,
      v.enabled,
      nextRun,
      req.params.id
    );
    res.json({ definition: serializeDef(stmts.getDef.get(req.params.id)) });
  })
);

// DELETE /api/reports/:id — delete a definition and its runs.
router.delete(
  "/:id",
  safe((req, res) => {
    const existing = stmts.getDef.get(req.params.id);
    if (!existing) return notFound(res, "Report definition not found");
    stmts.deleteRunsForDef.run(req.params.id);
    stmts.deleteDef.run(req.params.id);
    res.json({ ok: true });
  })
);

// POST /api/reports/:id/run — generate now, synchronously.
router.post(
  "/:id/run",
  safe((req, res) => {
    const def = stmts.getDef.get(req.params.id);
    if (!def) return notFound(res, "Report definition not found");
    const run = runReportForDefinition(def);
    res.json({ run: serializeRun(run) });
  })
);

// GET /api/reports/:id/runs — run history for a definition, newest first.
router.get(
  "/:id/runs",
  safe((req, res) => {
    const def = stmts.getDef.get(req.params.id);
    if (!def) return notFound(res, "Report definition not found");
    res.json({ runs: stmts.listRunsForDef.all(req.params.id).map(serializeRun) });
  })
);

module.exports = router;
module.exports.runReportForDefinition = runReportForDefinition;
module.exports.serializeRun = serializeRun;
module.exports._stmts = stmts;
