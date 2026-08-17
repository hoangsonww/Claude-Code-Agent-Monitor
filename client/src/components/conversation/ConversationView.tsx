/**
 * @file ConversationView.tsx
 * @description Conversation tab on the Session detail page. Loads a session
 * (or sub-agent) JSONL transcript, paginates it incrementally, and renders
 * the message stream via MessageList. Combines a WebSocket subscription, a
 * visibility-gated polling fallback, and a manual refresh button so the view
 * stays caught up even when events miss frames or the user is mid-text-only
 * turn. A top sentinel and scroll fallback
 * make older pages load reliably for both Claude and Codex transcripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/ConversationView.tsx`
 * **Purpose:** Renders provider transcript rows (user, assistant, tool calls) inside Session Detail with markdown, syntax highlighting, and TUI-style segments.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../../lib/api`
 * - `../../lib/eventBus`
 * - `./MessageList`
 * - `../../lib/types`
 *
 * ## Public surface
 * - `ConversationView` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **ConversationView**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2, ArrowDown, MessagesSquare, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { eventBus } from "../../lib/eventBus";
import { isRemoteDataRefreshMessage } from "../../lib/remoteDataEvents";
import { MessageList } from "./MessageList";
import type { TranscriptMessage, TranscriptInfo, WSMessage } from "../../lib/types";

// Catch-up poll interval. Some lifecycle event streams do not emit every
// transcript write, so a user-typed message or assistant text may otherwise
// remain invisible until the next event. A short visibility-gated poll closes
// that gap and also rescues the conversation from missed/late WebSocket frames.
const POLL_INTERVAL_MS = 3000;
// Rescan the transcripts list periodically so new subagents that spawn
// mid-session appear in the dropdown without a page reload.
const TRANSCRIPTS_REFRESH_MS = 15000;

interface ConversationViewProps {
  sessionId: string;
  initialTranscriptId?: string | null;
}

export function ConversationView({ sessionId, initialTranscriptId }: ConversationViewProps) {
  const { t } = useTranslation("sessions");
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

  // Track JSONL line numbers for incremental requests and history loading
  const lastLineRef = useRef(0);
  const firstLineRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const historySentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const fetchingRef = useRef(false);
  // State updates are asynchronous, so keep an imperative guard as well. It
  // prevents a scroll event and the top IntersectionObserver from requesting
  // the same history page before `loadingHistory` has rendered.
  const historyLoadingRef = useRef(false);
  // When a fetch is in flight and a new trigger arrives (WS event, poll,
  // manual refresh), we queue exactly one re-fetch so events that landed
  // during the in-flight request aren't silently dropped.
  const pendingFetchRef = useRef(false);
  // Refresh-button spinner state - separate from initial `loading` so the
  // existing skeleton doesn't blink during a manual refresh.
  const [refreshing, setRefreshing] = useState(false);

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

  // Sync external initialTranscriptId to internal state
  useEffect(() => {
    if (initialTranscriptId != null) {
      setSelectedTranscript(initialTranscriptId);
    }
  }, [initialTranscriptId]);

  // Initial load: fetch the latest N messages
  useEffect(() => {
    let cancelled = false;

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
      if (isRemoteDataRefreshMessage(msg)) {
        fetchNewMessages();
        return;
      }
      if (msg.type !== "new_event") return;
      const data = msg.data as { session_id?: string };
      if (data.session_id !== sessionId) return;
      fetchNewMessages();
    });
    return unsubscribe;
  }, [sessionId, fetchNewMessages]);

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
        // Tab just became visible - fire a one-shot catch-up immediately
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

  // Manual refresh - surfaces a control in the toolbar so users can force
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
    if (historyLoadingRef.current || !hasMore) return;
    // Need the first message's line number
    // Since message objects don't have a _line field, we track it via firstLineRef
    // firstLineRef is updated on initial load and each history load
    try {
      historyLoadingRef.current = true;
      setLoadingHistory(true);
      const container = scrollContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;

      const result = await api.sessions.transcript(sessionId, {
        agent_id: selectedTranscript || undefined,
        before: firstLineRef.current || undefined,
        limit: 50,
      });

      if (result.messages.length === 0) {
        // Nothing older exists - clear hasMore so the hint stops showing
        // even if the server still claims more is available.
        setHasMore(false);
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
      historyLoadingRef.current = false;
      setLoadingHistory(false);
    }
  }, [sessionId, selectedTranscript, hasMore]);

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
    if (container.scrollTop <= 50 && hasMore) {
      loadHistory();
    }
  }, [hasMore, loadHistory]);

  // Browsers occasionally do not emit another scroll event after a touchpad
  // fling lands exactly at scrollTop=0. Observing a tiny marker at the top
  // closes that gap, while the scroll handler above remains the fallback for
  // older browsers and explicit scrollbar movement.
  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = historySentinelRef.current;
    if (!root || !sentinel || !hasMore || loading || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadHistory();
      },
      { root, rootMargin: "64px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadHistory]);

  // Auto-scroll to bottom after initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex flex-col" style={{ minHeight: 0 }}>
      {/* Toolbar - always rendered after the initial load so users can
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
        data-testid="transcript-scroll-container"
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 320px)", minHeight: 200 }}
      >
        <div ref={historySentinelRef} aria-hidden="true" className="h-px" />
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
            <button
              type="button"
              onClick={loadHistory}
              className="text-[11px] text-gray-500 hover:text-violet-300 transition-colors"
            >
              {t("detail.transcript.loadOlder")}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-md py-12 text-center">
            <p className="text-sm text-gray-400">No conversation records found.</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              This session&apos;s metadata was imported, but its transcript file is no longer on
              disk. Older conversations may be unavailable when the original CLI has cleaned up its
              local history. Sessions imported from now on are snapshotted and kept even after the
              original transcript disappears.
            </p>
          </div>
        ) : (
          <MessageList messages={messages} loading={false} />
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
    </div>
  );
}
