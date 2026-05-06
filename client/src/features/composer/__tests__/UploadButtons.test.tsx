import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadButtons } from "../UploadButtons";

describe("UploadButtons", () => {
  it("paperclip and camera buttons are rendered", () => {
    render(<UploadButtons onAdd={() => {}} />);
    expect(screen.getByLabelText(/Attach file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Photo/i)).toBeInTheDocument();
  });

  it("photo input has accept=image and capture", () => {
    render(<UploadButtons onAdd={() => {}} />);
    const photoInput = document.getElementById("composer-photo-input") as HTMLInputElement;
    expect(photoInput.accept).toBe("image/*");
    expect(photoInput.getAttribute("capture")).toBe("environment");
  });

  it("onAdd fires for each selected file", () => {
    const onAdd = vi.fn();
    render(<UploadButtons onAdd={onAdd} />);
    const fileInput = document.getElementById("composer-file-input") as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File(["x"], "a.txt"), new File(["y"], "b.txt")],
    });
    fireEvent.change(fileInput);
    expect(onAdd).toHaveBeenCalledTimes(2);
  });
});
