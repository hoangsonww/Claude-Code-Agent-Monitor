// client/src/features/composer/__tests__/AttachmentBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentBar } from "../AttachmentBar";
import type { Attachment } from "../../../lib/composer-types";

const a: Attachment = { id: "u1", name: "a.txt", size: 2048, kind: "text", path: "./.launcher-uploads/u1/a.txt" };

describe("AttachmentBar", () => {
  it("renders chips for each attachment with size", () => {
    render(<AttachmentBar attachments={[a]} onRemove={() => {}} />);
    expect(screen.getByText(/a\.txt/)).toBeInTheDocument();
    expect(screen.getByText(/2 KB|2\.0 KB/)).toBeInTheDocument();
  });

  it("clicking the chip's delete handler fires onRemove with id", async () => {
    const onRemove = vi.fn();
    render(<AttachmentBar attachments={[a]} onRemove={onRemove} />);
    const remove = screen.getByLabelText(/remove a\.txt/i);
    await userEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith("u1");
  });

  it("renders nothing when attachments is empty", () => {
    const { container } = render(<AttachmentBar attachments={[]} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
