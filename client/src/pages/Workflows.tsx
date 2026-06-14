/**
 * @file Workflows.tsx
 * @description Displays comprehensive analytics on agent orchestration patterns, including DAGs of agent spawning, tool usage flows, collaboration networks, and session complexity metrics, with real-time updates and interactive filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { WorkflowRunsPanel } from "../components/workflows/WorkflowRunsPanel";

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

      {/* Workflow-tool runs (issue #167) — fleets ingested from on-disk journals */}
      <div className="card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Workflow className="w-4 h-4 text-violet-400" />
            {t("runs.title")}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{t("runs.subtitle")}</p>
        </div>
        <WorkflowRunsPanel statusFilter={statusFilter} />
      </div>

      {/* Section 1: Agent Orchestration DAG */}
      <Section
        number={1}
        title={t("orchestration.title")}
        subtitle={t("orchestration.subtitle")}
        infoKey="orchestration"
      >
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
      <Section
        number={2}
        title={t("toolFlow.title")}
        subtitle={t("toolFlow.subtitle")}
        infoKey="toolFlow"
      >
        <ToolExecutionFlow data={data.toolFlow} filterAgentType={selectedNode} />
      </Section>

      {/* Section 3: Agent Collaboration Network */}
      <Section
        number={3}
        title={t("pipeline.title")}
        subtitle={t("pipeline.subtitle")}
        infoKey="pipeline"
      >
        <AgentCollaborationNetwork effectiveness={data.effectiveness} edges={data.cooccurrence} />
      </Section>

      {/* Section 4 + 5: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          number={4}
          title={t("effectiveness.title")}
          subtitle={t("effectiveness.subtitle")}
          infoKey="effectiveness"
        >
          <SubagentEffectiveness data={data.effectiveness} />
        </Section>

        <Section
          number={5}
          title={t("patterns.title")}
          subtitle={t("patterns.subtitle")}
          infoKey="patterns"
        >
          <WorkflowPatterns data={data.patterns} onPatternClick={() => {}} />
        </Section>
      </div>

      {/* Section 6 + 7: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          number={6}
          title={t("modelDelegation.title")}
          subtitle={t("modelDelegation.subtitle")}
          infoKey="modelDelegation"
        >
          <ModelDelegationFlow data={data.modelDelegation} />
        </Section>

        <Section
          number={7}
          title={t("errorPropagation.title")}
          subtitle={t("errorPropagation.subtitle")}
          infoKey="errorPropagation"
        >
          <ErrorPropagationMap data={data.errorPropagation} />
        </Section>
      </div>

      {/* Section 8: Agent Concurrency Timeline */}
      <Section
        number={8}
        title={t("concurrency.title")}
        subtitle={t("concurrency.subtitle")}
        infoKey="concurrency"
      >
        <ConcurrencyTimeline data={data.concurrency} />
      </Section>

      {/* Section 9 + 10: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          number={9}
          title={t("complexity.title")}
          subtitle={t("complexity.subtitle")}
          infoKey="complexity"
        >
          <SessionComplexityScatter data={data.complexity} onSessionClick={setSelectedSessionId} />
        </Section>

        <Section
          number={10}
          title={t("compaction.title")}
          subtitle={t("compaction.subtitle")}
          infoKey="compaction"
        >
          <CompactionImpact data={data.compaction} />
        </Section>
      </div>

      {/* Section 11: Session Drill-In */}
      <Section
        number={11}
        title={t("drillIn.title")}
        subtitle={t("drillIn.subtitle")}
        infoKey="drillIn"
      >
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
  infoKey,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  /** Key under workflows.chartInfo.* — drives the structured popover content. */
  infoKey: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-md bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center">
            {number}
          </span>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          <ChartInfoPopover infoKey={infoKey} title={title} />
        </div>
        <span className="text-[11px] text-gray-600 hidden lg:block">{subtitle}</span>
      </div>
      <div className="card p-4">{children}</div>
    </div>
  );
}

/**
 * Structured info popover for a Workflows chart section. Hover or focus the
 * `i` icon to read three short paragraphs sourced from i18n:
 *
 *   1. What this shows  — what data the chart visualizes
 *   2. How to read it   — visual encoding (axes, sizes, colors, etc.)
 *   3. Why it matters   — what insights the user can extract
 *
 * The popover uses fixed positioning and is clamped to the viewport so it
 * never gets clipped by the sidebar or screen edges. Auto-flips above the
 * trigger when there's no room below.
 */
function ChartInfoPopover({ infoKey, title }: { infoKey: string; title: string }) {
  const { t } = useTranslation("workflows");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const POPOVER_W = 340;
  const MARGIN = 12;

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = buttonRef.current;
      const pop = popoverRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const popH = pop?.offsetHeight ?? 280;

      // Center horizontally over the icon, clamp to viewport.
      let left = r.left + r.width / 2 - POPOVER_W / 2;
      if (left < MARGIN) left = MARGIN;
      if (left + POPOVER_W > window.innerWidth - MARGIN) {
        left = window.innerWidth - POPOVER_W - MARGIN;
      }
      // Default below the icon; flip above if not enough room.
      const spaceBelow = window.innerHeight - r.bottom;
      const placeAbove = spaceBelow < popH + MARGIN && r.top > popH + MARGIN;
      const top = placeAbove ? Math.max(MARGIN, r.top - popH - 8) : r.bottom + 8;

      setCoords({ left, top });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("chartInfo.labels.what")}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center justify-center rounded-full p-0.5 -m-0.5 text-gray-600 hover:text-gray-400 transition-colors focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="fixed z-50 p-3.5 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl text-[11px] text-gray-300 pointer-events-none"
          style={{ left: coords.left, top: coords.top, width: POPOVER_W }}
        >
          <p className="text-xs font-semibold text-gray-100 mb-2.5 pb-2 border-b border-[#2a2a4a]">
            {title}
          </p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("chartInfo.labels.what")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">{t(`chartInfo.${infoKey}.what`)}</p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("chartInfo.labels.howToRead")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">{t(`chartInfo.${infoKey}.howToRead`)}</p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("chartInfo.labels.why")}
          </p>
          <p className="text-gray-400 leading-snug">{t(`chartInfo.${infoKey}.why`)}</p>
        </div>
      )}
    </>
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
  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
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
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
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
