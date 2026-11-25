/**
 * @file Checks that the skip link focuses the current route's content.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "../Layout";

vi.mock("../Sidebar", () => ({
  Sidebar: () => null,
  SIDEBAR_STORAGE_KEY: "sidebar",
  loadCollapsed: () => false,
}));
vi.mock("../UpdateNotifier", () => ({ UpdateNotifier: () => null }));
vi.mock("../CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("../Tabby/Tabby", () => ({ Tabby: () => null }));
vi.mock("../ActionToast", () => ({ ActionToast: () => null }));

describe("skip to content", () => {
  for (const route of ["/settings?tab=events", "/dashboard/sessions/abc?tab=events"]) {
    it(`focuses the current page at ${route}`, () => {
      window.history.replaceState({}, "", route);
      const base = document.createElement("base");
      base.href = route.startsWith("/dashboard") ? "/dashboard/" : "/";
      document.head.append(base);
      const view = render(
        <MemoryRouter>
          <Layout wsConnected={false} />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole("link", { name: /skip to content/i }));
      expect(document.activeElement?.id).toBe("main-content");
      expect(window.location.pathname + window.location.search).toBe(route);
      view.unmount();
      base.remove();
    });
  }
});
