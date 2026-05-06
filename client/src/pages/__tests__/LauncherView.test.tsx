import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LauncherView } from "../LauncherView";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
});

describe("LauncherView", () => {
  it("renders editor + command preview + footer", () => {
    render(<LauncherView />);
    // Editor's Identity accordion (defaultExpanded)
    expect(screen.getByRole("button", { name: /^Identity$/i })).toBeInTheDocument();
    expect(screen.getByTestId("command-preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Launch$/i })).toBeInTheDocument();
  });

  it("Launch button is disabled when cwd or prompt is empty", () => {
    render(<LauncherView />);
    const launch = screen.getByRole("button", { name: /^Launch$/i });
    expect(launch).toBeDisabled();
  });
});
