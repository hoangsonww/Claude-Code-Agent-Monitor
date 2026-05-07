import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RoutinesView } from "../RoutinesView";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/routines")) {
        return new Response(JSON.stringify({ routines: [] }), { status: 200 });
      }
      if (url.includes("/api/orchestrator/cwds")) {
        return new Response("[]", { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }),
  );
});

describe("RoutinesView", () => {
  it("renders title, banner, tab strip, and New routine button", async () => {
    render(
      <MemoryRouter>
        <RoutinesView />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Routines$/)).toBeInTheDocument();
    expect(
      screen.getByText(/Local routines only run while your computer is awake/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New routine/i })).toBeInTheDocument();
  });
});
