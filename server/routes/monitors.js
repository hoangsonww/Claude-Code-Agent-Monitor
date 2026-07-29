/**
 * @file Express router for the Kanban Board "Projects" view monitor layout —
 * a single global, server-shared config (this app has no user accounts, so
 * there is exactly one layout for every connected client/computer):
 *
 *   GET /api/monitors — current { monitors, monitorMap, collapsedProjects }
 *   PUT /api/monitors — patch any subset of the three; broadcasts the
 *                        resulting full state over the WebSocket
 *                        (`monitors_updated`) so every other connected
 *                        client picks up the change live, without a reload.
 *
 * Persisted in the singleton `dashboard_layout` row (server/db.js). Wire
 * shape is camelCase; DB columns are snake_case — same convention
 * server/routes/remote-sources.js uses.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts } = require("../db");
const { broadcast } = require("../websocket");

const router = Router();

const ORIENTATIONS = new Set(["horizontal", "vertical"]);

class ValidationError extends Error {}

function parseJsonColumn(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

/** Validates and returns a clean `MonitorGroup[]`, or throws {@link ValidationError}. */
function validateMonitors(value) {
  if (!Array.isArray(value)) throw new ValidationError("monitors must be an array");
  return value.map((m, i) => {
    if (!m || typeof m !== "object" || typeof m.id !== "string" || typeof m.name !== "string") {
      throw new ValidationError(`monitors[${i}] must have string id and name`);
    }
    const clean = { id: m.id, name: m.name };
    if (m.collapsed !== undefined) {
      if (typeof m.collapsed !== "boolean") {
        throw new ValidationError(`monitors[${i}].collapsed must be a boolean`);
      }
      clean.collapsed = m.collapsed;
    }
    if (m.orientation !== undefined) {
      if (!ORIENTATIONS.has(m.orientation)) {
        throw new ValidationError(`monitors[${i}].orientation must be "horizontal" or "vertical"`);
      }
      clean.orientation = m.orientation;
    }
    return clean;
  });
}

/** Validates a project id -> monitor id map, or throws {@link ValidationError}. */
function validateMonitorMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("monitorMap must be an object");
  }
  for (const [key, v] of Object.entries(value)) {
    if (typeof v !== "string") throw new ValidationError(`monitorMap[${key}] must be a string`);
  }
  return value;
}

/** Validates a project/monitor collapsed-state map, or throws {@link ValidationError}. */
function validateCollapsedProjects(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("collapsedProjects must be an object");
  }
  for (const [key, v] of Object.entries(value)) {
    if (typeof v !== "boolean") {
      throw new ValidationError(`collapsedProjects[${key}] must be a boolean`);
    }
  }
  return value;
}

function serialize(row) {
  return {
    monitors: parseJsonColumn(row.monitors, []),
    monitorMap: parseJsonColumn(row.monitor_map, {}),
    collapsedProjects: parseJsonColumn(row.collapsed_projects, {}),
  };
}

// GET / — current global layout.
router.get("/", (_req, res) => {
  res.json(serialize(stmts.getDashboardLayout.get()));
});

// PUT / — patch any subset of { monitors, monitorMap, collapsedProjects }.
router.put("/", (req, res) => {
  const body = req.body || {};
  let monitors;
  let monitorMap;
  let collapsedProjects;
  try {
    if (body.monitors !== undefined) monitors = validateMonitors(body.monitors);
    if (body.monitorMap !== undefined) monitorMap = validateMonitorMap(body.monitorMap);
    if (body.collapsedProjects !== undefined) {
      collapsedProjects = validateCollapsedProjects(body.collapsedProjects);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: { code: "INVALID_LAYOUT", message: err.message } });
    }
    throw err;
  }
  stmts.updateDashboardLayout.run(
    monitors !== undefined ? JSON.stringify(monitors) : null,
    monitorMap !== undefined ? JSON.stringify(monitorMap) : null,
    collapsedProjects !== undefined ? JSON.stringify(collapsedProjects) : null
  );
  const result = serialize(stmts.getDashboardLayout.get());
  broadcast("monitors_updated", result);
  res.json(result);
});

module.exports = router;
