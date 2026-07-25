/**
 * @file Express router for AGENT-PLAN.md plans and session focus reads. Plans
 * are ingested from `<cwd>/AGENT-PLAN.md` by server/lib/plan-ingest.js (poll +
 * SessionStart) and mirrored here read-only, keyed by cwd — projects aggregate
 * via the project_paths join exactly like sessions do. Also exposes the bulk
 * focus endpoint (GET /api/plans/focus is mounted at /api/focus by index.js)
 * that hydrates every active session's declared focus in one round-trip, and a
 * force-refresh escape hatch used by the CLI and tests.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const dbModule = require("../db");
const { stmts } = dbModule;
const { broadcast } = require("../websocket");
const { ingestPlanForCwd } = require("../lib/plan-ingest");
const { focusWireShape } = require("../lib/focus-commands");

const router = Router();

function planWithItems(planRow) {
  return { plan: planRow, items: stmts.listPlanItems.all(planRow.cwd) };
}

// GET /api/plans - every known plan with its items. Small N (one per repo).
router.get("/", (_req, res) => {
  const plans = stmts.listPlans.all().map((p) => ({ ...p, items: stmts.listPlanItems.all(p.cwd) }));
  res.json({ plans });
});

// GET /api/plans/for-cwd?cwd=<abs path> - the plan for one working directory.
// Query-param form because cwds contain slashes.
router.get("/for-cwd", (req, res) => {
  const cwd = req.query.cwd;
  if (!cwd || typeof cwd !== "string" || !cwd.trim()) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "cwd is required" } });
  }
  const plan = stmts.getPlanByCwd.get(cwd.trim());
  if (!plan) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "no plan for that cwd" } });
  }
  res.json(planWithItems(plan));
});

// GET /api/plans/project/:projectId - plan rollup for a project: one entry per
// mapped cwd that has a plan.
router.get("/project/:projectId", (req, res) => {
  const project = stmts.getProject.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "project not found" } });
  }
  const plans = [];
  for (const p of stmts.listProjectPaths.all(project.id)) {
    const plan = stmts.getPlanByCwd.get(p.cwd);
    if (plan) plans.push({ cwd: p.cwd, ...planWithItems(plan) });
  }
  res.json({ project_id: project.id, plans });
});

// POST /api/plans/refresh {cwd} - force an ingest now (CLI/tests, and the
// escape hatch when the background poll is disabled).
router.post("/refresh", (req, res) => {
  const { cwd } = req.body || {};
  if (!cwd || typeof cwd !== "string" || !cwd.trim()) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "cwd is required" } });
  }
  const result = ingestPlanForCwd(dbModule, cwd.trim());
  if (!result) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "no AGENT-PLAN.md and no stored plan" } });
  }
  if (result.changed) {
    broadcast("plan_updated", { plan: result.plan, items: result.items });
  }
  res.json({ changed: result.changed, plan: result.plan, items: result.items });
});

// Bulk focus hydrate: every active session's declared focus in one query.
// Exported separately so index.js can mount it at GET /api/focus (the client
// treats focus as its own top-level resource).
const focusRouter = Router();
focusRouter.get("/", (_req, res) => {
  const rows = stmts.listFocusForActiveSessions.all();
  res.json({ focus: rows.map((row) => focusWireShape(dbModule, row)) });
});

module.exports = router;
module.exports.focusRouter = focusRouter;
