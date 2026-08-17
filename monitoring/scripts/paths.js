/**
 * @file Shared paths and version pins for the CCAM monitoring stack.
 * Binaries are downloaded into monitoring/.bin/ by ensure-binaries.js so the
 * stack runs with plain npm on macOS, Linux, and Windows — no Homebrew, apt,
 * or global installs required.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const path = require("node:path");

const MONITORING_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(MONITORING_ROOT, "..");

const VERSIONS = {
  prometheus: "3.13.2",
  grafana: "13.1.2",
};

/** Human-readable list for error messages. */
const SUPPORTED_TARGETS = [
  "macOS (Apple Silicon / Intel)",
  "Linux (arm64 / amd64)",
  "Windows (x64)",
];

const BIN_ROOT = path.join(MONITORING_ROOT, ".bin");
const DATA_ROOT = path.join(MONITORING_ROOT, ".data");
const PROMETHEUS_DATA = path.join(DATA_ROOT, "prometheus");
const GRAFANA_DATA = path.join(DATA_ROOT, "grafana");
const RUNTIME_PROVISIONING = path.join(DATA_ROOT, "grafana-provisioning");

const PROMETHEUS_CONFIG = path.join(MONITORING_ROOT, "prometheus", "prometheus-native.yml");
const PROMETHEUS_CONSOLES = path.join(MONITORING_ROOT, "prometheus", "consoles");
const GRAFANA_DASHBOARDS = path.join(MONITORING_ROOT, "grafana", "dashboards");
const GRAFANA_DATASOURCE_TEMPLATE = path.join(
  MONITORING_ROOT,
  "grafana",
  "provisioning-native",
  "datasources",
  "datasource.yml"
);

const PROMETHEUS_PID = path.join(DATA_ROOT, "prometheus.pid");
const GRAFANA_PID = path.join(DATA_ROOT, "grafana.pid");
const PROMETHEUS_LOG = path.join(DATA_ROOT, "prometheus.log");
const GRAFANA_LOG = path.join(DATA_ROOT, "grafana.log");

function isWindows() {
  return process.platform === "win32";
}

/**
 * Maps Node's `process.arch` to Prometheus/Grafana release asset arch slugs.
 * @returns {"arm64"|"amd64"}
 */
function releaseArch() {
  if (process.arch === "arm64") return "arm64";
  if (process.arch === "x64") return "amd64";
  throw new Error(
    `Unsupported CPU architecture "${process.arch}". Supported: ${SUPPORTED_TARGETS.join(", ")}.`
  );
}

/** @returns {string} Prometheus platform slug used in release asset names. */
function prometheusPlatform() {
  const arch = releaseArch();
  if (process.platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-amd64";
  if (process.platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux-amd64";
  if (process.platform === "win32") return "windows-amd64";
  throw new Error(
    `Unsupported OS "${process.platform}". Supported: ${SUPPORTED_TARGETS.join(", ")}.`
  );
}

/** @returns {string} Grafana platform slug used in release asset names. */
function grafanaPlatform() {
  return prometheusPlatform();
}

function prometheusArchiveName() {
  return `prometheus-${VERSIONS.prometheus}.${prometheusPlatform()}`;
}

function grafanaArchiveName() {
  return `grafana-${VERSIONS.grafana}.${grafanaPlatform()}`;
}

function prometheusArchiveExt() {
  return isWindows() ? "zip" : "tar.gz";
}

function grafanaArchiveExt() {
  return isWindows() ? "zip" : "tar.gz";
}

function prometheusUrl() {
  const name = prometheusArchiveName();
  return `https://github.com/prometheus/prometheus/releases/download/v${VERSIONS.prometheus}/${name}.${prometheusArchiveExt()}`;
}

function grafanaUrl() {
  const plat = grafanaPlatform();
  return `https://dl.grafana.com/oss/release/grafana-${VERSIONS.grafana}.${plat}.${grafanaArchiveExt()}`;
}

function prometheusHome() {
  return path.join(BIN_ROOT, "prometheus");
}

function grafanaHome() {
  return path.join(BIN_ROOT, "grafana");
}

function prometheusBinary() {
  const name = isWindows() ? "prometheus.exe" : "prometheus";
  return path.join(prometheusHome(), name);
}

function grafanaBinary() {
  const name = isWindows() ? "grafana.exe" : "grafana";
  return path.join(grafanaHome(), "bin", name);
}

const GRAFANA_ADMIN_USER = "admin";
const GRAFANA_ADMIN_PASSWORD = "admin";

/** Grafana env vars that seed the default admin account on first start. */
function grafanaAdminEnv() {
  return {
    GF_SECURITY_ADMIN_USER: GRAFANA_ADMIN_USER,
    GF_SECURITY_ADMIN_PASSWORD: GRAFANA_ADMIN_PASSWORD,
    GF_USERS_ALLOW_SIGN_UP: "false",
    GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_UID: "ccam-overview",
  };
}

function grafanaLoginLabel() {
  return `${GRAFANA_ADMIN_USER} / ${GRAFANA_ADMIN_PASSWORD}`;
}

/** Grafana file providers require forward slashes even on Windows. */
function toGrafanaPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

/** CLI args for Prometheus 3.x (console libraries removed upstream). */
function prometheusServerArgs(configFile, storagePath = PROMETHEUS_DATA) {
  return [
    `--config.file=${configFile}`,
    `--storage.tsdb.path=${storagePath}`,
    "--web.enable-lifecycle",
    `--web.console.templates=${PROMETHEUS_CONSOLES}`,
  ];
}

function prometheusDockerServerArgs(configFile) {
  return [
    `--config.file=${configFile}`,
    `--storage.tsdb.path=/prometheus`,
    "--web.enable-lifecycle",
    `--web.console.templates=/etc/prometheus/consoles`,
  ];
}

const PROMETHEUS_CONSOLES_URL = "http://localhost:9090/consoles/index.html";

function binariesReady() {
  const fs = require("node:fs");
  return fs.existsSync(prometheusBinary()) && fs.existsSync(grafanaBinary());
}

module.exports = {
  MONITORING_ROOT,
  REPO_ROOT,
  VERSIONS,
  SUPPORTED_TARGETS,
  BIN_ROOT,
  DATA_ROOT,
  PROMETHEUS_DATA,
  GRAFANA_DATA,
  RUNTIME_PROVISIONING,
  PROMETHEUS_CONFIG,
  PROMETHEUS_CONSOLES,
  PROMETHEUS_CONSOLES_URL,
  GRAFANA_DASHBOARDS,
  GRAFANA_DATASOURCE_TEMPLATE,
  PROMETHEUS_PID,
  GRAFANA_PID,
  PROMETHEUS_LOG,
  GRAFANA_LOG,
  isWindows,
  releaseArch,
  prometheusPlatform,
  grafanaPlatform,
  prometheusArchiveName,
  grafanaArchiveName,
  prometheusArchiveExt,
  grafanaArchiveExt,
  prometheusUrl,
  grafanaUrl,
  prometheusHome,
  grafanaHome,
  prometheusBinary,
  grafanaBinary,
  prometheusServerArgs,
  prometheusDockerServerArgs,
  GRAFANA_ADMIN_USER,
  GRAFANA_ADMIN_PASSWORD,
  grafanaAdminEnv,
  grafanaLoginLabel,
  toGrafanaPath,
  binariesReady,
};
