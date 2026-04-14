/**
 * @file WorkflowStats.tsx
 * @description Defines the WorkflowStats component that displays key statistics about agent workflows in a dashboard format. It includes helper functions for formatting durations and determining success rate colors, as well as a reusable StatCard component for consistent styling of individual statistics. The component takes workflow statistics as props and renders them in a responsive grid layout with appropriate icons and accent colors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { GitFork, Users, CheckCircle, ArrowRightLeft, Layers, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowStats } from "../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDurationSec(sec: number): string {
  if (sec <= 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function successRateColor(rate: number): string {
  if (rate > 90) return "text-emerald-400";
  if (rate > 70) return "text-yellow-400";
  return "text-red-400";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass?: string;
}

function StatCard({ label, value, icon: Icon, accentClass = "text-accent" }: StatCardProps) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-none">
          {label}
        </span>
        <Icon className={`w-4 h-4 flex-shrink-0 ${accentClass}`} />
      </div>
      <span className={`text-2xl font-semibold leading-none truncate ${accentClass}`}>{value}</span>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface WorkflowStatsProps {
  stats: WorkflowStats;
}

export function WorkflowStats({ stats }: WorkflowStatsProps) {
  const topFlowLabel = stats.topFlow
    ? `${stats.topFlow.source} \u2192 ${stats.topFlow.target}`
    : "—";

  const srColor = successRateColor(stats.successRate);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        label="Avg Agent Depth"
        value={stats.avgDepth.toFixed(1)}
        icon={GitFork}
        accentClass="text-indigo-400"
      />
      <StatCard
        label="Avg Subagents / Session"
        value={stats.avgSubagents.toFixed(1)}
        icon={Users}
        accentClass="text-blue-400"
      />
      <StatCard
        label="Agent Success Rate"
        value={`${stats.successRate.toFixed(1)}%`}
        icon={CheckCircle}
        accentClass={srColor}
      />
      <StatCard
        label="Most Common Flow"
        value={topFlowLabel}
        icon={ArrowRightLeft}
        accentClass="text-violet-400"
      />
      <StatCard
        label="Avg Compactions"
        value={stats.avgCompactions.toFixed(1)}
        icon={Layers}
        accentClass="text-cyan-400"
      />
      <StatCard
        label="Avg Duration"
        value={formatDurationSec(stats.avgDurationSec)}
        icon={Clock}
        accentClass="text-amber-400"
      />
    </div>
  );
}
