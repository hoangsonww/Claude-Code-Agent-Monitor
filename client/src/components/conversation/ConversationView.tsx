/**
 * @file ConversationView.tsx
 * @description Conversation tab on the Session detail page. Loads a session
 * (or sub-agent) JSONL transcript, paginates it incrementally, and renders
 * the message stream via MessageList. Combines a WebSocket subscription, a
 * visibility-gated polling fallback, and a manual refresh button so the view
 * stays caught up even when hooks miss frames or the user is mid-text-only
 * turn (no PreToolUse fires until Stop).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ChevronDown, Loader2, ArrowDown, MessagesSquare, RefreshCw, Bot, User } from "lucide-react";
import { api } from "../../lib/api";
import { eventBus } from "../../lib/eventBus";
import { MessageList } from "./MessageList";
import { TranscriptViewMenu } from "./TranscriptViewMenu";
import { Composer } from "../../features/composer/Composer";
import type { TranscriptMessage, TranscriptInfo, WSMessage, CostResult } from "../../lib/types";
import {
  contextFromResultChunk,
  contextFromCost,
  type ContextUsage,
  type ResultChunkLike,
} from "../../lib/context-window";
import {
  readTranscriptFontSize,
  readTranscriptViewMode,
  writeTranscriptFontSize,
  writeTranscriptViewMode,
  type TranscriptFontSize,
  type TranscriptViewMode,
} from "../../lib/transcriptViewMode";

// Catch-up poll interval. Claude Code only fires hooks on PreToolUse /
// PostToolUse / Stop, which means a user-typed message (no hook) and any
// assistant text written between two hook fires is invisible until the next
// hook event. A short visibility-gated poll closes that gap and also rescues
// the conversation from missed/late WebSocket frames.
const POLL_INTERVAL_MS = 3000;
// Rescan the transcripts list periodically so new subagents that spawn
// mid-session appear in the dropdown without a page reload.
const TRANSCRIPTS_REFRESH_MS = 15000;

interface LiveMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

interface ConversationViewProps {
  sessionId: string;
  initialTranscriptId?: string | null;
  sessionCwd?: string;
  sessionLiveHandleId?: string | null;
  defaultModel?: string | null;
  defaultMode?: string | null;
  defaultProfileId?: string | null;
}

/** Convert a {@link LiveMessage} into the {@link TranscriptMessage} shape the
 * unified MessageList consumes. Live entries don't carry usage/model
 * metadata, so those fields stay undefined and MessageList renders a clean
 * bubble without the token-cost annotations. */
function liveToTranscript(m: LiveMessage): TranscriptMessage {
  return {
    type: m.role,
    timestamp: new Date(m.ts).toISOString(),
    content: [{ type: "text", text: m.text }],
  };
}

