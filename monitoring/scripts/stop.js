#!/usr/bin/env node
/**
 * @file Stops the npm-managed Prometheus + Grafana stack started by start.js.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { stopPid, PROMETHEUS_PID, GRAFANA_PID } = require("./lib");

const stoppedGrafana = stopPid(GRAFANA_PID, "Grafana");
const stoppedPrometheus = stopPid(PROMETHEUS_PID, "Prometheus");

if (!stoppedGrafana && !stoppedPrometheus) {
  console.log("Monitoring stack is not running.");
} else {
  console.log("Monitoring stack stopped.");
}
