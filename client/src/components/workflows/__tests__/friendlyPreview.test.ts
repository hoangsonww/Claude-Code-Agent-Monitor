/**
 * @file Unit tests for friendlyPreview — turns an agent's raw (often truncated)
 * JSON result preview into a human-readable excerpt for the Workflow Runs panel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { friendlyPreview, fullPreview } from "../WorkflowRunsPanel";

describe("friendlyPreview", () => {
  it("returns empty for nullish/empty input", () => {
    expect(friendlyPreview(null)).toBe("");
    expect(friendlyPreview(undefined)).toBe("");
    expect(friendlyPreview("")).toBe("");
  });

  it("prefers a known content field (pitch) over earlier short fields", () => {
    const raw =
      '{"language":"Python","pitch":"If you learn one language first in 2026, make it Python."}';
    expect(friendlyPreview(raw)).toBe("If you learn one language first in 2026, make it Python.");
  });

  it("extracts the first claim from a findings array", () => {
    const raw =
      '{"angle":"starship","findings":[{"claim":"SpaceX flew Starship Flight 12 on May 22, 2026.","source":"x","confidence":"high"}]}';
    expect(friendlyPreview(raw)).toBe("SpaceX flew Starship Flight 12 on May 22, 2026.");
  });

  it("handles a TRUNCATED json blob (no closing quote/brace) via the keyed field", () => {
    const raw =
      '{"angle":"starlink","findings":[{"claim":"As of June 2026, Starlink has roughly 10,500 active satellites in orbit and a';
    // keyed match stops at end-of-string (no closing quote), so it returns the partial claim
    expect(friendlyPreview(raw)).toContain("As of June 2026, Starlink has roughly 10,500");
    expect(friendlyPreview(raw)).not.toContain('{"angle"');
  });

  it("falls back to the first substantial quoted string when no known key matches", () => {
    const raw = '{"x":"ab","y":"this is a sufficiently long quoted value to surface"}';
    expect(friendlyPreview(raw)).toBe("this is a sufficiently long quoted value to surface");
  });

  it("de-JSONs a blob with no good string, stripping structural punctuation", () => {
    const raw = '{"a":1,"b":[2,3]}';
    const out = friendlyPreview(raw);
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
    expect(out).not.toContain("[");
  });

  it("passes plain prose through unchanged", () => {
    const raw = "All four claims confirmed against primary sources.";
    expect(friendlyPreview(raw)).toBe("All four claims confirmed against primary sources.");
  });
});

describe("fullPreview", () => {
  it("pretty-prints valid JSON", () => {
    const out = fullPreview('{"a":1,"b":{"c":2}}');
    expect(out).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
  });

  it("returns truncated/invalid JSON verbatim", () => {
    const raw = '{"claim":"partial value with no close';
    expect(fullPreview(raw)).toBe(raw);
  });

  it("returns empty for nullish input", () => {
    expect(fullPreview(null)).toBe("");
    expect(fullPreview(undefined)).toBe("");
  });
});
