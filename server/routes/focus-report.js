/**
 * @file Express router for the new cross-project aggregate focus-time
 * endpoint, `GET /api/focus-report` — a thin session-selection + explicit
 * `from`/`to` time-window layer in front of the existing, unmodified
 * `buildProjectFocusReport` (server/lib/focus-report.js). Distinct from both
 * `GET /api/projects/:id/focus-report` (single-project, no time window,
 * no `?sources=` support — left byte-unmodified by this file) and the
 * unrelated `/api/focus` mount (server/routes/plans.js's "declared focus"
 * hydrate endpoint).
 *
 * Resolves the session set from `?project_id=`/`?session_id=`/`?sources=`
 * (the latter via the shared `source-filter.js` convention already used by
 * `sessions.js`/`analytics.js`/`agents.js`/`events.js`), requires `?from=`/
 * `?to=` ISO-8601 instants bounding the query (no env knob, no server-side
 * default window — see decisions.md DEC-2/DEC-3: the client always supplies
 * both), and feeds the resolved rows through `buildProjectFocusReport`
 * unmodified. Never re-derives segment-replay/merge-interval math here.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const dbModule = require("../db");
const { stmts, db } = dbModule;
const { buildProjectFocusReport } = require("../lib/focus-report");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");

const router = Router();

// GET /api/focus-report - aggregate focus-time report across an explicitly
// bounded time window, optionally scoped to one project and/or one session,
// optionally narrowed to a data-scope source set. See file header above for
// the full contract; response shape mirrors GET /api/projects/:id/focus-report
// (sessions/items/totals/wall_clock_ms/concurrency_ratio/idle_grace_seconds)
// plus an echoed-back project_id/session_id (null when unfiltered). `from`/
// `to` are never echoed back - the caller already knows what it asked for.
router.get("/", (req, res) => {
  const { from, to, project_id: projectId, session_id: sessionId } = req.query;

  if (typeof from !== "string" || from === "" || typeof to !== "string" || to === "") {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Both from and to (ISO-8601 instants) are required.",
      },
    });
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "from/to must be parseable ISO-8601 instants.",
      },
    });
  }

  let project = null;
  if (typeof projectId === "string" && projectId !== "") {
    project = stmts.getProject.get(projectId);
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }
  }

  let session = null;
  if (typeof sessionId === "string" && sessionId !== "") {
    session = stmts.getSession.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
    }
  }

  // Sessions overlapping [from, to): started before `to`, and either still
  // open or ended at/after `from`.
  const where = ["started_at < ?", "(ended_at IS NULL OR ended_at >= ?)"];
  const params = [to, from];

  if (project) {
    const cwds = stmts.listProjectPaths.all(project.id).map((p) => p.cwd);
    if (cwds.length === 0) {
      // No mapped folders -> no sessions can match; short-circuit rather than
      // building an always-false SQL fragment for an empty json_each list.
      where.push("1 = 0");
    } else {
      where.push("cwd IN (SELECT value FROM json_each(?))");
      params.push(JSON.stringify(cwds));
    }
  }

  if (session) {
    where.push("id = ?");
    params.push(session.id);
  }

  const sourceFilter = sourceColumnClause(parseSources(req), "source");
  if (sourceFilter.clause) {
    where.push(sourceFilter.clause);
    params.push(...sourceFilter.params);
  }

  const sessions = db
    .prepare(
      `SELECT id, name, cwd, started_at, ended_at FROM sessions WHERE ${where.join(" AND ")} ORDER BY started_at ASC`
    )
    .all(...params);

  const report = buildProjectFocusReport(dbModule, sessions);
  res.json({
    project_id: project ? project.id : null,
    session_id: session ? session.id : null,
    ...report,
  });
});

module.exports = router;
