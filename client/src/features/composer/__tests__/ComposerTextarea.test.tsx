import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposerTextarea } from "../ComposerTextarea";

describe("ComposerTextarea", () => {
  it("Cmd+Enter triggers onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<ComposerTextarea value="hi" onChange={() => {}} onSubmit={onSubmit} onAddFiles={() => {}} onSlashStateChange={() => {}} />);
    const ta = screen.getByPlaceholderText(/Ask Claude/i);
    await userEvent.click(ta);
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalled();
  });

  it("typing '/' at start fires onSlashStateChange(true)", () => {
    const onSlashStateChange = vi.fn();
    const { rerender } = render(<ComposerTextarea value="" onChange={() => {}} onSubmit={() => {}} onAddFiles={() => {}} onSlashStateChange={onSlashStateChange} />);
    rerender(<ComposerTextarea value="/he" onChange={() => {}} onSubmit={() => {}} onAddFiles={() => {}} onSlashStateChange={onSlashStateChange} />);
    expect(onSlashStateChange).toHaveBeenLastCalledWith(true, "he");
  });

  it("typing space after '/foo' fires onSlashStateChange(false)", () => {
    const onSlashStateChange = vi.fn();
    const { rerender } = render(<ComposerTextarea value="/foo" onChange={() => {}} onSubmit={() => {}} onAddFiles={() => {}} onSlashStateChange={onSlashStateChange} />);
    rerender(<ComposerTextarea value="/foo " onChange={() => {}} onSubmit={() => {}} onAddFiles={() => {}} onSlashStateChange={onSlashStateChange} />);
    expect(onSlashStateChange).toHaveBeenLastCalledWith(false, "");
  });
});
