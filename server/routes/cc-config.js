/**
 * @file cc-config.js
 * @description HTTP surface for inspecting and (carefully) mutating Claude
 * Code configuration: skills, subagents, slash commands, output styles,
 * plugins, marketplaces, MCP servers, hooks, settings, memory, keybindings,
 * statusline, hook scripts. Powers the Claude Config Explorer dashboard
 * page.
 *
 * Read paths cover every surface. Write paths exist only for low-risk
 * text-file artifacts (skills, agents, commands, output styles, memory, and
 * per-project auto-memory files) and always create a timestamped backup
 * before mutating. Plugins, MCP servers,
 * and the live settings.json files stay read-only because they are written
 * concurrently by the running Claude Code CLI.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const cc = require("../lib/cc-discovery");
const ccMutate = require("../lib/cc-mutate");
const { broadcast } = require("../websocket");

const router = Router();

function emitChanged(payload) {
  try {
    broadcast("cc_config_changed", { source: "dashboard", ...payload });
  } catch {
    /* websocket may not be initialised in unit tests */
  }
}

// Map mutate-error codes → HTTP status. Anything unmapped is a 500.
const ERR_TO_STATUS = {
  EBADTYPE: 400,
  EBADSCOPE: 400,
  EBADNAME: 400,
  EBADPROJECT: 400,
  EBADCONTENT: 400,
  ETOOLARGE: 413,
  EOUTOFROOT: 400,
  ENOTFOUND: 404,
};

function mutateError(res, err) {
  const status = ERR_TO_STATUS[err.code] || 500;
  return res
    .status(status)
    .json({ error: { code: err.code || "EINTERNAL", message: err.message } });
}

function scopeOf(req) {
  const s = String(req.query.scope || "all");
  return s === "user" || s === "project" ? s : "all";
}

function cwdOf(req) {
  // The dashboard server's own cwd is the natural "project" — but allow
  // override via ?cwd= so the user can inspect another working dir without
  // restarting the server.
  const c = typeof req.query.cwd === "string" && req.query.cwd ? req.query.cwd : null;
  return c || process.cwd();
}

router.get("/overview", (req, res) => {
  res.json(cc.readOverview({ cwd: cwdOf(req) }));
});

router.get("/skills", (req, res) => {
  res.json({ items: cc.readSkills({ scope: scopeOf(req), cwd: cwdOf(req) }) });
});

router.get("/agents", (req, res) => {
  res.json({ items: cc.readAgents({ scope: scopeOf(req), cwd: cwdOf(req) }) });
});

router.get("/commands", (req, res) => {
  res.json({ items: cc.readCommands({ scope: scopeOf(req), cwd: cwdOf(req) }) });
});

router.get("/output-styles", (req, res) => {
  res.json({ items: cc.readOutputStyles({ scope: scopeOf(req), cwd: cwdOf(req) }) });
});

router.get("/plugins", (_req, res) => {
  res.json(cc.readPlugins());
});

router.get("/mcp", (req, res) => {
  res.json(cc.readMcpServers({ cwd: cwdOf(req) }));
});

router.get("/hooks", (req, res) => {
  res.json({ items: cc.readHooks({ cwd: cwdOf(req) }) });
});

router.get("/settings", (req, res) => {
  res.json({ items: cc.readSettings({ cwd: cwdOf(req) }) });
});

router.get("/memory", (req, res) => {
  res.json({ items: cc.readMemory({ cwd: cwdOf(req) }) });
});

router.get("/marketplaces", (_req, res) => {
  res.json(cc.readMarketplaces());
});

router.get("/keybindings", (_req, res) => {
  res.json(cc.readKeybindings());
});

router.get("/statusline", (_req, res) => {
  res.json(cc.readStatusline());
});

router.get("/hook-scripts", (_req, res) => {
  res.json(cc.readHookScripts());
});

// GET /api/cc-config/file?path=/abs/path  — return body of a single file.
// Path must resolve under CLAUDE_HOME, project .claude/, or be project CLAUDE.md.
router.get("/file", (req, res) => {
  const p = req.query.path;
  if (typeof p !== "string" || !p) {
    return res.status(400).json({ error: { code: "BAD_PATH", message: "path is required" } });
  }
  const result = cc.readFileSafe(p, { cwd: cwdOf(req) });
  if (result.error)
    return res.status(400).json({ error: { code: "READ_DENIED", message: result.error } });
  res.json(result);
});

// ── Phase-2 mutation endpoints ─────────────────────────────────────────
//
// PUT  /api/cc-config/file   — create or overwrite. Body: { scope, type, name?, content }
// DELETE /api/cc-config/file — delete. Body: { scope, type, name? }
// GET  /api/cc-config/backups[?scope=&type=] — list backups
//
// Plugins, MCP, hooks-in-settings, and settings.json files are intentionally
// not mutable here. See cc-mutate.js for the rationale.

router.put("/file", (req, res) => {
  const { scope, type, name, content, project } = req.body || {};
  if (typeof scope !== "string" || typeof type !== "string") {
    return res
      .status(400)
      .json({ error: { code: "EBADREQ", message: "scope and type are required" } });
  }
  try {
    const result = ccMutate.writeArtifact({ scope, type, name, content, project, cwd: cwdOf(req) });
    emitChanged({ action: "write", scope, type, name: name || null, project: project || null });
    res.json(result);
  } catch (err) {
    return mutateError(res, err);
  }
});

router.delete("/file", (req, res) => {
  const { scope, type, name, project } = req.body || {};
  if (typeof scope !== "string" || typeof type !== "string") {
    return res
      .status(400)
      .json({ error: { code: "EBADREQ", message: "scope and type are required" } });
  }
  try {
    const result = ccMutate.deleteArtifact({ scope, type, name, project, cwd: cwdOf(req) });
    emitChanged({ action: "delete", scope, type, name: name || null, project: project || null });
    res.json(result);
  } catch (err) {
    return mutateError(res, err);
  }
});

router.get("/backups", (req, res) => {
  const scope =
    req.query.scope === "user" || req.query.scope === "project" ? req.query.scope : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  res.json({ items: ccMutate.listBackups({ scope, type, cwd: cwdOf(req) }) });
});

module.exports = router;
