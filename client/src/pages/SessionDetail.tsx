import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionStatusBadge, AgentStatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatDuration, timeAgo } from "../lib/format";
import type { Session, Agent, DashboardEvent, SessionStatus, CostResult } from "../lib/types";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(() => {
    // Auto-expand on first render; useEffect below handles live updates
    return new Set<string>();
  });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [data, costData] = await Promise.all([
        api.sessions.get(id),
        api.pricing.sessionCost(id).catch(() => null),
      ]);
      setSession(data.session);
      setAgents(data.agents);
      setEvents(data.events);
      setCost(costData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-expand agents that have working subagents
  useEffect(() => {
    const parentsWithActiveChildren = new Set<string>();
    for (const a of agents) {
      if (
        a.type === "subagent" &&
        a.parent_agent_id &&
        (a.status === "working" || a.status === "connected")
      ) {
        parentsWithActiveChildren.add(a.parent_agent_id);
      }
    }
    if (parentsWithActiveChildren.size > 0) {
      setExpandedAgents((prev) => new Set([...prev, ...parentsWithActiveChildren]));
    }
  }, [agents]);

  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_updated" ||
        msg.type === "new_event"
      ) {
        load();
      }
    });
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">Loading session...</div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-2">{error || "Session not found"}</p>
        <button onClick={() => navigate("/sessions")} className="btn-ghost mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate("/sessions")} className="btn-ghost mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-gray-100">
              {session.name || `Session ${session.id.slice(0, 8)}`}
            </h2>
            <SessionStatusBadge status={session.status as SessionStatus} />
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
                <DollarSign className="w-3 h-3" />${cost.total_cost.toFixed(2)}
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

      {/* Agents */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Agents ({agents.length})
        </h3>
        {agents.length === 0 ? (
          <p className="text-sm text-gray-500">No agents recorded.</p>
        ) : (
          <div className="space-y-2">
            {(() => {
              const mainAgents = agents.filter((a) => a.type === "main");
              const subagentsByParent = new Map<string, Agent[]>();
              for (const a of agents) {
                if (a.type === "subagent" && a.parent_agent_id) {
                  const list = subagentsByParent.get(a.parent_agent_id) || [];
                  list.push(a);
                  subagentsByParent.set(a.parent_agent_id, list);
                }
              }
              // Subagents with no matching parent (orphans) get shown at top level
              const orphans = agents.filter(
                (a) =>
                  a.type === "subagent" &&
                  (!a.parent_agent_id || !mainAgents.some((m) => m.id === a.parent_agent_id))
              );

              return (
                <>
                  {mainAgents.map((main) => {
                    const children = subagentsByParent.get(main.id) || [];
                    const isExpanded = expandedAgents.has(main.id);
                    const hasChildren = children.length > 0;

                    return (
                      <div key={main.id}>
                        {/* Main agent row */}
                        <div className="flex items-center gap-1">
                          {hasChildren ? (
                            <button
                              onClick={() =>
                                setExpandedAgents((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(main.id)) next.delete(main.id);
                                  else next.add(main.id);
                                  return next;
                                })
                              }
                              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-6" />
                          )}
                          <div className="flex-1">
                            <AgentCard agent={main} />
                          </div>
                        </div>

                        {/* Subagent children (collapsible) */}
                        {hasChildren && isExpanded && (
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-violet-500/20 pl-3">
                            {children.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2">
                                <GitBranch className="w-3 h-3 text-violet-400 flex-shrink-0" />
                                <div className="flex-1">
                                  <AgentCard agent={sub} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subagent count badge when collapsed */}
                        {hasChildren && !isExpanded && (
                          <button
                            onClick={() =>
                              setExpandedAgents((prev) => new Set([...prev, main.id]))
                            }
                            className="ml-7 mt-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            {children.length} subagent{children.length !== 1 ? "s" : ""}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Orphaned subagents */}
                  {orphans.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wider">
                        Unparented Subagents
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {orphans.map((agent) => (
                          <AgentCard key={agent.id} agent={agent} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      {cost && cost.breakdown.length > 0 && cost.total_cost > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Cost Breakdown
          </h3>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Input
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Output
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Cache Read
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Cache Write
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Cost
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
                      ${row.cost.toFixed(4)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2">
                  <td className="px-5 py-2.5 text-sm font-medium text-gray-200" colSpan={5}>
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-sm text-emerald-400 text-right font-mono font-semibold">
                    ${cost.total_cost.toFixed(4)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Timeline */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-4">Event Timeline ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events recorded.</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto overflow-x-auto">
              {events.map((event, i) => (
                <div
                  key={event.id ?? i}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-surface-4 transition-colors min-w-0"
                >
                  <div className="w-16 text-[11px] text-gray-600 font-mono flex-shrink-0">
                    {timeAgo(event.created_at)}
                  </div>
                  <AgentStatusBadge
                    status={
                      event.event_type === "Stop" || event.event_type === "Compaction"
                        ? "completed"
                        : event.event_type === "PreToolUse"
                          ? "working"
                          : event.event_type === "error"
                            ? "error"
                            : "connected"
                    }
                  />
                  <span className="text-sm text-gray-300 flex-1 truncate">
                    {event.summary || event.event_type}
                  </span>
                  {event.tool_name && (
                    <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono">
                      {event.tool_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
