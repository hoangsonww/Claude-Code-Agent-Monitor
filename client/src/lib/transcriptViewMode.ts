/**
 * @file transcriptViewMode.ts
 * @description Types and helpers for the Conversation tab's "Transcript view"
 * picker. The user can switch between Normal (text only), Thinking (text +
 * thinking blocks), Verbose (everything including tool calls / tool results),
 * and Summary (collapse all but the last user + last assistant). The chosen
 * mode and font size are persisted to `localStorage` so the choice survives
 * page reloads and tab switches.
 */
import type { TranscriptMessage, TranscriptContent } from "./types";

export type TranscriptViewMode = "normal" | "thinking" | "verbose" | "summary";
export type TranscriptFontSize = "small" | "medium" | "large";

export const TRANSCRIPT_VIEW_MODES: ReadonlyArray<{
  value: TranscriptViewMode;
  label: string;
  description: string;
}> = [
  { value: "normal", label: "Normal", description: "User and assistant text only" },
  { value: "thinking", label: "Thinking", description: "Include thinking blocks" },
  { value: "verbose", label: "Verbose", description: "Include tool calls and results" },
  { value: "summary", label: "Summary", description: "Last user + last assistant only" },
];

export const TRANSCRIPT_FONT_SIZES: ReadonlyArray<{
  value: TranscriptFontSize;
  label: string;
  cssSize: string;
}> = [
  { value: "small", label: "Aa", cssSize: "12px" },
  { value: "medium", label: "Aa", cssSize: "14px" },
  { value: "large", label: "Aa", cssSize: "16px" },
];

const VIEW_MODE_KEY = "cccm.transcriptView";
const FONT_SIZE_KEY = "cccm.transcriptFontSize";

const VALID_MODES = new Set<TranscriptViewMode>([
  "normal",
  "thinking",
  "verbose",
  "summary",
]);
const VALID_SIZES = new Set<TranscriptFontSize>(["small", "medium", "large"]);

export function readTranscriptViewMode(): TranscriptViewMode {
  if (typeof window === "undefined") return "normal";
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    if (v && VALID_MODES.has(v as TranscriptViewMode)) {
      return v as TranscriptViewMode;
    }
  } catch {
    // localStorage access can throw in some sandbox environments — fall through.
  }
  return "normal";
}

export function writeTranscriptViewMode(mode: TranscriptViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Persisting is best-effort; the in-memory state still reflects the choice.
  }
}

export function readTranscriptFontSize(): TranscriptFontSize {
  if (typeof window === "undefined") return "medium";
  try {
    const v = window.localStorage.getItem(FONT_SIZE_KEY);
    if (v && VALID_SIZES.has(v as TranscriptFontSize)) {
      return v as TranscriptFontSize;
    }
  } catch {
    // ignore
  }
  return "medium";
}

export function writeTranscriptFontSize(size: TranscriptFontSize): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FONT_SIZE_KEY, size);
  } catch {
    // ignore
  }
}

export function fontSizeToCss(size: TranscriptFontSize): string {
  const found = TRANSCRIPT_FONT_SIZES.find((f) => f.value === size);
  return found ? found.cssSize : "14px";
}

/**
 * Filter the content blocks of a single message according to the active view
 * mode. Returns the kept blocks (may be empty — callers decide whether to
 * drop the whole message in that case).
 */
export function filterContentBlocks(
  content: TranscriptContent[],
  mode: TranscriptViewMode,
): TranscriptContent[] {
  switch (mode) {
    case "normal":
      return content.filter((c) => c.type === "text");
    case "thinking":
      return content.filter((c) => c.type === "text" || c.type === "thinking");
    case "verbose":
    case "summary":
      // Verbose keeps everything; Summary defers to message-level trimming
      // and still wants every content block of the messages it kept.
      return content;
  }
}

/**
 * Apply the view-mode filter across an entire message list. Drops messages
 * whose content collapses to empty after filtering, except for `verbose` and
 * `summary` which preserve the full block set on retained messages.
 */
export function applyTranscriptViewMode(
  messages: TranscriptMessage[],
  mode: TranscriptViewMode,
): TranscriptMessage[] {
  if (mode === "verbose") return messages;

  if (mode === "summary") {
    if (messages.length === 0) return messages;
    // Pick last user + last assistant. If only one type is present, keep that.
    let lastUserIdx = -1;
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]!;
      if (m.type === "user" && lastUserIdx === -1) lastUserIdx = i;
      else if (m.type === "assistant" && lastAssistantIdx === -1) lastAssistantIdx = i;
      if (lastUserIdx !== -1 && lastAssistantIdx !== -1) break;
    }
    const keepIdx = [lastUserIdx, lastAssistantIdx]
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    return keepIdx.map((i) => messages[i]!);
  }

  // normal | thinking — filter blocks and drop empty messages.
  return messages
    .map((m) => ({ ...m, content: filterContentBlocks(m.content, mode) }))
    .filter((m) => m.content.length > 0);
}
