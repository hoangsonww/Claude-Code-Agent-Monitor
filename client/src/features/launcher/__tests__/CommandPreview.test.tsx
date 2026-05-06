import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandPreview } from "../CommandPreview";

describe("CommandPreview", () => {
  it("renders the joined argv", () => {
    render(<CommandPreview config={{}} perLaunch={{ prompt: "hello" }} />);
    expect(screen.getByTestId("command-preview").textContent).toContain("--permission-mode acceptEdits");
    expect(screen.getByTestId("command-preview").textContent).toContain("-p hello");
  });

  it("highlights dangerous flags", () => {
    render(<CommandPreview config={{ dangerouslySkipPermissions: true }} perLaunch={{ prompt: "x" }} />);
    const danger = screen.getByTestId("danger-flags");
    expect(danger.textContent).toContain("--dangerously-skip-permissions");
  });
});
