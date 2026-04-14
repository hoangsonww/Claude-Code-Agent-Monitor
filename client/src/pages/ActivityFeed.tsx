/**
 * @file ActivityFeed.tsx
 * @description Displays a real-time feed of agent events with pause/resume and pagination features.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Pause, Play, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { formatTime, timeAgo } from "../lib/format";
import type { DashboardEvent, AgentStatus } from "../lib/types";

const PAGE_SIZE = 10;

export function ActivityFeed() {
  const navigate = useNavigate();
  const { t } = useTranslation("activity");
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [bufferCount, setBufferCount] = useState(0);
  const bufferRef = useRef<DashboardEvent[]>([]);
  const pausedRef = useRef(paused);

  pausedRef.current = paused;

  const load = useCallback(async () => {
    try {
      const { events: data } = await api.events.list({ limit: 100 });
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (msg.type === "new_event") {
        const event = msg.data as DashboardEvent;
        if (pausedRef.current) {
          bufferRef.current = [event, ...bufferRef.current];
          setBufferCount(bufferRef.current.length);
        } else {
          setEvents((prev) => [event, ...prev.slice(0, 199)]);
        }
      }
    });
  }, []);

  function resume() {
    pausedRef.current = false;
    const buffered = bufferRef.current;
    bufferRef.current = [];
    setBufferCount(0);
    setEvents((prev) => [...buffered, ...prev].slice(0, 200));
    setPaused(false);
  }

  function statusFromEventType(type: string): AgentStatus {
    switch (type) {
      case "PreToolUse":
        return "working";
      case "PostToolUse":
        return "connected";
      case "Stop":
      case "SubagentStop":
      case "Compaction":
        return "completed";
      default:
        return "idle";
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
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

      {!loading && events.length === 0 ? (
        <EmptyState icon={Activity} title={t("noActivity")} description={t("noActivityDesc")} />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto">
              {events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((event, i) => (
                <div
                  key={event.id ?? i}
                  onClick={() => navigate(`/sessions/${event.session_id}`)}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-4 transition-colors cursor-pointer animate-slide-up"
                >
                  <div className="w-14 text-[11px] text-gray-500 font-mono flex-shrink-0 text-right">
                    {formatTime(event.created_at)}
                  </div>

                  <AgentStatusBadge status={statusFromEventType(event.event_type)} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">
                      {event.summary || event.event_type}
                    </p>
                  </div>

                  {event.tool_name && (
                    <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                      {event.tool_name}
                    </span>
                  )}

                  <span className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {events.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-gray-500">
                {t("common:pagination.showing", {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, events.length),
                  total: events.length,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("common:pagination.previous")}
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-500">
                  {page + 1} / {Math.ceil(events.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(Math.ceil(events.length / PAGE_SIZE) - 1, p + 1))
                  }
                  disabled={page >= Math.ceil(events.length / PAGE_SIZE) - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("common:pagination.next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
