import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Search, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { SessionStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { formatDateTime, formatDuration, truncate, fmtCost } from "../lib/format";
import type { Session, SessionStatus, DashboardEvent } from "../lib/types";

const FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Error", value: "error" },
  { label: "Abandoned", value: "abandoned" },
];

const PAGE_SIZE = 10;

export function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sessionCosts, setSessionCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      const params: { status?: string; limit?: number } = { limit: 500 };
      if (filter) params.status = filter;
      const sessionsRes = await api.sessions.list(params);
      setSessions(sessionsRes.sessions);
      // Fetch individual session costs in background
      const costs: Record<string, number> = {};
      const batchSize = 10;
      for (let i = 0; i < sessionsRes.sessions.length; i += batchSize) {
        const batch = sessionsRes.sessions.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((s) =>
            api.pricing.sessionCost(s.id).catch(() => ({ total_cost: 0, breakdown: [] }))
          )
        );
        batch.forEach((s, j) => {
          if (results[j]) costs[s.id] = results[j].total_cost;
        });
      }
      setSessionCosts(costs);
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
      // Reload on turn boundaries — token usage (and thus cost) updates on each hook event
      // but only Stop/SessionEnd represent meaningful cost changes worth refreshing for.
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Sessions</h2>
          <p className="text-sm text-gray-500">
            {sessions.length}
            {filter ? ` ${filter}` : ""} session{sessions.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search sessions..."
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
          title="No sessions found"
          description={
            search || filter
              ? "Try adjusting your search or filters."
              : "Start a Claude Code session with hooks installed to begin tracking."
          }
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Agents
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Directory
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
                          {session.name || `Session ${session.id.slice(0, 8)}`}
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
                        : "running"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {session.agent_count ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400 font-mono">
                      {(() => {
                        const c = sessionCosts[session.id];
                        return c != null && c > 0 ? fmtCost(c) : "-";
                      })()}
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
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{" "}
                of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
