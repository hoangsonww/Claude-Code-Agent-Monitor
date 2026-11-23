/**
 * @file Builds same-origin dashboard URLs under the Vite base path.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

export function resolveDashboardBasePath(runtimeBase: string | null, viteBase: string): string {
  if (runtimeBase !== null && runtimeBase !== "__DASHBOARD_BASE_URL__") {
    return runtimeBase.replace(/\/$/, "");
  }
  const normalizedViteBase = viteBase.replace(/\/$/, "");
  return normalizedViteBase === "." ? "" : normalizedViteBase;
}

const runtimeBase =
  typeof document === "undefined"
    ? null
    : (document.querySelector('meta[name="dashboard-base-url"]')?.getAttribute("content") ?? null);

export const DASHBOARD_BASE_PATH = resolveDashboardBasePath(runtimeBase, import.meta.env.BASE_URL);

export function withDashboardBase(path: string, basePath = DASHBOARD_BASE_PATH): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
