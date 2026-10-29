/**
 * @file KanbanBoard.tsx
 * @description Kanban-style board with two views: agents grouped by their
 * AgentStatus (working/waiting/completed/error) or sessions grouped
 * by their SessionStatus (active/completed/error/abandoned). The view toggle
 * is persisted in localStorage so the user's choice survives reloads. Each
 * column paginates client-side at COLUMN_PAGE_SIZE.
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

import { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Columns3, ChevronDown, HelpCircle } from "lucide-react";
import { api } from "../lib/api";
import { useUrlTab } from "../hooks/usePageShortcuts";
import { usePaletteAction } from "../components/PaletteActionProvider";
import { useDataScope } from "../lib/dataScope";
import { eventBus } from "../lib/eventBus";
import { isRemoteDataRefreshMessage } from "../lib/remoteDataEvents";
import { mergeFreshestById } from "../lib/merge-by-id";
import { AgentCard } from "../components/AgentCard";
import { SessionCard } from "../components/SessionCard";
import { EmptyState } from "../components/EmptyState";
import { CardSkeleton } from "../components/Skeleton";
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
  SessionGroup,
  WSMessage,
} from "../lib/types";

/** Board views in render order — also the order `1`/`2` and `[`/`]` address them. */
const BOARD_VIEWS = ["agents", "sessions"] as const;
/** Which board is shown: agents or sessions. */
type BoardView = (typeof BOARD_VIEWS)[number];

/**
 * Agent statuses fetched from the API, one request each. Waiting agents are fetched with transient
 * rows included.
 */
const AGENT_FETCH_STATUSES: AgentStatus[] = ["working", "waiting", "completed", "error"];

/** Columns of the Agents board, in display order. */
const AGENT_COLUMNS: EffectiveAgentStatus[] = ["working", "waiting", "completed", "error"];
/**
 * Columns of the Sessions board, in display order. The waiting column is derived on the client from
 * active sessions that are waiting for input.
 */
const SESSION_COLUMNS: EffectiveSessionStatus[] = [
  "active",
  "waiting",
  "completed",
  "error",
  "abandoned",
];
/** Cards shown per column before a "show more" button; each click reveals this many more. */
const COLUMN_PAGE_SIZE = 10;
/** localStorage key mirroring the last chosen board, used when the URL does not name one. */
const VIEW_STORAGE_KEY = "kanban-board-view";

/**
 * Read every page of a filtered group so sessions beyond the API's page cap
 * can still contribute cards and agent membership. Unfiltered boards retain
 * their existing first-page limit.
 */
async function loadBoardSessionRows(params: {
  status?: string;
  group?: string;
  include_transient?: boolean;
}): Promise<Session[]> {
  const first = await api.sessions.list({ ...params, limit: 10000, offset: 0 });
  if (!params.group || first.total <= 10000) return first.sessions;
  const rows = [...first.sessions];
  for (let offset = 10000; offset < first.total; offset += 10000) {
    const page = await api.sessions.list({
      ...params,
      include_transient: false,
      limit: 10000,
      offset,
    });
    rows.push(...page.sessions);
  }
  return rows;
}

/**
 * Agent Board page (`/kanban`): a Kanban view of agents or sessions by status, chosen with a toggle
 * that is mirrored into the `view` URL parameter. Agents are fetched per status in parallel and
 * merged to one card per agent, keeping the freshest row, so an agent that changes status
 * mid-request lands in a single lane. Sessions are fetched too, so main-agent cards can show model,
 * working directory, and cost. Columns paginate on the client, the data follows the global data
 * scope, and the board refreshes on live WebSocket updates.
 */
