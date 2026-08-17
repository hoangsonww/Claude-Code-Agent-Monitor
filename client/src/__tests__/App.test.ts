/**
 * @file App.test.ts
 * @description Verifies that dashboard-only onboarding never renders over
 * Express-served API reference paths.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { shouldShowOnboarding } from "../App";

describe("shouldShowOnboarding", () => {
  it("shows first-run setup on dashboard routes", () => {
    expect(shouldShowOnboarding("/")).toBe(true);
    expect(shouldShowOnboarding("/sessions/session-123")).toBe(true);
  });

  it("suppresses first-run setup on every API route", () => {
    expect(shouldShowOnboarding("/api/docs")).toBe(false);
    expect(shouldShowOnboarding("/api/redoc")).toBe(false);
    expect(shouldShowOnboarding("/api/openapi.json")).toBe(false);
    expect(shouldShowOnboarding("/api/not-a-real-route")).toBe(false);
  });
});
