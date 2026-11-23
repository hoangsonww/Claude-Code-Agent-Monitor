/**
 * @vitest-environment node
 * @file Ensures production client bundles do not publish source maps.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("production Vite configuration", () => {
  it("does not publish source maps that expose build-time source URLs", () => {
    const resolved = config({ command: "build", mode: "production", isSsrBuild: false });
    expect(resolved.build?.sourcemap).toBe(false);
  });
});
