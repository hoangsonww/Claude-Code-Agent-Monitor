/**
 * @file KanbanBoard.tsx
 * @description Kanban-style board with two views: agents grouped by their
 * AgentStatus (idle/connected/working/completed/error) or sessions grouped
 * by their SessionStatus (active/completed/error/abandoned). The view toggle
 * is persisted in localStorage so the user's choice survives reloads. Each
 * column paginates client-side at COLUMN_PAGE_SIZE.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Columns3, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionCard } from "../components/SessionCard";
import { EmptyState } from "../components/EmptyState";
import { STATUS_CONFIG, SESSION_STATUS_CONFIG } from "../lib/types";
import type { Agent, AgentStatus, Session, SessionStatus, WSMessage } from "../lib/types";

type BoardView = "agents" | "sessions";

const AGENT_COLUMNS: AgentStatus[] = ["idle", "connected", "working", "completed", "error"];
const SESSION_COLUMNS: SessionStatus[] = ["active", "completed", "error", "abandoned"];
const COLUMN_PAGE_SIZE = 10;
const VIEW_STORAGE_KEY = "kanban-board-view";

function loadView(): BoardView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "agents" || stored === "sessions") return stored;
  } catch {
    /* ignore */
  }
  return "agents";
}

function persistView(view: BoardView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}

export function KanbanBoard() {
  const { t } = useTranslation("kanban");
  const [view, setViewState] = useState<BoardView>(loadView);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, number>>({});

  const setView = useCallback((next: BoardView) => {
    setViewState(next);
    persistView(next);
    setExpanded({}); // reset per-column pagination when switching views
  }, []);

  const loadAgents = useCallback(async () => {
    const results = await Promise.all(AGENT_COLUMNS.map((status) => api.agents.list({ status })));
    setAgents(results.flatMap((r) => r.agents));
  }, []);

  const loadSessions = useCallback(async () => {
    // Each column needs the full set for its status — column-level
    // pagination ("show more") is handled client-side at COLUMN_PAGE_SIZE.
    // Wire-limit raised to the server's safety cap (10000); cost
    // computation on the server scales with returned rows, so each
    // column's request stays bounded by how many sessions actually have
    // that status.
    const results = await Promise.all(
      SESSION_COLUMNS.map((status) => api.sessions.list({ status, limit: 10000 }))
    );
    setSessions(results.flatMap((r) => r.sessions));
  }, []);

  const load = useCallback(async () => {
    try {
      if (view === "agents") await loadAgents();
      else await loadSessions();
    } finally {
      setLoading(false);
    }
  }, [view, loadAgents, loadSessions]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (view === "agents") {
        if (msg.type === "agent_created" || msg.type === "agent_updated") loadAgents();
      } else {
        if (msg.type === "session_created" || msg.type === "session_updated") loadSessions();
      }
    });
  }, [view, loadAgents, loadSessions]);

  const groupedAgents = AGENT_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = agents.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<AgentStatus, Agent[]>
  );

  const groupedSessions = SESSION_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = sessions.filter((s) => s.status === status);
      return acc;
    },
    {} as Record<SessionStatus, Session[]>
  );

  const total = view === "agents" ? agents.length : sessions.length;
  const subtitle =
    view === "agents"
      ? t("agentCount", { count: agents.length })
      : t("sessionCount", { count: sessions.length });

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Columns3 className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-100 truncate">{t("title")}</h1>
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ViewToggle view={view} onChange={setView} />
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
      </div>
    </div>
  );

  if (!loading && total === 0) {
    return (
      <div className="animate-fade-in">
        {Header}
        <EmptyState
          icon={Columns3}
          title={view === "agents" ? t("noAgents") : t("noSessions")}
          description={view === "agents" ? t("noAgentsDesc") : t("noSessionsDesc")}
          action={
            <button onClick={load} className="btn-primary">
              <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {Header}

      <div className="flex gap-4 min-h-[600px] overflow-x-auto pb-4 -mx-8 px-8">
        {view === "agents"
          ? AGENT_COLUMNS.map((status) => {
              const config = STATUS_CONFIG[status];
              const items = groupedAgents[status];
              const limit = expanded[status] || COLUMN_PAGE_SIZE;
              return (
                <Column
                  key={status}
                  labelKey={config.labelKey}
                  color={config.color}
                  dotClass={config.dot}
                  pulse={status === "working"}
                  count={items?.length ?? 0}
                  emptyLabel={t("noAgentsInColumn")}
                  remaining={Math.max(0, (items?.length ?? 0) - limit)}
                  onShowMore={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [status]: limit + COLUMN_PAGE_SIZE,
                    }))
                  }
                >
                  {items?.slice(0, limit).map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </Column>
              );
            })
          : SESSION_COLUMNS.map((status) => {
              const config = SESSION_STATUS_CONFIG[status];
              const items = groupedSessions[status];
              const limit = expanded[status] || COLUMN_PAGE_SIZE;
              return (
                <Column
                  key={status}
                  labelKey={config.labelKey}
                  color={config.color}
                  dotClass={config.dot}
                  pulse={status === "active"}
                  count={items?.length ?? 0}
                  emptyLabel={t("noSessionsInColumn")}
                  remaining={Math.max(0, (items?.length ?? 0) - limit)}
                  onShowMore={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [status]: limit + COLUMN_PAGE_SIZE,
                    }))
                  }
                >
                  {items?.slice(0, limit).map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </Column>
              );
            })}
      </div>
    </div>
  );
}

interface ViewToggleProps {
  view: BoardView;
  onChange: (next: BoardView) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { t } = useTranslation("kanban");
  const baseClass =
    "px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg";
  const activeClass = "bg-accent/15 text-accent";
  const inactiveClass = "text-gray-400 hover:text-gray-200 hover:bg-surface-3";

  return (
    <div
      role="tablist"
      aria-label={t("viewToggle.agents") + " / " + t("viewToggle.sessions")}
      className="inline-flex border border-border rounded-lg overflow-hidden bg-surface-2"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "agents"}
        onClick={() => onChange("agents")}
        className={`${baseClass} ${view === "agents" ? activeClass : inactiveClass}`}
      >
        {t("viewToggle.agents")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "sessions"}
        onClick={() => onChange("sessions")}
        className={`${baseClass} border-l border-border ${
          view === "sessions" ? activeClass : inactiveClass
        }`}
      >
        {t("viewToggle.sessions")}
      </button>
    </div>
  );
}

interface ColumnProps {
  labelKey: string;
  color: string;
  dotClass: string;
  pulse: boolean;
  count: number;
  emptyLabel: string;
  remaining: number;
  onShowMore: () => void;
  children: React.ReactNode;
}

function Column({
  labelKey,
  color,
  dotClass,
  pulse,
  count,
  emptyLabel,
  remaining,
  onShowMore,
  children,
}: ColumnProps) {
  const { t } = useTranslation("kanban");
  const childrenArray = Array.isArray(children) ? children : children ? [children] : [];
  const hasChildren = childrenArray.length > 0;

  return (
    <div className="bg-surface-1 rounded-xl border border-border p-3 flex flex-col flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className={`w-2 h-2 rounded-full ${dotClass} ${pulse ? "animate-pulse-dot" : ""}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
          {t(labelKey)}
        </span>
        <span className="ml-auto text-[11px] text-gray-600 bg-surface-3 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {hasChildren ? (
          <>
            {children}
            {remaining > 0 && (
              <button
                onClick={onShowMore}
                className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                {t("common:showMore", { count: remaining })}
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-24 text-xs text-gray-600">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
