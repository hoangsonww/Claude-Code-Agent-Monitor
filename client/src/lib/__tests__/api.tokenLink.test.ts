/**
 * @file api.tokenLink.test.ts
 * @description Tests for the one-time `?token=` pairing link: the token is saved to
 * localStorage, removed from the address bar, and left alone when the URL has none.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, beforeEach } from "vitest";
import { captureTokenFromUrl, dashboardToken } from "../api";

describe("captureTokenFromUrl", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("stores the token and strips it from the URL", () => {
    window.history.replaceState(null, "", "/flow?token=abc123&x=1#top");
    expect(captureTokenFromUrl()).toBe(true);
    expect(localStorage.getItem("dashboard_token")).toBe("abc123");
    expect(dashboardToken()).toBe("abc123");
    expect(window.location.pathname).toBe("/flow");
    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#top");
  });

  it("does nothing when the URL has no token", () => {
    localStorage.setItem("dashboard_token", "keep");
    expect(captureTokenFromUrl()).toBe(false);
    expect(localStorage.getItem("dashboard_token")).toBe("keep");
  });
});
