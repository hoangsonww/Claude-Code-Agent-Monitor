/**
 * @file Express router for the rules-based alerting engine: CRUD for alert
 * rules, a read-only preview that backtests a candidate rule against recorded
 * history, the fired-alert feed with pagination and unacked filtering, and
 * acknowledge endpoints. Rule evaluation itself lives in server/lib/alerts.js.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const { stmts } = require("../db");
const { broadcast } = require("../websocket");
const {
  RULE_TYPES,
  validateRuleConfig,
  invalidateRuleCache,
  previewRule,
} = require("../lib/alerts");

const router = Router();

function serializeRule(row) {
  let config = {};
  try {
    config = JSON.parse(row.config || "{}");
  } catch {
    /* surface as empty config rather than failing the request */
  }
  return { ...row, config, enabled: row.enabled === 1 };
}

// GET /api/alerts/rules - List all alert rules
router.get("/rules", (_req, res) => {
  res.json({ rules: stmts.listAlertRules.all().map(serializeRule) });
});

// POST /api/alerts/rules - Create an alert rule
router.post("/rules", (req, res) => {
  const { name, rule_type, config, enabled, cooldown_seconds } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "name is required" },
    });
  }
  const validated = validateRuleConfig(rule_type, config);
  if (!validated.ok) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: validated.error } });
  }
  const cooldown =
    cooldown_seconds == null ? 300 : Number.isInteger(cooldown_seconds) ? cooldown_seconds : -1;
  if (cooldown < 0) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "cooldown_seconds must be a non-negative integer" },
    });
  }

  const id = uuidv4();
  stmts.insertAlertRule.run(
    id,
    name.trim(),
    rule_type,
    JSON.stringify(validated.config),
    enabled === false ? 0 : 1,
    cooldown
  );
  invalidateRuleCache();
  res.status(201).json({ rule: serializeRule(stmts.getAlertRule.get(id)) });
});

// POST /api/alerts/rules/preview - Dry-run a candidate rule against recorded
// history. Read-only: nothing is persisted, broadcast, or delivered to
// webhooks. Registered before the "/rules/:id" handlers so "preview" is never
// swallowed as a rule id.
router.post("/rules/preview", (req, res) => {
  const { name, rule_type, config, lookback_hours, cooldown_seconds, limit } = req.body || {};
  const result = previewRule(rule_type, config, {
    name,
    lookbackHours: lookback_hours,
    cooldownSeconds: cooldown_seconds,
    limit,
  });
  if (!result.ok) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: result.error } });
  }
  res.json({ preview: result.preview });
});

// PATCH /api/alerts/rules/:id - Update an alert rule (partial)
router.patch("/rules/:id", (req, res) => {
  const existing = stmts.getAlertRule.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Alert rule not found" } });
  }
  const { name, config, enabled, cooldown_seconds } = req.body || {};

  if (name != null && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "name must be a non-empty string" },
    });
  }
  let configJson = null;
  if (config != null) {
    // rule_type is immutable — validate the new config against the stored type
    const validated = validateRuleConfig(existing.rule_type, config);
    if (!validated.ok) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: validated.error } });
    }
    configJson = JSON.stringify(validated.config);
  }
  if (cooldown_seconds != null && (!Number.isInteger(cooldown_seconds) || cooldown_seconds < 0)) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "cooldown_seconds must be a non-negative integer" },
    });
  }

  stmts.updateAlertRule.run(
    name != null ? name.trim() : null,
    configJson,
    enabled == null ? null : enabled ? 1 : 0,
    cooldown_seconds ?? null,
    req.params.id
  );
  invalidateRuleCache();
  res.json({ rule: serializeRule(stmts.getAlertRule.get(req.params.id)) });
});

// DELETE /api/alerts/rules/:id - Delete an alert rule (its alert history
// cascades away with it — the FK is ON DELETE CASCADE)
router.delete("/rules/:id", (req, res) => {
  const existing = stmts.getAlertRule.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Alert rule not found" } });
  }
  stmts.deleteAlertRule.run(req.params.id);
  invalidateRuleCache();
  res.json({ ok: true });
});

// GET /api/alerts - Fired-alert feed, newest first. ?unacked=true filters to
// unacknowledged alerts; limit/offset paginate.
router.get("/", (req, res) => {
  // Clamp to sane bounds — negative values would make SQLite's LIMIT/OFFSET
  // misbehave (a negative LIMIT means "no limit").
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const unackedOnly = req.query.unacked === "true";

  const alerts = unackedOnly
    ? stmts.listUnackedAlertEvents.all(limit, offset)
    : stmts.listAlertEvents.all(limit, offset);
  const total = unackedOnly
    ? stmts.countUnackedAlertEvents.get().count
    : stmts.countAlertEvents.get().count;
  const unacked = stmts.countUnackedAlertEvents.get().count;

  res.json({ alerts, total, unacked, limit, offset });
});

// POST /api/alerts/:id/ack - Acknowledge one alert
router.post("/:id(\\d+)/ack", (req, res) => {
  const alert = stmts.getAlertEvent.get(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Alert not found" } });
  }
  stmts.ackAlertEvent.run(req.params.id);
  const updated = stmts.getAlertEvent.get(req.params.id);
  broadcast("alert_updated", updated);
  res.json({ alert: updated });
});

// POST /api/alerts/ack-all - Acknowledge every unacked alert
router.post("/ack-all", (_req, res) => {
  const info = stmts.ackAllAlertEvents.run();
  if (info.changes > 0) broadcast("alert_updated", { acked_all: true });
  res.json({ ok: true, acknowledged: info.changes });
});

module.exports = router;
module.exports.RULE_TYPES = RULE_TYPES;
