/**
 * @file quips.test.ts
 * @description Unit tests for Tabby's quip picker — full key coverage and stable selection behavior for the speech-bubble lines.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/Tabby/__tests__/quips.test.ts`
 *
 * Scope
 * Unit tests for Tabby's quip picker — full key coverage and stable selection behavior for the
 * speech-bubble lines.
 *
 * Subjects and collaborators
 * - `../quips` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `pickQuip`
 *
 * Protected behavior
 * - returns a non-empty string for every known key
 * - is deterministic given an injected rand
 * - rand=0.999 stays within bounds (no out-of-range index)
 * - returns empty string for an unknown key without throwing
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

import { describe, it, expect } from "vitest";
import { pickQuip, ALL_QUIP_KEYS } from "../quips";

describe("pickQuip", () => {
  it("returns a non-empty string for every known key", () => {
    for (const key of ALL_QUIP_KEYS) {
      expect(pickQuip(key, () => 0).length).toBeGreaterThan(0);
    }
  });

  it("is deterministic given an injected rand", () => {
    expect(pickQuip("session_done", () => 0)).toBe(pickQuip("session_done", () => 0));
  });

  it("rand=0.999 stays within bounds (no out-of-range index)", () => {
    for (const key of ALL_QUIP_KEYS) {
      expect(typeof pickQuip(key, () => 0.999)).toBe("string");
      expect(pickQuip(key, () => 0.999).length).toBeGreaterThan(0);
    }
  });

  it("returns empty string for an unknown key without throwing", () => {
    // @ts-expect-error intentionally passing an invalid key
    expect(pickQuip("nope", () => 0)).toBe("");
  });
});
