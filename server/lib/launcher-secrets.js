/**
 * @file Optional ~/.claude/launcher/secrets.env reader. Profiles declare env
 * var NAMES; values resolve from secrets.env (preferred) or process.env. Never
 * logged. Never serialized into argv.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function secretsPath() {
  return path.join(process.env.HOME || os.homedir(), ".claude", "launcher", "secrets.env");
}

function readSecretsEnv() {
  let text;
  try {
    text = fs.readFileSync(secretsPath(), "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

function resolveEnvForNames(names = []) {
  const secrets = readSecretsEnv();
  const out = {};
  for (const name of names) {
    if (typeof name !== "string" || !name) continue;
    if (Object.prototype.hasOwnProperty.call(secrets, name)) out[name] = secrets[name];
    else if (Object.prototype.hasOwnProperty.call(process.env, name)) out[name] = process.env[name];
  }
  return out;
}

module.exports = { readSecretsEnv, resolveEnvForNames, secretsPath };