export function ConversationView({ sessionId, initialTranscriptId, sessionCwd, sessionLiveHandleId, defaultModel, defaultMode, defaultProfileId }: ConversationViewProps) {
  // Live handle tracker: starts with the prop and updates when the Composer
  // spawns or respawns. Used to filter agent_stream WS broadcasts so we only
  // append messages from the agent attached to THIS session view.
  const [liveHandleId, setLiveHandleId] = useState<string | null>(sessionLiveHandleId ?? null);
  useEffect(() => setLiveHandleId(sessionLiveHandleId ?? null), [sessionLiveHandleId]);
  // Live messages received via agent_stream — appended in real time so the user
  // sees the agent's response immediately, even when `claude -p --resume` forks
  // the session-id and no `new_event` ever fires for the session in the URL.
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(
    initialTranscriptId ?? null
  );
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptInfo[]>([]);
  const [showNewMsg, setShowNewMsg] = useState(false);
  // Optimistic user message: rendered immediately on Send, cleared when the
  // composer reports busy=false. The JSONL catch-up will populate the real
  // message within a few seconds — a brief gap is preferable to double-render.
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  // Whether to show the assistant "thinking…" placeholder. True from Send
  // until the first agent_stream chunk arrives or the agent terminates.
  const [thinking, setThinking] = useState(false);
  // Latest context-window snapshot from the most recent `result` chunk; used
  // by the composer's capacity ring. Falls back to the cost endpoint until
  // the first turn completes.
  const [resultContext, setResultContext] = useState<ContextUsage | null>(null);
  const [cost, setCost] = useState<CostResult | null>(null);

  // Track JSONL line numbers for incremental requests and history loading
  const lastLineRef = useRef(0);
  const firstLineRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const fetchingRef = useRef(false);
  // When a fetch is in flight and a new trigger arrives (WS event, poll,
  // manual refresh), we queue exactly one re-fetch so events that landed
  // during the in-flight request aren't silently dropped.
  const pendingFetchRef = useRef(false);
  // Refresh-button spinner state — separate from initial `loading` so the
  // existing skeleton doesn't blink during a manual refresh.
  const [refreshing, setRefreshing] = useState(false);

  // Transcript view-mode + font-size selections, persisted across reloads
  // via localStorage. Default to "normal" + "medium" on first visit.
  const [viewMode, setViewModeState] = useState<TranscriptViewMode>(() => readTranscriptViewMode());
  const [fontSize, setFontSizeState] = useState<TranscriptFontSize>(() => readTranscriptFontSize());
  const setViewMode = useCallback((m: TranscriptViewMode) => {
    setViewModeState(m);
    writeTranscriptViewMode(m);
  }, []);
  const setFontSize = useCallback((s: TranscriptFontSize) => {
    setFontSizeState(s);
    writeTranscriptFontSize(s);
  }, []);

  // Load available transcript list (also rescanned on a short interval so
  // newly-spawned subagents appear in the dropdown without a page reload).
  useEffect(() => {
    let cancelled = false;
    async function loadTranscripts() {
      try {
        const result = await api.sessions.transcripts(sessionId);
        if (cancelled) return;
        setTranscripts(result.transcripts);
      } catch {
        // Non-fatal
      }
    }
    loadTranscripts();
    const interval = window.setInterval(loadTranscripts, TRANSCRIPTS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  // Load aggregate session cost as a fallback context-usage source. The ring
  // only renders this number until the first `result` chunk arrives, after
  // which `resultContext` takes precedence.
  useEffect(() => {
    let cancelled = false;
    api.pricing
      .sessionCost(sessionId)
      .then((c) => {
        if (!cancelled) setCost(c);
      })
      .catch(() => {
        /* non-fatal — ring renders a placeholder */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Sync external initialTranscriptId to internal state
  useEffect(() => {
    if (initialTranscriptId != null) {
      setSelectedTranscript(initialTranscriptId);
    }
  }, [initialTranscriptId]);

  // Initial load: fetch the latest N messages. Also clears live-stream
  // and result-context state so a transcript switch doesn't carry stale
  // chunks from the previous selection.
  useEffect(() => {
    let cancelled = false;
    setLiveMessages([]);
    setResultContext(null);
    setPendingUserText(null);
    setThinking(false);

    async function load() {
      try {
        setError(null);
        setLoading(true);
        setShowNewMsg(false);
        const result = await api.sessions.transcript(sessionId, {
          agent_id: selectedTranscript || undefined,
          limit: 50,
        });
        if (cancelled) return;
        setMessages(result.messages);
        setTotal(result.total);
        setHasMore(result.has_more);
        lastLineRef.current = result.last_line;
        firstLineRef.current = result.first_line;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load transcript");
        setMessages([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedTranscript]);

  // Incrementally load new messages. Two modes:
  //   - bootstrap (lastLineRef === 0): the initial load saw an empty
  //     transcript, so we pull the latest 50 to seed the view. This unblocks
  //     fresh sessions where the JSONL hadn't been written yet at mount.
  //   - incremental (lastLineRef > 0): tail-fetch lines after the highest
  //     parsed message we've seen. The server already de-overlaps via
  //     afterLine, so we can safely append.
  const fetchNewMessages = useCallback(async () => {
    if (fetchingRef.current) {
      // Coalesce: remember a trigger arrived during this fetch and re-run
      // exactly once when the in-flight request settles.
      pendingFetchRef.current = true;
      return;
    }
    fetchingRef.current = true;
    pendingFetchRef.current = false;

    const wasBootstrap = lastLineRef.current === 0;
    try {
      const result = await api.sessions.transcript(sessionId, {
        agent_id: selectedTranscript || undefined,
        ...(wasBootstrap ? {} : { after: lastLineRef.current }),
        limit: 50,
      });
      if (result.messages.length === 0) return;

      lastLineRef.current = result.last_line;

      if (wasBootstrap) {
        // Seed the view in a single render so the user sees the whole
        // catch-up batch instead of a blank panel followed by a partial one.
        setMessages(result.messages);
        firstLineRef.current = result.first_line;
        setHasMore(result.has_more);
      } else {
        setMessages((prev) => [...prev, ...result.messages]);
      }
      setTotal(result.total);

      // Auto-scroll if user is at bottom; otherwise show "new messages" indicator
      if (isAtBottomRef.current) {
        scrollToBottom();
      } else {
        setShowNewMsg(true);
      }
    } catch {
      // Non-fatal
    } finally {
      fetchingRef.current = false;
      // Drain a queued trigger if one arrived during the fetch.
      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        // Defer one tick so React state updates from this call commit first.
        setTimeout(() => fetchNewMessages(), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, selectedTranscript]);

  // WebSocket subscription: refetch on every new_event for this session.
  // Hook coverage isn't complete (a user-typed message fires no hook), so we
  // also poll below to catch what WS misses.
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((msg: WSMessage) => {
      if (msg.type !== "new_event") return;
      const data = msg.data as { session_id?: string };
      if (data.session_id !== sessionId) return;
      fetchNewMessages();
    });
    return unsubscribe;
  }, [sessionId, fetchNewMessages]);

  // Live agent_stream subscription: append the agent's tokens directly when a
  // live orchestrator handle is attached. This is independent of the JSONL →
  // new_event path — `claude -p --resume <terminated-session>` forks the
  // session-id, so no new_event ever fires for the session in the URL. The
  // agent_stream broadcast comes straight from the spawner's stdout parser.
  // NOTE: server's broadcast() wraps payload as {type, data, timestamp}, so
  // sessionId/chunk live under msg.data — not at the top level. The WSMessage
  // type declares them top-level, which is a pre-existing inaccuracy; we cast
  // through `unknown` to read the actual wire shape.
  useEffect(() => {
    if (!liveHandleId) return;
    const unsubscribe = eventBus.subscribe((msg: WSMessage) => {
      const wire = msg as unknown as { type: string; data?: Record<string, unknown> };
      if (wire.type === "agent_respawned") {
        const d = wire.data || {};
        if (d.oldHandleId === liveHandleId && typeof d.newHandleId === "string") {
          setLiveHandleId(d.newHandleId);
        }
        return;
      }
      if (wire.type === "agent_status") {
        const d = wire.data || {};
        if (d.sessionId === liveHandleId) {
          // Terminal status — stop the thinking indicator regardless of
          // whether any chunks made it through. "killed" matters too: a
          // user-clicked Stop should drop the spinner, not strand it.
          const status = d.status;
          if (status === "completed" || status === "error" || status === "killed") {
            setThinking(false);
          }
        }
        return;
      }
      if (wire.type !== "agent_stream") return;
      const d = wire.data || {};
      if (d.sessionId !== liveHandleId) return;
      const chunk = d.chunk as
        | (ResultChunkLike & {
            type?: string;
            message?: { role?: string; content?: unknown };
            text?: string;
          })
        | undefined;
      if (!chunk) return;

      // Capture the `result` chunk for context-usage tracking — this is the
      // most accurate snapshot available client-side.
      if (chunk.type === "result") {
        const usage = contextFromResultChunk(chunk);
        if (usage) setResultContext(usage);
        // `result` also marks the end of an assistant turn; clear thinking.
        setThinking(false);
      }

      // Normalize the SDK stream-json variants we care about into our compact
      // shape. Skip system/hook events (subtype, hook_response, etc.) — they
      // aren't user-visible turns.
      let text: string | null = null;
      let role: "user" | "assistant" = "assistant";
      if (chunk.type === "assistant" && chunk.message) {
        const c = chunk.message.content;
        if (Array.isArray(c)) {
          text = c
            .map((p: { type?: string; text?: string }) => (p?.type === "text" ? p.text || "" : ""))
            .filter(Boolean)
            .join("\n");
        } else if (typeof c === "string") {
          text = c;
        }
        role = "assistant";
      } else if (chunk.type === "user" && chunk.message) {
        const c = chunk.message.content;
        if (typeof c === "string") text = c;
        else if (Array.isArray(c))
          text = c
            .map((p: { type?: string; text?: string }) => (p?.type === "text" ? p.text || "" : ""))
            .filter(Boolean)
            .join("\n");
        role = "user";
      }
      if (!text) return;
      // First assistant chunk arrived — drop the thinking placeholder.
      if (role === "assistant") setThinking(false);
      // The agent's stream-json includes a `user` echo of the prompt. When
      // that arrives we also drop the optimistic pending bubble so the user
      // doesn't see their message twice (pending dim + live echo).
      if (role === "user") setPendingUserText(null);
      setLiveMessages((prev) => [
        ...prev,
        { id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text, ts: Date.now() },
      ]);
    });
    return unsubscribe;
  }, [liveHandleId]);

  // Resync on WebSocket reconnect: events that landed during a transient
  // disconnect are gone from the bus, but the JSONL still has them, so a
  // single tail-fetch on reconnect catches the conversation up.
  useEffect(() => {
    return eventBus.onConnection((connected) => {
      if (connected) fetchNewMessages();
    });
  }, [fetchNewMessages]);

  // Visibility-gated polling fallback. Covers:
  //   1. User-typed messages (no Claude Code hook fires for those).
  //   2. Long assistant turns where text streams between hook fires.
  //   3. Late JSONL flushes that arrive after the triggering hook's fetch.
  //   4. Dropped/missed WebSocket frames.
  useEffect(() => {
    let interval: number | null = null;
    function start() {
      if (interval !== null) return;
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") fetchNewMessages();
      }, POLL_INTERVAL_MS);
    }
    function stop() {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Tab just became visible — fire a one-shot catch-up immediately
        // and resume polling. Backgrounded tabs throttle setInterval, so
        // restarting on focus avoids a stale conversation.
        fetchNewMessages();
        start();
      } else {
        stop();
      }
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNewMessages]);

  // Manual refresh — surfaces a control in the toolbar so users can force
  // a sync without reloading the page.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNewMessages();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNewMessages]);

  // Scroll-up to load history
  const loadHistory = useCallback(async () => {
    if (loadingHistory || !hasMore) return;
    // Need the first message's line number
    // Since message objects don't have a _line field, we track it via firstLineRef
    // firstLineRef is updated on initial load and each history load
    try {
      setLoadingHistory(true);
      const container = scrollContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;

      const result = await api.sessions.transcript(sessionId, {
        agent_id: selectedTranscript || undefined,
        before: firstLineRef.current || undefined,
        limit: 50,
      });

      if (result.messages.length === 0) {
        // Nothing older exists — clear hasMore so the hint stops showing
        // even if the server still claims more is available.
        setHasMore(false);
        setLoadingHistory(false);
        return;
      }

      // Update firstLineRef to the oldest message's line number in the history batch
      firstLineRef.current = result.first_line;

      setMessages((prev) => [...result.messages, ...prev]);
      setHasMore(result.has_more);

      // Preserve scroll position (don't jump to top)
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch {
      // Non-fatal
    } finally {
      setLoadingHistory(false);
    }
  }, [sessionId, selectedTranscript, loadingHistory, hasMore]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, []);

  // Listen for scroll events: detect bottom position + trigger history load
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Detect if at bottom
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isAtBottomRef.current = atBottom;

    // Hide "new messages" indicator when scrolled to bottom
    if (atBottom) {
      setShowNewMsg(false);
    }

    // Load history when scrolled to top
    if (container.scrollTop < 50 && hasMore && !loadingHistory) {
      loadHistory();
    }
  }, [hasMore, loadingHistory, loadHistory]);

  // Auto-scroll to bottom after initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unified message list: JSONL-derived + live-stream-derived. Live messages
  // get appended at the tail until the JSONL catches up; when a fresh agent
  // handle is attached `liveMessages` is reset (see onLiveHandleChange).
  const unifiedMessages = useMemo<TranscriptMessage[]>(() => {
    if (liveMessages.length === 0) return messages;
    // Dedupe: when the JSONL catch-up surfaces the same text the agent
    // already streamed, the JSONL version (with model + token metadata)
    // wins. Match against the tail of `messages` since live entries are
    // always recent. Bounded N×M is fine — both sides are paginated to ~50.
    const recent = messages.slice(-Math.max(liveMessages.length * 2, 10));
    const recentText = new Set(
      recent.map((m) => `${m.type}|${m.content.map((c) => c.text || "").join("")}`),
    );
    const dedupedLive = liveMessages.filter(
      (l) => !recentText.has(`${l.role}|${l.text}`),
    );
    if (dedupedLive.length === 0) return messages;
    return [...messages, ...dedupedLive.map(liveToTranscript)];
  }, [messages, liveMessages]);

  // Keep auto-scroll behaviour when live chunks arrive — without this the
  // newly streamed assistant text would render below the fold while the
  // scroll position stays anchored to the old bottom.
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    } else {
      setShowNewMsg(true);
    }
  }, [liveMessages.length, pendingUserText, thinking, scrollToBottom]);

  // Composer reports its in-flight user-message text. We mirror it into
  // `pendingUserText` so the dimmed "Sending…" bubble renders right after
  // the click, and clear it when busy flips false (composer passes null).
  const handlePendingChange = useCallback((text: string | null) => {
    setPendingUserText(text);
    if (text !== null) {
      // The composer just kicked off a send — the next assistant chunk is
      // pending, so light up the typing indicator.
      setThinking(true);
    }
  }, []);

  // Compose the context-usage snapshot: prefer the most recent `result`
  // chunk, fall back to the cost endpoint, fall back to a model-default
  // ring when neither has data yet.
  const contextUsage = useMemo<ContextUsage | null>(() => {
    if (resultContext) return resultContext;
    return contextFromCost(cost, defaultModel);
  }, [resultContext, cost, defaultModel]);

  return (
    <div className="relative flex flex-col" style={{ minHeight: 0 }}>
      {/* Toolbar — always rendered after the initial load so users can
          refresh even when no messages have streamed yet. */}
      {!loading && (
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
          {transcripts.length > 1 && (
            <div className="relative">
              <select
                value={selectedTranscript || ""}
                onChange={(e) => setSelectedTranscript(e.target.value || null)}
                className="appearance-none bg-surface-2 border border-surface-3 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-300 focus:outline-none focus:border-violet-500/50 hover:border-violet-500/30 cursor-pointer transition-colors"
              >
                {transcripts.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 font-mono bg-surface-2 border border-surface-3 rounded-md px-2 py-1">
            <MessagesSquare className="w-3 h-3" />
            {total} message{total !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            title="Refresh conversation"
            aria-label="Refresh conversation"
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200 bg-surface-2 border border-surface-3 hover:border-violet-500/30 rounded-md px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <TranscriptViewMenu
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Message list container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 320px)", minHeight: 200 }}
      >
        {/* History loading indicator */}
        {loadingHistory && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500 ml-2">Loading history...</span>
          </div>
        )}

        {/* Scroll-up for history hint */}
        {hasMore && !loadingHistory && !loading && (
          <div className="flex justify-center py-2">
            <span className="text-[11px] text-gray-600">↑ Scroll up for older messages</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            Loading conversation...
          </div>
        ) : unifiedMessages.length === 0 && !pendingUserText && !thinking ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No conversation records found.
          </div>
        ) : (
          <>
            <MessageList
              messages={unifiedMessages}
              loading={false}
              viewMode={viewMode}
              fontSize={fontSize}
            />
            {/* Pending optimistic user bubble, dimmed/italic until busy flips. */}
            {pendingUserText && (
              <div className="mt-3" data-testid="pending-user-bubble">
                <PendingUserBubble text={pendingUserText} />
              </div>
            )}
            {/* Assistant thinking placeholder — three pulsing dots until the
                first agent_stream chunk lands or the agent terminates. */}
            {thinking && (
              <div className="mt-3" data-testid="thinking-indicator">
                <ThinkingBubble />
              </div>
            )}
          </>
        )}
      </div>

      {/* New messages indicator */}
      {showNewMsg && (
        <button
          onClick={() => {
            scrollToBottom();
            setShowNewMsg(false);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg transition-colors z-10"
        >
          <ArrowDown className="w-3 h-3" />
          New messages
        </button>
      )}

      {/* Send composer — only shown when session cwd is known */}
      {sessionCwd && (
        <Composer
          sessionId={sessionId}
          sessionCwd={sessionCwd}
          sessionLiveHandleId={liveHandleId}
          defaultModel={defaultModel}
          defaultMode={defaultMode as Parameters<typeof Composer>[0]["defaultMode"]}
          defaultProfileId={defaultProfileId}
          contextUsage={contextUsage}
          onPendingChange={handlePendingChange}
          onLiveHandleChange={(id) => {
            setLiveHandleId(id);
            // When a fresh handle is attached (new spawn), reset live messages
            // so the user doesn't see stale chunks from a previous run.
            if (id !== liveHandleId) {
              setLiveMessages([]);
              setResultContext(null);
            }
          }}
        />
      )}
    </div>
  );
}

/** Optimistic user-message bubble. Visually distinguishable from a settled
 * user row (lower opacity, italic body, "Sending…" label) but uses the same
 * blue accent palette so the transition to the real bubble is smooth. */
function PendingUserBubble({ text }: { text: string }) {
  return (
    <div
      className="relative flex gap-3 rounded-xl px-3 py-2.5 opacity-60 italic before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:rounded-full before:opacity-60 before:bg-blue-500/40"
      aria-label="Sending message"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 shadow-sm bg-gradient-to-br from-blue-500/30 to-cyan-500/20 text-blue-200 ring-1 ring-blue-400/30">
        <User className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold tracking-wide text-blue-200">User</span>
          <span className="text-[10px] text-gray-500 font-mono bg-surface-3/60 border border-surface-3 rounded px-1.5 py-0.5 not-italic">
            Sending…
          </span>
        </div>
        <div className="min-w-0 whitespace-pre-wrap text-sm text-gray-300">{text}</div>
      </div>
    </div>
  );
}

/** Three pulsing dots, rendered where the next assistant bubble will appear. */
function ThinkingBubble() {
  return (
    <div
      className="relative flex gap-3 rounded-xl px-3 py-2.5 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:rounded-full before:opacity-60 before:bg-violet-500/40"
      aria-label="Assistant is thinking"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 shadow-sm bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-200 ring-1 ring-violet-400/30">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold tracking-wide text-violet-200">Assistant</span>
          <span className="text-[10px] text-gray-500 font-mono">thinking…</span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-violet-300/70 animate-pulse"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-violet-300/70 animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-violet-300/70 animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
