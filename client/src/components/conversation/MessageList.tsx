/**
 * @file MessageList.tsx
 * @description Renders the chronological message stream of a Claude Code
 * transcript: alternating user / assistant rows with collapsible thinking
 * blocks, inline ToolCallBlocks for tool_use / tool_result pairs, and
 * MarkdownContent for prose. Used by ConversationView as the main body of
 * the Conversation tab on the Session detail page.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Brain,
  ScrollText,
  Terminal,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { TranscriptMessage, TranscriptContent } from "../../lib/types";
import { ToolCallBlock } from "./ToolCallBlock";
import { MarkdownContent } from "./MarkdownContent";
import { fmt } from "../../lib/format";
import { parseTuiSegments, stripAnsi, hasTuiTags, type TuiSegment } from "./tuiSegments";
import {
  applyTranscriptViewMode,
  fontSizeToCss,
  type TranscriptFontSize,
  type TranscriptViewMode,
} from "../../lib/transcriptViewMode";

interface MessageListProps {
  messages: TranscriptMessage[];
  loading: boolean;
  /** Filter content blocks per the active transcript-view mode. Defaults to
   * "verbose" (preserve existing behaviour for any non-Conversation caller). */
  viewMode?: TranscriptViewMode;
  /** Apply a CSS variable so font-size controls cascade to message body. */
  fontSize?: TranscriptFontSize;
}

/** Build a map from tool_use id → tool_result for matching */
function buildToolResultMap(messages: TranscriptMessage[]): Map<string, TranscriptContent> {
  const map = new Map<string, TranscriptContent>();
  for (const msg of messages) {
    if (msg.type !== "user") continue;
    for (const c of msg.content) {
      if (c.type === "tool_result" && c.id) {
        map.set(c.id, c);
      }
    }
  }
  return map;
}

/** Detect if text is skill loading content (starts with "Base directory for this skill:") */
function isSkillContent(text: string): boolean {
  return text.startsWith("Base directory for this skill:");
}

/** Detect if text is a task notification (contains <task-notification> tag) */
function isTaskNotification(text: string): boolean {
  return text.includes("<task-notification>") || text.includes("<task-id>");
}

/** Format a timestamp as compact local time (e.g. "14:23:01"). */
function formatLocalTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "";
  }
}

/** Compact pill for /command invocations parsed out of TUI markup. */
function CommandPill({ display }: { display: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-1.5 max-w-full">
      <span className="text-emerald-500/70">›</span>
      <span className="break-all">{display}</span>
    </div>
  );
}

