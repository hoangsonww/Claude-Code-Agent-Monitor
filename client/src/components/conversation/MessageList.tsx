import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Bot, User, Brain, ScrollText } from "lucide-react";
import type { TranscriptMessage, TranscriptContent } from "../../lib/types";
import { ToolCallBlock } from "./ToolCallBlock";

interface MessageListProps {
  messages: TranscriptMessage[];
  loading: boolean;
}

/** Build a map from tool_use id → tool_result for matching */
function buildToolResultMap(
  messages: TranscriptMessage[]
): Map<string, TranscriptContent> {
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

/** Generic collapsible content block */
function CollapsibleBlock({ text, icon, title, borderClass, bgClass, textClass }: {
  text: string;
  icon: React.ReactNode;
  title: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border ${borderClass} ${bgClass}`}>
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
      <div className="text-center py-12 text-gray-500 text-sm">
        No conversation records found.
      </div>
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
    <div className="space-y-4">
      {messages.map((msg, idx) => {
        // Skip user messages that are purely tool_result — they're rendered inside ToolCallBlock
        if (msg.type === "user" && !userMsgHasText.get(idx)) {
          return null;
        }

        return (
          <div key={idx} className="flex gap-3">
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                msg.type === "assistant"
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {msg.type === "assistant" ? (
                <Bot className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>

            {/* Message body */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header line */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">
                  {msg.type === "assistant" ? "Assistant" : "User"}
                </span>
                {msg.model && (
                  <span className="text-[11px] text-gray-600 font-mono">{msg.model}</span>
                )}
                {msg.usage && (
                  <span className="text-[11px] text-gray-600 font-mono">
                    {msg.usage.input_tokens.toLocaleString()}in / {msg.usage.output_tokens.toLocaleString()}out
                  </span>
                )}
                {msg.timestamp && (
                  <span className="text-[11px] text-gray-600 ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString()}
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
                        className="text-sm text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-1.5 whitespace-pre-wrap break-words"
                      >
                        {display}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={bIdx}
                      className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed"
                    >
                      {block.text}
                    </div>
                  );
                }

                if (block.type === "thinking" && block.text) {
                  const thinkKey = idx * 100 + bIdx;
                  const isExpanded = expandedThinking.has(thinkKey);
                  return (
                    <div key={bIdx} className="rounded-lg border border-amber-500/20 bg-amber-500/5">
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
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-amber-500/60" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-amber-500/60" />
                        )}
                        <Brain className="w-3.5 h-3.5 text-amber-400/60" />
                        <span className="text-xs text-amber-400/80">Thinking</span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-amber-500/10 px-3 py-2">
                          <pre className="text-xs text-amber-200/70 whitespace-pre-wrap break-words leading-relaxed">
                            {block.text}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                }

                if (block.type === "tool_use") {
                  const matchedResult = block.id ? toolResultMap.get(block.id) ?? null : null;
                  return (
                    <ToolCallBlock
                      key={bIdx}
                      toolUse={block}
                      toolResult={matchedResult}
                    />
                  );
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