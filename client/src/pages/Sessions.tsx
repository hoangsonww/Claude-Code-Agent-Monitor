/**
 * @file Sessions.tsx
 * @description Displays a list of all recorded sessions with filtering, searching, and pagination features. Sessions are updated in real-time based on events received from the event bus.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FolderOpen, Search, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { SessionStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { formatDateTime, formatDuration, truncate, fmtCost } from "../lib/format";
import type { Session, SessionStatus, DashboardEvent } from "../lib/types";

const PAGE_SIZE = 10;

export function Sessions() {
  const navigate = useNavigate();
  const { t } = useTranslation("sessions");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const FILTER_OPTIONS: Array<{ label: string; value: string }> = [
    { label: t("filterAll"), value: "" },
    { label: t("filterActive"), value: "active" },
    { label: t("filterCompleted"), value: "completed" },
    { label: t("filterError"), value: "error" },
    { label: t("filterAbandoned"), value: "abandoned" },
  ];

  const load = useCallback(async () => {
    try {
      const params: { status?: string; limit?: number } = { limit: 500 };
      if (filter) params.status = filter;
      const sessionsRes = await api.sessions.list(params);
      setSessions(sessionsRes.sessions);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (msg.type === "session_created" || msg.type === "session_updated") {
        load();
      }
      if (msg.type === "new_event") {
        const ev = msg.data as DashboardEvent;
        if (ev.event_type === "Stop" || ev.event_type === "SessionEnd") {
          load();
        }
      }
    });
  }, [load]);

  const filtered = search
    ? sessions.filter(
        (s) =>
          s.id.toLowerCase().includes(search.toLowerCase()) ||
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.cwd?.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter/search changes
  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <FolderOpen className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">
              {t("sessionCount", { count: sessions.length })}
              {filter ? ` ${filter}` : ""}
            </p>
          </div>
        </div>
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === opt.value
                  ? "bg-surface-4 text-gray-200"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={t("noSessions")}
          description={search || filter ? t("noSessionsDesc") : t("noSessionsHint")}
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableSession")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableStatus")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableLastActive")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableDuration")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableAgents")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableCost")}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {t("tableDirectory")}
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    className="hover:bg-surface-4 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {session.name || `${t("defaultName")}${session.id.slice(0, 8)}`}
                        </p>
                        <p className="text-[11px] text-gray-600 font-mono">
                          {session.id.slice(0, 12)}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SessionStatusBadge status={session.status as SessionStatus} />
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {formatDateTime(session.last_activity || session.started_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400 font-mono">
                      {session.ended_at
                        ? formatDuration(session.started_at, session.ended_at)
                        : t("common:running")}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {session.agent_count ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400 font-mono">
                      {session.cost != null && session.cost > 0 ? fmtCost(session.cost) : "-"}
                    </td>
                    <td className="px-5 py-4 text-[11px] text-gray-500 font-mono">
                      {session.cwd ? truncate(session.cwd, 30) : "-"}
                    </td>
                    <td className="px-3 py-4">
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-gray-500">
                {t("common:pagination.showing", {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, filtered.length),
                  total: filtered.length,
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
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
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
