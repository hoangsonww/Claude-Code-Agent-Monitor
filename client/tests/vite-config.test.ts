/**
 * @vitest-environment node
 * @file Ensures production client bundles do not publish source maps.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import config from "../vite.config";

describe("production Vite configuration", () => {
  it("does not publish source maps that expose build-time source URLs", () => {
    const resolved = config({ command: "build", mode: "production", isSsrBuild: false });
    expect(resolved.build?.sourcemap).toBe(false);
  });
});

describe("development dotenv selection", () => {
  it("does not inherit the root prefix when a custom dotenv omits it", () => {
    const dir = mkdtempSync(join(tmpdir(), "ccam-vite-"));
    const cwd = process.cwd();
    const previous = process.env.DASHBOARD_ENV_PATH;
    const previousBase = process.env.DASHBOARD_BASE_URL;
    try {
      mkdirSync(join(dir, "client"));
      writeFileSync(join(dir, ".env"), "DASHBOARD_BASE_URL=/wrong\n");
      writeFileSync(join(dir, "custom.env"), "DASHBOARD_PORT=4820\n");
      process.chdir(join(dir, "client"));
      process.env.DASHBOARD_ENV_PATH = join(dir, "custom.env");
      delete process.env.DASHBOARD_BASE_URL;
      expect(config({ command: "serve", mode: "development", isSsrBuild: false }).base).toBe("/");
    } finally {
      process.chdir(cwd);
      if (previous === undefined) delete process.env.DASHBOARD_ENV_PATH;
      else process.env.DASHBOARD_ENV_PATH = previous;
      if (previousBase === undefined) delete process.env.DASHBOARD_BASE_URL;
      else process.env.DASHBOARD_BASE_URL = previousBase;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
