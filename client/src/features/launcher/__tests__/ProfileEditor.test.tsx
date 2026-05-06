import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditor } from "../ProfileEditor";

vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));

describe("ProfileEditor", () => {
  it("renders all top-level sections", () => {
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={() => {}} />);
    // Match accordion section headers via the AccordionSummary button role,
    // anchored to start-of-string to avoid matching field labels inside sections.
    expect(screen.getByRole("button", { name: /^Identity$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Working directory$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Model & runtime$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Permissions$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tools$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^System prompt$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Advanced — dangerous/i })).toBeInTheDocument();
  });

  it("propagates change events", async () => {
    const onChange = vi.fn();
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/^Model$/i), "sonnet");
    expect(onChange).toHaveBeenCalled();
  });
});
