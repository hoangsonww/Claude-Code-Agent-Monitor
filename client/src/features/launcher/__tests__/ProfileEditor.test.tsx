import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditor } from "../ProfileEditor";

vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));

describe("ProfileEditor", () => {
  it("renders all top-level sections", () => {
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={() => {}} />);
    expect(screen.getByText(/Identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Working directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Model & runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/Permissions/i)).toBeInTheDocument();
    expect(screen.getByText(/Tools/i)).toBeInTheDocument();
    expect(screen.getByText(/System prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/Advanced — dangerous/i)).toBeInTheDocument();
  });

  it("propagates change events", async () => {
    const onChange = vi.fn();
    render(<ProfileEditor value={{ name: "x", config: {} }} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/^Model$/i), "sonnet");
    expect(onChange).toHaveBeenCalled();
  });
});
