/**
 * @file Normalizes the optional dashboard URL path prefix and matches requests against it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

function normalizeBaseUrl(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "/") return "";
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) || /[?#\\]/.test(trimmed)) {
    throw new Error("DASHBOARD_BASE_URL must be a URL path, such as /dashboard");
  }
  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("DASHBOARD_BASE_URL cannot contain dot path segments");
  }
  return normalized;
}

function stripBaseUrl(requestPath, baseUrl) {
  if (!baseUrl) return requestPath;
  if (requestPath === baseUrl) return "/";
  if (requestPath.startsWith(`${baseUrl}/`)) return requestPath.slice(baseUrl.length);
  return null;
}

function injectBaseUrlIntoHtml(html, baseUrl) {
  const escapedBaseUrl = baseUrl
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return html
    .replace(
      /<base\b[^>]*data-dashboard-base[^>]*>/i,
      `<base href="${escapedBaseUrl ? `${escapedBaseUrl}/` : "/"}" data-dashboard-base />`
    )
    .replaceAll("__DASHBOARD_BASE_URL__", escapedBaseUrl);
}

module.exports = { injectBaseUrlIntoHtml, normalizeBaseUrl, stripBaseUrl };
