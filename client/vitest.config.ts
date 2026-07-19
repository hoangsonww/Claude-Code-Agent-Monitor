/**
 * @file vitest.config.ts
 * @description Vitest configuration for the client test suite — jsdom environment, React plugin, test globals, and the same build-time `__APP_VERSION__` injection as vite.config.ts so version-dependent components render identically under test.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Mirror vite.config.ts: inject the repo-root project version as `__APP_VERSION__`
// so components that render it (e.g. the sidebar footer) behave the same in tests.
const APP_VERSION = JSON.parse(readFileSync(resolve(process.cwd(), "..", "package.json"), "utf8"))
  .version as string;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
