#!/usr/bin/env node
/**
 * @file Installs the dashboard's Cursor completion/usage hooks without
 * replacing unrelated commands. Writes are atomic and preserve regular files,
 * symlinks, dangling symlink targets, and existing permission modes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { getCursorHome } = require("../server/lib/cursor-home");

const HOOK_HANDLER = path.resolve(__dirname, "hook-handler.js").replace(/\\/g, "/");
const CURSOR_HOOKS = [
  ["stop", "Stop"],
  ["afterAgentResponse", "afterAgentResponse"],
];

function hookCommand(hookType) {
  return `node "${HOOK_HANDLER}" ${hookType}`;
}

function hooksPath() {
  return path.join(getCursorHome(), "hooks.json");
}

function isOurCommand(entry, hookType) {
  if (typeof entry?.command !== "string") return false;
  return entry.command.trim() === hookCommand(hookType);
}

function isSymbolicLink(target) {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function getCursorHookStatus() {
  const filePath = hooksPath();
  try {
    if (!fs.existsSync(filePath)) return { installed: false, path: filePath, hooks: {} };
    const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const hooks = {};
    for (const [name, hookType] of CURSOR_HOOKS) {
      const entries = Array.isArray(config.hooks?.[name]) ? config.hooks[name] : [];
      hooks[name] = entries.some((entry) => isOurCommand(entry, hookType));
    }
    return { installed: Object.values(hooks).every(Boolean), path: filePath, hooks };
  } catch (error) {
    return { installed: false, path: filePath, hooks: {}, error: error.message };
  }
}

function writeHooksFile(filePath, body) {
  let destination = filePath;
  let mode = 0o600;
  try {
    const linkStat = fs.lstatSync(filePath);
    if (linkStat.isSymbolicLink()) {
      destination = path.resolve(path.dirname(filePath), fs.readlinkSync(filePath));
      const visited = new Set([path.resolve(filePath)]);
      for (let hops = 0; hops < 40 && isSymbolicLink(destination); hops++) {
        if (visited.has(destination)) {
          throw new Error(`Symbolic link cycle while resolving ${filePath}`);
        }
        visited.add(destination);
        destination = path.resolve(path.dirname(destination), fs.readlinkSync(destination));
      }
      if (isSymbolicLink(destination)) {
        throw new Error(`Too many symbolic link levels while resolving ${filePath}`);
      }
      try {
        mode = fs.statSync(destination).mode & 0o777;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    } else {
      mode = linkStat.mode & 0o777;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = path.join(path.dirname(destination), `.hooks.json.${process.pid}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "w", mode);
    fs.writeFileSync(descriptor, body);
    try {
      fs.fchmodSync(descriptor, mode);
    } catch {
      // Some filesystems do not support chmod; the completed bytes are safe.
    }
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Already closed.
      }
    }
    try {
      fs.unlinkSync(temporary);
    } catch {
      // No partial temp file remains when creation itself failed.
    }
    throw error;
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
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    const message = `Failed to parse ${filePath}: expected a JSON object`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCursorHookStatus() };
  }
  if (!config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
    config.hooks = {};
  }
  if (config.version == null) config.version = 1;
  let updated = 0;
  for (const [name, hookType] of CURSOR_HOOKS) {
    if (!Array.isArray(config.hooks[name])) config.hooks[name] = [];
    const command = hookCommand(hookType);
    const matches = config.hooks[name]
      .map((entry, index) => (isOurCommand(entry, hookType) ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length) {
      config.hooks[name][matches[0]] = { ...config.hooks[name][matches[0]], command };
      for (const index of matches.slice(1).reverse()) config.hooks[name].splice(index, 1);
      updated++;
    } else {
      config.hooks[name].push({ command });
    }
  }
  try {
    writeHooksFile(filePath, `${JSON.stringify(config, null, 2)}\n`);
  } catch (error) {
    const message = `Failed to write ${filePath}: ${error.message}`;
    if (!silent) console.error(message);
    return { ok: false, output: [message], status: getCursorHookStatus() };
  }
  const status = getCursorHookStatus();
  return {
    ok: status.installed,
    replaced: updated > 0,
    output: [`Cursor usage hooks ${updated ? "updated" : "installed"}.`, `Hooks: ${filePath}`],
    status,
  };
}

if (require.main === module) {
  const result = installCursorHooks();
  for (const line of result.output || []) console.log(line);
  if (!result.ok) process.exit(1);
}

module.exports = { getCursorHookStatus, installCursorHooks };
