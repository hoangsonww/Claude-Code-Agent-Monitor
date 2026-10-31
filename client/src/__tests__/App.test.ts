/**
 * @file App.test.ts
 * @description Verifies that dashboard-only onboarding never renders over
 * Express-served API reference paths.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/__tests__/App.test.ts`
 *
 * Scope
 * Verifies that dashboard-only onboarding never renders over Express-served API reference paths.
 *
 * Subjects and collaborators
 * - `../App` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `shouldShowOnboarding`
 *
 * Protected behavior
 * - shows first-run setup on dashboard routes
 * - suppresses first-run setup on every API route
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

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
