/**
 * @file KanbanBoard.tsx
 * @description Kanban-style board with three views: agents grouped by their
 * AgentStatus (working/waiting/completed/error), sessions grouped by their
 * SessionStatus (active/completed/error/abandoned), or sessions grouped by
 * Project (one column per project's mapped folders, plus an Unassigned
 * column for sessions whose cwd isn't mapped to any project). The view
 * toggle is persisted in localStorage so the user's choice survives reloads.
 * Each column paginates client-side at COLUMN_PAGE_SIZE.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/pages/KanbanBoard.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `../lib/api`
 * - `../lib/eventBus`
 * - `../components/AgentCard`
 * - `../components/SessionCard`
 * - `../components/EmptyState`
 * - `../components/Skeleton`
 * - `../lib/types`
 *
 * ## Public surface
 * - `KanbanBoard` — exported API; see TSDoc on the symbol for behavior.
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
 * **KanbanBoard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  Columns3,
  ChevronDown,
  HelpCircle,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionCard } from "../components/SessionCard";
import { EmptyState } from "../components/EmptyState";
import { CardSkeleton } from "../components/Skeleton";
import { loadProjectOrder, persistProjectOrder, applyProjectOrder } from "../lib/projectOrder";
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
  Project,
  Session,
  UnassignedProjectBucket,
  WSMessage,
} from "../lib/types";

type BoardView = "agents" | "sessions" | "projects";

// Column dot/label colors for the Projects view, cycled by column index.
// Deliberately avoids emerald/yellow/violet/red/slate — those already carry
// status meaning in STATUS_CONFIG/SESSION_STATUS_CONFIG, and a project column
// isn't a status.
const PROJECT_COLOR_CYCLE = [
  { color: "text-sky-400", dot: "bg-sky-400" },
  { color: "text-indigo-400", dot: "bg-indigo-400" },
  { color: "text-teal-400", dot: "bg-teal-400" },
  { color: "text-fuchsia-400", dot: "bg-fuchsia-400" },
  { color: "text-cyan-400", dot: "bg-cyan-400" },
  { color: "text-orange-400", dot: "bg-orange-400" },
] as const;
const UNASSIGNED_COLOR = { color: "text-gray-400", dot: "bg-gray-400" } as const;

const EMPTY_UNASSIGNED_BUCKET: UnassignedProjectBucket = {
  cwds: [],
  session_count: 0,
  active_count: 0,
  last_activity: null,
};

// Persisted statuses we fetch from the API.
const AGENT_FETCH_STATUSES: AgentStatus[] = ["working", "waiting", "completed", "error"];

// Columns rendered on the Agents board.
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
const HIDE_COMPLETED_STORAGE_KEY = "kanban-hide-completed";

function loadView(): BoardView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "agents" || stored === "sessions" || stored === "projects") return stored;
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

function loadHideCompleted(): boolean {
  try {
    return localStorage.getItem(HIDE_COMPLETED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistHideCompleted(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_COMPLETED_STORAGE_KEY, String(hide));
  } catch {
    /* ignore */
  }
}

