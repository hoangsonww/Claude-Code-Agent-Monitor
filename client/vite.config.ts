/**
 * @file vite.config.ts
 * @description Vite build and dev-server configuration for the dashboard client — React plugin plus an API/WebSocket proxy that honours DASHBOARD_PORT.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
