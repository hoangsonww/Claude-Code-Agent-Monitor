/**
 * @file Dashboard.tsx
 * @description Main dashboard page showing real-time stats, active agents, and recent activity feed for Claude Code sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  FolderOpen,
  Bot,
  Zap,
  DollarSign,
  Activity,
  ArrowRight,
  RefreshCw,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { StatCard } from "../components/StatCard";
import { AgentCard } from "../components/AgentCard";
import { AgentStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { timeAgo, fmt, fmtCost } from "../lib/format";
import type { Stats, Agent, DashboardEvent, WSMessage } from "../lib/types";

export function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [recentEvents, setRecentEvents] = useState<DashboardEvent[]>([]);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [allSubagents, setAllSubagents] = useState<Agent[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, workingRes, connectedRes, idleRes, eventsRes, costRes] = await Promise.all([
        api.stats.get(),
        api.agents.list({ status: "working", limit: 20 }),
        api.agents.list({ status: "connected", limit: 20 }),
        api.agents.list({ status: "idle", limit: 20 }),
        api.events.list({ limit: 15 }),
        api.pricing.totalCost(),
      ]);
      setStats(statsRes);
      const active = [...workingRes.agents, ...connectedRes.agents, ...idleRes.agents];
      setActiveAgents(active);
      setRecentEvents(eventsRes.events);
      setTotalCost(costRes.total_cost);
      setError(null);

      // Fetch all subagents for each active main agent's session
      const activeSessionIds = [
        ...new Set(active.filter((a) => a.type === "main").map((a) => a.session_id)),
      ];
      const subagentResults = await Promise.all(
        activeSessionIds.map((sid) => api.agents.list({ session_id: sid, limit: 100 }))
      );
      const subs = subagentResults.flatMap((r) => r.agents).filter((a) => a.type === "subagent");
      setAllSubagents(subs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedLoad"));
    }
  }, [t]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  // Auto-expand agents with active subagents (walk up the full parent chain)
  useEffect(() => {
    const parentsWithActive = new Set<string>();
    for (const a of allSubagents) {
      if (a.parent_agent_id && (a.status === "working" || a.status === "connected")) {
        parentsWithActive.add(a.parent_agent_id);
      }
    }
    if (parentsWithActive.size > 0) {
      const subMap = new Map(allSubagents.map((a) => [a.id, a]));
      const toExpand = new Set<string>();
      for (const pid of parentsWithActive) {
        let cur = pid;
        while (cur) {
          toExpand.add(cur);
          const parent = subMap.get(cur);
          cur = parent?.parent_agent_id ?? "";
        }
      }
      setExpandedAgents((prev) => new Set([...prev, ...toExpand]));
    }
  }, [allSubagents]);

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_created" ||
        msg.type === "session_updated"
      ) {
        load();
      }
      if (msg.type === "new_event") {
        setRecentEvents((prev) => [msg.data as DashboardEvent, ...prev.slice(0, 14)]);
      }
    });
  }, [load]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-2">{t("failedConnect")}</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={load} className="btn-primary mt-4">
          {t("common:retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <LayoutDashboard className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
      </div>

      {/* Stats grid — 2 rows of 3 avoids the 6-column squeeze */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label={t("totalSessions")}
          value={stats ? fmt(stats.total_sessions) : "-"}
          raw={stats ? stats.total_sessions.toLocaleString() : undefined}
          icon={FolderOpen}
          trend={stats ? `${stats.active_sessions}${t("activeTrend")}` : undefined}
        />
        <StatCard
          label={t("activeAgents")}
          value={stats?.active_agents ?? "-"}
          icon={Bot}
          accentColor="text-emerald-400"
        />
        <StatCard
          label={t("activeSubagents")}
          value={
            allSubagents.filter((a) => a.status === "working" || a.status === "connected").length
          }
          icon={GitBranch}
          accentColor="text-violet-400"
          trend={`${allSubagents.length}${t("totalTrend")}`}
        />
        <StatCard
          label={t("eventsToday")}
          value={stats ? fmt(stats.events_today) : "-"}
          raw={stats ? stats.events_today.toLocaleString() : undefined}
          icon={Zap}
          accentColor="text-yellow-400"
        />
        <StatCard
          label={t("totalEvents")}
          value={stats ? fmt(stats.total_events) : "-"}
          raw={stats ? stats.total_events.toLocaleString() : undefined}
          icon={Activity}
          accentColor="text-violet-400"
        />
        <StatCard
          label={t("totalCost")}
          value={totalCost !== null ? fmtCost(totalCost) : "-"}
          raw={
            totalCost !== null
              ? `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : undefined
          }
          icon={DollarSign}
          accentColor="text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* Active agents */}
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">{t("activeAgentsSection")}</h3>
            <button onClick={() => navigate("/kanban")} className="btn-ghost text-xs">
              {t("viewBoard")} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {activeAgents.length === 0 ? (
            <EmptyState icon={Bot} title={t("noAgents")} description={t("noAgentsDesc")} />
          ) : (
            <div className="space-y-2">
              {(() => {
                // Build parent→children map across all subagents for recursive rendering
                const childrenByParent = new Map<string, Agent[]>();
                for (const a of allSubagents) {
                  if (a.parent_agent_id) {
                    const list = childrenByParent.get(a.parent_agent_id) || [];
                    list.push(a);
                    childrenByParent.set(a.parent_agent_id, list);
                  }
                }

                function countDescendants(id: string): number {
                  const kids = childrenByParent.get(id) || [];
                  return kids.reduce((sum, k) => sum + 1 + countDescendants(k.id), 0);
                }

                function countActiveDescendants(id: string): number {
                  const kids = childrenByParent.get(id) || [];
                  return kids.reduce(
                    (sum, k) =>
                      sum +
                      (k.status === "working" || k.status === "connected" ? 1 : 0) +
                      countActiveDescendants(k.id),
                    0
                  );
                }

                function renderAgentNode(agent: Agent, depth: number) {
                  const children = childrenByParent.get(agent.id) || [];
                  const isExpanded = expandedAgents.has(agent.id);
                  const hasChildren = children.length > 0;
                  const isSubagent = depth > 0;
                  const totalDesc = hasChildren ? countDescendants(agent.id) : 0;
                  const activeDesc = hasChildren ? countActiveDescendants(agent.id) : 0;

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
                          {totalDesc} {t("common:subagent", { count: totalDesc })}
                          {activeDesc > 0 && (
                            <span className="text-emerald-400 ml-1">
                              ({activeDesc} {t("common:active")})
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    {activeAgents
                      .filter((a) => a.type === "main")
                      .slice(0, 5)
                      .map((main) => renderAgentNode(main, 0))}
                    {/* Show active subagents without a main agent in the active list */}
                    {activeAgents
                      .filter((a) => a.type === "subagent")
                      .map((agent) => (
                        <div key={agent.id}>
                          <AgentCard agent={agent} />
                        </div>
                      ))}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">{t("recentActivity")}</h3>
            <button onClick={() => navigate("/activity")} className="btn-ghost text-xs">
              {t("viewAll")} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentEvents.length === 0 ? (
            <EmptyState icon={Activity} title={t("noActivity")} description={t("noActivityDesc")} />
          ) : (
            <div className="card divide-y divide-border">
              {recentEvents.slice(0, 8).map((event, i) => (
                <div
                  key={event.id ?? i}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-surface-4 transition-colors cursor-pointer"
                  onClick={() => navigate(`/sessions/${event.session_id}`)}
                >
                  <AgentStatusBadge
                    status={
                      event.event_type === "Stop"
                        ? "completed"
                        : event.event_type === "PreToolUse"
                          ? "working"
                          : "connected"
                    }
                  />
                  <span className="text-sm text-gray-300 truncate flex-1">
                    {event.summary || event.event_type}
                  </span>
                  {event.tool_name && (
                    <span className="text-[11px] text-gray-500 font-mono">{event.tool_name}</span>
                  )}
                  <span className="text-[11px] text-gray-600 flex-shrink-0">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
