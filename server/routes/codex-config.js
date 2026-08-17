/**
 * @file HTTP surface for Codex configuration discovery, redacted inspection,
 * tightly scoped text-file editing/deletion with timestamped backups, and
 * explicit creation of Codex profile overlays. Only configuration surfaces
 * users commonly maintain are mutable; the base config remains edit-only.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const codex = require("../lib/codex-config-discovery");
const mutate = require("../lib/codex-config-mutate");
const { broadcast } = require("../websocket");

const router = Router();

function emitChanged(payload) {
  try {
    broadcast("codex_config_changed", { source: "dashboard", ...payload });
  } catch {
    // The websocket service is optional for isolated route tests.
  }
}

function mutationError(res, error) {
  const status =
    error.code === "ETOOLARGE"
      ? 413
      : error.code === "ENOENT"
        ? 404
        : ["ENOTFILE", "EEXIST"].includes(error.code)
          ? 409
          : 400;
  return res.status(status).json({
    error: { code: error.code || "EINTERNAL", message: error.message || "Unable to update file" },
  });
}

router.get("/overview", (_req, res) => {
  res.json(codex.readOverview());
});

router.get("/file", (req, res) => {
  const result = codex.readFileSafe(req.query.path);
  if (result.error) {
    return res.status(400).json({ error: { code: "READ_DENIED", message: result.error } });
  }
  return res.json(result);
});

// This endpoint deliberately returns unredacted text only for the small
// editable allowlist. A redacted preview cannot safely be saved back because
// it would overwrite a user's real secret values with "[redacted]".
router.get("/edit-file", (req, res) => {
  try {
    return res.json(mutate.readEditableFile(req.query.path));
  } catch (error) {
    return mutationError(res, error);
  }
});

router.put("/file", (req, res) => {
  try {
    const result = mutate.writeEditableFile({ file: req.body?.path, content: req.body?.content });
    emitChanged({ action: "write", path: result.file });
    return res.json(result);
  } catch (error) {
    return mutationError(res, error);
  }
});

// Base config.toml is deliberately edit-only. This route accepts only the
// narrower user-managed deletion allowlist from codex-config-mutate, always
// retaining a timestamped backup before it unlinks a file or a skill folder.
router.delete("/file", (req, res) => {
  try {
    const result = mutate.deleteEditableFile({ file: req.body?.path });
    emitChanged({ action: "delete", path: result.file });
    return res.json(result);
  } catch (error) {
    return mutationError(res, error);
  }
});

// Profiles are individual top-level `name.config.toml` overlay files. Codex
// applies them only when invoked with `--profile name`; creation never mutates
// the base config.toml or an existing profile.
router.post("/profiles", (req, res) => {
  try {
    const profile = mutate.createProfile({ name: req.body?.name });
    emitChanged({ action: "create-profile", path: profile.path });
    return res.status(201).json(profile);
  } catch (error) {
    return mutationError(res, error);
  }
});

module.exports = router;
