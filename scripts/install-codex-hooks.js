#!/usr/bin/env node
// Installs this dashboard's supported Codex lifecycle hooks without touching
// unrelated user hooks in ~/.codex/hooks.json.
// @author Son Nguyen <hoangson091104@gmail.com>

const fs = require("fs");
const path = require("path");
const { getCodexHooksPath } = require("../server/lib/codex-home");

const HOOK_HANDLER = path.resolve(__dirname, "codex-hook-handler.js").replace(/\\/g, "/");
// PreToolUse gets the freshly completed model turn into the dashboard before a
// long-running tool finishes; PostToolUse catches the resulting tool output.
const HOOK_TYPES = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SessionEnd",
];

function isOurEntry(entry) {
  if (entry?.command?.includes("codex-hook-handler.js")) return true;
  return Array.isArray(entry?.hooks)
    ? entry.hooks.some((hook) => hook?.command?.includes("codex-hook-handler.js"))
    : false;
}

function getCodexHookStatus() {
  const hooksPath = getCodexHooksPath();
  try {
    if (!fs.existsSync(hooksPath)) return { installed: false, path: hooksPath, hooks: {} };
    const config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    const hooks = Object.fromEntries(
      HOOK_TYPES.map((type) => [type, (config.hooks?.[type] || []).some(isOurEntry)])
    );
    const hookLists = Object.values(config.hooks || {}).filter(Array.isArray);
    return {
      installed: Object.values(hooks).every(Boolean),
      has_dashboard_hooks: Object.values(hooks).some(Boolean),
      has_existing_hooks: hookLists.some((entries) => entries.length > 0),
      path: hooksPath,
      hooks,
    };
  } catch (error) {
    return { installed: false, path: hooksPath, hooks: {}, error: error.message };
  }
}

function makeHookEntry(type) {
  return {
    hooks: [
      {
        type: "command",
        command: `node "${HOOK_HANDLER}" ${type}`,
        timeout: 3,
      },
    ],
  };
}

function installCodexHooks({ silent = false } = {}) {
  const hooksPath = getCodexHooksPath();
  let config = {};
  try {
    if (fs.existsSync(hooksPath)) config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  } catch (error) {
    const message = `Failed to parse ${hooksPath}: ${error.message}`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCodexHookStatus() };
  }
  if (!config.hooks || typeof config.hooks !== "object") config.hooks = {};

  const previous = getCodexHookStatus();
  let installed = 0;
  let updated = 0;
  for (const type of HOOK_TYPES) {
    if (!Array.isArray(config.hooks[type])) config.hooks[type] = [];
    const index = config.hooks[type].findIndex(isOurEntry);
    if (index >= 0) {
      config.hooks[type][index] = makeHookEntry(type);
      updated++;
    } else {
      config.hooks[type].push(makeHookEntry(type));
      installed++;
    }
  }
  try {
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch (error) {
    const message = `Failed to write ${hooksPath}: ${error.message}`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCodexHookStatus() };
  }

  const output = [
    `Codex hook handler: ${HOOK_HANDLER}`,
    `Hooks file: ${hooksPath}`,
    `Installed: ${installed} new, updated: ${updated} existing dashboard hook entries`,
    previous.installed
      ? "Existing dashboard Codex hooks were replaced with the current handler configuration."
      : "Codex hooks configured. Start or resume a Codex session to begin tracking.",
  ];
  if (!silent) output.forEach((line) => console.log(line));
  return {
    ok: true,
    output,
    status: getCodexHookStatus(),
    installed,
    updated,
    replaced: previous.installed,
  };
}

if (require.main === module) {
  const result = installCodexHooks();
  if (!result.ok) process.exitCode = 1;
}

module.exports = { HOOK_TYPES, getCodexHookStatus, installCodexHooks };
