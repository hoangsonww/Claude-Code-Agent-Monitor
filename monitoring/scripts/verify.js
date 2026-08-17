#!/usr/bin/env node
/**
 * @file Verifies the CCAM dashboard and optional Prometheus/Grafana stack are up.
 * Used after `monitoring:up` or `monitoring:docker:up` to confirm scrape health.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD } = require("./paths");

const DASHBOARD_URL = process.env.CCAM_DASHBOARD_URL || "http://127.0.0.1:4820";
const PROMETHEUS_URL = process.env.CCAM_PROMETHEUS_URL || "http://127.0.0.1:9090";
const GRAFANA_URL = process.env.CCAM_GRAFANA_URL || "http://127.0.0.1:3000";
const JSON_MODE = process.argv.includes("--json");

async function checkDashboardHealth() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/health`);
    if (!res.ok) {
      return { name: "Dashboard /api/health", ok: false, detail: `HTTP ${res.status}` };
    }
    const body = await res.json();
    const detail = body.version ? `v${body.version}` : undefined;
    return { name: "Dashboard /api/health", ok: true, detail, version: body.version };
  } catch (err) {
    return { name: "Dashboard /api/health", ok: false, detail: err.message };
  }
}

async function check(name, url, ok = (res) => res.ok) {
  try {
    const res = await fetch(url);
    if (!ok(res)) {
      return { name, ok: false, detail: `HTTP ${res.status}` };
    }
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, detail: err.message };
  }
}

async function checkPrometheusTarget(attempts = 12, intervalMs = 2500) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await checkPrometheusTargetOnce();
    if (result.ok) return result;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
    if (i === attempts - 1) return result;
  }
  return { name: "Prometheus ccam target", ok: false, detail: "timeout" };
}

async function checkPrometheusTargetOnce() {
  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/targets`);
    if (!res.ok) return { name: "Prometheus ccam target", ok: false, detail: `HTTP ${res.status}` };
    const body = await res.json();
    const target = body?.data?.activeTargets?.find((t) => t.labels?.job === "ccam");
    if (!target) return { name: "Prometheus ccam target", ok: false, detail: "job not found" };
    if (target.health !== "up") {
      return {
        name: "Prometheus ccam target",
        ok: false,
        detail: target.lastError || `health=${target.health}`,
      };
    }
    return { name: "Prometheus ccam target", ok: true, detail: target.scrapeUrl };
  } catch (err) {
    return { name: "Prometheus ccam target", ok: false, detail: err.message };
  }
}

async function checkGrafanaLogin() {
  try {
    const res = await fetch(`${GRAFANA_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: GRAFANA_ADMIN_USER,
        password: GRAFANA_ADMIN_PASSWORD,
      }),
    });
    if (!res.ok) {
      return { name: "Grafana admin login", ok: false, detail: `HTTP ${res.status}` };
    }
    const body = await res.json();
    if (body?.message !== "Logged in") {
      return { name: "Grafana admin login", ok: false, detail: body?.message || "login rejected" };
    }
    return { name: "Grafana admin login", ok: true, detail: grafanaLoginDetail() };
  } catch (err) {
    return { name: "Grafana admin login", ok: false, detail: err.message };
  }
}

function grafanaLoginDetail() {
  return `${GRAFANA_ADMIN_USER} / ${GRAFANA_ADMIN_PASSWORD}`;
}

async function checkPrometheusMetrics() {
  try {
    const queries = [
      { name: "Prometheus ccam_up", q: "ccam_up" },
      { name: "Prometheus total sessions", q: "sum(ccam_sessions)" },
    ];
    const results = [];
    for (const { name, q } of queries) {
      const res = await fetch(
        `${PROMETHEUS_URL}/api/v1/query?${new URLSearchParams({ query: q })}`
      );
      if (!res.ok) {
        results.push({ name, ok: false, detail: `HTTP ${res.status}` });
        continue;
      }
      const body = await res.json();
      const series = body?.data?.result;
      if (!Array.isArray(series) || series.length === 0) {
        results.push({ name, ok: false, detail: "no series (is CCAM scraping?)" });
        continue;
      }
      const sample = series[0]?.value?.[1];
      results.push({ name, ok: true, detail: `${q} = ${sample}` });
    }
    return results;
  } catch (err) {
    return [{ name: "Prometheus ccam metrics", ok: false, detail: err.message }];
  }
}

async function checkPrometheusConsole() {
  try {
    const res = await fetch(`${PROMETHEUS_URL}/consoles/index.html`);
    if (!res.ok) {
      return { name: "Prometheus CCAM console", ok: false, detail: `HTTP ${res.status}` };
    }
    const html = await res.text();
    if (!html.includes("CCAM")) {
      return { name: "Prometheus CCAM console", ok: false, detail: "unexpected page body" };
    }
    return { name: "Prometheus CCAM console", ok: true, detail: "/consoles/index.html" };
  } catch (err) {
    return { name: "Prometheus CCAM console", ok: false, detail: err.message };
  }
}

async function main() {
  const checks = [
    await checkDashboardHealth(),
    await check(
      "Dashboard /api/metrics",
      `${DASHBOARD_URL}/api/metrics`,
      (res) => res.ok && res.headers.get("content-type")?.includes("text/plain")
    ),
    await check("Prometheus /-/ready", `${PROMETHEUS_URL}/-/ready`),
    await checkPrometheusConsole(),
    await check("Grafana /api/health", `${GRAFANA_URL}/api/health`),
    await checkGrafanaLogin(),
    await checkPrometheusTarget(),
    ...(await checkPrometheusMetrics()),
  ];

  let failed = 0;
  for (const c of checks) {
    if (c.ok) {
      if (!JSON_MODE) {
        console.log(`✔ ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
      }
    } else {
      failed += 1;
      if (!JSON_MODE) {
        console.error(`✖ ${c.name}: ${c.detail || "failed"}`);
      }
    }
  }

  if (JSON_MODE) {
    const payload = {
      ok: failed === 0,
      checks,
      urls: {
        dashboard: DASHBOARD_URL,
        prometheus: PROMETHEUS_URL,
        grafana: GRAFANA_URL,
        metrics: `${DASHBOARD_URL}/api/metrics`,
      },
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(failed > 0 ? 1 : 0);
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nMonitoring stack OK.");
  console.log(`  Grafana:    ${GRAFANA_URL}  (${grafanaLoginDetail()})`);
  console.log(`  Console:    ${PROMETHEUS_URL}/consoles/index.html`);
  console.log(`  Graph:      ${PROMETHEUS_URL}/graph`);
  console.log(`  Metrics:    ${DASHBOARD_URL}/api/metrics`);
}

main();