/** Terminal-style fenced block for stdout/stderr captured from local commands. */
function TerminalBlock({ text, stream }: { text: string; stream: "stdout" | "stderr" }) {
  const cleaned = stripAnsi(text).replace(/^\n+|\n+$/g, "");
  const isErr = stream === "stderr";
  const accent = isErr
    ? "border-red-500/30 bg-red-950/30 text-red-200/90"
    : "border-surface-3 bg-surface-4/60 text-gray-200";
  const labelColor = isErr ? "text-red-300/80" : "text-gray-400";
  return (
    <div className={`rounded-lg border ${accent} overflow-hidden`}>
      <div
        className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wider border-b border-current/10 ${labelColor}`}
      >
        <Terminal className="w-3 h-3" />
        <span>{stream}</span>
      </div>
      <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
        {cleaned}
      </pre>
    </div>
  );
}

/** Subtle inline note for the local-command-caveat banner. */
function CaveatBlock({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/15 bg-amber-500/[0.05] px-3 py-1.5 text-[11px] text-amber-200/70">
      <Info className="w-3.5 h-3.5 mt-px flex-shrink-0 opacity-60" />
      <span className="leading-relaxed italic">{stripAnsi(text).trim()}</span>
    </div>
  );
}

/** Render a single segment produced by parseTuiSegments. */
function renderSegment(seg: TuiSegment, key: number): React.ReactNode {
  switch (seg.kind) {
    case "command":
      return <CommandPill key={key} display={seg.display} />;
    case "stdout":
      return <TerminalBlock key={key} text={seg.text} stream="stdout" />;
    case "stderr":
      return <TerminalBlock key={key} text={seg.text} stream="stderr" />;
    case "caveat":
      return <CaveatBlock key={key} text={seg.text} />;
    case "system-reminder":
      return (
        <CollapsibleBlock
          key={key}
          text={seg.text}
          icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />}
          title="System reminder"
          borderClass="border-amber-500/20"
          bgClass="bg-amber-500/5"
          textClass="text-amber-300/80"
        />
      );
    case "persisted-output":
      return (
        <CollapsibleBlock
          key={key}
          text={seg.text}
          icon={<ScrollText className="w-3.5 h-3.5 text-violet-400/60 flex-shrink-0" />}
          title="Persisted output"
          borderClass="border-violet-500/20"
          bgClass="bg-violet-500/5"
          textClass="text-violet-300/80"
        />
      );
    case "text": {
      const cleaned = stripAnsi(seg.text);
      if (!cleaned.trim()) return null;
      return (
        <div key={key} className="min-w-0">
          <MarkdownContent text={cleaned} />
        </div>
      );
    }
  }
}

/** Generic collapsible content block */
function CollapsibleBlock({
  text,
  icon,
  title,
  borderClass,
  bgClass,
  textClass,
}: {
  text: string;
  icon: React.ReactNode;
  title: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border ${borderClass} ${bgClass} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:opacity-80 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
        )}
        {icon}
        <span className={`text-xs ${textClass} truncate`}>{title}</span>
      </button>
      {expanded && (
        <div className="border-t border-current/10 px-3 py-2">
          <pre className="text-xs opacity-60 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MessageList({ messages, loading, viewMode = "verbose", fontSize = "medium" }: MessageListProps) {
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(() => new Set());

  // Apply view-mode filter once per render. The filter is a pure function so
  // the caller can also pre-filter; here we keep the pipeline self-contained
  // and easy to swap out.
  const viewMessages = useMemo(
    () => applyTranscriptViewMode(messages, viewMode),
    [messages, viewMode],
  );

  // Tool-result lookup must reference the ORIGINAL messages so a hidden
  // user-only tool_result row still paints alongside the assistant tool_use
  // when verbose mode is active. (Filtered modes drop tool_use anyway.)
  const toolResultMap = useMemo(() => buildToolResultMap(messages), [messages]);

  // Track which user messages in the filtered view are pure tool_result (no
  // text) — we merge those into the preceding assistant message.
  const userMsgHasText = useMemo(() => {
    const map = new Map<number, boolean>();
    viewMessages.forEach((msg, idx) => {
      if (msg.type !== "user") return;
      const hasText = msg.content.some((c) => c.type === "text");
      map.set(idx, hasText);
    });
    return map;
  }, [viewMessages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        Loading conversation...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">No conversation records found.</div>
    );
  }

  // Summary mode supplies a "… N messages …" affordance so the user knows
  // there are hidden rows. Click expands but here we just render the count
  // because re-expansion is a transient affordance owned by the parent.
  const summaryHidden = viewMode === "summary" ? Math.max(0, messages.length - viewMessages.length) : 0;

  return (
    <div
      className="space-y-3"
      style={
        {
          // Cascade font size to MarkdownContent / pre / span via this var.
          "--message-font-size": fontSizeToCss(fontSize),
          fontSize: "var(--message-font-size)",
        } as React.CSSProperties
      }
    >
      {summaryHidden > 0 && (
        <div className="text-center text-[11px] text-gray-500 italic py-2">
          … {summaryHidden} message{summaryHidden === 1 ? "" : "s"} hidden …
        </div>
      )}
      {viewMessages.map((msg, idx) => {
        // Skip user messages that are purely tool_result — they're rendered inside ToolCallBlock
        if (msg.type === "user" && !userMsgHasText.get(idx)) {
          return null;
        }

        const isAssistant = msg.type === "assistant";
        const accentBar = isAssistant ? "before:bg-violet-500/40" : "before:bg-blue-500/40";
        const avatarRing = isAssistant
          ? "bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-200 ring-1 ring-violet-400/30"
          : "bg-gradient-to-br from-blue-500/30 to-cyan-500/20 text-blue-200 ring-1 ring-blue-400/30";

        return (
          <div
            key={idx}
            className={`relative flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/30 transition-colors before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:rounded-full before:opacity-60 ${accentBar}`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 shadow-sm ${avatarRing}`}
            >
              {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>

            {/* Message body */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header line */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-semibold tracking-wide ${
                    isAssistant ? "text-violet-200" : "text-blue-200"
                  }`}
                >
                  {isAssistant ? "Assistant" : "User"}
                </span>
                {msg.model && (
                  <span className="text-[10px] text-gray-400 font-mono bg-surface-3/60 border border-surface-3 rounded px-1.5 py-0.5">
                    {msg.model}
                  </span>
                )}
                {msg.usage && (
                  <span className="text-[10px] text-gray-500 font-mono inline-flex items-center gap-1">
                    <span className="text-emerald-300/70">↓ {fmt(msg.usage.input_tokens)}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-orange-300/70">↑ {fmt(msg.usage.output_tokens)}</span>
                  </span>
                )}
                {msg.timestamp && (
                  <span className="text-[10px] text-gray-600 ml-auto font-mono">
                    {formatLocalTime(msg.timestamp)}
                  </span>
                )}
              </div>

              {/* Content blocks */}
              {msg.content.map((block, bIdx) => {
                if (block.type === "text" && block.text) {
                  // Detect task notifications, collapsed by default
                  if (isTaskNotification(block.text)) {
                    return (
                      <CollapsibleBlock
                        key={bIdx}
                        text={block.text}
                        icon={<ScrollText className="w-3.5 h-3.5 text-cyan-400/60 flex-shrink-0" />}
                        title="Task Notification"
                        borderClass="border-cyan-500/20"
                        bgClass="bg-cyan-500/5"
                        textClass="text-cyan-400/80"
                      />
                    );
                  }

                  // Detect skill content, collapsed by default
                  if (isSkillContent(block.text)) {
                    const pathMatch = block.text.match(/^Base directory for this skill:\s*(\S+)/);
                    const skillPath = pathMatch ? pathMatch[1]! : "Skill";
                    return (
                      <CollapsibleBlock
                        key={bIdx}
                        text={block.text}
                        icon={<ScrollText className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0" />}
                        title={skillPath}
                        borderClass="border-blue-500/20"
                        bgClass="bg-blue-500/5"
                        textClass="text-blue-400/80"
                      />
                    );
                  }

                  // Mixed TUI markup: caveat / command / stdout / stderr / system-reminder
                  // can appear inline (sometimes interleaved with prose). Parse the text
                  // into segments and render each with the appropriate visual treatment.
                  if (hasTuiTags(block.text)) {
                    const segments = parseTuiSegments(block.text);
                    return (
                      <div key={bIdx} className="space-y-2 min-w-0">
                        {segments.map((s, sIdx) => renderSegment(s, sIdx))}
                      </div>
                    );
                  }

                  return (
                    <div key={bIdx} className="min-w-0">
                      <MarkdownContent text={stripAnsi(block.text)} />
                    </div>
                  );
                }

                if (block.type === "thinking" && block.text) {
                  const thinkKey = idx * 100 + bIdx;
                  const isExpanded = expandedThinking.has(thinkKey);
                  return (
                    <div
                      key={bIdx}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedThinking((prev) => {
                            const next = new Set(prev);
                            if (next.has(thinkKey)) next.delete(thinkKey);
                            else next.add(thinkKey);
                            return next;
                          })
                        }
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-amber-500/10 transition-colors"
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-amber-500/60 transition-transform duration-150 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <Brain className="w-3.5 h-3.5 text-amber-400/80" />
                        <span className="text-xs text-amber-200/90 font-medium">Thinking</span>
                        {!isExpanded && (
                          <span className="text-[10px] text-amber-300/40 font-mono ml-auto">
                            {block.text.length.toLocaleString()} chars
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="border-t border-amber-500/10 px-3 py-2 text-amber-100/80">
                          <MarkdownContent text={block.text} dense />
                        </div>
                      )}
                    </div>
                  );
                }

                if (block.type === "tool_use") {
                  const matchedResult = block.id ? (toolResultMap.get(block.id) ?? null) : null;
                  return <ToolCallBlock key={bIdx} toolUse={block} toolResult={matchedResult} />;
                }

                // tool_result blocks rendered inside ToolCallBlock, skip standalone
                return null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
