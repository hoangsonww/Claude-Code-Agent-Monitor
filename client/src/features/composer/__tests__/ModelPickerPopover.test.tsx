import { describe, it, expect } from "vitest";
import { modelChipLabel } from "../ModelPickerPopover";

describe("modelChipLabel", () => {
  it("returns the friendly label for a known model id", () => {
    expect(modelChipLabel("claude-opus-4-7[1m]", null)).toBe("Opus 4.7 1M");
    expect(modelChipLabel("claude-sonnet-4-6", null)).toBe("Sonnet 4.6");
  });

  it("falls back to the raw id when the model is unknown", () => {
    expect(modelChipLabel("custom-model-x", null)).toBe("custom-model-x");
  });

  it("falls back to 'Default model' when no id is provided", () => {
    expect(modelChipLabel(null, null)).toBe("Default model");
  });

  it("appends the effort label with a separator when effort is set", () => {
    expect(modelChipLabel("claude-opus-4-7[1m]", "xhigh")).toBe("Opus 4.7 1M · Extra high");
    expect(modelChipLabel("claude-haiku-4-5", "low")).toBe("Haiku 4.5 · Low");
  });

  it("ignores unknown effort values gracefully", () => {
    expect(modelChipLabel("claude-opus-4-7", "bogus" as never)).toBe("Opus 4.7");
  });
});
