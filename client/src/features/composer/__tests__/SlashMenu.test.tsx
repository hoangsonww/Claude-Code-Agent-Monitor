// client/src/features/composer/__tests__/SlashMenu.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlashMenu } from "../SlashMenu";
import type { SlashCatalog } from "../../../lib/composer-types";

const catalog: SlashCatalog = {
  builtin: [{ name: "help", description: "Show help", source: "builtin" }, { name: "clear", description: "Clear", source: "builtin" }],
  skills: [{ name: "code-review", description: "Reviews", source: "skill" }],
  plugins: [],
  project: [{ name: "deploy", description: "Deploy", source: "project" }],
};

describe("SlashMenu", () => {
  it("renders all groups when open", () => {
    render(<SlashMenu open catalog={catalog} query="" onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/Built-in/i)).toBeInTheDocument();
    expect(screen.getByText("/help")).toBeInTheDocument();
    expect(screen.getByText("/code-review")).toBeInTheDocument();
    expect(screen.getByText("/deploy")).toBeInTheDocument();
  });

  it("filters by query", () => {
    render(<SlashMenu open catalog={catalog} query="re" onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText("/code-review")).toBeInTheDocument();
    expect(screen.queryByText("/help")).not.toBeInTheDocument();
  });

  it("clicking a command fires onPick with the command", async () => {
    const onPick = vi.fn();
    render(<SlashMenu open catalog={catalog} query="" onPick={onPick} onClose={() => {}} />);
    await userEvent.click(screen.getByText("/help"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "help" }));
  });

  it("renders nothing when closed", () => {
    const { container } = render(<SlashMenu open={false} catalog={catalog} query="" onPick={() => {}} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
