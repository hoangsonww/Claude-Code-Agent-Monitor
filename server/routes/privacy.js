/**
 * @file Express router for ingest-time privacy controls: read and replace the
 * active privacy policy (built-in detector toggles + custom redaction rules)
 * and preview how a sample payload would be transformed without persisting
 * anything. The sanitizer itself lives in server/lib/privacy.js.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const {
  ACTIONS,
  MATCH_TYPES,
  DEFAULT_POLICY,
  loadPolicy,
  savePolicy,
  validatePolicy,
  sanitizeEventData,
  sanitizeText,
} = require("../lib/privacy");

const router = Router();

// GET /api/privacy - Active policy plus the vocabulary the UI needs to render
// rule editors without hardcoding server enums.
router.get("/", (_req, res) => {
  res.json({
    policy: loadPolicy(),
    actions: ACTIONS,
    match_types: MATCH_TYPES,
    defaults: DEFAULT_POLICY,
  });
});

// PUT /api/privacy - Replace the policy document (validated server-side)
router.put("/", (req, res) => {
  const result = savePolicy(req.body?.policy ?? req.body);
  if (!result.ok) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: result.error } });
  }
  res.json({ policy: result.policy });
});

// POST /api/privacy/preview - Show before/after for a sample payload without
// persisting anything. Accepts an optional draft policy so the Settings UI
// can preview unsaved edits.
router.post("/preview", (req, res) => {
  const { data, summary, policy: draftPolicy } = req.body || {};
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "data must be a JSON object" },
    });
  }

  let policy = null;
  if (draftPolicy != null) {
    const validated = validatePolicy(draftPolicy);
    if (!validated.ok) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: validated.error } });
    }
    policy = validated.policy;
  }

  const result = sanitizeEventData(data, policy || undefined);
  const response = {
    before: data,
    after: result.data,
    meta: result.meta,
  };
  if (typeof summary === "string") {
    response.summary_before = summary;
    response.summary_after = sanitizeText(summary, policy || undefined);
  }
  res.json(response);
});

module.exports = router;
