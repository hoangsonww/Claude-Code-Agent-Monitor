/**
 * @file dataScope.test.ts
 * @description Unit tests for the global data-scope store (which source machines
 * the dashboard shows). Covers persistence, the localStorage → query-param
 * mapping consumed by the API layer, subscriber notification, and malformed /
 * empty input handling. Each case re-imports the module so the singleton starts
 * clean.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "ccam-data-scope";

// Fresh module instance (resets the module-level `current`) with localStorage
// pre-seeded, so we can test load-from-storage behavior deterministically.
async function freshModule(seed?: unknown) {
  localStorage.clear();
  if (seed !== undefined) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  vi.resetModules();
  return import("../dataScope");
}

describe("dataScope store", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to scope 'all' (no filter) when nothing is stored", async () => {
    const m = await freshModule();
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
    expect(m.activeSourcesParam()).toBeNull();
  });

  it("activeSourcesParam maps each mode correctly", async () => {
    const m = await freshModule();
    m.setScope({ mode: "all", selected: [] });
    expect(m.activeSourcesParam()).toBeNull();
    m.setScope({ mode: "local", selected: [] });
    expect(m.activeSourcesParam()).toBe("local");
    m.setScope({ mode: "selected", selected: ["local", "src_abc"] });
    expect(m.activeSourcesParam()).toBe("local,src_abc");
  });

  it("'selected' with an empty selection degrades to local-only (never empty app)", async () => {
    const m = await freshModule();
    m.setScope({ mode: "selected", selected: [] });
    expect(m.activeSourcesParam()).toBe("local");
  });

  it("persists to localStorage and reloads on next module init", async () => {
    const m1 = await freshModule();
    m1.setScope({ mode: "selected", selected: ["src_1", "src_2"] });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      mode: "selected",
      selected: ["src_1", "src_2"],
    });
    // A fresh init (new tab) should read the persisted value back.
    const m2 = await import("../dataScope").then(async () => {
      vi.resetModules();
      return import("../dataScope");
    });
    expect(m2.getScope()).toEqual({ mode: "selected", selected: ["src_1", "src_2"] });
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const m = await freshModule();
    const cb = vi.fn();
    const unsub = m.subscribeScope(cb);
    m.setScope({ mode: "local", selected: [] });
    m.setScope({ mode: "all", selected: [] });
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    m.setScope({ mode: "local", selected: [] });
    expect(cb).toHaveBeenCalledTimes(2); // no further calls
  });

  it("getScope returns a stable reference between changes (for useSyncExternalStore)", async () => {
    const m = await freshModule();
    const a = m.getScope();
    const b = m.getScope();
    expect(a).toBe(b);
    m.setScope({ mode: "local", selected: [] });
    expect(m.getScope()).not.toBe(a);
  });

  it("setScope copies the selected array (no external mutation leaks in)", async () => {
    const m = await freshModule();
    const sel = ["src_1"];
    m.setScope({ mode: "selected", selected: sel });
    sel.push("src_2");
    expect(m.getScope().selected).toEqual(["src_1"]);
  });

  it("tolerates malformed stored JSON and falls back to the default", async () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    vi.resetModules();
    const m = await import("../dataScope");
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
  });

  it("sanitizes an unknown mode / non-array selected from storage", async () => {
    const m = await freshModule({ mode: "bogus", selected: "nope" });
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
  });
});
