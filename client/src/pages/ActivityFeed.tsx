/**
 * @file ActivityFeed.tsx
 * @description Real-time feed of agent events with server-driven filters,
 * tool-call grouping, and batched "Load more" pagination. Clicking a row in
 * flat mode toggles the inline EventDetail payload view; the "View session"
 * Link navigates to the session page. Live events trigger a debounced,
 * filter-aware refetch that preserves the user's accumulated page size.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Pause, Play, RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { EventDetail } from "../components/EventDetail";
import {
  EventFilters,
  EMPTY_FILTERS,
  isEmptyFilters,
  expandStatusToEventTypes,
} from "../components/EventFilters";
import type { EventFiltersValue } from "../components/EventFilters";
import { EventFiltersInfo } from "../components/EventFiltersInfo";
import { EventGroupRow } from "../components/EventGroupRow";
import {
  agentOriginLabel,
  buildEventTitle,
  buildOriginLabel,
  groupEvents,
  projectFromEvent,
  statusFromEventType,
} from "../lib/event-grouping";
import type { AgentInfo } from "../lib/event-grouping";
import { formatTime, timeAgo } from "../lib/format";
import type { DashboardEvent } from "../lib/types";

const INITIAL_BATCH = 50;
const MORE_BATCH = 500;
// Max rows a single /api/events request can return (server cap). Refreshes
// triggered by live events are bounded by this — if the user has loaded more
// than MAX_REFRESH via "Load more", the refresh shows the newest MAX_REFRESH
// matching rows and the tail falls off until the user paginates again.
const MAX_REFRESH = 500;
// Debounce live-event refreshes so a burst of hook events (e.g. a stream of
// PostToolUse results) triggers one refetch instead of dozens.
const REFRESH_DEBOUNCE_MS = 500;

export function ActivityFeed() {
  const { t } = useTranslation("activity");
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<EventFiltersValue>(EMPTY_FILTERS);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [grouped, setGrouped] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(() => new Set());
  // session_id → session name. Populated from /api/sessions on mount so rows
  // can render a friendly session pill instead of a bare UUID.
  const [sessionNameById, setSessionNameById] = useState<Map<string, string>>(() => new Map());
  // agent_id → subagent-facing info. Populated from /api/agents on mount so the
  // subagent pill can show subagent_type (e.g. "frontend-reviewer") instead of
  // a raw ID. Main agents intentionally yield no pill.
  const [agentInfoById, setAgentInfoById] = useState<Map<string, AgentInfo>>(() => new Map());

  const bufferRef = useRef<DashboardEvent[]>([]);
  const pausedRef = useRef(paused);
  // Refs let the websocket handler read the latest filter/size without
  // re-subscribing on every change.
  const apiParamsRef = useRef<Record<string, unknown>>({});
  const loadedCountRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  pausedRef.current = paused;
  loadedCountRef.current = events.length;

  function toggleEvent(id: number) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Convert UI filter state → API params. Status presets expand into
  // event_type values and merge with any explicit event_type selection.
  const apiParams = useMemo(() => {
    const statusExpanded = expandStatusToEventTypes(filters.status);
    const eventTypeMerged = Array.from(new Set<string>([...filters.event_type, ...statusExpanded]));
    return {
      event_type: eventTypeMerged.length > 0 ? eventTypeMerged : undefined,
      tool_name: filters.tool_name.length > 0 ? filters.tool_name : undefined,
      agent_id: filters.agent_id.length > 0 ? filters.agent_id : undefined,
      session_id: filters.session_id.length > 0 ? filters.session_id : undefined,
      q: filters.q || undefined,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
    };
  }, [filters]);

  apiParamsRef.current = apiParams;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { events: data, total: totalCount } = await api.events.list({
        ...apiParams,
        limit: INITIAL_BATCH,
        offset: 0,
      });
      setEvents(data);
      setTotal(totalCount);
    } catch (err) {
      // Non-fatal: keep the previous list; log so dev tools surface the
      // failure instead of raising an unhandled promise rejection.
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }, [apiParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    api.sessions
      .list({ limit: 500 })
      .then(({ sessions }) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const s of sessions) {
          if (s.name) map.set(s.id, s.name);
        }
        setSessionNameById(map);
      })
      .catch(() => {
        // Non-fatal: rows just render without the session name pill.
      });
    api.agents
      .list({ limit: 1000 })
      .then(({ agents }) => {
        if (cancelled) return;
        const map = new Map<string, AgentInfo>();
        for (const a of agents) {
          map.set(a.id, {
            type: a.type,
            subagent_type: a.subagent_type,
            name: a.name,
          });
        }
        setAgentInfoById(map);
      })
      .catch(() => {
        // Non-fatal: subagent pills fall back to the short-id label.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const { events: data, total: totalCount } = await api.events.list({
        ...apiParams,
        limit: MORE_BATCH,
        offset: events.length,
      });
      setEvents((prev) => [...prev, ...data]);
      setTotal(totalCount);
    } catch (err) {
      console.error("Failed to load more events:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [apiParams, events.length]);

  // Refetches the list using the latest filter state + the page size the user
  // has currently accumulated. Preserves "Load more" state across live
  // refreshes (capped at MAX_REFRESH, the server limit).
  const refreshWithPagination = useCallback(async () => {
    const target = Math.max(loadedCountRef.current || INITIAL_BATCH, INITIAL_BATCH);
    const size = Math.min(target, MAX_REFRESH);
    try {
      const { events: data, total: totalCount } = await api.events.list({
        ...apiParamsRef.current,
        limit: size,
        offset: 0,
      });
      setEvents(data);
      setTotal(totalCount);
    } catch (err) {
      // Non-fatal: swallow the error so a flaky websocket burst doesn't
      // spam unhandled rejections; the next live event / manual refresh
      // will try again.
      console.error("Failed to refresh events:", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe((msg) => {
      if (msg.type !== "new_event") return;
      const event = msg.data as DashboardEvent;
      if (pausedRef.current) {
        bufferRef.current = [event, ...bufferRef.current];
        setBufferCount(bufferRef.current.length);
        return;
      }
      // Debounce bursts into a single filter-aware refresh.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        refreshWithPagination();
      }, REFRESH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [refreshWithPagination]);

  function resume() {
    pausedRef.current = false;
    bufferRef.current = [];
    setBufferCount(0);
    setPaused(false);
    // Catch-up via filtered refresh so buffered non-matching events don't leak in.
    refreshWithPagination();
  }

  const hasMore = events.length < total;
  const groups = useMemo(() => groupEvents(events), [events]);
  // Precompute the project name per event so row rendering doesn't re-parse
  // event.data JSON on every render pass.
  const projectByEventId = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const e of events) map.set(e.id, projectFromEvent(e));
    return map;
  }, [events]);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <Activity className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">
              {t("subtitle")}
              {paused && (
                <span className="ml-2 text-yellow-400">{t("paused", { count: bufferCount })}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => (paused ? resume() : setPaused(true))} className="btn-ghost">
            {paused ? (
              <>
                <Play className="w-4 h-4" /> {t("resume")}
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" /> {t("pause")}
              </>
            )}
          </button>
          <button onClick={load} className="btn-ghost">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <EventFiltersInfo />
      </div>

      <div className="mb-4">
        <EventFilters
          value={filters}
          onChange={setFilters}
          sessionOptions={Array.from(sessionNameById.entries()).map(([id, label]) => ({
            id,
            label,
          }))}
        />
      </div>

      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          role="group"
          aria-label="view mode"
          className="inline-flex rounded-md border border-border overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setGrouped(true)}
            aria-pressed={grouped}
            className={`text-[11px] px-3 py-1 cursor-pointer ${
              grouped
                ? "bg-accent/20 text-accent"
                : "bg-surface-2 text-gray-400 hover:text-gray-200"
            }`}
          >
            {t("common:eventFilters.grouped")}
          </button>
          <button
            type="button"
            onClick={() => setGrouped(false)}
            aria-pressed={!grouped}
            className={`text-[11px] px-3 py-1 border-l border-border cursor-pointer ${
              !grouped
                ? "bg-accent/20 text-accent"
                : "bg-surface-2 text-gray-400 hover:text-gray-200"
            }`}
          >
            {t("common:eventFilters.flat")}
          </button>
        </div>
      </div>

      {!loading && events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={isEmptyFilters(filters) ? t("noActivity") : t("common:eventFilters.noResults")}
          description={isEmptyFilters(filters) ? t("noActivityDesc") : ""}
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border max-h-[calc(100vh-380px)] overflow-y-auto overflow-x-auto">
              {grouped
                ? groups.map((group) => (
                    <EventGroupRow
                      key={group.key}
                      group={group}
                      sessionNameById={sessionNameById}
                      agentInfoById={agentInfoById}
                    />
                  ))
                : events.map((event, i) => {
                    const isOpen = event.id != null && expandedEvents.has(event.id);
                    return (
                      <div key={event.id ?? i} className="animate-slide-up">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (event.id != null) toggleEvent(event.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (event.id != null) toggleEvent(event.id);
                            }
                          }}
                          aria-expanded={isOpen}
                          className="flex items-center px-5 py-3.5 gap-4 hover:bg-surface-4 transition-colors cursor-pointer select-none"
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}
                          />

                          <div className="w-14 text-[11px] text-gray-500 font-mono flex-shrink-0 text-right">
                            {formatTime(event.created_at)}
                          </div>

                          <AgentStatusBadge status={statusFromEventType(event.event_type)} />

                          {(() => {
                            const sname = sessionNameById.get(event.session_id);
                            const info = event.agent_id
                              ? agentInfoById.get(event.agent_id)
                              : undefined;
                            const project = projectByEventId.get(event.id) ?? null;
                            const origin = buildOriginLabel(
                              project,
                              sname ?? null,
                              agentOriginLabel(event.agent_id, info)
                            );
                            return (
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-300 truncate">
                                  {origin && (
                                    <span
                                      className="text-gray-500 mr-1"
                                      title={`${event.session_id} · ${event.agent_id ?? ""}`}
                                    >
                                      {origin} ·
                                    </span>
                                  )}
                                  {buildEventTitle(event)}
                                </p>
                              </div>
                            );
                          })()}

                          {event.tool_name && (
                            <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                              {event.tool_name}
                            </span>
                          )}

                          <span className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
                            {timeAgo(event.created_at)}
                          </span>

                          <Link
                            to={`/sessions/${event.session_id}`}
                            onClick={(e) => e.stopPropagation()}
                            title={t("viewSession")}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-accent hover:bg-accent/10 border border-border hover:border-accent/30 transition-colors flex-shrink-0 font-medium"
                          >
                            {t("viewSession")}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        {isOpen && <EventDetail event={event} />}
                      </div>
                    );
                  })}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs text-gray-500">
              {t("common:eventFilters.showing", { shown: events.length, total })}
            </span>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loadingMore ? t("common:eventFilters.loading") : t("common:eventFilters.loadMore")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
