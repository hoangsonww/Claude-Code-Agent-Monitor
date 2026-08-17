/**
 * @file Shared fail-safe transport for Claude Code and Codex hook handlers.
 * It preserves loopback fan-out by default and supports an opt-in HTTPS remote
 * dashboard with a dedicated token for cloud deployments.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function readHookToken() {
  const direct = process.env.CCAM_HOOK_TOKEN;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const tokenPath = process.env.CCAM_HOOK_TOKEN_FILE;
  if (typeof tokenPath !== "string" || !tokenPath.trim()) return null;
  try {
    return fs.readFileSync(tokenPath.trim(), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function remoteDashboardUrl() {
  const raw = process.env.CCAM_DASHBOARD_URL;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CCAM_DASHBOARD_URL must use http or https");
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("Remote CCAM_DASHBOARD_URL values must use HTTPS");
  }
  return url;
}

function buildTargets(resolvePorts, endpointPath) {
  const remote = remoteDashboardUrl();
  if (remote) {
    if (!LOOPBACK_HOSTS.has(remote.hostname) && !readHookToken()) {
      throw new Error("Remote CCAM_DASHBOARD_URL values require CCAM_HOOK_TOKEN");
    }
    const target = new URL(remote.toString());
    target.pathname = endpointPath;
    target.search = "";
    target.hash = "";
    return [target];
  }
  return resolvePorts().map((port) => new URL(`http://127.0.0.1:${port}${endpointPath}`));
}

function sendHook(resolvePorts, endpointPath, payload) {
  let targets;
  try {
    targets = buildTargets(resolvePorts, endpointPath);
  } catch {
    return Promise.resolve();
  }

  const body = JSON.stringify(payload);
  const token = readHookToken();
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };
  if (token) headers["x-ccam-hook-token"] = token;

  return Promise.all(
    targets.map(
      (target) =>
        new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          const transport = target.protocol === "https:" ? https : http;
          const request = transport.request(
            target,
            { method: "POST", headers, timeout: 2000 },
            (response) => response.resume()
          );
          request.on("error", done);
          request.on("timeout", () => {
            request.destroy();
            done();
          });
          request.write(body);
          request.end(done);
        })
    )
  ).then(() => undefined);
}

module.exports = {
  LOOPBACK_HOSTS,
  readHookToken,
  remoteDashboardUrl,
  buildTargets,
  sendHook,
};
