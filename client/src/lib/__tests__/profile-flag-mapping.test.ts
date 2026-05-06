import { describe, it, expect } from "vitest";
import { buildArgvPreview } from "../profile-flag-mapping";

describe("buildArgvPreview", () => {
  it("matches server defaults for an empty profile + prompt", () => {
    expect(buildArgvPreview({}, { prompt: "hi" })).toEqual([
      "claude",
      "-p", "hi",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "acceptEdits",
    ]);
  });

  it("includes --resume when resumeSessionId is set", () => {
    const argv = buildArgvPreview({}, { prompt: "x", resumeSessionId: "abc" });
    expect(argv).toContain("--resume");
    expect(argv).toContain("abc");
  });

  it("redacts the prompt body when redactPrompt is set", () => {
    const argv = buildArgvPreview({}, { prompt: "secrets here" }, { redactPrompt: true });
    const i = argv.indexOf("-p");
    expect(argv[i + 1]).toBe("<prompt>");
  });
});
