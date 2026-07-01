/**
 * @file Dashboard.tsx
 * @description Main dashboard page showing real-time stats, active agents, and recent activity feed for Claude Code sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import {
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
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
  CircleDot,
  Server,
  HardDrive,
  Plug,
  Cpu,
  BarChart3,
  ShieldCheck,
  Database,
  Search,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { StatCard } from "../components/StatCard";
import { AgentCard } from "../components/AgentCard";
import { AgentStatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Tip } from "../components/Tip";
import { timeAgo, fmt, fmtCost, formatModelName } from "../lib/format";
import type { Stats, Agent, DashboardEvent, WSMessage, WorkflowData, Session } from "../lib/types";

interface SystemInfo {
  db: {
    path: string;
    size: number;
    counts: Record<string, number>;
    pragmas: {
      journal_mode: string;
      synchronous: number;
      auto_vacuum: number;
      encoding: string;
      foreign_keys: number;
      busy_timeout: number;
    };
    load_stats: { m5: number; m15: number; h1: number };
  };
  hooks: { installed: boolean; path: string; hooks: Record<string, boolean> };
  server: {
    uptime: number;
    node_version: string;
    platform: string;
    ws_connections: number;
    memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
    cpu_load: number[];
    arch: string;
    total_mem: number;
    free_mem: number;
    cpus: number;
  };
  transcript_cache: {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    keys: string[];
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SystemHealthTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [infoRes, workflowRes] = await Promise.all([api.settings.info(), api.workflows.get()]);
      setInfo(infoRes as any);
      setWorkflow(workflowRes);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const int = setInterval(loadData, 30000); // 30s is sufficient for health metrics
    return () => clearInterval(int);
  }, [loadData]);

  const stats = useMemo(() => {
    if (!info || !workflow) return null;

    const totalEntries =
      (info.db.counts?.sessions || 0) +
      (info.db.counts?.agents || 0) +
      (info.db.counts?.events || 0);
    const sessPct = totalEntries > 0 ? ((info.db.counts?.sessions || 0) / totalEntries) * 100 : 0;
    const agentPct = totalEntries > 0 ? ((info.db.counts?.agents || 0) / totalEntries) * 100 : 0;
    const eventPct = totalEntries > 0 ? ((info.db.counts?.events || 0) / totalEntries) * 100 : 0;

    const modelStats = (workflow.modelDelegation?.tokensByModel || [])
      .sort((a, b) => b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens))
      .slice(0, 6);
    const totalTokens = modelStats.reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0);

    const memUsedPct =
      info.server.total_mem > 0 ? (1 - info.server.free_mem / info.server.total_mem) * 100 : 0;
    const heapUsedPct =
      info.server.memory.heapTotal > 0
        ? (info.server.memory.heapUsed / info.server.memory.heapTotal) * 100
        : 0;

    return {
      totalEntries,
      sessPct,
      agentPct,
      eventPct,
      modelStats,
      totalTokens,
      memUsedPct,
      heapUsedPct,
    };
  }, [info, workflow]);

  if (!info || !workflow || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse h-48 bg-surface-2 rounded-2xl" />
        ))}
      </div>
    );
  }

  const {
    totalEntries,
    sessPct,
    agentPct,
    eventPct,
    modelStats,
    totalTokens,
    memUsedPct,
    heapUsedPct,
  } = stats;
  const successRate = Math.max(0, Math.min(100, workflow.stats.successRate));
  const errorRate = Math.max(
    0,
    Math.min(100, workflow.errorPropagation?.errorRate ?? 100 - successRate)
  );
  const cacheHitRate = Math.max(
    0,
    Math.min(
      100,
      ((info.transcript_cache?.hits ?? 0) /
        ((info.transcript_cache?.hits ?? 0) + (info.transcript_cache?.misses ?? 0) || 1)) *
        100
    )
  );

  // Concurrency histogram data
  const lanes = workflow.concurrency?.aggregateLanes || [];
  const maxLaneCount = Math.max(...lanes.map((l) => l.count), 1);

  // Tool flow top tools
  const topTools = (workflow.toolFlow?.toolCounts || []).slice(0, 8);
  const maxToolCount = topTools.length > 0 ? (topTools[0]?.count ?? 1) : 1;

  // Subagent effectiveness
  const effectiveness = (workflow.effectiveness || []).slice(0, 6);

  // Composite health score - clamped to [0, 100] for display safety
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      successRate * 0.4 +
        cacheHitRate * 0.25 +
        Math.max(0, 100 - errorRate) * 0.25 +
        Math.max(0, 100 - Math.min(100, heapUsedPct)) * 0.1
    )
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Row 1: Runtime + Storage + Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Runtime Environment */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Runtime</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">
              {info.server.cpus} cores · {info.server.arch}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28 flex-shrink-0">Uptime</span>
              <span className="text-xs text-gray-200 font-mono ml-auto">
                {formatUptime(info.server.uptime)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28 flex-shrink-0">CPU (1/5/15m)</span>
              <div className="flex gap-1 ml-auto">
                {(info.server.cpu_load || []).slice(0, 3).map((load, i) => (
                  <span
                    key={i}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${i === 0 && load > info.server.cpus ? "bg-red-500/20 text-red-400" : "bg-surface-3 text-gray-300"}`}
                  >
                    {load.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28 flex-shrink-0">Node RSS</span>
              <span className="text-xs text-gray-200 font-mono ml-auto">
                {formatBytes(info.server.memory.rss)}
              </span>
            </div>
          </div>

          <div className="border-t border-border/40 pt-3 space-y-3">
            <Tip
              block
              raw={`Host Memory: ${memUsedPct.toFixed(1)}% used\n${formatBytes(info.server.total_mem - info.server.free_mem)} / ${formatBytes(info.server.total_mem)}`}
            >
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Host Memory</span>
                  <span className="text-gray-400 font-mono">{memUsedPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-surface-3 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${memUsedPct > 90 ? "bg-red-500" : memUsedPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${memUsedPct}%` }}
                  />
                </div>
              </div>
            </Tip>
            <Tip
              block
              raw={`V8 Heap: ${heapUsedPct.toFixed(1)}% used\n${formatBytes(info.server.memory.heapUsed)} / ${formatBytes(info.server.memory.heapTotal)}\nExternal: ${formatBytes(info.server.memory.external)}`}
            >
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">V8 Heap</span>
                  <span className="text-gray-400 font-mono">{heapUsedPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-surface-3 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${heapUsedPct > 85 ? "bg-red-500" : heapUsedPct > 60 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${heapUsedPct}%` }}
                  />
                </div>
              </div>
            </Tip>
          </div>
        </div>

        {/* Storage Engine */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Storage</span>
            </div>
            <Tip
              raw={`Write velocity (events):\n5 min: ${info.db.load_stats?.m5 ?? 0}\n15 min: ${info.db.load_stats?.m15 ?? 0}\n1 hr: ${info.db.load_stats?.h1 ?? 0}`}
            >
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 cursor-default">
                ⚡ {info.db.load_stats?.m5 ?? 0}/{info.db.load_stats?.m15 ?? 0}/
                {info.db.load_stats?.h1 ?? 0}
              </span>
            </Tip>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">Database</span>
            <span className="text-xs text-gray-200 font-mono ml-auto">
              {formatBytes(info.db.size)} · {info.db.pragmas?.journal_mode?.toUpperCase() || "WAL"}
            </span>
          </div>

          {/* Pie chart + legend using same pattern as Analytics DonutChart */}
          <div className="flex items-center justify-center gap-5 flex-1">
            <Tip
              raw={`Record Distribution\n\nSessions: ${(info.db.counts?.sessions ?? 0).toLocaleString()} (${sessPct.toFixed(1)}%)\nAgents: ${(info.db.counts?.agents ?? 0).toLocaleString()} (${agentPct.toFixed(1)}%)\nEvents: ${(info.db.counts?.events ?? 0).toLocaleString()} (${eventPct.toFixed(1)}%)\n\nTotal: ${totalEntries.toLocaleString()} records`}
            >
              <svg
                width={96}
                height={96}
                viewBox="0 0 96 96"
                className="flex-shrink-0 cursor-default"
              >
                <circle cx="48" cy="48" r="38" fill="none" stroke="#1e1e2e" strokeWidth="14" />
                {(() => {
                  const r = 38,
                    cx = 48,
                    cy = 48,
                    circumference = 2 * Math.PI * r;
                  const segments = [
                    { pct: sessPct, color: "#60a5fa" },
                    { pct: agentPct, color: "#8b5cf6" },
                    { pct: eventPct, color: "#34d399" },
                  ];
                  let offset = circumference / 4;
                  return segments.map((seg, i) => {
                    if (seg.pct <= 0) return null;
                    const dash = (seg.pct / 100) * circumference;
                    const gap = circumference - dash;
                    const currentOffset = offset;
                    offset -= dash;
                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={currentOffset}
                      />
                    );
                  });
                })()}
                <text
                  x="48"
                  y="46"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-300"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {totalEntries > 999 ? `${(totalEntries / 1000).toFixed(1)}K` : totalEntries}
                </text>
                <text
                  x="48"
                  y="60"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-600"
                  fontSize="8"
                >
                  total
                </text>
              </svg>
            </Tip>
            <div className="space-y-2.5">
              {[
                {
                  label: "Sessions",
                  value: info.db.counts?.sessions ?? 0,
                  color: "#60a5fa",
                  pct: sessPct,
                },
                {
                  label: "Agents",
                  value: info.db.counts?.agents ?? 0,
                  color: "#8b5cf6",
                  pct: agentPct,
                },
                {
                  label: "Events",
                  value: info.db.counts?.events ?? 0,
                  color: "#34d399",
                  pct: eventPct,
                },
              ].map((item) => (
                <Tip
                  block
                  key={item.label}
                  raw={`${item.label}: ${item.value.toLocaleString()} (${item.pct.toFixed(1)}%)`}
                >
                  <div className="flex items-center gap-2 text-xs cursor-default">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-gray-500 ml-auto pl-3 font-mono">
                      {Math.round(item.pct)}%
                    </span>
                  </div>
                </Tip>
              ))}
            </div>
          </div>
        </div>

        {/* Health Score */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Health Score</span>
            </div>
            <Tip
              raw={`Composite Index formula:\n0.4 × Success Rate (${successRate.toFixed(1)}%)\n+ 0.25 × Cache Hit (${cacheHitRate.toFixed(1)}%)\n+ 0.25 × (100 − Error Rate) (${(100 - errorRate).toFixed(1)}%)\n+ 0.10 × (100 − Heap%) (${(100 - heapUsedPct).toFixed(1)}%)\n= ${healthScore.toFixed(1)}`}
            >
              <span className="text-[10px] text-gray-500 cursor-help border-b border-dashed border-gray-700">
                ⓘ Formula
              </span>
            </Tip>
          </div>

          {/* Ring gauge - centered */}
          <div className="flex items-center justify-center flex-1">
            <Tip
              raw={`Score: ${healthScore.toFixed(1)} / 100\n\n• Success Rate (40%): ${successRate.toFixed(1)}%\n• Cache Hit (25%): ${cacheHitRate.toFixed(1)}%\n• Error Avoidance (25%): ${(100 - errorRate).toFixed(1)}%\n• Memory Health (10%): ${(100 - heapUsedPct).toFixed(1)}%`}
            >
              <svg width="120" height="120" viewBox="0 0 120 120" className="cursor-default">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#1e1e2e" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke={healthScore >= 90 ? "#34d399" : healthScore >= 70 ? "#fbbf24" : "#f87171"}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${healthScore * 3.016} ${301.6 - healthScore * 3.016}`}
                  strokeDashoffset={301.6 / 4}
                  className="transition-all duration-1000"
                />
                <text
                  x="60"
                  y="57"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-100"
                  fontSize="24"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  {healthScore.toFixed(0)}
                </text>
                <text
                  x="60"
                  y="76"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-600"
                  fontSize="9"
                  fontWeight="500"
                >
                  / 100
                </text>
              </svg>
            </Tip>
          </div>

          {/* Sub-metrics row */}
          <div className="grid grid-cols-4 gap-2 border-t border-border/40 pt-3">
            <Tip
              block
              raw={`Cache Hit Rate: ${cacheHitRate.toFixed(1)}%\nHits: ${info.transcript_cache?.hits ?? 0}\nMisses: ${info.transcript_cache?.misses ?? 0}`}
            >
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Cache</p>
                <p className="text-xs font-mono font-bold text-blue-400">
                  {cacheHitRate.toFixed(0)}%
                </p>
              </div>
            </Tip>
            <Tip
              block
              raw={`Error Rate: ${errorRate.toFixed(2)}%\n<5% = healthy, 5-15% = warning, >15% = critical`}
            >
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Errors</p>
                <p
                  className={`text-xs font-mono font-bold ${errorRate < 5 ? "text-emerald-400" : errorRate < 15 ? "text-amber-400" : "text-red-400"}`}
                >
                  {errorRate.toFixed(1)}%
                </p>
              </div>
            </Tip>
            <Tip
              block
              raw={`Transcript compactions: ${workflow.compaction?.totalCompactions ?? 0}\nReduces context window by summarizing turns.`}
            >
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Compact</p>
                <p className="text-xs font-mono font-bold text-violet-400">
                  {workflow.compaction?.totalCompactions ?? 0}
                </p>
              </div>
            </Tip>
            <Tip
              block
              raw={`Tokens recovered: ${(workflow.compaction?.tokensRecovered ?? 0).toLocaleString()}\nFreed by compaction.`}
            >
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Saved</p>
                <p className="text-xs font-mono font-bold text-emerald-400">
                  {((workflow.compaction?.tokensRecovered ?? 0) / 1000).toFixed(1)}K
                </p>
              </div>
            </Tip>
          </div>
        </div>
      </div>

      {/* Row 2: Model Usage + Concurrency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Token Distribution */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Token Usage</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">
              {(totalTokens / 1000).toFixed(1)}K total
            </span>
          </div>

          <div className="space-y-2.5">
            {modelStats.map((m, i) => {
              const pct =
                totalTokens > 0 ? ((m.input_tokens + m.output_tokens) / totalTokens) * 100 : 0;
              const colors = [
                "bg-blue-400",
                "bg-violet-400",
                "bg-emerald-400",
                "bg-amber-400",
                "bg-pink-400",
                "bg-cyan-400",
              ];
              return (
                <Tip
                  block
                  key={i}
                  raw={`${formatModelName(m.model) ?? m.model}\nInput: ${m.input_tokens.toLocaleString()}\nOutput: ${m.output_tokens.toLocaleString()}\nCache Read: ${m.cache_read_tokens.toLocaleString()}\nShare: ${pct.toFixed(1)}%`}
                >
                  <div className="flex items-center gap-3 cursor-default">
                    <span
                      className="text-xs text-gray-400 w-28 truncate flex-shrink-0"
                      title={formatModelName(m.model) ?? m.model}
                    >
                      {formatModelName(m.model) ?? m.model}
                    </span>
                    <div className="flex-1 bg-surface-3 rounded-full h-2">
                      <div
                        className={`${colors[i % colors.length]} h-2 rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0 font-mono">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </Tip>
              );
            })}
            {modelStats.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-4">No model data</p>
            )}
          </div>
        </div>

        {/* Concurrency Timeline */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Concurrency</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">{lanes.length} intervals</span>
          </div>

          {/* Sparkline-style bar chart matching Analytics sparkline */}
          <Tip
            block
            raw={`Peak: ${maxLaneCount} parallel sessions\nActive intervals: ${lanes.filter((l) => l.count > 0).length}\nAvg: ${lanes.length > 0 ? (lanes.reduce((s, l) => s + l.count, 0) / lanes.length).toFixed(1) : "0"}`}
          >
            <div className="flex items-end gap-px h-20 cursor-default">
              {lanes.slice(-Math.min(lanes.length, 40)).map((lane, i) => {
                const barPct =
                  maxLaneCount > 0 ? Math.max(4, Math.round((lane.count / maxLaneCount) * 100)) : 4;
                const color =
                  lane.count > 5
                    ? "#f87171"
                    : lane.count > 2
                      ? "#fbbf24"
                      : lane.count > 0
                        ? "#34d399"
                        : "#1e1e2e";
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${barPct}%`,
                      backgroundColor: color,
                      opacity: lane.count === 0 ? 0.2 : 0.85,
                    }}
                  />
                );
              })}
              {lanes.length === 0 && (
                <p className="text-xs text-gray-600 text-center w-full self-center">
                  No concurrency data
                </p>
              )}
            </div>
          </Tip>

          <div className="grid grid-cols-3 gap-3 border-t border-border/40 pt-3">
            <Tip block raw={`Peak: ${maxLaneCount} sessions running simultaneously.`}>
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Peak</p>
                <p className="text-sm font-mono font-bold text-gray-200">{maxLaneCount}</p>
              </div>
            </Tip>
            <Tip
              block
              raw={`${lanes.filter((l) => l.count > 0).length} of ${lanes.length} intervals have active sessions.`}
            >
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Active</p>
                <p className="text-sm font-mono font-bold text-emerald-400">
                  {lanes.filter((l) => l.count > 0).length}
                </p>
              </div>
            </Tip>
            <Tip block raw={`Average concurrency across all intervals.`}>
              <div className="text-center cursor-default">
                <p className="text-[9px] text-gray-600 uppercase">Avg</p>
                <p className="text-sm font-mono font-bold text-blue-400">
                  {lanes.length > 0
                    ? (lanes.reduce((s, l) => s + l.count, 0) / lanes.length).toFixed(1)
                    : "0"}
                </p>
              </div>
            </Tip>
          </div>
        </div>
      </div>

      {/* Row 3: Tool Usage + Subagent Effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tool Invocations */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Tool Usage</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">top {topTools.length}</span>
          </div>

          <div className="space-y-2">
            {topTools.map((tool, i) => {
              const pct = maxToolCount > 0 ? Math.round((tool.count / maxToolCount) * 100) : 0;
              const colors = [
                "bg-amber-400",
                "bg-blue-400",
                "bg-emerald-400",
                "bg-violet-400",
                "bg-pink-400",
                "bg-cyan-400",
                "bg-red-400",
                "bg-indigo-400",
              ];
              return (
                <Tip
                  block
                  key={i}
                  raw={`${tool.tool_name}: ${tool.count.toLocaleString()} invocations`}
                >
                  <div className="flex items-center gap-3 cursor-default">
                    <span
                      className="text-xs text-gray-400 w-28 truncate flex-shrink-0"
                      title={tool.tool_name}
                    >
                      {tool.tool_name}
                    </span>
                    <div className="flex-1 bg-surface-3 rounded-full h-2">
                      <div
                        className={`${colors[i % colors.length]} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0 font-mono">
                      {tool.count > 999 ? `${(tool.count / 1000).toFixed(1)}K` : tool.count}
                    </span>
                  </div>
                </Tip>
              );
            })}
            {topTools.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-6">No tool data yet</p>
            )}
          </div>
        </div>

        {/* Subagent Effectiveness */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                Subagent Effectiveness
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {effectiveness.map((item, i) => {
              const color =
                item.successRate >= 90
                  ? "bg-emerald-400"
                  : item.successRate >= 70
                    ? "bg-amber-400"
                    : "bg-red-400";
              return (
                <Tip
                  block
                  key={i}
                  raw={`${item.subagent_type || "default"}\nSuccess: ${item.successRate.toFixed(1)}%\nTotal: ${item.total} · OK: ${item.completed} · Errors: ${item.errors}`}
                >
                  <div className="flex items-center gap-3 cursor-default">
                    <span className="text-xs text-gray-400 w-28 truncate flex-shrink-0">
                      {item.subagent_type || "default"}
                    </span>
                    <div className="flex-1 bg-surface-3 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${item.successRate}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs w-12 text-right flex-shrink-0 font-mono ${item.successRate >= 90 ? "text-emerald-400" : item.successRate >= 70 ? "text-amber-400" : "text-red-400"}`}
                    >
                      {item.successRate.toFixed(0)}%
                    </span>
                  </div>
                </Tip>
              );
            })}
            {effectiveness.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-6">No subagent data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Integration Gateway + Platform Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Integration Gateway */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plug className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Integration</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${info.hooks.installed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-surface-3 text-gray-500 border border-border"}`}
            >
              {info.hooks.installed ? "Active" : "Offline"}
            </span>
          </div>

          {Object.entries(info.hooks.hooks || {}).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(info.hooks.hooks).map(([cwd, active]) => (
                <Tip
                  block
                  key={cwd}
                  raw={`Path: ${cwd}\nStatus: ${active ? "Connected" : "Disconnected"}`}
                >
                  <div className="flex items-center gap-3 bg-surface-2/50 px-3 py-2 rounded-lg border border-border/30 cursor-default">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-emerald-400" : "bg-gray-600"}`}
                    />
                    <span className="text-xs text-gray-300 truncate font-mono">
                      {cwd.split("/").pop() || cwd}
                    </span>
                  </div>
                </Tip>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 border border-dashed border-border/40 rounded-lg">
              <Search className="w-4 h-4 text-gray-600 mb-2" />
              <p className="text-xs text-gray-500">No project hooks registered</p>
            </div>
          )}

          <Tip
            block
            raw={`WebSocket connections: ${info.server.ws_connections}\nProtocol: RFC 6455`}
          >
            <div className="flex items-center gap-3 bg-emerald-500/5 px-3 py-2.5 rounded-lg border border-emerald-500/10 cursor-default">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <div>
                <p className="text-[10px] text-emerald-400 font-medium">WebSocket Active</p>
                <p className="text-[10px] text-gray-500">
                  {info.server.ws_connections} connection
                  {info.server.ws_connections !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </Tip>
        </div>

        {/* Platform Config */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">Platform</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">{info.server.node_version}</span>
          </div>

          <div className="space-y-2">
            {[
              {
                label: "Journal Mode",
                value: info.db.pragmas?.journal_mode?.toUpperCase() || "WAL",
              },
              {
                label: "Synchronous",
                value:
                  info.db.pragmas?.synchronous === 2
                    ? "FULL"
                    : info.db.pragmas?.synchronous === 1
                      ? "NORMAL"
                      : "OFF",
              },
              { label: "Auto-Vacuum", value: info.db.pragmas?.auto_vacuum > 0 ? "FULL" : "OFF" },
              { label: "Foreign Keys", value: info.db.pragmas?.foreign_keys ? "ON" : "OFF" },
              { label: "Busy Timeout", value: `${info.db.pragmas?.busy_timeout || 5000}ms` },
              { label: "Platform", value: `${info.server.platform} / ${info.server.arch}` },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-28 flex-shrink-0">{row.label}</span>
                <span className="text-xs text-gray-200 font-mono ml-auto">{row.value}</span>
              </div>
            ))}
          </div>

          <Tip block raw={info.db.path}>
            <div className="flex items-center gap-2 bg-surface-2/50 px-3 py-2 rounded-lg border border-border/30 cursor-default">
              <HardDrive className="w-3 h-3 text-gray-500 flex-shrink-0" />
              <span className="text-[10px] text-gray-400 font-mono truncate">{info.db.path}</span>
            </div>
          </Tip>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");

  // Persistent Tab State
  const [activeTab, setActiveTab] = useState<"monitor" | "health">(() => {
    return (localStorage.getItem("dashboard_tab") as "monitor" | "health") || "monitor";
  });

  useEffect(() => {
    localStorage.setItem("dashboard_tab", activeTab);
  }, [activeTab]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [recentEvents, setRecentEvents] = useState<DashboardEvent[]>([]);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [allSubagents, setAllSubagents] = useState<Agent[]>([]);
  const [sessionsById, setSessionsById] = useState<Map<string, Session>>(new Map());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Dynamic item counts based on available container height
  const agentsContainerRef = useRef<HTMLDivElement>(null);
  const activityContainerRef = useRef<HTMLDivElement>(null);
  const [visibleAgentCount, setVisibleAgentCount] = useState(5);
  const [visibleActivityCount, setVisibleActivityCount] = useState(8);

  useEffect(() => {
    const AGENT_ROW_H = 56; // ~px per agent card row
    const ACTIVITY_ROW_H = 44; // ~px per activity row
    const HEADER_H = 40; // section header height

    function recalc() {
      if (agentsContainerRef.current) {
        const h = agentsContainerRef.current.clientHeight;
        setVisibleAgentCount(Math.max(3, Math.floor((h - HEADER_H) / AGENT_ROW_H)));
      }
      if (activityContainerRef.current) {
        const h = activityContainerRef.current.clientHeight;
        setVisibleActivityCount(Math.max(3, Math.floor((h - HEADER_H) / ACTIVITY_ROW_H)));
      }
    }

    const ro = new ResizeObserver(recalc);
    if (agentsContainerRef.current) ro.observe(agentsContainerRef.current);
    if (activityContainerRef.current) ro.observe(activityContainerRef.current);
    recalc();

    return () => ro.disconnect();
  }, [activeTab]);

  const load = useCallback(async () => {
    try {
      const [statsRes, workingRes, waitingRes, eventsRes, costRes, sessionsRes] = await Promise.all(
        [
          api.stats.get(),
          api.agents.list({ status: "working", limit: 20 }),
          api.agents.list({ status: "waiting", limit: 20 }),
          api.events.list({ limit: 30 }),
          api.pricing.totalCost(),
          api.sessions.list({ status: "active", limit: 100 }),
        ]
      );
      setStats(statsRes);
      const active = [...workingRes.agents, ...waitingRes.agents];
      setActiveAgents(active);
      setRecentEvents(eventsRes.events);
      setTotalCost(costRes.total_cost);
      setSessionsById(new Map(sessionsRes.sessions.map((s) => [s.id, s])));
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
      if (a.parent_agent_id && a.status === "working") {
        parentsWithActive.add(a.parent_agent_id);
      }
    }
    if (parentsWithActive.size === 0) return; // No-op: skip state update entirely

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
    setExpandedAgents((prev) => {
      // Only update if there are genuinely new IDs to add
      const newIds = [...toExpand].filter((id) => !prev.has(id));
      if (newIds.length === 0) return prev; // Stable reference - no re-render
      return new Set([...prev, ...newIds]);
    });
  }, [allSubagents]);

  useEffect(() => {
    const debounceRef = { timer: null as ReturnType<typeof setTimeout> | null };
    return eventBus.subscribe((msg: WSMessage) => {
      if (
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_created" ||
        msg.type === "session_updated"
      ) {
        // Debounce rapid-fire updates (e.g., 5 agents created in 100ms)
        if (debounceRef.timer) clearTimeout(debounceRef.timer);
        debounceRef.timer = setTimeout(load, 300);
      }
      if (msg.type === "new_event") {
        setRecentEvents((prev) => {
          const newEvent = msg.data as DashboardEvent;
          // Deduplicate by event ID to prevent WS + polling race condition
          if (newEvent.id && prev.some((e) => e.id === newEvent.id)) return prev;
          return [newEvent, ...prev.slice(0, 14)];
        });
      }
    });
  }, [load]);

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  // Memoize agent tree structure to avoid recalculating on every render
  const agentTree = useMemo(() => {
    const childrenByParent = new Map<string, Agent[]>();
    for (const a of allSubagents) {
      if (a.parent_agent_id) {
        const list = childrenByParent.get(a.parent_agent_id) || [];
        list.push(a);
        childrenByParent.set(a.parent_agent_id, list);
      }
    }

    // Pre-compute descendant counts with memoization (avoids exponential recursion)
    const descendantCache = new Map<string, { total: number; active: number }>();
    function getDescendants(id: string): { total: number; active: number } {
      if (descendantCache.has(id)) return descendantCache.get(id)!;
      // Seed a zero sentinel before recursing so a cyclic parent_agent_id
      // (corrupt data) resolves to the cached value instead of looping forever.
      descendantCache.set(id, { total: 0, active: 0 });
      const kids = childrenByParent.get(id) || [];
      const result = kids.reduce(
        (acc, k) => {
          const child = getDescendants(k.id);
          return {
            total: acc.total + 1 + child.total,
            active: acc.active + (k.status === "working" ? 1 : 0) + child.active,
          };
        },
        { total: 0, active: 0 }
      );
      descendantCache.set(id, result);
      return result;
    }
    // Pre-warm cache for all nodes
    for (const a of allSubagents) getDescendants(a.id);

    return { childrenByParent, getDescendants };
  }, [allSubagents]);

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
    <div className="flex flex-col gap-8 animate-fade-in min-h-[calc(100vh-4rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <LayoutDashboard className="w-4.5 h-4.5 text-accent" />
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
        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setActiveTab("monitor")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === "monitor"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Monitor
            </button>
            <button
              onClick={() => setActiveTab("health")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === "health"
                  ? "bg-accent/15 text-accent shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Server className="w-3.5 h-3.5" /> Health
            </button>
          </div>
          <button onClick={load} className="btn-ghost flex-shrink-0">
            <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
          </button>
        </div>
      </div>

      {activeTab === "monitor" ? (
        <div className="flex-1 flex flex-col gap-8 min-h-0">
          {/* Stats grid - 2 rows of 3 avoids the 6-column squeeze */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label={t("totalSessions")}
              value={stats ? fmt(stats.total_sessions) : ""}
              raw={stats ? stats.total_sessions.toLocaleString() : undefined}
              icon={FolderOpen}
              trend={stats ? `${stats.active_sessions}${t("activeTrend")}` : undefined}
              loading={!stats}
            />
            <StatCard
              label={t("activeAgents")}
              value={stats?.active_agents ?? ""}
              icon={Bot}
              accentColor="text-emerald-400"
              loading={!stats}
            />
            <StatCard
              label={t("activeSubagents")}
              value={stats ? allSubagents.filter((a) => a.status === "working").length : ""}
              icon={GitBranch}
              accentColor="text-violet-400"
              trend={stats ? `${allSubagents.length}${t("totalTrend")}` : undefined}
              loading={!stats}
            />
            <StatCard
              label={t("eventsToday")}
              value={stats ? fmt(stats.events_today) : ""}
              raw={stats ? stats.events_today.toLocaleString() : undefined}
              icon={Zap}
              accentColor="text-yellow-400"
              loading={!stats}
            />
            <StatCard
              label={t("totalEvents")}
              value={stats ? fmt(stats.total_events) : ""}
              raw={stats ? stats.total_events.toLocaleString() : undefined}
              icon={Activity}
              accentColor="text-violet-400"
              loading={!stats}
            />
            <StatCard
              label={t("totalCost")}
              value={totalCost !== null ? fmtCost(totalCost) : ""}
              raw={
                totalCost !== null
                  ? `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : undefined
              }
              icon={DollarSign}
              accentColor="text-emerald-400"
              loading={totalCost === null}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-0 min-w-0 flex-1 min-h-0">
            {/* Active agents */}
            <div ref={agentsContainerRef} className="min-w-0 overflow-y-auto pr-6">
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
                    const { childrenByParent, getDescendants } = agentTree;

                    function renderAgentNode(
                      agent: Agent,
                      depth: number,
                      ancestors: Set<string> = new Set()
                    ): ReactNode {
                      // Guard against a cyclic parent_agent_id (corrupt data) so
                      // the recursive render can't stack-overflow the page.
                      if (ancestors.has(agent.id)) return null;
                      const childAncestors = new Set(ancestors).add(agent.id);
                      const children = childrenByParent.get(agent.id) || [];
                      const isExpanded = expandedAgents.has(agent.id);
                      const hasChildren = children.length > 0;
                      const isSubagent = depth > 0;
                      const { total: totalDesc, active: activeDesc } = hasChildren
                        ? getDescendants(agent.id)
                        : { total: 0, active: 0 };
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
                            {/* Reserve the chevron column even when this row
                                has no chevron - without this, peer top-level
                                mains would line up at different x positions
                                depending on whether they have subagents,
                                making chevron-having mains look indented
                                like a subagent of the chevron-less main
                                above them. A muted leaf-marker icon fills
                                the slot so the column reads as deliberately
                                empty rather than as a misalignment. */}
                            {!hasChildren && !isSubagent && (
                              <span
                                className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-violet-400/70"
                                aria-hidden="true"
                                title={t("common:noSubagents", "No subagents")}
                              >
                                <CircleDot className="w-4 h-4" strokeWidth={2} />
                              </span>
                            )}
                            {isSubagent && (
                              <GitBranch className="w-3 h-3 text-violet-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <AgentCard
                                agent={agent}
                                session={sessionsById.get(agent.session_id)}
                                // Card click always navigates (AgentCard's
                                // default → session details), whether or not it
                                // has children. Expand/collapse is handled solely
                                // by the chevron button, so clicking a parent
                                // (incl. the main agent) no longer toggles.
                                onClick={undefined}
                              />
                            </div>
                          </div>

                          {hasChildren && isExpanded && (
                            <div className="ml-6 mt-1 space-y-1 border-l-2 border-violet-500/20 pl-3">
                              {children.map((child) =>
                                renderAgentNode(child, depth + 1, childAncestors)
                              )}
                            </div>
                          )}

                          {hasChildren && !isExpanded && (
                            <button
                              onClick={() =>
                                setExpandedAgents((prev) => new Set([...prev, agent.id]))
                              }
                              className="ml-7 mt-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                            >
                              {t("common:subagent_label", { count: totalDesc })}
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

                    // Build the set of agent ids that will be rendered as
                    // descendants under the visible main-agent trees, so the
                    // orphan-subagent block below doesn't render them a
                    // second time at the root. Previously the orphan filter
                    // was `a.type === "subagent"` with no parentage check,
                    // which surfaced every nested subagent twice: once
                    // indented under its main, and once flush at root level.
                    const visibleMains = activeAgents
                      .filter((a) => a.type === "main")
                      .slice(0, visibleAgentCount);
                    const renderedInTree = new Set<string>();
                    for (const m of visibleMains) {
                      const stack: string[] = [m.id];
                      while (stack.length) {
                        const id = stack.pop()!;
                        if (renderedInTree.has(id)) continue;
                        renderedInTree.add(id);
                        for (const child of childrenByParent.get(id) || []) {
                          stack.push(child.id);
                        }
                      }
                    }

                    return (
                      <>
                        {visibleMains.map((main) => renderAgentNode(main, 0))}
                        {/* Only true orphans: subagents whose ancestor chain
                            isn't already shown in a tree above. */}
                        {activeAgents
                          .filter((a) => a.type === "subagent" && !renderedInTree.has(a.id))
                          .map((agent) => (
                            <div key={agent.id}>
                              <AgentCard
                                agent={agent}
                                session={sessionsById.get(agent.session_id)}
                              />
                            </div>
                          ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="hidden lg:block w-px bg-border self-stretch" />

            {/* Recent activity */}
            <div ref={activityContainerRef} className="min-w-0 overflow-y-auto pl-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">{t("recentActivity")}</h3>
                <button onClick={() => navigate("/activity")} className="btn-ghost text-xs">
                  {t("viewAll")} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {recentEvents.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title={t("noActivity")}
                  description={t("noActivityDesc")}
                />
              ) : (
                <div className="card divide-y divide-border">
                  {recentEvents.slice(0, visibleActivityCount).map((event, i) => (
                    <div
                      key={event.id ?? i}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-surface-4 transition-colors cursor-pointer"
                      onClick={() => navigate(`/sessions/${event.session_id}`)}
                    >
                      <AgentStatusBadge
                        status={
                          event.event_type === "Stop"
                            ? event.summary?.toLowerCase().includes("error")
                              ? "error"
                              : "completed"
                            : event.event_type === "APIError" ||
                                event.summary?.toLowerCase().includes("error")
                              ? "error"
                              : event.event_type === "PreToolUse"
                                ? "working"
                                : "waiting"
                        }
                      />
                      <span className="text-sm text-gray-300 truncate flex-1">
                        {event.summary || event.event_type}
                      </span>
                      {(() => {
                        // Session label: real name when one exists, else the
                        // short ID - keeps every activity row attributable.
                        const sname = sessionsById.get(event.session_id)?.name?.trim() || "";
                        const isAuto = /^Session [0-9a-f]{8}$/i.test(sname);
                        return (
                          <span
                            className="text-[11px] text-gray-500 truncate max-w-[9rem] flex-shrink-0"
                            title={event.session_id}
                          >
                            {sname && !isAuto ? (
                              sname
                            ) : (
                              <span className="font-mono">{event.session_id.slice(0, 8)}</span>
                            )}
                          </span>
                        );
                      })()}
                      {event.tool_name && (
                        <span className="text-[11px] text-gray-500 font-mono">
                          {event.tool_name}
                        </span>
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
      ) : (
        <SystemHealthTab />
      )}
    </div>
  );
}
