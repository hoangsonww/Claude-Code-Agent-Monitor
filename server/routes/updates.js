/**
 * @file HTTP routes for dashboard upstream-update detection. The dashboard never
 * restarts itself — users copy the printed command and run it in their terminal.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { getUpdatesStatus } = require("../lib/update-check");

const router = Router();

function updateStatusProvider(req) {
  const injected = req.app?.locals?.updateStatusProvider;
  return typeof injected === "function" ? injected : getUpdatesStatus;
}

router.get("/status", async (req, res) => {
  try {
    const status = await updateStatusProvider(req)();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: { code: "UPDATE_STATUS_FAILED", message: err.message || String(err) },
    });
  }
});

router.post("/check", async (req, res) => {
  try {
    const status = await updateStatusProvider(req)();
    try {
      const { broadcast } = require("../websocket");
      broadcast("update_status", status);
    } catch {
      // WS not initialized (e.g. in isolated tests) — safe to ignore.
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: { code: "UPDATE_CHECK_FAILED", message: err.message || String(err) },
    });
  }
});

module.exports = router;
