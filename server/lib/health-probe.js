/**
 * @file Detects a dashboard on its configured prefix or legacy root path.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const http = require("node:http");
const { normalizeBaseUrl } = require("./base-url");

function probePath(port, path, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path, timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(res.statusCode === 200 && JSON.parse(body)?.status === "ok");
        } catch {
          resolve(false);
        }
      });
      res.on("error", () => resolve(false));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => req.destroy());
  });
}

async function probeDashboardHealth(port, baseUrl, timeoutMs = 1500) {
  const base = normalizeBaseUrl(baseUrl);
  if (await probePath(port, `${base}/api/health`, timeoutMs)) return { baseUrl: base };
  if (base && (await probePath(port, "/api/health", timeoutMs))) return { baseUrl: "" };
  return null;
}

module.exports = { probeDashboardHealth };
