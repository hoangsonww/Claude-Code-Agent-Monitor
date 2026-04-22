/**
 * @file SessionDetail.tsx
 * @description Displays detailed information about a specific session, including its agents, events, and cost breakdown, with real-time updates and an expandable agent hierarchy view.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { SessionStatusBadge, AgentStatusBadge } from "../components/StatusBadge";
import { EventDetail } from "../components/EventDetail";
import { formatDateTime, formatDuration, fmtCostFull, timeAgo } from "../lib/format";
import type { Session, Agent, DashboardEvent, SessionStatus, CostResult } from "../lib/types";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("sessions");
  const [session, setSession] = useState<Session | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(() => {
    return new Set<string>();
  });
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(() => new Set());

  function toggleEvent(id: number) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const goBack = useCallback(() => {
    const historyState =
      typeof window !== "undefined" ? (window.history.state as { idx?: number } | null) : null;
    if ((historyState?.idx ?? 0) > 0) {
      navigate(-1);
      return;
    }
    navigate("/sessions");
  }, [navigate]);

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
      setError(err instanceof Error ? err.message : t("detail.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

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

      {/* Agents */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          {t("detail.agents")} ({agents.length})
        </h3>
        {agents.length === 0 ? (
          <p className="text-sm text-gray-500">{t("detail.noAgents")}</p>
        ) : (
          <div className="space-y-2">
            {(() => {
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

              function countDescendants(id: string): number {
                const kids = childrenByParent.get(id) || [];
                return kids.reduce((sum, k) => sum + 1 + countDescendants(k.id), 0);
              }

              function renderAgentNode(agent: Agent, depth: number) {
                const children = childrenByParent.get(agent.id) || [];
                const isExpanded = expandedAgents.has(agent.id);
                const hasChildren = children.length > 0;
                const isSubagent = depth > 0;
                const totalDesc = hasChildren ? countDescendants(agent.id) : 0;

                return (
                  <div key={agent.id}>
                    <div className="flex items-center gap-1 min-w-0">
                      {hasChildren && (
                        <button
                          onClick={() =>
                            setExpandedAgents((prev) => {
                              const next = new Set(prev);
                              if (next.has(agent.id)) next.delete(agent.id);
                              else next.add(agent.id);
                              return next;
                            })
                          }
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
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
                        <AgentCard agent={agent} />
                      </div>
                    </div>

                    {hasChildren && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1 border-l-2 border-violet-500/20 pl-3">
                        {children.map((child) => renderAgentNode(child, depth + 1))}
                      </div>
                    )}

                    {hasChildren && !isExpanded && (
                      <button
                        onClick={() => setExpandedAgents((prev) => new Set([...prev, agent.id]))}
                        className="ml-7 mt-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        {t("common:subagent_label", { count: totalDesc })}
                      </button>
                    )}
                  </div>
                );
              }

              const orphans = rootAgents.filter(
                (a) =>
                  a.type === "subagent" && a.parent_agent_id && !agentMap.has(a.parent_agent_id)
              );
              const roots = rootAgents.filter(
                (a) =>
                  !(a.type === "subagent" && a.parent_agent_id && !agentMap.has(a.parent_agent_id))
              );

              return (
                <>
                  {roots.map((agent) => renderAgentNode(agent, 0))}

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
        )}
      </div>

      {/* Cost Breakdown */}
      {cost && cost.breakdown.length > 0 && cost.total_cost > 0 && (
        <div>
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

      {/* Event Timeline */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-4">
          {t("detail.eventTimeline")} ({events.length})
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">{t("detail.noEvents")}</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto overflow-x-auto">
              {events.map((event, i) => {
                const key = event.id ?? i;
                const isOpen = event.id != null && expandedEvents.has(event.id);
                return (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => event.id != null && toggleEvent(event.id)}
                      aria-expanded={isOpen}
                      aria-label={
                        isOpen ? t("common:eventDetail.collapse") : t("common:eventDetail.expand")
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
                    </button>
                    {isOpen && <EventDetail event={event} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
