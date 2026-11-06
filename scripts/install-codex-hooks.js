#!/usr/bin/env node
// Installs this dashboard's supported host-side Codex lifecycle hooks without
// touching unrelated entries, rejecting container-only paths unless opted in.
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

function hasUsableHandler(entry) {
  const commands = [
    entry?.command,
    ...(Array.isArray(entry?.hooks) ? entry.hooks.map((hook) => hook?.command) : []),
  ];
  return commands.some((command) => {
    if (typeof command !== "string" || !command.includes("codex-hook-handler.js")) return false;
    const quoted = command.match(/"([^"]*codex-hook-handler\.js)"/);
    const unquoted = command.match(/(?:^|\s)([^\s"']*codex-hook-handler\.js)(?=\s|$)/);
    const handler = quoted?.[1] || unquoted?.[1];
    return Boolean(handler && fs.existsSync(handler));
  });
}

function getCodexHookStatus() {
  const hooksPath = getCodexHooksPath();
  try {
    if (!fs.existsSync(hooksPath)) return { installed: false, path: hooksPath, hooks: {} };
    const config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    const hooks = Object.fromEntries(
      HOOK_TYPES.map((type) => [
        type,
        (config.hooks?.[type] || []).some((entry) => isOurEntry(entry) && hasUsableHandler(entry)),
      ])
    );
    const hookLists = Object.values(config.hooks || {}).filter(Array.isArray);
    return {
      installed: Object.values(hooks).every(Boolean),
      has_dashboard_hooks: hookLists.some((entries) => entries.some(isOurEntry)),
      has_existing_hooks: hookLists.some((entries) => entries.length > 0),
      path: hooksPath,
      hooks,
    };
  } catch (error) {
    return { installed: false, path: hooksPath, hooks: {}, error: error.message };
  }
}

function normalizeDashboardPort(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error("--dashboard-port must be an integer between 1 and 65535.");
  }
  const port = Number.parseInt(raw, 10);
  if (port < 1 || port > 65535) {
    throw new Error("--dashboard-port must be an integer between 1 and 65535.");
  }
  return port;
}

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

function makeHookEntry(type, dashboardPort = null) {
  const portAssignment = dashboardPort
    ? `process.env.CLAUDE_DASHBOARD_PORT='${dashboardPort}';`
    : "";
  const command = `node -e "${portAssignment}if(require('fs').existsSync(process.argv[1]))require(process.argv[1])" "${HOOK_HANDLER}" ${type}`;
  return {
    hooks: [
      {
        type: "command",
        command,
        timeout: 3,
      },
    ],
  };
}

function installCodexHooks({ silent = false, dashboardPort = null } = {}) {
  const resolvedDashboardPort = normalizeDashboardPort(dashboardPort);
  const hooksPath = getCodexHooksPath();
  if (require("./install-hooks").isInsideContainer() && !envFlag("CCAM_ALLOW_CONTAINER_HOOKS")) {
    const message =
      "Refusing to install Codex hooks from inside a container; run the host installer with --dashboard-port instead.";
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCodexHookStatus() };
  }
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
      config.hooks[type][index] = makeHookEntry(type, resolvedDashboardPort);
      updated++;
    } else {
      config.hooks[type].push(makeHookEntry(type, resolvedDashboardPort));
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
    ...(resolvedDashboardPort
      ? [`Hook target: http://127.0.0.1:${resolvedDashboardPort} (embedded explicit override)`]
      : []),
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
