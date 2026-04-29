/**
 * @file KanbanBoard.tsx
 * @description Kanban-style board with two views: agents grouped by their
 * AgentStatus (idle/connected/working/completed/error) or sessions grouped
 * by their SessionStatus (active/completed/error/abandoned). The view toggle
 * is persisted in localStorage so the user's choice survives reloads. Each
 * column paginates client-side at COLUMN_PAGE_SIZE.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Columns3, ChevronDown, HelpCircle } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionCard } from "../components/SessionCard";
import { EmptyState } from "../components/EmptyState";
import {
  STATUS_CONFIG,
  SESSION_STATUS_CONFIG,
  isAgentAwaitingInput,
  isSessionAwaitingInput,
} from "../lib/types";
import type {
  Agent,
  AgentStatus,
  EffectiveAgentStatus,
  EffectiveSessionStatus,
  Session,
  WSMessage,
} from "../lib/types";

type BoardView = "agents" | "sessions";

// Persisted statuses we fetch from the API. We MUST fetch `idle` even
// though it doesn't have its own column: a main agent post-Stop has
// status="idle" with awaiting_input_since set, and that agent belongs in
// the Waiting column. Filtering `idle` out of the fetch list (as a prior
// version did, after we dropped the Idle column) caused those agents to
// never load on the board even though the session detail page rendered
// them correctly.
const AGENT_FETCH_STATUSES: AgentStatus[] = ["idle", "connected", "working", "completed", "error"];

// Columns rendered on the Agents board. Idle and Connected are
// intentionally absent — with the current state machine, neither is
// reachable on a live active session: SessionStart immediately stamps
// the waiting flag (so a fresh agent goes straight to Waiting), and
// Stop pairs idle with the waiting flag (also Waiting). Both statuses
// remain valid persisted enum values and are still queryable via
// /api/agents?status={idle,connected} for legacy / imported data.
const AGENT_COLUMNS: EffectiveAgentStatus[] = ["working", "waiting", "completed", "error"];
const SESSION_COLUMNS: EffectiveSessionStatus[] = [
  "active",
  "waiting",
  "completed",
  "error",
  "abandoned",
];
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
    // Fetch every persisted status — including idle, which has no column
    // of its own but produces Waiting cards via the awaiting_input_since
    // overlay. Bucketing happens below in `groupedAgents`.
    //
    // Also fetch sessions so AgentCard can surface model / cwd / cost on
    // main-agent cards (they have no task and a generic name on their
    // own — the session metadata is what makes the card useful).
    const [agentResults, sessionsRes] = await Promise.all([
      Promise.all(AGENT_FETCH_STATUSES.map((status) => api.agents.list({ status }))),
      api.sessions.list({ limit: 10000 }),
    ]);
    setAgents(agentResults.flatMap((r) => r.agents));
    setSessions(sessionsRes.sessions);
  }, []);

  const loadSessions = useCallback(async () => {
    // Each column needs the full set for its status — column-level
    // pagination ("show more") is handled client-side at COLUMN_PAGE_SIZE.
    // Wire-limit raised to the server's safety cap (10000); cost
    // computation on the server scales with returned rows, so each
    // column's request stays bounded by how many sessions actually have
    // that status. The "waiting" column is derived client-side from the
    // active set (see grouping below).
    const persistedStatuses = SESSION_COLUMNS.filter((s) => s !== "waiting");
    const results = await Promise.all(
      persistedStatuses.map((status) => api.sessions.list({ status, limit: 10000 }))
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
        // Agent changes always reload; session changes also reload because
        // AgentCard surfaces session metadata (cost, cwd, model) and we
        // want those to track in real time.
        if (
          msg.type === "agent_created" ||
          msg.type === "agent_updated" ||
          msg.type === "session_updated" ||
          msg.type === "session_created"
        ) {
          loadAgents();
        }
      } else {
        if (msg.type === "session_created" || msg.type === "session_updated") loadSessions();
      }
    });
  }, [view, loadAgents, loadSessions]);

  // Lookup map for AgentCard's session prop — built once per render of the
  // agents view rather than walking the array per card.
  const sessionsById = new Map<string, Session>();
  for (const s of sessions) sessionsById.set(s.id, s);

  // Bucket by effective status: agents/sessions blocked on user input fall
  // into the "waiting" column instead of their underlying lifecycle column.
  // This keeps the persisted enum stable while letting the UI surface the
  // attention-required state in a dedicated column.
  const groupedAgents = AGENT_COLUMNS.reduce(
    (acc, status) => {
      acc[status] =
        status === "waiting"
          ? agents.filter(isAgentAwaitingInput)
          : agents.filter((a) => a.status === status && !isAgentAwaitingInput(a));
      return acc;
    },
    {} as Record<EffectiveAgentStatus, Agent[]>
  );

  const groupedSessions = SESSION_COLUMNS.reduce(
    (acc, status) => {
      acc[status] =
        status === "waiting"
          ? sessions.filter(isSessionAwaitingInput)
          : sessions.filter((s) => s.status === status && !isSessionAwaitingInput(s));
      return acc;
    },
    {} as Record<EffectiveSessionStatus, Session[]>
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
                  pulse={status === "working" || status === "waiting"}
                  count={items?.length ?? 0}
                  emptyLabel={t("noAgentsInColumn")}
                  tooltip={t(`tooltip.agent.${status}`)}
                  remaining={Math.max(0, (items?.length ?? 0) - limit)}
                  onShowMore={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [status]: limit + COLUMN_PAGE_SIZE,
                    }))
                  }
                >
                  {items?.slice(0, limit).map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      session={sessionsById.get(agent.session_id)}
                    />
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
                  pulse={status === "active" || status === "waiting"}
                  count={items?.length ?? 0}
                  emptyLabel={t("noSessionsInColumn")}
                  tooltip={t(`tooltip.session.${status}`)}
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
  /** Multi-line description rendered in a tooltip when the user hovers
   *  the column's help icon. Pass an empty string to suppress the icon. */
  tooltip?: string;
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
  tooltip,
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
        {tooltip && <ColumnHelp text={tooltip} />}
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

/**
 * Help icon + tooltip for a Kanban column header. Hover or focus shows a
 * multi-line description explaining what the column lists and what the
 * status means in lifecycle terms. Keyboard-focusable for accessibility.
 */
function ColumnHelp({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  // Anchor positioning to the column header so the tooltip stays in-page on
  // the leftmost columns (where a centered tooltip would clip on narrow
  // viewports). We always anchor left-aligned to the trigger.
  const triggerRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center cursor-help"
      tabIndex={0}
      role="img"
      aria-label={text}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300 transition-colors" />
      {show && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 w-64 px-3 py-2 text-[11px] leading-relaxed text-gray-200 bg-surface-3 border border-border rounded-md shadow-xl z-50 pointer-events-none whitespace-pre-line"
        >
          {text}
        </span>
      )}
    </span>
  );
}
