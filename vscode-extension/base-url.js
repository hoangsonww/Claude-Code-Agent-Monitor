/**
 * @file Resolves the dashboard path prefix from the VS Code host environment.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
function basePath() {
  const value = (process.env.DASHBOARD_BASE_URL || "").trim().replace(/^\/+|\/+$/g, "");
  return value ? `/${value}` : "";
}

module.exports = { basePath };
