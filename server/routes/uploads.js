/**
 * @file HTTP surface for Composer file uploads. POST accepts multipart, writes
 * to <cwd>/.launcher-uploads/<id>/<name>. DELETE removes the id-folder. Gated
 * by ORCHESTRATOR_ENABLED. cwd must be in the allowlist.
 */
const express = require("express");
const multer = require("multer");
const cwds = require("../lib/cwds");
const { saveUpload, removeUpload } = require("../lib/uploads");

const router = express.Router();
const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
const MAX_MB = Number(process.env.LAUNCHER_MAX_UPLOAD_MB || 25);

router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

router.post("/", upload.single("file"), (req, res) => {
  const cwd = req.body?.cwd;
  if (!cwd || !cwds.isAllowed(cwd)) return res.status(400).json({ error: "cwd not in allowlist" });
  if (!req.file) return res.status(400).json({ error: "file required" });
  try {
    const result = saveUpload({
      cwd,
      originalName: req.file.originalname,
      buffer: req.file.buffer,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.use((err, _req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `file exceeds ${MAX_MB} MB` });
  }
  if (err) return res.status(500).json({ error: err.message });
});

router.delete("/:id", (req, res) => {
  const cwd = req.query?.cwd;
  if (!cwd || !cwds.isAllowed(String(cwd))) return res.status(400).json({ error: "cwd not in allowlist" });
  try {
    const ok = removeUpload({ cwd: String(cwd), id: req.params.id });
    res.status(ok ? 204 : 404).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
