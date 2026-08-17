/**
 * @file Shared helpers for starting and stopping the npm-managed monitoring stack.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
  DATA_ROOT,
  RUNTIME_PROVISIONING,
  GRAFANA_DASHBOARDS,
  GRAFANA_DATASOURCE_TEMPLATE,
  PROMETHEUS_PID,
  GRAFANA_PID,
  PROMETHEUS_LOG,
  GRAFANA_LOG,
  isWindows,
  toGrafanaPath,
} = require("./paths");

function readPid(file) {
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writePid(file, pid) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(pid));
}

function removePid(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    /* already gone */
  }
}

function killProcess(pid) {
  if (!pid) return;
  if (isWindows()) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  process.kill(pid, "SIGTERM");
}

function stopPid(file, label) {
  const pid = readPid(file);
  if (!pid) return false;
  if (!isRunning(pid)) {
    removePid(file);
    return false;
  }
  try {
    killProcess(pid);
    console.log(`Stopped ${label} (pid ${pid})`);
  } catch (err) {
    console.warn(`Could not stop ${label} (pid ${pid}): ${err.message}`);
  }
  removePid(file);
  return true;
}

function writeGrafanaProvisioning() {
  const dashboardsDir = path.join(RUNTIME_PROVISIONING, "dashboards");
  const datasourcesDir = path.join(RUNTIME_PROVISIONING, "datasources");
  fs.mkdirSync(dashboardsDir, { recursive: true });
  fs.mkdirSync(datasourcesDir, { recursive: true });

  fs.copyFileSync(GRAFANA_DATASOURCE_TEMPLATE, path.join(datasourcesDir, "datasource.yml"));

  const provider = [
    "apiVersion: 1",
    "",
    "providers:",
    "  - name: CCAM",
    "    orgId: 1",
    "    type: file",
    "    disableDeletion: false",
    "    updateIntervalSeconds: 30",
    "    allowUiUpdates: true",
    "    options:",
    `      path: ${toGrafanaPath(GRAFANA_DASHBOARDS)}`,
    "      foldersFromFilesStructure: false",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dashboardsDir, "provider.yml"), provider);
}

function spawnDetached(binary, args, env, logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logFd = fs.openSync(logFile, "a");
  const child = spawn(binary, args, {
    detached: !isWindows(),
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  if (!isWindows()) child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

function spawnForeground(binary, args, env) {
  return spawn(binary, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    windowsHide: true,
  });
}

async function waitForHttp(url, attempts = 30, intervalMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

module.exports = {
  readPid,
  isRunning,
  writePid,
  removePid,
  killProcess,
  stopPid,
  writeGrafanaProvisioning,
  spawnDetached,
  spawnForeground,
  waitForHttp,
  PROMETHEUS_PID,
  GRAFANA_PID,
  PROMETHEUS_LOG,
  GRAFANA_LOG,
  DATA_ROOT,
  RUNTIME_PROVISIONING,
};
