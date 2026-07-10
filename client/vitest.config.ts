/**
 * @file vitest.config.ts
 * @description Vitest configuration for the client test suite — jsdom environment, React plugin, and test globals.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
