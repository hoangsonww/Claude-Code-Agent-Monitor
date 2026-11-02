#!/usr/bin/env node
/**
 * @file install-cursor-hooks.js
 * @description Installs this dashboard's Cursor `stop` hook into
 * `~/.cursor/hooks.json` without replacing unrelated hook commands. Cursor's
 * agent transcript has no usage records; the stop payload carries the turn's
 * token counts, which the dashboard prices on the Cursor rate card.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { getCursorHome } = require("../server/lib/cursor-home");

const HOOK_HANDLER = path.resolve(__dirname, "hook-handler.js").replace(/\\/g, "/");

function hooksPath() {
  return path.join(getCursorHome(), "hooks.json");
}

function isOurCommand(entry, hookType) {
  if (typeof entry?.command !== "string") return false;
  const command = entry.command.trim();
  return command.includes(HOOK_HANDLER) && command.endsWith(hookType);
}

const CURSOR_HOOKS = [
  ["stop", "Stop"],
  ["afterAgentResponse", "afterAgentResponse"],
];

function getCursorHookStatus() {
  const filePath = hooksPath();
  try {
    if (!fs.existsSync(filePath)) return { installed: false, path: filePath, hooks: {} };
    const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const hooks = {};
    for (const [name, hookType] of CURSOR_HOOKS) {
      const list = Array.isArray(config.hooks?.[name]) ? config.hooks[name] : [];
      hooks[name] = list.some((entry) => isOurCommand(entry, hookType));
    }
    return {
      installed: Object.values(hooks).every(Boolean),
      path: filePath,
      hooks,
    };
  } catch (error) {
    return { installed: false, path: filePath, hooks: {}, error: error.message };
  }
}

function installCursorHooks({ silent = false } = {}) {
  const filePath = hooksPath();
  let config = {};
  try {
    if (fs.existsSync(filePath)) config = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = `Failed to parse ${filePath}: ${error.message}`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCursorHookStatus() };
  }
  if (!config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
    config.hooks = {};
  }
  if (!Array.isArray(config.hooks.stop)) config.hooks.stop = [];
  if (config.version == null) config.version = 1;

  let replaced = 0;
  for (const [name, hookType] of CURSOR_HOOKS) {
    if (!Array.isArray(config.hooks[name])) config.hooks[name] = [];
    const command = `node "${HOOK_HANDLER}" ${hookType}`;
    const index = config.hooks[name].findIndex((entry) => isOurCommand(entry, hookType));
    if (index >= 0) {
      config.hooks[name][index] = { ...config.hooks[name][index], command };
      replaced += 1;
    } else {
      config.hooks[name].push({ command });
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(path.dirname(filePath), `.hooks.json.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`);
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // The temp file may not exist if the write itself failed.
    }
    const message = `Failed to write ${filePath}: ${error.message}`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCursorHookStatus() };
  }
  const status = getCursorHookStatus();
  return {
    ok: status.installed,
    replaced: replaced > 0,
    output: [`Cursor usage hooks ${replaced ? "updated" : "installed"}.`, `Hooks: ${filePath}`],
    status,
  };
}

if (require.main === module) {
  const result = installCursorHooks();
  for (const line of result.output || []) console.log(line);
  if (!result.ok) process.exit(1);
}

module.exports = { installCursorHooks, getCursorHookStatus };
