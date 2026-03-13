import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Columns3, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { AgentCard } from "../components/AgentCard";
import { EmptyState } from "../components/EmptyState";
import { STATUS_CONFIG } from "../lib/types";
import type { Agent, AgentStatus } from "../lib/types";

const COLUMNS: AgentStatus[] = ["idle", "connected", "working", "completed", "error"];
const COLUMN_PAGE_SIZE = 10;

export function KanbanBoard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const results = await Promise.all(COLUMNS.map((status) => api.agents.list({ status })));
      setAgents(results.flatMap((r) => r.agents));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (msg.type === "agent_created" || msg.type === "agent_updated") {
        load();
      }
    });
  }, [load]);

  const grouped = COLUMNS.reduce(
    (acc, status) => {
      acc[status] = agents.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<AgentStatus, Agent[]>
  );

  if (!loading && agents.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Agent Board</h2>
          <p className="text-sm text-gray-500">Kanban view of all agents by status</p>
        </div>
        <EmptyState
          icon={Columns3}
          title="No agents tracked yet"
          description="Start a Claude Code session with hooks installed to see agents appear here."
          action={
            <button onClick={load} className="btn-primary">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Agent Board</h2>
          <p className="text-sm text-gray-500">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-4 min-h-[600px] overflow-x-auto pb-4 -mx-8 px-8">
        {COLUMNS.map((status) => {
          const config = STATUS_CONFIG[status];
          const items = grouped[status];
          return (
            <div
              key={status}
              className="bg-surface-1 rounded-xl border border-border p-3 flex flex-col flex-shrink-0 w-72"
            >
              <div className="flex items-center gap-2 mb-4 px-1">
                <span
                  className={`w-2 h-2 rounded-full ${config.dot} ${
                    status === "working" ? "animate-pulse-dot" : ""
                  }`}
                />
                <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                  {config.label}
                </span>
                <span className="ml-auto text-[11px] text-gray-600 bg-surface-3 px-2 py-0.5 rounded-full">
                  {items?.length ?? 0}
                </span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {items && items.length > 0 ? (
                  <>
                    {items.slice(0, expanded[status] || COLUMN_PAGE_SIZE).map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                    {items.length > (expanded[status] || COLUMN_PAGE_SIZE) && (
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [status]: (prev[status] || COLUMN_PAGE_SIZE) + COLUMN_PAGE_SIZE,
                          }))
                        }
                        className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                        Show more ({items.length - (expanded[status] || COLUMN_PAGE_SIZE)}{" "}
                        remaining)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-24 text-xs text-gray-600">
                    No agents
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
