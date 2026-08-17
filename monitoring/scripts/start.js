#!/usr/bin/env node
/**
 * @file Starts the npm-managed Prometheus + Grafana stack (no Docker / no Brew).
 * Downloads binaries on first run if monitoring:setup has not been run yet.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  PROMETHEUS_CONFIG,
  PROMETHEUS_DATA,
  GRAFANA_DATA,
  RUNTIME_PROVISIONING,
  prometheusBinary,
  prometheusServerArgs,
  PROMETHEUS_CONSOLES_URL,
  grafanaBinary,
  grafanaHome,
  grafanaAdminEnv,
  grafanaLoginLabel,
  binariesReady,
} = require("./paths");
const {
  readPid,
  isRunning,
  writePid,
  writeGrafanaProvisioning,
  spawnDetached,
  spawnForeground,
  waitForHttp,
  killProcess,
  PROMETHEUS_PID,
  GRAFANA_PID,
  PROMETHEUS_LOG,
  GRAFANA_LOG,
} = require("./lib");

const detached = process.argv.includes("--detach") || process.argv.includes("-d");
const foreground = process.argv.includes("--foreground") || process.argv.includes("-f");

async function ensureBinaries() {
  if (binariesReady()) return;
  console.log("Monitoring binaries not found — running setup…");
  const script = path.join(__dirname, "ensure-binaries.js");
  const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function assertNotRunning() {
  for (const [file, label] of [
    [PROMETHEUS_PID, "Prometheus"],
    [GRAFANA_PID, "Grafana"],
  ]) {
    const pid = readPid(file);
    if (isRunning(pid)) {
      console.error(`${label} is already running (pid ${pid}). Run: npm run monitoring:down`);
      process.exit(1);
    }
  }
}

function startPrometheus() {
  fs.mkdirSync(PROMETHEUS_DATA, { recursive: true });
  const args = prometheusServerArgs(PROMETHEUS_CONFIG);
  const binary = prometheusBinary();
  if (detached || (!foreground && !process.stdout.isTTY)) {
    const pid = spawnDetached(binary, args, {}, PROMETHEUS_LOG);
    writePid(PROMETHEUS_PID, pid);
    return pid;
  }
  return spawnForeground(binary, args, {});
}

function startGrafana() {
  fs.mkdirSync(GRAFANA_DATA, { recursive: true });
  writeGrafanaProvisioning();
  const env = {
    GF_PATHS_HOME: grafanaHome(),
    GF_PATHS_DATA: GRAFANA_DATA,
    GF_PATHS_PROVISIONING: RUNTIME_PROVISIONING,
    ...grafanaAdminEnv(),
  };
  const args = ["server", "--homepath", grafanaHome()];
  const binary = grafanaBinary();
  if (detached || (!foreground && !process.stdout.isTTY)) {
    const pid = spawnDetached(binary, args, env, GRAFANA_LOG);
    writePid(GRAFANA_PID, pid);
    return pid;
  }
  return spawnForeground(binary, args, env);
}

async function main() {
  await ensureBinaries();
  assertNotRunning();

  console.log("Starting CCAM monitoring stack…");
  console.log(`  Prometheus config: ${PROMETHEUS_CONFIG}`);
  console.log(`  Grafana home:      ${grafanaHome()}`);

  if (detached || (!foreground && !process.stdout.isTTY)) {
    const promPid = startPrometheus();
    const grafPid = startGrafana();
    const promOk = await waitForHttp("http://127.0.0.1:9090/-/ready");
    const grafOk = await waitForHttp("http://127.0.0.1:3000/api/health");
    console.log("");
    console.log(
      `Prometheus  http://localhost:9090  (pid ${promPid})${promOk ? "" : "  [still starting]"}`
    );
    console.log(`  CCAM console:    ${PROMETHEUS_CONSOLES_URL}`);
    console.log(
      `Grafana     http://localhost:3000  (pid ${grafPid})  ${grafanaLoginLabel()}${grafOk ? "" : "  [still starting]"}`
    );
    console.log(
      "CCAM dashboards auto-provisioned (Overview, Sessions & Agents, Tokens & Events, Platform Health)."
    );
    console.log("Stop with: npm run monitoring:down");
    if (!promOk || !grafOk) {
      console.log(`Logs: ${PROMETHEUS_LOG}  ${GRAFANA_LOG}`);
    }
    return;
  }

  // Foreground: Prometheus in background, Grafana in foreground (Grafana owns the tty).
  const promPid = spawnDetached(
    prometheusBinary(),
    prometheusServerArgs(PROMETHEUS_CONFIG),
    {},
    PROMETHEUS_LOG
  );
  writePid(PROMETHEUS_PID, promPid);
  console.log(`Prometheus running at http://localhost:9090 (pid ${promPid})`);
  console.log(`  CCAM console: ${PROMETHEUS_CONSOLES_URL}`);
  console.log(
    `Grafana starting at http://localhost:3000 (${grafanaLoginLabel()}) — Ctrl+C stops both`
  );
  const graf = startGrafana();
  const shutdown = () => {
    killProcess(promPid);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  graf.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(`monitoring:start failed: ${err.message}`);
  process.exit(1);
});
