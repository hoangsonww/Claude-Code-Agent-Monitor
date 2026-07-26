/**
 * @file Sidebar.test.tsx
 * @description Unit tests for the Sidebar component, which is responsible for rendering the application's sidebar navigation. The tests cover rendering of the brand name, subtitle, navigation links, WebSocket connection status, and version number. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "../Sidebar";

function renderSidebar(wsConnected: boolean, collapsed = false) {
  return render(
    <MemoryRouter>
      <Sidebar wsConnected={wsConnected} collapsed={collapsed} onToggle={() => {}} />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  it("should render the brand name", () => {
    renderSidebar(true);
    expect(screen.getByText("Agent Dashboard")).toBeInTheDocument();
  });

  it("should render the subtitle", () => {
    renderSidebar(true);
    expect(screen.getByText("Claude Code Monitor")).toBeInTheDocument();
  });

  it("should render all navigation links", () => {
    renderSidebar(true);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Kanban Board")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Activity Feed")).toBeInTheDocument();
    // New nav entry (build task 19, not yet built as of this test) - DEC-5's
    // exact short label, not the longer in-page heading "Focus Calendar".
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it('should show "Live" when WebSocket is connected', () => {
    renderSidebar(true);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it('should show "Disconnected" when WebSocket is not connected', () => {
    renderSidebar(false);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("should show version number", () => {
    // `__APP_VERSION__` is injected by Vite from the repo-root package.json
    // (see vite.config.ts) and replaced at transform time in tests too, so this
    // stays correct as the project version changes.
    renderSidebar(true);
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it("should have correct navigation hrefs", () => {
    renderSidebar(true);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/kanban");
    expect(hrefs).toContain("/sessions");
    expect(hrefs).toContain("/activity");
    // New nav route (build task 19).
    expect(hrefs).toContain("/focus-calendar");
  });

  it("positions Calendar right after Projects in nav order", () => {
    renderSidebar(true);
    const nav = screen.getByRole("navigation");
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    const projectsIndex = labels.indexOf("Projects");
    const calendarIndex = labels.indexOf("Calendar");
    // Closes the pre-existing "Projects has zero assertion" hole (this is
    // the first test in this file to check "Projects" at all) while pinning
    // DEC-5's exact position - right after Projects, not after Kanban Board
    // (the original draft's incorrect placement).
    expect(projectsIndex).toBeGreaterThan(-1);
    expect(calendarIndex).toBe(projectsIndex + 1);
  });

  it("should render four language options in expanded mode", () => {
    renderSidebar(true);
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chinese" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vietnamese" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Korean" })).toBeInTheDocument();
  });

  it("should switch to Vietnamese when Vietnamese option is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar(true);

    await user.click(screen.getByRole("button", { name: "Vietnamese" }));

    await waitFor(() => {
      expect(screen.getByText("Tổng quan")).toBeInTheDocument();
      expect(screen.getByText("Bảng Kanban")).toBeInTheDocument();
    });
  });

  it("should switch to Korean when Korean option is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar(true);

    await user.click(screen.getByRole("button", { name: "Korean" }));

    await waitFor(() => {
      expect(screen.getByText("대시보드")).toBeInTheDocument();
      expect(screen.getByText("칸반 보드")).toBeInTheDocument();
    });
  });

  it("should cycle language in collapsed mode", async () => {
    const user = userEvent.setup();
    renderSidebar(true, true);

    expect(screen.getByText("EN")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    await waitFor(() => {
      expect(screen.getByText("中文")).toBeInTheDocument();
    });
  });
});
