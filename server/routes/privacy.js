/**
 * @file Express router for privacy control settings — rule CRUD, global
 * enable/disable toggle, and a sample-payload preview endpoint. All mutation
 * routes invalidate the in-memory rule cache so changes take effect on the
 * next ingested event without restarting the server.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const {
  applyPrivacyPolicy,
  previewPrivacyPolicy,
  invalidateCache,
  stmts,
} = require("../lib/privacy");

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/privacy/rules — list all rules
// ---------------------------------------------------------------------------
router.get("/rules", (_req, res) => {
  res.json(stmts.listRules.all());
});

// ---------------------------------------------------------------------------
// POST /api/privacy/rules — create a user rule
// ---------------------------------------------------------------------------
router.post("/rules", (req, res) => {
  const {
    name,
    action,
    field_path = "",
    pattern = "",
    enabled = true,
    priority = 100,
  } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const VALID_ACTIONS = [
    "mask",
    "hash",
    "drop_field",
    "drop_event_payload",
    "preserve_metadata_only",
  ];
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` });
  }
  if ((action === "mask" || action === "hash") && !String(pattern).trim()) {
    return res.status(400).json({ error: `pattern is required for action "${action}"` });
  }
  if (action === "drop_field" && !String(field_path).trim()) {
    return res.status(400).json({ error: `field_path is required for action "${action}"` });
  }
  if (pattern) {
    try {
      new RegExp(pattern);
    } catch {
      return res.status(400).json({ error: "pattern is not a valid regex" });
    }
  }
  try {
    const info = stmts.insertRule.run(
      name.trim(),
      action,
      String(field_path),
      String(pattern),
      enabled ? 1 : 0,
      Number(priority) || 100
    );
    invalidateCache();
    res.status(201).json(stmts.getRule.get(info.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/privacy/rules/:id — update a user rule (built-in rules are immutable)
// ---------------------------------------------------------------------------
router.put("/rules/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const existing = stmts.getRule.get(id);
  if (!existing) return res.status(404).json({ error: "rule not found" });
  if (existing.built_in) return res.status(403).json({ error: "built-in rules are immutable" });

  const { name, action, field_path, pattern, enabled, priority } = req.body ?? {};
  const VALID_ACTIONS = [
    "mask",
    "hash",
    "drop_field",
    "drop_event_payload",
    "preserve_metadata_only",
  ];
  const nextAction = action ?? existing.action;
  if (!VALID_ACTIONS.includes(nextAction)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` });
  }
  const nextPattern = pattern !== undefined ? String(pattern) : existing.pattern;
  const nextFieldPath = field_path !== undefined ? String(field_path) : existing.field_path;
  if ((nextAction === "mask" || nextAction === "hash") && !nextPattern.trim()) {
    return res.status(400).json({ error: `pattern is required for action "${nextAction}"` });
  }
  if (nextAction === "drop_field" && !nextFieldPath.trim()) {
    return res.status(400).json({ error: `field_path is required for action "${nextAction}"` });
  }
  if (nextPattern) {
    try {
      new RegExp(nextPattern);
    } catch {
      return res.status(400).json({ error: "pattern is not a valid regex" });
    }
  }

  stmts.updateRule.run(
    (name !== undefined ? String(name).trim() : existing.name) || existing.name,
    nextAction,
    field_path !== undefined ? String(field_path) : existing.field_path,
    nextPattern,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    priority !== undefined ? Number(priority) || existing.priority : existing.priority,
    id
  );
  invalidateCache();
  res.json(stmts.getRule.get(id));
});

// ---------------------------------------------------------------------------
// PATCH /api/privacy/rules/:id/toggle — quick enable/disable toggle
// ---------------------------------------------------------------------------
router.patch("/rules/:id/toggle", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const existing = stmts.getRule.get(id);
  if (!existing) return res.status(404).json({ error: "rule not found" });

  stmts.toggleRule.run(existing.enabled ? 0 : 1, id);
  invalidateCache();
  res.json(stmts.getRule.get(id));
});

// ---------------------------------------------------------------------------
// DELETE /api/privacy/rules/:id — delete a user rule
// ---------------------------------------------------------------------------
router.delete("/rules/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const existing = stmts.getRule.get(id);
  if (!existing) return res.status(404).json({ error: "rule not found" });
  if (existing.built_in) return res.status(403).json({ error: "built-in rules cannot be deleted" });

  stmts.deleteRule.run(id);
  invalidateCache();
  res.json({ deleted: true, id });
});

// ---------------------------------------------------------------------------
// GET /api/privacy/settings — get global enabled flag and other settings
// ---------------------------------------------------------------------------
router.get("/settings", (_req, res) => {
  const enabled = stmts.getSetting.get("enabled");
  res.json({ enabled: enabled ? enabled.value === "1" : true });
});

// ---------------------------------------------------------------------------
// PUT /api/privacy/settings — update global privacy switch
// ---------------------------------------------------------------------------
router.put("/settings", (req, res) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }
  stmts.setSetting.run("enabled", enabled ? "1" : "0");
  invalidateCache();
  res.json({ enabled });
});

// ---------------------------------------------------------------------------
// POST /api/privacy/preview — preview transformation without persisting
// ---------------------------------------------------------------------------
router.post("/preview", (req, res) => {
  const sample = req.body?.payload;
  if (sample === undefined) {
    return res.status(400).json({ error: "payload field is required in request body" });
  }
  const result = previewPrivacyPolicy(sample);
  res.json(result);
});

module.exports = router;
