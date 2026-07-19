/**
 * @file vite.config.ts
 * @description Vite build and dev-server configuration for the dashboard client — React plugin, an API/WebSocket proxy that honours DASHBOARD_PORT, and build-time injection of the project version as `__APP_VERSION__`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard's displayed version is the canonical project version from the
// repo-root package.json (the version CI cuts releases from), injected at build
// time as the `__APP_VERSION__` global so the UI footer always shows the real
// version instead of a hardcoded string. Vite runs from the client dir, so the
// root manifest is normally one level up; fall back to the client manifest, and
// finally a placeholder, so the build never fails when the root file is absent
// (e.g. a Docker stage that only copies client/). The global is declared in
// `client/src/vite-env.d.ts`.
function resolveAppVersion(): string {
  for (const rel of ["../package.json", "package.json"]) {
    try {
      const { version } = JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8"));
      if (version) return version as string;
    } catch {
      // Not found or unreadable at this path — try the next candidate.
    }
  }
  return "0.0.0";
}
const APP_VERSION = resolveAppVersion();

// Honour DASHBOARD_PORT so the proxy follows when `npm run dev:server` is
// moved off the default 4820 (e.g. when an SSH `LocalForward` already holds
// 4820 on `127.0.0.1` and `::1`). The dev server reads the same env var from
// `server/index.js`, so a single `DASHBOARD_PORT=4821 npm run dev` keeps
// both sides in lockstep.
//
// We also target `127.0.0.1` rather than `localhost`: when several listeners
// exist on the same port across IP families (loopback-specific SSH binds vs.
// Node's wildcard listen), macOS routes connections by socket specificity,
// so `localhost` can resolve into the wrong process. An explicit IPv4 loopback
// is what the embedded server in production binds to anyway.
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || "4820", 10);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${DASHBOARD_PORT}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://127.0.0.1:${DASHBOARD_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
