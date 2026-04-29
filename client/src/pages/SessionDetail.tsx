/**
 * @file SessionDetail.tsx
 * @description Displays detailed information about a specific session, including its agents, events, and cost breakdown, with real-time updates and an expandable agent hierarchy view.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bot,
  Clock,
  FolderOpen,
  Cpu,
  RefreshCw,
  DollarSign,
  ChevronDown,
  ChevronRight,
  GitBranch,
  MessageSquare,
  List,
  AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionOverview } from "../components/SessionOverview";
import { ConversationView } from "../components/conversation/ConversationView";
import { SessionStatusBadge, AgentStatusBadge } from "../components/StatusBadge";
import { effectiveSessionStatus } from "../lib/types";
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
import { formatDateTime, formatDuration, fmtCostFull, timeAgo } from "../lib/format";
import type { Session, Agent, DashboardEvent, CostResult, TranscriptInfo } from "../lib/types";

type DetailTab = "agents" | "conversation" | "timeline";

const EVENTS_INITIAL_BATCH = 50;
const EVENTS_MORE_BATCH = 500;
// Live-refresh bounds — see ActivityFeed for rationale.
const EVENTS_MAX_REFRESH = 500;
const EVENTS_REFRESH_DEBOUNCE_MS = 500;

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("sessions");
  const [session, setSession] = useState<Session | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [filters, setFilters] = useState<EventFiltersValue>(EMPTY_FILTERS);
  const [grouped, setGrouped] = useState(true);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(() => {
    return new Set<string>();
  });
  const [activeTab, setActiveTab] = useState<DetailTab>("agents");
  // Keep tabs mounted once visited so switching between them doesn't unmount/
  // remount their subtrees (which causes a perceptible flash on click).
  const [visitedTabs, setVisitedTabs] = useState<Set<DetailTab>>(() => new Set(["agents"]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);
  const [transcripts, setTranscripts] = useState<TranscriptInfo[]>([]);
  const [pendingTranscriptId, setPendingTranscriptId] = useState<string | null>(null);
  const [transcriptNotFound, setTranscriptNotFound] = useState(false);
  const notFoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(() => new Set());

  function toggleEvent(id: number) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Refs let the websocket handler access latest state without re-subscribing.
  const eventApiParamsRef = useRef<Record<string, unknown> | null>(null);
  const eventsLoadedCountRef = useRef(0);
  const eventsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  eventsLoadedCountRef.current = events.length;
  const goBack = useCallback(() => {
    const historyState =
      typeof window !== "undefined" ? (window.history.state as { idx?: number } | null) : null;
    if ((historyState?.idx ?? 0) > 0) {
      navigate(-1);
      return;
    }
    navigate("/sessions");
  }, [navigate]);

  // Auto-dismiss not-found warning after 8 seconds
  useEffect(() => {
    if (transcriptNotFound) {
      notFoundTimerRef.current = setTimeout(() => setTranscriptNotFound(false), 8000);
      return () => {
        if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
      };
    }
  }, [transcriptNotFound]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [data, costData] = await Promise.all([
        api.sessions.get(id),
        api.pricing.sessionCost(id).catch(() => null),
      ]);
      setSession(data.session);
      setAgents(data.agents);
      setCost(costData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Load transcripts list (for Agent → Conversation navigation ID mapping)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.sessions
      .transcripts(id)
      .then((result) => {
        if (!cancelled) setTranscripts(result.transcripts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Navigate to Conversation tab and select the matching transcript when clicking an agent
  const navigateToAgentConversation = useCallback(
    (agent: Agent) => {
      // Clear any previous not-found warning
      setTranscriptNotFound(false);

      const findTranscriptId = (ts: TranscriptInfo[]): string | null => {
        // 1. Exact match via db_agent_id (most reliable)
        const exactMatch = ts.find((t) => t.db_agent_id === agent.id);
        if (exactMatch) return exactMatch.id;

        // 2. Main agent fallback
        if (agent.type === "main") return "main";

        // 3. Fallback: match by subagent_type or type, then narrow by name
        let candidates = ts.filter((t) => t.type !== "main");
        if (agent.subagent_type) {
          const byType = candidates.filter(
            (t) => t.subagent_type === agent.subagent_type || t.type === agent.subagent_type
          );
          if (byType.length > 0) candidates = byType;
        }
        if (agent.name && candidates.length > 1) {
          const byName = candidates.filter((t) => t.name === agent.name);
          if (byName.length > 0) candidates = byName;
        }
        if (candidates.length === 1) return candidates[0]!.id;

        return null;
      };

      // Always switch to the conversation tab — the user clicked a leaf agent
      // and expects to see its conversation. If no exact transcript match is
      // found, the tab still opens and the not-found banner explains why.
      setActiveTab("conversation");

      const transcriptId = findTranscriptId(transcripts);

      if (transcriptId) {
        setPendingTranscriptId(transcriptId);
      } else if (transcripts.length === 0 && id) {
        // Transcripts not loaded yet — fetch them and retry. The tab is
        // already showing; this just selects the right transcript when ready.
        api.sessions
          .transcripts(id)
          .then((result) => {
            setTranscripts(result.transcripts);
            const freshId = findTranscriptId(result.transcripts);
            if (freshId) {
              setPendingTranscriptId(freshId);
            } else {
              setTranscriptNotFound(true);
            }
          })
          .catch(() => {
            setTranscriptNotFound(true);
          });
      } else {
        // Transcripts are loaded but no specific match for this agent.
        setTranscriptNotFound(true);
      }
    },
    [transcripts, id]
  );

  // Compute compaction labels: "#1", "#2", etc. based on started_at order
  const compactionLabels = useMemo(() => {
    const map = new Map<string, string>();
    const compactions = agents
      .filter((a) => a.subagent_type === "compaction")
      .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));
    compactions.forEach((a, i) => {
      const time = a.started_at
        ? new Date(a.started_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      map.set(a.id, `#${i + 1}${time ? ` · ${time}` : ""}`);
    });
    return map;
  }, [agents]);

  // Event list is fetched separately from the session metadata so it can
  // respect the user's filters and use the server-driven pagination. Status
  // presets expand into event_type values and merge with any explicit
  // event_type selection.
  const eventApiParams = useMemo(() => {
    if (!id) return null;
    const statusExpanded = expandStatusToEventTypes(filters.status);
    const eventTypeMerged = Array.from(new Set<string>([...filters.event_type, ...statusExpanded]));
    return {
      session_id: [id],
      event_type: eventTypeMerged.length > 0 ? eventTypeMerged : undefined,
      tool_name: filters.tool_name.length > 0 ? filters.tool_name : undefined,
      agent_id: filters.agent_id.length > 0 ? filters.agent_id : undefined,
      q: filters.q || undefined,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
    };
  }, [id, filters]);

  eventApiParamsRef.current = eventApiParams;

  const eventGroups = useMemo(() => groupEvents(events), [events]);

  // Build an AgentInfo map from the already-fetched agents list so rows can
  // render the subagent pill (subagent_type) without an extra fetch.
  const agentInfoById = useMemo(() => {
    const map = new Map<string, AgentInfo>();
    for (const a of agents) {
      map.set(a.id, { type: a.type, subagent_type: a.subagent_type, name: a.name });
    }
    return map;
  }, [agents]);

  // Precompute project per event so flat-row rendering doesn't re-parse JSON.
  const projectByEventId = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const e of events) map.set(e.id, projectFromEvent(e));
    return map;
  }, [events]);

  const loadEvents = useCallback(async () => {
    if (!eventApiParams) return;
    try {
      const { events: data, total } = await api.events.list({
        ...eventApiParams,
        limit: EVENTS_INITIAL_BATCH,
        offset: 0,
      });
      setEvents(data);
      setEventsTotal(total);
    } catch (err) {
      console.error("Failed to load session events:", err);
    }
  }, [eventApiParams]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadMoreEvents = useCallback(async () => {
    if (!eventApiParams) return;
    setEventsLoadingMore(true);
    try {
      const { events: data, total } = await api.events.list({
        ...eventApiParams,
        limit: EVENTS_MORE_BATCH,
        offset: events.length,
      });
      setEvents((prev) => [...prev, ...data]);
      setEventsTotal(total);
    } catch (err) {
      console.error("Failed to load more session events:", err);
    } finally {
      setEventsLoadingMore(false);
    }
  }, [eventApiParams, events.length]);
  // Auto-expand agents that have working subagents (at any depth)
  useEffect(() => {
    const parentsWithActiveChildren = new Set<string>();
    for (const a of agents) {
      if (a.parent_agent_id && (a.status === "working" || a.status === "connected")) {
        parentsWithActiveChildren.add(a.parent_agent_id);
      }
    }
    if (parentsWithActiveChildren.size > 0) {
      const agentMap = new Map(agents.map((a) => [a.id, a]));
      const toExpand = new Set<string>();
      for (const pid of parentsWithActiveChildren) {
        let cur = pid;
        while (cur) {
          toExpand.add(cur);
          const parent = agentMap.get(cur);
          cur = parent?.parent_agent_id ?? "";
        }
      }
      setExpandedAgents((prev) => new Set([...prev, ...toExpand]));
    }
  }, [agents]);

  // Pagination-preserving filtered refresh, mirrors ActivityFeed's behavior.
  const refreshEventsWithPagination = useCallback(async () => {
    const params = eventApiParamsRef.current;
    if (!params) return;
    const target = Math.max(
      eventsLoadedCountRef.current || EVENTS_INITIAL_BATCH,
      EVENTS_INITIAL_BATCH
    );
    const size = Math.min(target, EVENTS_MAX_REFRESH);
    try {
      const { events: data, total } = await api.events.list({
        ...params,
        limit: size,
        offset: 0,
      });
      setEvents(data);
      setEventsTotal(total);
    } catch (err) {
      console.error("Failed to refresh session events:", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe((msg) => {
      if (
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_updated"
      ) {
        load();
      }
      if (msg.type === "new_event") {
        // Debounce bursts into one filter-aware refetch that preserves the
        // current "Load more" pagination size.
        if (eventsRefreshTimerRef.current) clearTimeout(eventsRefreshTimerRef.current);
        eventsRefreshTimerRef.current = setTimeout(() => {
          eventsRefreshTimerRef.current = null;
          refreshEventsWithPagination();
        }, EVENTS_REFRESH_DEBOUNCE_MS);
      }
    });
    return () => {
      unsubscribe();
      if (eventsRefreshTimerRef.current) {
        clearTimeout(eventsRefreshTimerRef.current);
        eventsRefreshTimerRef.current = null;
      }
    };
  }, [load, refreshEventsWithPagination]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {t("detail.loading")}
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-2">{error || t("detail.notFound")}</p>
        <button onClick={goBack} className="btn-ghost mt-4">
          <ArrowLeft className="w-4 h-4" /> {t("detail.backToSessions")}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={goBack} className="btn-ghost mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-gray-100">
              {session.name || `${t("defaultName")}${session.id.slice(0, 8)}`}
            </h2>
            <SessionStatusBadge status={effectiveSessionStatus(session)} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-surface-2 px-2 py-1 rounded">
              {session.id.slice(0, 16)}
            </span>
            {session.model && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-surface-2 px-2 py-1 rounded">
                <Cpu className="w-3 h-3 text-gray-500" />
                {session.model}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-surface-2 px-2 py-1 rounded">
              <Clock className="w-3 h-3 text-gray-500" />
              {events.length > 0 && events[0]
                ? formatDateTime(events[0].created_at)
                : formatDateTime(session.started_at)}
              {session.ended_at && (
                <span className="text-gray-500 ml-1">
                  ({formatDuration(session.started_at, session.ended_at)})
                </span>
              )}
            </span>
            {cost && cost.total_cost > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                <DollarSign className="w-3 h-3" />
                {fmtCostFull(cost.total_cost).slice(1)}
              </span>
            )}
          </div>
          {session.cwd && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
              <FolderOpen className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono truncate">{session.cwd}</span>
            </div>
          )}
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => {
            setActiveTab("agents");
            setTranscriptNotFound(false);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "agents"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <Bot className="w-4 h-4" />
          {t("detail.agents")} ({agents.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("conversation");
            setTranscriptNotFound(false);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "conversation"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Conversation
        </button>
        <button
          onClick={() => {
            setActiveTab("timeline");
            setTranscriptNotFound(false);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "timeline"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <List className="w-4 h-4" />
          Timeline ({events.length}/{eventsTotal})
        </button>
      </div>

      {/* Tab Content */}
      {transcriptNotFound && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-3 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Conversation transcript not found for this agent. The transcript file may be missing or
            not yet linked.
          </span>
          <button
            onClick={() => setTranscriptNotFound(false)}
            className="ml-auto text-amber-400/60 hover:text-amber-400 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {visitedTabs.has("agents") && (
        <div hidden={activeTab !== "agents"}>
          <SessionOverview session={session} agents={agents} />

          {agents.length === 0 ? (
            <p className="text-sm text-gray-500">{t("detail.noAgents")}</p>
          ) : (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
                {t("detail.agents")}
                <span className="text-gray-600 font-mono">· {agents.length}</span>
              </h3>
              <div className="space-y-2" data-testid="agent-tree">
                {(() => {
                  // Build parent→children map for the full tree (works at any depth)
                  const agentMap = new Map(agents.map((a) => [a.id, a]));
                  const childrenByParent = new Map<string, Agent[]>();
                  const rootAgents: Agent[] = [];
                  for (const a of agents) {
                    if (a.parent_agent_id && agentMap.has(a.parent_agent_id)) {
                      const list = childrenByParent.get(a.parent_agent_id) || [];
                      list.push(a);
                      childrenByParent.set(a.parent_agent_id, list);
                    } else if (!a.parent_agent_id || !agentMap.has(a.parent_agent_id)) {
                      rootAgents.push(a);
                    }
                  }
                  // Sort roots and children by started_at ascending (chronological order)
                  rootAgents.sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));
                  for (const key of childrenByParent.keys()) {
                    childrenByParent
                      .get(key)!
                      .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));
                  }

                  // Count all descendants (recursive) for collapsed badge
                  function countDescendants(id: string): number {
                    const kids = childrenByParent.get(id) || [];
                    return kids.reduce((sum, k) => sum + 1 + countDescendants(k.id), 0);
                  }

                  // Recursive agent node renderer
                  function renderAgentNode(agent: Agent, depth: number) {
                    const children = childrenByParent.get(agent.id) || [];
                    const isExpanded = expandedAgents.has(agent.id);
                    const hasChildren = children.length > 0;
                    const isSubagent = depth > 0;
                    const totalDesc = hasChildren ? countDescendants(agent.id) : 0;
                    const toggleExpanded = () =>
                      setExpandedAgents((prev) => {
                        const next = new Set(prev);
                        if (next.has(agent.id)) next.delete(agent.id);
                        else next.add(agent.id);
                        return next;
                      });

                    return (
                      <div key={agent.id}>
                        <div className="flex items-center gap-1 min-w-0">
                          {hasChildren && (
                            <button
                              onClick={toggleExpanded}
                              className="p-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                              aria-label={isExpanded ? "Collapse subagents" : "Expand subagents"}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {isSubagent && !hasChildren && <span className="w-6 flex-shrink-0" />}
                          {isSubagent && (
                            <GitBranch className="w-3 h-3 text-violet-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <AgentCard
                              agent={agent}
                              session={session ?? undefined}
                              label={compactionLabels.get(agent.id)}
                              onClick={
                                hasChildren
                                  ? toggleExpanded
                                  : () => navigateToAgentConversation(agent)
                              }
                            />
                          </div>
                        </div>

                        {/* Recursive children (collapsible) */}
                        {hasChildren && isExpanded && (
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-violet-500/20 pl-3">
                            {children.map((child) => renderAgentNode(child, depth + 1))}
                          </div>
                        )}

                        {/* Descendant count badge when collapsed */}
                        {hasChildren && !isExpanded && (
                          <button
                            onClick={() =>
                              setExpandedAgents((prev) => new Set([...prev, agent.id]))
                            }
                            className="ml-7 mt-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            {t("common:subagent_label", { count: totalDesc })}
                          </button>
                        )}
                      </div>
                    );
                  }

                  // Separate true orphans (subagent whose parent_agent_id references a missing agent)
                  const orphans = rootAgents.filter(
                    (a) =>
                      a.type === "subagent" && a.parent_agent_id && !agentMap.has(a.parent_agent_id)
                  );
                  const roots = rootAgents.filter(
                    (a) =>
                      !(
                        a.type === "subagent" &&
                        a.parent_agent_id &&
                        !agentMap.has(a.parent_agent_id)
                      )
                  );

                  return (
                    <>
                      {roots.map((agent) => renderAgentNode(agent, 0))}

                      {/* Orphaned subagents */}
                      {orphans.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wider">
                            {t("detail.unparented")}
                          </p>
                          <div className="space-y-1">
                            {orphans.map((agent) => renderAgentNode(agent, 1))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {/* Cost Breakdown — shown under Agents tab */}
          {cost && cost.breakdown.length > 0 && cost.total_cost > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {t("detail.costBreakdown")}
              </h3>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {t("common:cost.model")}
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {t("common:token.input")}
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {t("common:token.output")}
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {t("common:token.cacheRead")}
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {t("common:token.cacheWrite")}
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {t("common:cost.cost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cost.breakdown.map((row) => (
                      <tr key={row.model} className="hover:bg-surface-4 transition-colors">
                        <td className="px-5 py-2.5 text-sm font-mono text-gray-300">{row.model}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-400 text-right font-mono">
                          {row.input_tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-sm text-gray-400 text-right font-mono">
                          {row.output_tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-sm text-gray-400 text-right font-mono">
                          {row.cache_read_tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-sm text-gray-400 text-right font-mono">
                          {row.cache_write_tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-sm text-emerald-400 text-right font-mono font-medium">
                          {fmtCostFull(row.cost, 4)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-surface-2">
                      <td className="px-5 py-2.5 text-sm font-medium text-gray-200" colSpan={5}>
                        {t("common:total")}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-emerald-400 text-right font-mono font-semibold">
                        {fmtCostFull(cost.total_cost, 4)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {visitedTabs.has("conversation") && (
        <div hidden={activeTab !== "conversation"}>
          <ConversationView sessionId={session.id} initialTranscriptId={pendingTranscriptId} />
        </div>
      )}

      {visitedTabs.has("timeline") && (
        <div hidden={activeTab !== "timeline"}>
          <div className="mb-3">
            <EventFiltersInfo />
          </div>
          <div className="mb-3">
            <EventFilters
              value={filters}
              onChange={setFilters}
              hideSessionFilter
              agentOptions={agents.map((a) => ({ id: a.id, label: a.name || a.id }))}
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
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isEmptyFilters(filters) ? t("detail.noEvents") : t("common:eventFilters.noResults")}
            </p>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto overflow-x-auto">
                {grouped
                  ? eventGroups.map((group) => (
                      <EventGroupRow key={group.key} group={group} agentInfoById={agentInfoById} />
                    ))
                  : events.map((event, i) => {
                      const key = event.id ?? i;
                      const isOpen = event.id != null && expandedEvents.has(event.id);
                      return (
                        <div key={key}>
                          <button
                            type="button"
                            onClick={() => event.id != null && toggleEvent(event.id)}
                            aria-expanded={isOpen}
                            aria-label={
                              isOpen
                                ? t("common:eventDetail.collapse")
                                : t("common:eventDetail.expand")
                            }
                            className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-surface-4 transition-colors min-w-0 cursor-pointer"
                          >
                            <span
                              className={`text-gray-500 text-[10px] w-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                              aria-hidden="true"
                            >
                              ▶
                            </span>
                            <div className="w-16 text-[11px] text-gray-600 font-mono flex-shrink-0">
                              {timeAgo(event.created_at)}
                            </div>
                            <AgentStatusBadge status={statusFromEventType(event.event_type)} />
                            {(() => {
                              const info = event.agent_id
                                ? agentInfoById.get(event.agent_id)
                                : undefined;
                              // Session is implicit on this page — project is
                              // still shown so the row identifies the working
                              // directory when you share / search.
                              const project = projectByEventId.get(event.id) ?? null;
                              const origin = buildOriginLabel(
                                project,
                                null,
                                agentOriginLabel(event.agent_id, info)
                              );
                              return (
                                <span className="text-sm text-gray-300 flex-1 truncate">
                                  {origin && (
                                    <span
                                      className="text-gray-500 mr-1"
                                      title={event.agent_id ?? undefined}
                                    >
                                      {origin} ·
                                    </span>
                                  )}
                                  {buildEventTitle(event)}
                                </span>
                              );
                            })()}
                            {event.tool_name && (
                              <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono">
                                {event.tool_name}
                              </span>
                            )}
                          </button>
                          {isOpen && <EventDetail event={event} />}
                        </div>
                      );
                    })}
              </div>
            </div>
          )}
          {events.length < eventsTotal && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-gray-500">
                {t("common:eventFilters.showing", { shown: events.length, total: eventsTotal })}
              </span>
              <button
                type="button"
                onClick={loadMoreEvents}
                disabled={eventsLoadingMore}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {eventsLoadingMore
                  ? t("common:eventFilters.loading")
                  : t("common:eventFilters.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
