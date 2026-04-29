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
import { ChevronDown, ChevronRight, Bot, User, Brain, ScrollText } from "lucide-react";
import type { TranscriptMessage, TranscriptContent } from "../../lib/types";
import { ToolCallBlock } from "./ToolCallBlock";
import { MarkdownContent } from "./MarkdownContent";
import { fmt } from "../../lib/format";

interface MessageListProps {
  messages: TranscriptMessage[];
  loading: boolean;
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

/**
 * Detect and format command messages.
 * Converts <command-message>X</command-message><command-name>/X</command-name><command-args>Y</command-args>
 * into /X Y format.
 */
function formatCommandMessage(text: string): { isCommand: boolean; display: string } {
  const cmdMatch = text.match(
    /<command-message>([^<]*)<\/command-message>\s*<command-name>([^<]*)<\/command-name>\s*(?:<command-args>([^<]*)<\/command-args>)?/
  );
  if (cmdMatch) {
    const name = cmdMatch[2] ?? cmdMatch[1] ?? "";
    const args = cmdMatch[3] ?? "";
    return { isCommand: true, display: args ? `${name} ${args}` : name };
  }
  return { isCommand: false, display: text };
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

export function MessageList({ messages, loading }: MessageListProps) {
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(() => new Set());

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

  const toolResultMap = buildToolResultMap(messages);

  // Track which user messages are pure tool_result (no text) — we merge those into the preceding assistant message
  const userMsgHasText = useMemo(() => {
    const map = new Map<number, boolean>();
    messages.forEach((msg, idx) => {
      if (msg.type !== "user") return;
      const hasText = msg.content.some((c) => c.type === "text");
      map.set(idx, hasText);
    });
    return map;
  }, [messages]);

  return (
    <div className="space-y-3">
      {messages.map((msg, idx) => {
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

                  // Detect command messages, format for display
                  const { isCommand, display } = formatCommandMessage(block.text);
                  if (isCommand) {
                    return (
                      <div
                        key={bIdx}
                        className="inline-flex items-center gap-2 text-sm text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-1.5 max-w-full"
                      >
                        <span className="text-emerald-500/70">›</span>
                        <span className="break-all">{display}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={bIdx} className="min-w-0">
                      <MarkdownContent text={block.text} />
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
