/**
 * @file Express router for Projects: a user-named grouping of one or more
 * session working directories (cwd). Sessions carry no project_id column -
 * membership is derived by joining sessions.cwd against project_paths.cwd, so
 * this is a thin label layer over the existing session/cwd data rather than a
 * new session relationship. Exposes CRUD for projects plus add/remove folder
 * mapping endpoints, and returns aggregated session counts per project (and
 * for cwds not yet mapped to any project) so the client can render a live
 * "active projects" view without a separate stats round-trip.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const { stmts, db } = dbModule;
const { buildProjectFocusReport } = require("../lib/focus-report");

const router = Router();

/**
 * Grouped per-cwd session stats in one query, so listing N projects costs one
 * extra query total instead of N. Keyed by cwd for O(1) lookup while building
 * each project's (and the unassigned bucket's) aggregate.
 */
function cwdSessionStats() {
  const rows = db
    .prepare(
      `SELECT cwd,
              COUNT(*) AS session_count,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
              MAX(updated_at) AS last_activity
       FROM sessions
       WHERE cwd IS NOT NULL AND cwd != ''
       GROUP BY cwd`
    )
    .all();
  return new Map(rows.map((r) => [r.cwd, r]));
}

function aggregate(cwds, statsByCwd) {
  let session_count = 0;
  let active_count = 0;
  let last_activity = null;
  for (const cwd of cwds) {
    const s = statsByCwd.get(cwd);
    if (!s) continue;
    session_count += s.session_count;
    active_count += s.active_count;
    if (s.last_activity && (!last_activity || s.last_activity > last_activity)) {
      last_activity = s.last_activity;
    }
  }
  return { session_count, active_count, last_activity };
}

// GET /api/projects - every project with its mapped folders and aggregated
// session stats, plus an "unassigned" bucket for cwds with sessions that
// aren't mapped to any project yet.
router.get("/", (_req, res) => {
  const projects = stmts.listProjects.all();
  const allPaths = stmts.listAllProjectPaths.all();

  const pathsByProject = new Map();
  const mappedCwds = new Set();
  for (const p of allPaths) {
    mappedCwds.add(p.cwd);
    if (!pathsByProject.has(p.project_id)) pathsByProject.set(p.project_id, []);
    pathsByProject.get(p.project_id).push({ id: p.id, cwd: p.cwd });
  }

  const statsByCwd = cwdSessionStats();

  const result = projects.map((project) => {
    const paths = pathsByProject.get(project.id) || [];
    return {
      ...project,
      paths,
      ...aggregate(
        paths.map((p) => p.cwd),
        statsByCwd
      ),
    };
  });

  const unassignedCwds = [...statsByCwd.keys()].filter((cwd) => !mappedCwds.has(cwd));
  const unassigned = {
    cwds: unassignedCwds,
    ...aggregate(unassignedCwds, statsByCwd),
  };

  res.json({ projects: result, unassigned });
});

// POST /api/projects - create a project, optionally attaching folders it
// already covers (each must be unmapped; a folder belongs to one project).
router.post("/", (req, res) => {
  const { name, cwds } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "name is required" } });
  }

  let cwdList = [];
  if (cwds !== undefined) {
    if (!Array.isArray(cwds) || cwds.some((c) => typeof c !== "string" || !c.trim())) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "cwds must be an array of non-empty strings" },
      });
    }
    cwdList = [...new Set(cwds.map((c) => c.trim()))];
  }

  for (const cwd of cwdList) {
    if (stmts.getProjectPathByCwd.get(cwd)) {
      return res.status(409).json({
        error: { code: "ALREADY_MAPPED", message: `"${cwd}" already belongs to another project` },
      });
    }
  }

  const id = uuidv4();
  db.transaction(() => {
    stmts.insertProject.run(id, name.trim());
    for (const cwd of cwdList) stmts.insertProjectPath.run(id, cwd);
  })();

  const project = stmts.getProject.get(id);
  const paths = stmts.listProjectPaths.all(id);
  res.status(201).json({ project: { ...project, paths } });
});

// PATCH /api/projects/:id - rename a project.
router.patch("/:id", (req, res) => {
  const existing = stmts.getProject.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  const { name } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "name is required" } });
  }
  stmts.renameProject.run(name.trim(), req.params.id);
  const project = stmts.getProject.get(req.params.id);
  const paths = stmts.listProjectPaths.all(req.params.id);
  res.json({ project: { ...project, paths } });
});

// DELETE /api/projects/:id - delete a project. Its folder mappings cascade
// away (ON DELETE CASCADE); the underlying sessions are untouched and simply
// fall back into the unassigned bucket.
router.delete("/:id", (req, res) => {
  const existing = stmts.getProject.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  stmts.deleteProject.run(req.params.id);
  res.json({ ok: true });
});

// POST /api/projects/:id/paths - map an additional folder onto this project.
router.post("/:id/paths", (req, res) => {
  const existing = stmts.getProject.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  const { cwd } = req.body || {};
  if (!cwd || typeof cwd !== "string" || !cwd.trim()) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "cwd is required" } });
  }
  const trimmed = cwd.trim();
  const mapping = stmts.getProjectPathByCwd.get(trimmed);
  if (mapping) {
    const message =
      mapping.project_id === req.params.id
        ? `"${trimmed}" is already part of this project`
        : `"${trimmed}" already belongs to another project`;
    return res.status(409).json({ error: { code: "ALREADY_MAPPED", message } });
  }
  stmts.insertProjectPath.run(req.params.id, trimmed);
  const project = stmts.getProject.get(req.params.id);
  const paths = stmts.listProjectPaths.all(req.params.id);
  res.status(201).json({ project: { ...project, paths } });
});

// DELETE /api/projects/:id/paths/:pathId - unmap a folder from this project
// (the folder itself, and its sessions, are untouched - it just becomes
// unassigned again).
router.delete("/:id/paths/:pathId", (req, res) => {
  const existing = stmts.getProject.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  const pathId = parseInt(req.params.pathId, 10);
  if (!Number.isInteger(pathId)) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_INPUT", message: "pathId must be an integer" } });
  }
  const info = stmts.deleteProjectPath.run(pathId, req.params.id);
  if (info.changes === 0) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Folder mapping not found" } });
  }
  const project = stmts.getProject.get(req.params.id);
  const paths = stmts.listProjectPaths.all(req.params.id);
  res.json({ project: { ...project, paths } });
});

// GET /api/projects/:id/focus-report - focus-time breakdown for every
// session under this project's mapped folders: per-session segments (item /
// detour / feature / bug, each with wall-clock + idle-grace-discounted
// active time), a per-item rollup bucketing detours under the item that was
// current when they started, and project-wide totals by kind. See
// server/lib/focus-report.js for the segment-replay + grace-window math.
router.get("/:id/focus-report", (req, res) => {
  const project = stmts.getProject.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  const paths = stmts.listProjectPaths.all(project.id);
  const cwds = paths.map((p) => p.cwd);
  const sessions =
    cwds.length === 0
      ? []
      : db
          .prepare(
            "SELECT id, name, cwd, ended_at FROM sessions WHERE cwd IN (SELECT value FROM json_each(?)) ORDER BY started_at ASC"
          )
          .all(JSON.stringify(cwds));
  const report = buildProjectFocusReport(dbModule, sessions);
  res.json({ project_id: project.id, ...report });
});

module.exports = router;
