import { describe, it, expect } from "vitest";
import {
  applyTranscriptViewMode,
  filterContentBlocks,
  fontSizeToCss,
} from "../transcriptViewMode";
import type { TranscriptMessage } from "../types";

const messages: TranscriptMessage[] = [
  {
    type: "user",
    timestamp: "2025-01-01T00:00:00Z",
    content: [{ type: "text", text: "first user" }],
  },
  {
    type: "assistant",
    timestamp: "2025-01-01T00:00:01Z",
    content: [
      { type: "thinking", text: "thinking out loud" },
      { type: "text", text: "first assistant" },
      { type: "tool_use", name: "Read", id: "t1" },
    ],
  },
  {
    type: "user",
    timestamp: "2025-01-01T00:00:02Z",
    content: [{ type: "tool_result", id: "t1", output: "ok" }],
  },
  {
    type: "user",
    timestamp: "2025-01-01T00:00:03Z",
    content: [{ type: "text", text: "second user" }],
  },
  {
    type: "assistant",
    timestamp: "2025-01-01T00:00:04Z",
    content: [{ type: "text", text: "second assistant" }],
  },
];

describe("filterContentBlocks", () => {
  it("normal keeps only text blocks", () => {
    const out = filterContentBlocks(messages[1]!.content, "normal");
    expect(out.map((c) => c.type)).toEqual(["text"]);
  });

  it("thinking keeps text and thinking blocks", () => {
    const out = filterContentBlocks(messages[1]!.content, "thinking");
    expect(out.map((c) => c.type).sort()).toEqual(["text", "thinking"]);
  });

  it("verbose returns content unchanged", () => {
    const out = filterContentBlocks(messages[1]!.content, "verbose");
    expect(out).toHaveLength(messages[1]!.content.length);
  });
});

describe("applyTranscriptViewMode", () => {
  it("normal drops messages whose content collapses to empty", () => {
    const out = applyTranscriptViewMode(messages, "normal");
    // user-only-tool_result (idx 2) drops; thinking is filtered out of the
    // assistant message; everything else survives.
    expect(out).toHaveLength(4);
    const lastAssistant = out.find((m) => m.type === "assistant" && m.content.some((c) => c.text === "first assistant"));
    expect(lastAssistant?.content.every((c) => c.type === "text")).toBe(true);
  });

  it("thinking keeps the assistant's thinking block", () => {
    const out = applyTranscriptViewMode(messages, "thinking");
    const firstAssistant = out.find((m) => m.type === "assistant");
    expect(firstAssistant?.content.some((c) => c.type === "thinking")).toBe(true);
    expect(firstAssistant?.content.some((c) => c.type === "tool_use")).toBe(false);
  });

  it("verbose returns the original list unchanged", () => {
    const out = applyTranscriptViewMode(messages, "verbose");
    expect(out).toBe(messages);
  });

  it("summary keeps only the last user + last assistant message", () => {
    const out = applyTranscriptViewMode(messages, "summary");
    expect(out).toHaveLength(2);
    expect(out[0]!.type).toBe("user");
    expect(out[0]!.content[0]!.text).toBe("second user");
    expect(out[1]!.type).toBe("assistant");
    expect(out[1]!.content[0]!.text).toBe("second assistant");
  });

  it("summary on an empty list returns empty", () => {
    expect(applyTranscriptViewMode([], "summary")).toEqual([]);
  });
});

describe("fontSizeToCss", () => {
  it("maps to predictable px values", () => {
    expect(fontSizeToCss("small")).toBe("12px");
    expect(fontSizeToCss("medium")).toBe("14px");
    expect(fontSizeToCss("large")).toBe("16px");
  });
});
