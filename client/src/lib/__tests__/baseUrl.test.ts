/**
 * @file Verifies URL composition for root and subpath dashboard deployments.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { resolveDashboardBasePath, withDashboardBase } from "../baseUrl";

describe("withDashboardBase", () => {
  it("preserves root deployment URLs", () => {
    expect(withDashboardBase("/api/health", "")).toBe("/api/health");
  });

  it("prefixes dashboard routes and API URLs", () => {
    expect(withDashboardBase("api/health", "/dashboard")).toBe("/dashboard/api/health");
    expect(withDashboardBase("/ws", "/dashboard")).toBe("/dashboard/ws");
  });

  it("uses the server-injected path at runtime and treats a relative Vite base as root", () => {
    expect(resolveDashboardBasePath("/dashboard", "./")).toBe("/dashboard");
    expect(resolveDashboardBasePath("", "./")).toBe("");
    expect(resolveDashboardBasePath(null, "./")).toBe("");
  });
});
