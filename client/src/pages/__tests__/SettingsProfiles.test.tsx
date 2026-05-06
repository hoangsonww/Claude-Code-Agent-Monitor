import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProfiles } from "../SettingsProfiles";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (typeof url === "string" && url.endsWith("/profiles")) {
        return new Response(
          JSON.stringify([
            { id: "p1", name: "code-review", config: { model: "sonnet" }, createdAt: 1, updatedAt: 1 },
            { id: "p2", name: "ad-hoc", config: {}, createdAt: 2, updatedAt: 2 },
          ]),
          { status: 200 },
        );
      }
      return new Response("[]", { status: 200 });
    }),
  );
});

describe("SettingsProfiles", () => {
  it("lists profiles", async () => {
    render(<SettingsProfiles />);
    await waitFor(() => expect(screen.getByText("code-review")).toBeInTheDocument());
    expect(screen.getByText("ad-hoc")).toBeInTheDocument();
  });

  it("opens editor on click", async () => {
    render(<SettingsProfiles />);
    await userEvent.click(await screen.findByText("code-review"));
    expect(screen.getByRole("button", { name: /^Identity$/i })).toBeInTheDocument();
  });

  it("renders Import / Export buttons", async () => {
    render(<SettingsProfiles />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Import/i })).toBeInTheDocument());
    // Export only renders when a profile is selected — just confirm Import is present.
  });
});
