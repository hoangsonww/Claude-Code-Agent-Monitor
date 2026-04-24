/**
 * @file HTTP routes for dashboard self-update status and apply (git pull, npm run setup, restart).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getUpdatesStatus, DEFAULT_ROOT } = require("../lib/update-check");
const { closeServer } = require("../httpServerRef");

const router = Router();

function isLoopbackAddress(addr) {
  if (!addr || typeof addr !== "string") return false;
  if (addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1") return true;
  return false;
}

function isSelfUpdateAllowed(req) {
  const flag = process.env.DASHBOARD_SELF_UPDATE;
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  const addr = req.socket?.remoteAddress;
  return isLoopbackAddress(addr);
}

router.get("/status", async (_req, res) => {
  try {
    const status = await getUpdatesStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: { code: "UPDATE_STATUS_FAILED", message: err.message || String(err) },
    });
  }
});

router.post("/check", async (_req, res) => {
  try {
    const status = await getUpdatesStatus();
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

router.post("/apply", async (req, res) => {
  if (!isSelfUpdateAllowed(req)) {
    return res.status(403).json({
      error: {
        code: "SELF_UPDATE_FORBIDDEN",
        message:
          "Self-update is disabled for this request. From the same computer open the dashboard UI, set DASHBOARD_SELF_UPDATE=1 for non-local access, or remove DASHBOARD_SELF_UPDATE=0.",
      },
    });
  }

  const root = path.resolve(DEFAULT_ROOT);
  const scriptPath = path.join(root, "scripts", "self-update-restart.js");
  try {
    const pre = await getUpdatesStatus(root, { skipFetch: false });
    if (!pre.git_repo) {
      return res.status(400).json({
        error: {
          code: "NOT_A_GIT_REPO",
          message: "This install is not a git clone; use a manual install path instead.",
        },
      });
    }
    if (!pre.update_available) {
      return res.status(400).json({
        error: { code: "ALREADY_UP_TO_DATE", message: "No upstream commits to pull." },
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: { code: "UPDATE_PREFLIGHT_FAILED", message: err.message || String(err) },
    });
  }

  res.json({
    ok: true,
    message:
      "Update started. This process will exit; dependencies install, then the server restarts.",
  });

  setImmediate(() => {
    let logStdio = "ignore";
    const logPath = path.join(root, "self-update.log");
    try {
      const fd = fs.openSync(logPath, "a");
      logStdio = ["ignore", fd, fd];
    } catch {
      // Could not open the log file — fall back to ignoring stdio so the
      // update still runs even if the filesystem is read-only.
    }
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      detached: true,
      stdio: logStdio,
      env: { ...process.env },
    });
    child.unref();
    setTimeout(() => {
      closeServer(() => {
        process.exit(0);
      });
    }, 400);
  });
});

module.exports = router;