export function KanbanBoard() {
  const { t } = useTranslation("kanban");
  const [view, setViewState] = useState<BoardView>(loadView);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [unassignedBucket, setUnassignedBucket] =
    useState<UnassignedProjectBucket>(EMPTY_UNASSIGNED_BUCKET);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, number>>({});
  const [hideCompleted, setHideCompletedState] = useState<boolean>(loadHideCompleted);

  // Manual drag order for the Projects view's columns - shared with the
  // standalone Projects page (same localStorage key via lib/projectOrder),
  // so arranging projects once applies consistently in both places.
  // Unassigned is never part of this - it always renders last.
  const [projectOrderIds, setProjectOrderIds] = useState<string[]>(loadProjectOrder);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [liveProjectOrderIds, setLiveProjectOrderIds] = useState<string[] | null>(null);

  const setView = useCallback((next: BoardView) => {
    setViewState(next);
    persistView(next);
    setExpanded({}); // reset per-column pagination when switching views
  }, []);

  const toggleHideCompleted = useCallback(() => {
    setHideCompletedState((prev) => {
      const next = !prev;
      persistHideCompleted(next);
      return next;
    });
  }, []);

  const loadAgents = useCallback(async () => {
    // Fetch every persisted agent status. Bucketing happens below in
    // `groupedAgents`.
    //
    // Also fetch sessions so AgentCard can surface model / cwd / cost on
    // main-agent cards (they have no task and a generic name on their
    // own - the session metadata is what makes the card useful).
    const [agentResults, sessionsRes] = await Promise.all([
      Promise.all(AGENT_FETCH_STATUSES.map((status) => api.agents.list({ status }))),
      api.sessions.list({ limit: 10000 }),
    ]);
    setAgents(agentResults.flatMap((r) => r.agents));
    setSessions(sessionsRes.sessions);
  }, []);

  const loadSessions = useCallback(async () => {
    // Each column needs the full set for its status - column-level
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

  // Project list + aggregated counts for the Projects view. Session cards
  // themselves come from `loadSessions` (fetched alongside, below) and are
  // grouped client-side by cwd against each project's mapped folders.
  const loadProjectsData = useCallback(async () => {
    const res = await api.projects.list();
    setProjectsList(res.projects);
    setUnassignedBucket(res.unassigned);
  }, []);

  const load = useCallback(async () => {
    try {
      if (view === "agents") await loadAgents();
      else if (view === "projects") await Promise.all([loadSessions(), loadProjectsData()]);
      else await loadSessions();
    } finally {
      setLoading(false);
    }
  }, [view, loadAgents, loadSessions, loadProjectsData]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    return eventBus.subscribe((msg: WSMessage) => {
      if (view === "agents") {
        if (
          msg.type === "agent_created" ||
          msg.type === "agent_updated" ||
          msg.type === "session_updated" ||
          msg.type === "session_created" ||
          msg.type === "session_deleted"
        ) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(loadAgents, 300);
        }
      } else if (view === "projects") {
        if (
          msg.type === "session_created" ||
          msg.type === "session_updated" ||
          msg.type === "session_deleted"
        ) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            loadSessions();
            loadProjectsData();
          }, 300);
        }
      } else {
        if (
          msg.type === "session_created" ||
          msg.type === "session_updated" ||
          msg.type === "session_deleted"
        ) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(loadSessions, 300);
        }
      }
    });
  }, [view, loadAgents, loadSessions, loadProjectsData]);

  // Lookup map for AgentCard's session prop - memoized to avoid rebuilding on every render
  const sessionsById = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  // Sessions grouped by cwd, for the Projects view - each project's column
  // is every session whose cwd is one of that project's mapped folders.
  const sessionsByCwd = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!s.cwd) continue;
      if (!map.has(s.cwd)) map.set(s.cwd, []);
      map.get(s.cwd)?.push(s);
    }
    return map;
  }, [sessions]);

  // Bucket by effective status: agents with status "waiting" OR those with
  // awaiting_input_since set go into the "waiting" column. Other columns
  // exclude agents that belong in "waiting".
  const isEffectivelyWaiting = (a: Agent) => a.status === "waiting" || isAgentAwaitingInput(a);

  const groupedAgents = AGENT_COLUMNS.reduce(
    (acc, status) => {
      acc[status] =
        status === "waiting"
          ? agents.filter(isEffectivelyWaiting)
          : agents.filter((a) => a.status === status && !isEffectivelyWaiting(a));
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

  // "Hide completed" drops the Completed column outright on the Agents/
  // Sessions boards (there's nothing left to show in it).
  const visibleAgentColumns = hideCompleted
    ? AGENT_COLUMNS.filter((s) => s !== "completed")
    : AGENT_COLUMNS;
  const visibleSessionColumns = hideCompleted
    ? SESSION_COLUMNS.filter((s) => s !== "completed")
    : SESSION_COLUMNS;

  // Projects view column order: drag-reorderable, persisted (shared with the
  // standalone Projects page). `liveProjectOrderIds` holds the in-progress
  // shuffle while a drag is active.
  const orderedProjectsList = useMemo(
    () => applyProjectOrder(projectsList, liveProjectOrderIds ?? projectOrderIds),
    [projectsList, projectOrderIds, liveProjectOrderIds]
  );

  function handleColumnDragStart(id: string) {
    setDraggedColumnId(id);
    setLiveProjectOrderIds(orderedProjectsList.map((p) => p.id));
  }

  function handleColumnDragOver(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault(); // required for onDrop to ever fire
    if (!draggedColumnId || draggedColumnId === targetId) return;
    setLiveProjectOrderIds((prev) => {
      const current = prev ?? orderedProjectsList.map((p) => p.id);
      const from = current.indexOf(draggedColumnId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedColumnId);
      return next;
    });
  }

  function handleColumnDragEnd() {
    if (liveProjectOrderIds) {
      setProjectOrderIds(liveProjectOrderIds);
      persistProjectOrder(liveProjectOrderIds);
    }
    setDraggedColumnId(null);
    setLiveProjectOrderIds(null);
  }

  // Projects view: compute each column's (filtered) items up front so a
  // project/Unassigned column that has nothing left to show once completed
  // sessions are hidden can be dropped entirely, instead of rendering an
  // empty box.
  const projectColumns = [
    ...orderedProjectsList.map((project, i) => ({
      key: project.id,
      label: project.name,
      cwds: project.paths.map((p) => p.cwd),
      activeCount: project.active_count,
      palette: PROJECT_COLOR_CYCLE[i % PROJECT_COLOR_CYCLE.length] ?? UNASSIGNED_COLOR,
    })),
    {
      key: "__unassigned__",
      label: t("unassignedColumn"),
      cwds: unassignedBucket.cwds,
      activeCount: unassignedBucket.active_count,
      palette: UNASSIGNED_COLOR,
    },
  ]
    .map((col) => {
      const allItems = col.cwds.flatMap((cwd) => sessionsByCwd.get(cwd) || []);
      const items = hideCompleted ? allItems.filter((s) => s.status !== "completed") : allItems;
      return { ...col, items };
    })
    .filter((col) => !hideCompleted || col.items.length > 0);

  const total = view === "agents" ? agents.length : sessions.length;
  const subtitle =
    view === "agents"
      ? t("agentCount", { count: agents.length })
      : t("sessionCount", { count: sessions.length });

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Columns3 className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-100 truncate">{t("title")}</h1>
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                {t("common:live")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {t("common:offline")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ViewToggle view={view} onChange={setView} />
        <button
          type="button"
          onClick={toggleHideCompleted}
          aria-pressed={hideCompleted}
          title={hideCompleted ? t("showCompleted") : t("hideCompleted")}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors duration-150 flex-shrink-0 ${
            hideCompleted
              ? "bg-accent/15 text-accent border-accent/30"
              : "border-border text-gray-400 hover:text-gray-200 hover:bg-surface-4"
          }`}
        >
          {hideCompleted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {hideCompleted ? t("showCompleted") : t("hideCompleted")}
        </button>
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
      </div>
    </div>
  );

  if (!loading && total === 0) {
    return (
      <div className="animate-fade-in flex flex-col min-h-[60vh]">
        {Header}
        <div className="flex-1 flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {Header}

      <div className="flex gap-4 min-h-[600px] overflow-x-auto pb-4 -mx-8 px-8">
        {view === "agents"
          ? visibleAgentColumns.map((status) => {
              const config = STATUS_CONFIG[status];
              const items = groupedAgents[status];
              const limit = expanded[status] || COLUMN_PAGE_SIZE;
              return (
                <Column
                  key={status}
                  label={t(config.labelKey)}
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
                  {loading && (items?.length ?? 0) === 0
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <CardSkeleton key={`sk-${status}-${i}`} />
                      ))
                    : items
                        ?.slice(0, limit)
                        .map((agent) => (
                          <AgentCard
                            key={agent.id}
                            agent={agent}
                            session={sessionsById.get(agent.session_id)}
                          />
                        ))}
                </Column>
              );
            })
          : view === "sessions"
            ? visibleSessionColumns.map((status) => {
                const config = SESSION_STATUS_CONFIG[status];
                const items = groupedSessions[status];
                const limit = expanded[status] || COLUMN_PAGE_SIZE;
                return (
                  <Column
                    key={status}
                    label={t(config.labelKey)}
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
                    {loading && (items?.length ?? 0) === 0
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <CardSkeleton key={`sk-${status}-${i}`} />
                        ))
                      : items
                          ?.slice(0, limit)
                          .map((session) => <SessionCard key={session.id} session={session} />)}
                  </Column>
                );
              })
            : projectColumns.map(({ key, label, cwds, activeCount, palette, items }) => {
                const limit = expanded[`proj-${key}`] || COLUMN_PAGE_SIZE;
                const isUnassigned = key === "__unassigned__";
                return (
                  <Column
                    key={key}
                    label={label}
                    color={palette.color}
                    dotClass={palette.dot}
                    pulse={activeCount > 0}
                    count={items.length}
                    emptyLabel={t("noSessionsInColumn")}
                    tooltip={isUnassigned ? t("unassignedColumnTooltip") : cwds.join("\n")}
                    remaining={Math.max(0, items.length - limit)}
                    onShowMore={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [`proj-${key}`]: limit + COLUMN_PAGE_SIZE,
                      }))
                    }
                    draggableColumn={!isUnassigned}
                    dragging={draggedColumnId === key}
                    onColumnDragStart={isUnassigned ? undefined : () => handleColumnDragStart(key)}
                    onColumnDragOver={
                      isUnassigned ? undefined : (e) => handleColumnDragOver(e, key)
                    }
                    onColumnDragEnd={isUnassigned ? undefined : handleColumnDragEnd}
                  >
                    {loading && items.length === 0
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <CardSkeleton key={`sk-${key}-${i}`} />
                        ))
                      : items
                          .slice(0, limit)
                          .map((session) => <SessionCard key={session.id} session={session} />)}
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
      aria-label={
        t("viewToggle.agents") + " / " + t("viewToggle.sessions") + " / " + t("viewToggle.projects")
      }
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
      <button
        type="button"
        role="tab"
        aria-selected={view === "projects"}
        onClick={() => onChange("projects")}
        className={`${baseClass} border-l border-border ${
          view === "projects" ? activeClass : inactiveClass
        }`}
      >
        {t("viewToggle.projects")}
      </button>
    </div>
  );
}

interface ColumnProps {
  /** Pre-resolved display label (already run through `t()`, or a raw project
   *  name — never a translation key itself, since project names are
   *  user-supplied text, not i18n keys). */
  label: string;
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
  /** Only true for the Projects view's actual project columns - Unassigned
   *  (and every Agents/Sessions status column) is never draggable. */
  draggableColumn?: boolean;
  /** True while this column is the one being dragged (dims it as feedback). */
  dragging?: boolean;
  onColumnDragStart?: () => void;
  /** Fired while another dragged column is over this one - the parent
   *  live-reorders on this, so drop itself only needs to preventDefault. */
  onColumnDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onColumnDragEnd?: () => void;
}

function Column({
  label,
  color,
  dotClass,
  pulse,
  count,
  emptyLabel,
  tooltip,
  remaining,
  onShowMore,
  children,
  draggableColumn,
  dragging,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragEnd,
}: ColumnProps) {
  const { t } = useTranslation("kanban");
  const childrenArray = Array.isArray(children) ? children : children ? [children] : [];
  const hasChildren = childrenArray.length > 0;

  return (
    <div
      draggable={draggableColumn}
      onDragStart={onColumnDragStart}
      onDragOver={onColumnDragOver}
      onDrop={draggableColumn ? (e) => e.preventDefault() : undefined}
      onDragEnd={onColumnDragEnd}
      className={`bg-surface-1 rounded-xl border border-border p-3 flex flex-col flex-shrink-0 w-72 transition-opacity ${
        draggableColumn ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 mb-4 px-1 min-w-0">
        {draggableColumn && (
          <GripVertical className="w-3 h-3 text-gray-600 flex-shrink-0" aria-hidden="true" />
        )}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass} ${pulse ? "animate-pulse-dot" : ""}`}
        />
        <span
          className={`text-xs font-semibold uppercase tracking-wider truncate ${color}`}
          title={label}
        >
          {label}
        </span>
        {tooltip && <ColumnHelp text={tooltip} />}
        <span className="ml-auto text-[11px] text-gray-600 bg-surface-3 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* draggable={false}: opts the scrollable session-card list (and the
          "Show more" button) out of the column's own drag region, so
          clicking through to a card navigates instead of starting a
          reorder-drag. */}
      <div className="flex-1 space-y-2.5 overflow-y-auto" draggable={false}>
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
