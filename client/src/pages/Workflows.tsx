/**
 * @file Workflows.tsx
 * @description Displays comprehensive analytics on agent orchestration patterns, including DAGs of agent spawning, tool usage flows, collaboration networks, and session complexity metrics, with real-time updates and interactive filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Workflow, RefreshCw, Download, AlertCircle, Info } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import type { WorkflowData, WSMessage } from "../lib/types";

import { WorkflowStats } from "../components/workflows/WorkflowStats";
import { OrchestrationDAG } from "../components/workflows/OrchestrationDAG";
import { ToolExecutionFlow } from "../components/workflows/ToolExecutionFlow";
import { AgentCollaborationNetwork } from "../components/workflows/AgentCollaborationNetwork";
import { SubagentEffectiveness } from "../components/workflows/SubagentEffectiveness";
import { WorkflowPatterns } from "../components/workflows/WorkflowPatterns";
import { ModelDelegationFlow } from "../components/workflows/ModelDelegationFlow";
import { ErrorPropagationMap } from "../components/workflows/ErrorPropagationMap";
import { ConcurrencyTimeline } from "../components/workflows/ConcurrencyTimeline";
import { SessionComplexityScatter } from "../components/workflows/SessionComplexityScatter";
import { CompactionImpact } from "../components/workflows/CompactionImpact";
import { SessionDrillIn } from "../components/workflows/SessionDrillIn";

type StatusFilter = "all" | "active" | "completed";

export function Workflows() {
  const { t } = useTranslation("workflows");
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await api.workflows.get(statusFilter);
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh on WebSocket events
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handler = (_msg: WSMessage) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchData, 3000);
    };
    const unsub = eventBus.subscribe(handler);
    return () => {
      unsub();
      clearTimeout(debounceTimer);
    };
  }, [fetchData]);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflows-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={handleRefresh}
          onExport={handleExport}
          lastUpdated={null}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-surface-2" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse bg-surface-2" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={handleRefresh}
          onExport={handleExport}
          lastUpdated={null}
        />
        <div className="card flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={handleRefresh} className="btn-primary text-sm">
            {t("common:retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={handleRefresh}
        onExport={handleExport}
        lastUpdated={lastUpdated}
      />

      {/* Stats Row */}
      <WorkflowStats stats={data.stats} />

      {/* Section 1: Agent Orchestration DAG */}
      <Section number={1} title={t("orchestration.title")} subtitle={t("orchestration.subtitle")}>
        <OrchestrationDAG
          data={data.orchestration}
          onNodeClick={setSelectedNode}
          selectedNode={selectedNode}
        />
        {selectedNode && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">{t("filteredBy")}</span>
            <span className="badge bg-accent/15 text-accent border border-accent/20 text-xs">
              {selectedNode}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              {t("clearFilter")}
            </button>
          </div>
        )}
      </Section>

      {/* Section 2: Tool Execution Flow */}
      <Section number={2} title={t("toolFlow.title")} subtitle={t("toolFlow.subtitle")}>
        <ToolExecutionFlow data={data.toolFlow} filterAgentType={selectedNode} />
      </Section>

      {/* Section 3: Agent Collaboration Network */}
      <Section number={3} title={t("pipeline.title")} subtitle={t("pipeline.subtitle")}>
        <AgentCollaborationNetwork effectiveness={data.effectiveness} edges={data.cooccurrence} />
      </Section>

      {/* Section 4 + 5: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section number={4} title={t("effectiveness.title")} subtitle={t("effectiveness.subtitle")}>
          <SubagentEffectiveness data={data.effectiveness} />
        </Section>

        <Section number={5} title={t("patterns.title")} subtitle={t("patterns.subtitle")}>
          <WorkflowPatterns data={data.patterns} onPatternClick={() => {}} />
        </Section>
      </div>

      {/* Section 6 + 7: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          number={6}
          title={t("modelDelegation.title")}
          subtitle={t("modelDelegation.subtitle")}
        >
          <ModelDelegationFlow data={data.modelDelegation} />
        </Section>

        <Section
          number={7}
          title={t("errorPropagation.title")}
          subtitle={t("errorPropagation.subtitle")}
        >
          <ErrorPropagationMap data={data.errorPropagation} />
        </Section>
      </div>

      {/* Section 8: Agent Concurrency Timeline */}
      <Section number={8} title={t("concurrency.title")} subtitle={t("concurrency.subtitle")}>
        <ConcurrencyTimeline data={data.concurrency} />
      </Section>

      {/* Section 9 + 10: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section number={9} title={t("complexity.title")} subtitle={t("complexity.subtitle")}>
          <SessionComplexityScatter data={data.complexity} onSessionClick={setSelectedSessionId} />
        </Section>

        <Section number={10} title={t("compaction.title")} subtitle={t("compaction.subtitle")}>
          <CompactionImpact data={data.compaction} />
        </Section>
      </div>

      {/* Section 11: Session Drill-In */}
      <Section number={11} title={t("drillIn.title")} subtitle={t("drillIn.subtitle")}>
        <SessionDrillIn
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          onSelectSession={(id) => setSelectedSessionId(id)}
        />
      </Section>
    </div>
  );
}

// ── Section wrapper ──
function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-md bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center">
            {number}
          </span>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="flex items-center justify-center"
            >
              <Info className="w-3.5 h-3.5 text-gray-600 hover:text-gray-400 transition-colors" />
            </button>
            {showTip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 px-3 py-2 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl text-[11px] text-gray-300 whitespace-nowrap pointer-events-none">
                {subtitle}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#2a2a4a]" />
              </div>
            )}
          </div>
        </div>
        <span className="text-[11px] text-gray-600 hidden lg:block">{subtitle}</span>
      </div>
      <div className="card p-4">{children}</div>
    </div>
  );
}

// ── Page Header ──
function PageHeader({
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onExport,
  lastUpdated,
}: {
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  onRefresh: () => void;
  onExport: () => void;
  lastUpdated: Date | null;
}) {
  const { t } = useTranslation("workflows");
  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("allSessions") },
    { value: "active", label: t("activeOnly") },
    { value: "completed", label: t("completed") },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
          <Workflow className="w-4.5 h-4.5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
          <p className="text-xs text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Status filter tabs */}
        <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onStatusFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-accent/15 text-accent"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-3 transition-colors"
          title={t("refreshData")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={onExport}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-3 transition-colors"
          title={t("exportJson")}
        >
          <Download className="w-4 h-4" />
        </button>

        {lastUpdated && (
          <span className="text-[10px] text-gray-600 ml-1">
            {t("common:updated")}
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