export function KanbanBoard() {
  const { t } = useTranslation("kanban");
  const [dataScope] = useDataScope();
  // URL-backed so the palette and shared links can open either board directly;
  // `kanban-board-view` still mirrors the last choice for an unqualified visit.
  const [view, setViewState] = useUrlTab(BOARD_VIEWS, "agents", {
    param: "view",
    storageKey: VIEW_STORAGE_KEY,
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, number>>({});
  const loadGenerationRef = useRef(0);

  const loadGroups = useCallback(async () => {
    const result = await api.sessionGroups.list();
    setGroups(result.groups);
  }, []);
  useEffect(() => {
    void loadGroups().catch(() => undefined);
  }, [loadGroups]);

  /** Switch boards and reset each column's "show more" pagination. */
  const setView = useCallback(
    (next: BoardView) => {
      setViewState(next);
      setExpanded({}); // reset per-column pagination when switching views
    },
    [setViewState]
  );

  /**
   * Load agents for every board status in parallel (waiting agents include transient rows), merging
   * duplicates to the freshest row, plus the sessions that main-agent cards need for model, working
   * directory, and cost.
   */
  const loadAgents = useCallback(
    async (generation: number) => {
      // Fetch every persisted agent status. Bucketing happens below in
      // `groupedAgents`.
      //
      // Also fetch sessions so AgentCard can surface model / cwd / cost on
      // main-agent cards (they have no task and a generic name on their
      // own - the session metadata is what makes the card useful).
      const [agentResults, sessionsRes] = await Promise.all([
        Promise.all(
          AGENT_FETCH_STATUSES.map((status) =>
            api.agents.list({ status, include_transient: status === "waiting" })
          )
        ),
        loadBoardSessionRows({
          include_transient: !groupFilter || groupFilter === "ungrouped",
          group: groupFilter || undefined,
        }),
      ]);
      // One request per status runs in parallel, so an agent whose status changes
      // mid-flight returns in two of them. Merge to one card per agent id, keeping
      // the freshest row so it lands in a single lane.
      if (generation !== loadGenerationRef.current) return;
      setAgents(mergeFreshestById(...agentResults.map((r) => r.agents)));
      setSessions(sessionsRes);
    },
    [dataScope, groupFilter]
  );

  /**
   * Load sessions for every board status in parallel. Group-filtered requests
   * continue past the server's 10,000-row page cap; columns paginate on the client.
   */
  const loadSessions = useCallback(
    async (generation: number) => {
      // Each column needs the full set for its status - column-level
      // pagination ("show more") is handled client-side at COLUMN_PAGE_SIZE.
      // Each request uses the server's 10,000-row page cap. A filtered group
      // loads later pages so the board does not silently drop its sessions.
      // The "waiting" column is derived client-side from the active set.
      const persistedStatuses = SESSION_COLUMNS.filter((s) => s !== "waiting");
      const results = await Promise.all(
        persistedStatuses.map((status) =>
          loadBoardSessionRows({
            status,
            include_transient: status === "active" && (!groupFilter || groupFilter === "ungrouped"),
            group: groupFilter || undefined,
          })
        )
      );
      // Same parallel-status race as the agent lanes above.
      if (generation !== loadGenerationRef.current) return;
      setSessions(mergeFreshestById(...results));
    },
    [dataScope, groupFilter]
  );

  /**
   * Load the data for the board currently shown. Errors are logged and leave the previous cards on
   * screen.
   */
  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    try {
      if (view === "agents") await loadAgents(generation);
      else await loadSessions(generation);
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [view, loadAgents, loadSessions]);

  usePaletteAction("page.refresh", () => {
    void load();
  });

  useEffect(() => {
    setLoading(true);
    setAgents([]);
    setSessions([]);
    void load();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "session_groups_changed") {
        void loadGroups().catch(() => undefined);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(load, 300);
        return;
      }
      if (isRemoteDataRefreshMessage(msg)) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(load, 300);
        return;
      }
      if (view === "agents") {
        if (
          msg.type === "agent_created" ||
          msg.type === "agent_updated" ||
          msg.type === "session_updated" ||
          msg.type === "session_created"
        ) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(load, 300);
        }
      } else {
        if (msg.type === "session_created" || msg.type === "session_updated") {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(load, 300);
        }
      }
    });
    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [view, loadGroups, load]);

  // Lookup map for AgentCard's session prop - memoized to avoid rebuilding on every render
  const sessionsById = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) map.set(s.id, s);
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
          ? agents.filter(
              (a) => isEffectivelyWaiting(a) && (!groupFilter || sessionsById.has(a.session_id))
            )
          : agents.filter(
              (a) =>
                a.status === status &&
                !isEffectivelyWaiting(a) &&
                (!groupFilter || sessionsById.has(a.session_id))
            );
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

  const total =
    view === "agents"
      ? groupFilter
        ? agents.filter((agent) => sessionsById.has(agent.session_id)).length
        : agents.length
      : sessions.length;
  const subtitle =
    view === "agents"
      ? t("agentCount", { count: total })
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
        <label className="flex items-center gap-2 text-xs text-gray-400">
          {t("groupFilter")}
          <select
            className="input min-w-[125px]"
            value={groupFilter}
            onChange={(event) => {
              setGroupFilter(event.target.value);
              setExpanded({});
            }}
          >
            <option value="">{t("allGroups")}</option>
            <option value="ungrouped">{t("ungrouped")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <ViewToggle view={view} onChange={setView} />
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
                  {loading && (items?.length ?? 0) === 0
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <CardSkeleton key={`sk-${status}-${i}`} />
                      ))
                    : items?.slice(0, limit).map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          session={sessionsById.get(agent.session_id)}
                          // The column already names the status.
                          statusDisplay="dot"
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
                  {loading && (items?.length ?? 0) === 0
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <CardSkeleton key={`sk-${status}-${i}`} />
                      ))
                    : items
                        ?.slice(0, limit)
                        .map((session) => (
                          <SessionCard key={session.id} session={session} statusDisplay="dot" />
                        ))}
                </Column>
              );
            })}
      </div>
    </div>
  );
}

/** Props for {@link ViewToggle}. */
interface ViewToggleProps {
  /** Board currently shown. */
  view: BoardView;
  /** Called with the board the user picks. */
  onChange: (next: BoardView) => void;
}

/** Segmented control switching between the Agents and Sessions boards. */
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

/** Props for {@link Column}. */
interface ColumnProps {
  /** Translation key of the column title. */
  labelKey: string;
  /** Accent color class for the column header. */
  color: string;
  /** Class for the status dot in the header. */
  dotClass: string;
  /** Whether the status dot pulses (live statuses such as working). */
  pulse: boolean;
  /** Total cards in the column, shown in the header. */
  count: number;
  /** Text shown when the column has no cards. */
  emptyLabel: string;
  /** Multi-line description rendered in a tooltip when the user hovers
   *  the column's help icon. Pass an empty string to suppress the icon. */
  tooltip?: string;
  /** Cards not yet revealed; the "show more" button is hidden at 0. */
  remaining: number;
  /** Reveals the next page of cards. */
  onShowMore: () => void;
  /** The visible cards. */
  children: React.ReactNode;
}

/**
 * One Kanban column: header with status dot, title, count, and an optional help tooltip, then the
 * cards, an empty message, and a "show more" button when more cards remain.
 */
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
