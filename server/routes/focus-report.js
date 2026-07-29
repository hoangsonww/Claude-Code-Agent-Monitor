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
 * both), and feeds the resolved rows through `buildProjectFocusReport`,
 * passing the parsed `fromMs`/`toMs` through as its window bounds so every
 * session's reported segments/totals are CLIPPED to `[from, to)` — not just
 * session *selection* — rather than a session that merely overlaps the
 * window contributing its full, unclipped history. Never re-derives
 * segment-replay/merge-interval math here; the clipping itself lives in
 * `buildSessionFocusReport` (server/lib/focus-report.js).
 *
 * `?unassigned=true` scopes to the inverse of a project filter: sessions
 * whose `cwd` isn't mapped to ANY project (`cwd NOT IN (SELECT cwd FROM
 * project_paths)` — `project_paths.cwd` is `UNIQUE`, so this mirrors
 * `GET /api/projects`' own JS-side `unassigned` bucket (routes/projects.js),
 * just expressed as a SQL anti-join instead of a post-hoc Set difference,
 * since this route already builds its session query as a `WHERE` clause).
 * Mutually exclusive with `?project_id=` — combining them is a structured
 * 400, not a silently-ignored one or the other, since "sessions in project
 * X" and "sessions in no project" can never both be true.
 *
 * Also hosts `GET /api/focus-report/summary` — the stakeholder-readable
 * LLM synthesis of the same window (server/lib/focus-summary.js), grouped
 * by project: a scoped request is one group, the all-projects scope
 * partitions sessions per project (unmapped cwds = an Unassigned group) and
 * summarizes each separately with cache keys identical to the equivalent
 * directly-scoped request, so group and single-project summaries share one
 * cache. Shares this file's exact validation/session-resolution via
 * `resolveWindowSessions` so both endpoints always agree on which sessions
 * a window contains. Summary unavailability is `{ summary: null }` with a
 * 200, never an error — it's an additive layer the client hides when absent.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const dbModule = require("../db");
const { stmts, db } = dbModule;
const { buildProjectFocusReport } = require("../lib/focus-report");
const { generateWindowSummary, summaryModel } = require("../lib/focus-summary");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");

const router = Router();

/**
 * Shared request-validation + session-resolution for both routes below:
 * parses/validates `from`/`to`/`project_id`/`session_id`/`unassigned`/
 * `?sources=`, resolves the matching session rows, and either sends the
 * appropriate 400/404 itself (returning null) or returns
 * `{ sessions, fromMs, toMs, project, session }`. Extracted verbatim from
 * the original single GET / handler so `/summary` can never drift to a
 * slightly different notion of "which sessions are in this window".
 */
function resolveWindowSessions(req, res) {
  const { from, to, project_id: projectId, session_id: sessionId, unassigned } = req.query;
  const unassignedOnly = unassigned === "true";

  if (typeof from !== "string" || from === "" || typeof to !== "string" || to === "") {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Both from and to (ISO-8601 instants) are required.",
      },
    });
    return null;
  }
  if (unassignedOnly && typeof projectId === "string" && projectId !== "") {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "project_id and unassigned=true are mutually exclusive.",
      },
    });
    return null;
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "from/to must be parseable ISO-8601 instants.",
      },
    });
    return null;
  }

  let project = null;
  if (typeof projectId === "string" && projectId !== "") {
    project = stmts.getProject.get(projectId);
    if (!project) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
      return null;
    }
  }

  let session = null;
  if (typeof sessionId === "string" && sessionId !== "") {
    session = stmts.getSession.get(sessionId);
    if (!session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
      return null;
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

  if (unassignedOnly) {
    where.push("(cwd IS NULL OR cwd = '' OR cwd NOT IN (SELECT cwd FROM project_paths))");
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

  return { sessions, fromMs, toMs, project, session };
}

// GET /api/focus-report - aggregate focus-time report across an explicitly
// bounded time window, optionally scoped to one project and/or one session,
// optionally narrowed to a data-scope source set. See file header above for
// the full contract; response shape mirrors GET /api/projects/:id/focus-report
// (sessions/items/totals/wall_clock_ms/concurrency_ratio/idle_grace_seconds)
// plus an echoed-back project_id/session_id (null when unfiltered). `from`/
// `to` are never echoed back - the caller already knows what it asked for.
router.get("/", (req, res) => {
  const resolved = resolveWindowSessions(req, res);
  if (!resolved) return; // error response already sent

  const report = buildProjectFocusReport(
    dbModule,
    resolved.sessions,
    resolved.fromMs,
    resolved.toMs
  );
  res.json({
    project_id: resolved.project ? resolved.project.id : null,
    session_id: resolved.session ? resolved.session.id : null,
    ...report,
  });
});

// GET /api/focus-report/summary - stakeholder-readable bullet synthesis of
// the same window (see server/lib/focus-summary.js), GROUPED BY PROJECT.
// Identical query params and validation as GET / (same
// resolveWindowSessions). A scoped request (project_id / session_id /
// unassigned) yields exactly one group; the all-projects scope partitions
// the window's sessions by project (cwd -> project_paths join, unmapped
// cwds forming an Unassigned group) and summarizes each project's activity
// separately, ordered by wall-clock share (largest first). Each group's
// cache key/scope is IDENTICAL to what a directly project-scoped (or
// unassigned-scoped) request would produce, so group summaries and
// single-project summaries share one cache - nothing generates twice.
// Responds `{ summary: { groups: [{ project_id, project_name,
// wall_clock_ms, bullets, generated_at, cached, model }] } }` on success or
// `{ summary: null }` when no group could be summarized - the LLM path is
// disabled/unavailable, the window has no sessions, or generation failed.
// Unavailability is a 200 with null, never an error: the summary is an
// additive layer the Focus page simply hides when absent.
router.get("/summary", async (req, res) => {
  const resolved = resolveWindowSessions(req, res);
  if (!resolved) return; // error response already sent

  const sources = parseSources(req);
  const unassignedOnly = req.query.unassigned === "true";

  // Partition the window's sessions into per-project groups - see above.
  let partitions; // [{ projectId, projectName, unassigned, sessions }]
  if (resolved.project || resolved.session || unassignedOnly) {
    partitions = [
      {
        projectId: resolved.project ? resolved.project.id : null,
        projectName: resolved.project ? resolved.project.name : null,
        unassigned: unassignedOnly,
        sessions: resolved.sessions,
      },
    ];
  } else {
    const byCwd = new Map(
      db
        .prepare(
          "SELECT pp.cwd AS cwd, p.id AS id, p.name AS name FROM project_paths pp JOIN projects p ON p.id = pp.project_id"
        )
        .all()
        .map((r) => [r.cwd, r])
    );
    const groupsByKey = new Map();
    for (const s of resolved.sessions) {
      const proj = s.cwd ? byCwd.get(s.cwd) : undefined;
      const key = proj ? proj.id : "__unassigned__";
      let group = groupsByKey.get(key);
      if (!group) {
        group = {
          projectId: proj ? proj.id : null,
          projectName: proj ? proj.name : null,
          unassigned: !proj,
          sessions: [],
        };
        groupsByKey.set(key, group);
      }
      group.sessions.push(s);
    }
    partitions = [...groupsByKey.values()];
  }

  try {
    const groups = [];
    // Serial on purpose: each generation may spawn a `claude -p`; N projects
    // fanning out N concurrent spawns on a first view is worse than a
    // slightly longer serial pass (and cache hits cost nothing anyway).
    for (const partition of partitions) {
      const report = buildProjectFocusReport(
        dbModule,
        partition.sessions,
        resolved.fromMs,
        resolved.toMs
      );
      if ((report.sessions || []).length === 0) continue;

      // Scope identity: every scope-affecting param. `?sources=`
      // participates too - two different data scopes must never share one
      // cached summary. The window cache key adds from/to; per-day
      // building-block keys inside the hierarchical path add the day
      // instead (lib/focus-summary.js).
      const scope = {
        project_id: partition.projectId,
        session_id: resolved.session ? resolved.session.id : null,
        unassigned: partition.unassigned,
        sources,
      };
      const cacheKey = JSON.stringify({ ...scope, from: resolved.fromMs, to: resolved.toMs });
      const summary = await generateWindowSummary(dbModule, cacheKey, report, {
        fromMs: resolved.fromMs,
        toMs: resolved.toMs,
        scope,
        sessions: partition.sessions,
      });
      if (summary) {
        groups.push({
          project_id: partition.projectId,
          project_name: partition.projectName,
          wall_clock_ms: report.wall_clock_ms,
          ...summary,
        });
      }
    }
    groups.sort((a, b) => (b.wall_clock_ms || 0) - (a.wall_clock_ms || 0));
    res.json({ summary: groups.length > 0 ? { groups } : null });
  } catch {
    res.json({ summary: null }); // fail-safe: unavailable, never a 500
  }
});

// GET /api/focus-report/summary/config - the model the NEXT summary
// generation would use (DASHBOARD_FOCUS_SUMMARY_MODEL falling back to
// DASHBOARD_FOCUS_INFER_MODEL, then haiku). Exists so the client can name
// the model in its "Summarizing this window using ..." loading state BEFORE
// the summary response (which carries the authoritative per-row `model`)
// arrives. Static per server process; no params, never errors.
router.get("/summary/config", (_req, res) => {
  res.json({ model: summaryModel() });
});

module.exports = router;
