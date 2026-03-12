import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Bot, Zap, DollarSign, Activity, ArrowRight, RefreshCw } from "lucide-react";
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [recentEvents, setRecentEvents] = useState<DashboardEvent[]>([]);
  const [totalCost, setTotalCost] = useState<number | null>(null);
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
      setActiveAgents([...workingRes.agents, ...connectedRes.agents, ...idleRes.agents]);
      setRecentEvents(eventsRes.events);
      setTotalCost(costRes.total_cost);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

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
        <p className="text-red-400 mb-2">Failed to connect to server</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={load} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Dashboard</h2>
          <p className="text-sm text-gray-500">Real-time overview of Claude Code agent activity</p>
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Sessions"
          value={stats ? fmt(stats.total_sessions) : "-"}
          raw={stats ? stats.total_sessions.toLocaleString() : undefined}
          icon={FolderOpen}
          trend={stats ? `${stats.active_sessions} active` : undefined}
        />
        <StatCard
          label="Active Agents"
          value={stats?.active_agents ?? "-"}
          icon={Bot}
          accentColor="text-emerald-400"
        />
        <StatCard
          label="Events Today"
          value={stats ? fmt(stats.events_today) : "-"}
          raw={stats ? stats.events_today.toLocaleString() : undefined}
          icon={Zap}
          accentColor="text-yellow-400"
        />
        <StatCard
          label="Total Events"
          value={stats ? fmt(stats.total_events) : "-"}
          raw={stats ? stats.total_events.toLocaleString() : undefined}
          icon={Activity}
          accentColor="text-violet-400"
        />
        <StatCard
          label="Total Cost"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active agents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">Active Agents</h3>
            <button onClick={() => navigate("/kanban")} className="btn-ghost text-xs">
              View Board <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {activeAgents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No active agents"
              description="Agents will appear here when a Claude Code session is running."
            />
          ) : (
            <div className="space-y-3">
              {activeAgents.slice(0, 5).map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">Recent Activity</h3>
            <button onClick={() => navigate("/activity")} className="btn-ghost text-xs">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentEvents.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Events from Claude Code sessions will stream here in real-time."
            />
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
