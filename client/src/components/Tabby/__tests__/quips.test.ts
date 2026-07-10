/**
 * @file quips.test.ts
 * @description Unit tests for Tabby's quip picker — full key coverage and stable selection behavior for the speech-bubble lines.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
