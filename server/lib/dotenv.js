/**
 * @file Loads the dashboard's dotenv file (simple key=value, no external dependency) into
 * process.env without overriding variables that are already set. Shared by the server and the
 * CLI scripts that must resolve the same paths the server does.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

/** Read DASHBOARD_ENV_PATH, else the repository `.env`, into process.env. */
function loadDotEnv() {
  const envPath = path.resolve(
    process.env.DASHBOARD_ENV_PATH || path.resolve(__dirname, "..", "..", ".env")
  );
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val.replace(/^~(?=\/)/, os.homedir());
    }
  }
}

module.exports = { loadDotEnv };
