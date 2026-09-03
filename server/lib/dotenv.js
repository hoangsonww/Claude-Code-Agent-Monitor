/**
 * @file Loads the dashboard's `.env` file (or `DASHBOARD_ENV_PATH`) into
 * process.env without overriding values already set. Simple key=value lines,
 * no external dependency. Shared by the server and the maintenance scripts so
 * they all resolve the same database and the same settings.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

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
